import json
import logging
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

import boto3
import psycopg
from botocore.config import Config
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from redis import Redis
from starlette.exceptions import HTTPException
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app.config import Settings
from app.contracts import Problem, ProblemBody

logger = logging.getLogger(__name__)


def dependencies_ready(settings: Settings) -> bool:
    try:
        with psycopg.connect(settings.database_url, connect_timeout=2) as connection:
            connection.execute("SELECT 1")
        with Redis.from_url(
            settings.redis_url, socket_connect_timeout=2, socket_timeout=2
        ) as redis:
            redis.ping()
        s3 = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(connect_timeout=2, read_timeout=2, retries={"max_attempts": 0}),
        )
        s3.head_bucket(Bucket=settings.s3_bucket)
        return True
    except Exception:
        return False


class Health(BaseModel):
    status: str


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = Settings()
        yield

    app = FastAPI(title="Cold Chain API", version="0.1.0", lifespan=lifespan)

    def problem_response(request: Request, error: Problem) -> JSONResponse:
        body = ProblemBody(
            type=f"urn:cold-chain:error:{error.code.lower()}",
            title=error.code.replace("_", " ").title(),
            status=error.status,
            code=error.code,
            detail=error.detail,
            request_id=request.state.request_id,
        )
        return JSONResponse(
            body.model_dump(), status_code=error.status, media_type="application/problem+json"
        )

    @app.middleware("http")
    async def trace(request: Request, call_next: RequestResponseEndpoint) -> Response:
        supplied = request.headers.get("X-Request-Id", "")
        request.state.request_id = (
            supplied if re.fullmatch(r"[A-Za-z0-9_-]{1,64}", supplied) else str(uuid4())
        )
        try:
            response = await call_next(request)
        except Exception:
            logger.error("request_failed request_id=%s", request.state.request_id)
            response = problem_response(request, Problem(500, "INTERNAL_ERROR", "Internal error"))
        response.headers["X-Request-Id"] = request.state.request_id
        return response

    @app.exception_handler(Problem)
    async def domain_error(request: Request, exc: Problem) -> JSONResponse:
        return problem_response(request, exc)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        codes = {401: "AUTH_REQUIRED", 403: "PERMISSION_DENIED", 404: "RESOURCE_NOT_FOUND"}
        return problem_response(
            request,
            Problem(
                exc.status_code,
                codes.get(exc.status_code, "HTTP_ERROR"),
                "Request could not be completed",
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        response = problem_response(request, Problem(422, "VALIDATION_ERROR", "Invalid request"))
        body = json.loads(bytes(response.body))
        body["errors"] = [
            {
                "field": ".".join(str(part) for part in error["loc"]),
                "code": error["type"],
                "message": "Invalid value",
            }
            for error in exc.errors()
        ]
        return JSONResponse(body, status_code=422, media_type="application/problem+json")

    @app.get("/api/v1/health/live", response_model=Health)
    def live() -> Health:
        return Health(status="alive")

    @app.get(
        "/api/v1/health/ready",
        response_model=Health,
        responses={503: {"model": ProblemBody, "content": {"application/problem+json": {}}}},
    )
    def ready(request: Request) -> Health:
        if not dependencies_ready(request.app.state.settings):
            raise Problem(503, "DEPENDENCY_UNAVAILABLE", "Required dependency unavailable")
        return Health(status="ready")

    return app


app = create_app()
