import secrets
from datetime import timedelta
from typing import Annotated, Any

from authlib.integrations.starlette_client import OAuth  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select

from app.access import DB, Current, authenticated, digest, permit
from app.contracts import Problem
from app.db import now
from app.models import LoginSession, MemberRole, Membership, Organization, User

router = APIRouter(prefix="/api/v1")


class Login(BaseModel):
    model_config = ConfigDict(extra="forbid")
    return_to: str = "/workspace"


async def provider(request: Request) -> Any:
    settings = request.app.state.settings
    if not settings.oidc_issuer or not settings.oidc_client_id or not settings.session_secret:
        raise Problem(503, "DEPENDENCY_UNAVAILABLE", "Identity provider not configured")
    oauth = OAuth()
    oauth.register(
        "idp",
        client_id=settings.oidc_client_id,
        client_secret=settings.oidc_client_secret,
        server_metadata_url=(settings.oidc_backchannel or settings.oidc_issuer).rstrip("/")
        + "/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
    )
    client = oauth.create_client("idp")
    metadata = await client.load_server_metadata()
    if settings.oidc_backchannel:
        for key in ("token_endpoint", "jwks_uri", "userinfo_endpoint"):
            if key in metadata:
                metadata[key] = metadata[key].replace(
                    settings.oidc_issuer, settings.oidc_backchannel, 1
                )
    return client


@router.post("/auth/login")
async def login(payload: Login, request: Request) -> dict[str, str]:
    if payload.return_to not in {"/workspace", "/"}:
        raise Problem(422, "VALIDATION_ERROR", "Invalid return path")
    client = await provider(request)
    request.session["return_to"] = payload.return_to
    response = await client.authorize_redirect(request, request.app.state.settings.oidc_callback)
    return {"authorization_url": response.headers["location"]}


@router.get("/auth/callback")
async def callback(request: Request, db: DB) -> Response:
    try:
        client = await provider(request)
        token = await client.authorize_access_token(request)
        claims = token["userinfo"]
        subject = claims["iss"] + "|" + claims["sub"]
        if claims["iss"].rstrip("/") != request.app.state.settings.oidc_issuer.rstrip("/"):
            raise ValueError()
    except Exception:
        raise Problem(401, "AUTH_REQUIRED", "Identity validation failed") from None
    user = db.scalar(select(User).where(User.identity_subject == subject, User.status == "ACTIVE"))
    if not user:
        raise Problem(403, "PERMISSION_DENIED", "Identity must be provisioned by an administrator")
    raw, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    db.add(
        LoginSession(
            user_id=user.id,
            token_hash=digest(raw),
            csrf_hash=digest(csrf),
            expires_at=now() + timedelta(hours=8),
        )
    )
    response = RedirectResponse(
        request.app.state.settings.web_origin + request.session.pop("return_to", "/workspace"),
        status_code=303,
    )
    request.session.clear()
    response.set_cookie(
        "cc_session",
        raw,
        httponly=True,
        secure=request.app.state.settings.secure_cookies,
        samesite="lax",
        max_age=28800,
    )
    response.set_cookie(
        "cc_csrf",
        csrf,
        httponly=False,
        secure=request.app.state.settings.secure_cookies,
        samesite="lax",
        max_age=28800,
    )
    return response


@router.post("/auth/logout", status_code=204)
def logout(request: Request, db: DB, user: Annotated[User, Depends(authenticated)]) -> Response:
    record = db.scalar(
        select(LoginSession).where(
            LoginSession.token_hash == digest(request.cookies.get("cc_session", ""))
        )
    )
    if record:
        db.delete(record)
    response = Response(status_code=204)
    response.delete_cookie("cc_session")
    response.delete_cookie("cc_csrf")
    return response


@router.get("/auth/me")
def me(db: DB, user: Annotated[User, Depends(authenticated)]) -> dict[str, Any]:
    memberships = []
    for item in db.scalars(
        select(Membership).where(Membership.user_id == user.id, Membership.status == "ACTIVE")
    ):
        memberships.append(
            {
                "organization_id": item.organization_id,
                "status": item.status,
                "roles": list(
                    db.scalars(select(MemberRole.role).where(MemberRole.membership_id == item.id))
                ),
            }
        )
    return {
        "user": {"id": user.id, "email": user.email, "name": user.name},
        "memberships": memberships,
    }


@router.get("/organizations/current")
def organization(db: DB, current: Current) -> dict[str, Any]:
    item = db.get(Organization, current.organization_id)
    assert item
    return {"organization": {"id": item.id, "name": item.name, "status": item.status}}


@router.get("/organizations/current/members")
def members(db: DB, current: Current) -> dict[str, Any]:
    permit(current, "ADMIN")
    return {
        "items": [
            {
                "id": item.id,
                "user_id": item.user_id,
                "status": item.status,
                "roles": list(
                    db.scalars(select(MemberRole.role).where(MemberRole.membership_id == item.id))
                ),
            }
            for item in db.scalars(
                select(Membership).where(Membership.organization_id == current.organization_id)
            )
        ],
        "next_cursor": None,
    }
