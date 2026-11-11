from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class BodyLimit:
    """Bound raw body before multipart parsing, including chunked uploads."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in {"POST", "PATCH", "PUT"}:
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")
        limit = (
            11 * 1024 * 1024
            if path.endswith("/temperature-datasets") or path.endswith("/reference-documents")
            else 1024 * 1024
        )
        chunks = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > limit:
                response = JSONResponse(
                    {
                        "type": "urn:cold-chain:error:file_too_large",
                        "title": "Request too large",
                        "status": 413,
                        "code": "FILE_TOO_LARGE",
                        "detail": "Request body exceeds permitted size",
                        "request_id": scope.get("state", {}).get("request_id", ""),
                        "errors": [],
                    },
                    status_code=413,
                    media_type="application/problem+json",
                )
                await response(scope, receive, send)
                return
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        sent = False

        async def replay() -> Message:
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
