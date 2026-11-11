import hashlib
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Query, Request, Response, UploadFile
from pydantic import Field
from sqlalchemy import or_, select, true

from app.access import DB, Current, audit, owned, permit, remember, replay
from app.analytics import Rules
from app.contracts import Problem, UTCDateTime, etag, request_hash, require_match
from app.db import now
from app.models import Organization, Policy, Product, ReferenceDocument
from app.shipments import Strict, page, serialized
from app.storage import S3Store

router = APIRouter(prefix="/api/v1")


class PolicyInput(Strict):
    product_id: UUID
    policy_key: str = Field(min_length=1, max_length=100)
    version: int = Field(gt=0)
    reference_document_id: UUID | None = None
    effective_from: UTCDateTime
    effective_to: UTCDateTime | None = None
    rules: Rules


class Note(Strict):
    note: str | None = Field(default=None, max_length=4000)
    approval_note: str | None = Field(default=None, max_length=4000)
    reason: str | None = Field(default=None, max_length=4000)


@router.post("/reference-documents", status_code=201)
async def reference(
    request: Request, db: DB, current: Current, file: UploadFile = File(...)
) -> dict[str, Any]:
    permit(current, "ADMIN", "QA")
    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise Problem(413, "FILE_TOO_LARGE", "Reference exceeds 10 MB")
    if not content:
        raise Problem(422, "VALIDATION_ERROR", "Reference cannot be empty")
    identifier = str(uuid4())
    digest = hashlib.sha256(content).hexdigest()
    key = f"{current.organization_id}/references/{identifier}/{digest}"
    store = getattr(request.app.state, "store", None) or S3Store(request.app.state.settings)
    store.put(key, content, "application/octet-stream")
    item = ReferenceDocument(
        id=identifier,
        organization_id=current.organization_id,
        object_key=key,
        sha256=digest,
        filename=(file.filename or "reference")[:200],
        uploaded_by=current.user_id,
    )
    db.add(item)
    db.flush()
    return {"reference_document": {"id": item.id, "sha256": digest}}


@router.post("/quality-policies", status_code=201)
def create(payload: PolicyInput, request: Request, db: DB, current: Current) -> dict[str, Any]:
    permit(current, "ADMIN", "QA")
    owned(db, Product, str(payload.product_id), current)
    if payload.reference_document_id:
        owned(db, ReferenceDocument, str(payload.reference_document_id), current)
    if payload.effective_to and payload.effective_to <= payload.effective_from:
        raise Problem(422, "VALIDATION_ERROR", "Invalid effective interval")
    item = Policy(
        organization_id=current.organization_id,
        product_id=str(payload.product_id),
        policy_key=payload.policy_key,
        version=payload.version,
        reference_document_id=str(payload.reference_document_id)
        if payload.reference_document_id
        else None,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        rules=payload.rules.model_dump(mode="json"),
        created_by=current.user_id,
    )
    db.add(item)
    db.flush()
    body = {"quality_policy": serialized(item)}
    audit(db, current, request, "CREATE", "policy", item.id, body)
    return body


@router.get("/quality-policies")
def policies(
    db: DB,
    current: Current,
    product_id: UUID | None = None,
    status: str | None = None,
    limit: int = Query(25, ge=1, le=100),
    cursor: str | None = None,
) -> dict[str, Any]:
    filters = []
    if product_id:
        filters.append(Policy.product_id == str(product_id))
    if status:
        filters.append(Policy.status == status)
    return page(db, current, Policy, limit, cursor, f"policies:{product_id}:{status}", filters)


@router.get("/quality-policies/{policy_id}")
def policy(policy_id: UUID, response: Response, db: DB, current: Current) -> dict[str, Any]:
    item = owned(db, Policy, str(policy_id), current)
    response.headers["ETag"] = etag("policy", item.revision)
    return {"quality_policy": serialized(item)}


@router.patch("/quality-policies/{policy_id}")
def edit(
    policy_id: UUID,
    payload: PolicyInput,
    request: Request,
    response: Response,
    db: DB,
    current: Current,
) -> dict[str, Any]:
    permit(current, "ADMIN", "QA")
    item = owned(db, Policy, str(policy_id), current, True)
    require_match(request.headers.get("If-Match"), etag("policy", item.revision))
    if item.status != "DRAFT":
        raise Problem(409, "INVALID_STATE_TRANSITION", "Only draft policies may change")
    owned(db, Product, str(payload.product_id), current)
    if payload.reference_document_id:
        owned(db, ReferenceDocument, str(payload.reference_document_id), current)
    for key, value in payload.model_dump().items():
        if key == "rules":
            value = payload.rules.model_dump(mode="json")
        elif key.endswith("_id") and value:
            value = str(value)
        setattr(item, key, value)
    item.revision += 1
    response.headers["ETag"] = etag("policy", item.revision)
    body = {"quality_policy": serialized(item)}
    audit(db, current, request, "UPDATE", "policy", item.id, body)
    return body


@router.post("/quality-policies/{policy_id}/{action}")
def transition(
    policy_id: UUID,
    action: str,
    payload: Note,
    request: Request,
    response: Response,
    db: DB,
    current: Current,
) -> dict[str, Any]:
    if action not in {"submit-review", "approve", "retire"}:
        raise Problem(404, "RESOURCE_NOT_FOUND", "Unknown action")
    permit(current, *(["QA"] if action in {"approve", "retire"} else ["ADMIN", "QA"]))
    item = owned(db, Policy, str(policy_id), current, True)
    key, fingerprint, existing = replay(
        db, current, request, {**payload.model_dump(), "if_match": request.headers.get("If-Match")}
    )
    if existing:
        return existing
    require_match(request.headers.get("If-Match"), etag("policy", item.revision))
    expected, target = {
        "submit-review": ("DRAFT", "PENDING_REVIEW"),
        "approve": ("PENDING_REVIEW", "APPROVED"),
        "retire": ("APPROVED", "RETIRED"),
    }[action]
    if item.status != expected:
        raise Problem(409, "INVALID_STATE_TRANSITION", "Policy transition not permitted")
    if action == "approve":
        org = db.get(Organization, current.organization_id)
        if org and org.require_separation_of_duties and item.created_by == current.user_id:
            raise Problem(403, "SELF_APPROVAL_FORBIDDEN", "Independent reviewer required")
        if (
            not payload.approval_note
            or not payload.approval_note.strip()
            or not Rules.model_validate(item.rules).complete()
            or not item.reference_document_id
        ):
            raise Problem(
                422, "UNAPPROVED_POLICY", "Complete rules, reference and approval note required"
            )
        other = db.scalar(
            select(Policy).where(
                Policy.organization_id == current.organization_id,
                Policy.product_id == item.product_id,
                Policy.status == "APPROVED",
                or_(Policy.effective_to.is_(None), Policy.effective_to > item.effective_from),
                Policy.effective_from < item.effective_to if item.effective_to else true(),
            )
        )
        if other:
            raise Problem(
                409, "INVALID_STATE_TRANSITION", "Approved policy effective ranges overlap"
            )
        item.approved_by = current.user_id
        item.approved_at = now()
        item.content_sha256 = request_hash(
            {
                "rules": item.rules,
                "reference": owned(
                    db, ReferenceDocument, item.reference_document_id, current
                ).sha256,
                "product_id": item.product_id,
                "version": item.version,
            }
        )
    item.status = target
    item.revision += 1
    body = {"quality_policy": serialized(item)}
    remember(db, current, request, key, fingerprint, body, 200)
    audit(
        db,
        current,
        request,
        action,
        "policy",
        item.id,
        body,
        "QA" if action in {"approve", "retire"} else None,
    )
    response.headers["ETag"] = etag("policy", item.revision)
    return body
