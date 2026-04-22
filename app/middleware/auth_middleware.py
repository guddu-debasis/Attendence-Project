from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.utils.security import decode_token

PUBLIC_PATHS = {"/", "/health", "/api/auth/login", "/docs", "/openapi.json", "/redoc"}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        token = request.headers.get("Authorization", "")
        if not token.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid Authorization header"},
            )

        payload = decode_token(token.split(" ", 1)[1])
        if payload is None:
            return JSONResponse(
                status_code=401,
                content={"detail": "Token is invalid or expired"},
            )

        request.state.user_id = payload.get("user_id")
        request.state.role = payload.get("role")
        return await call_next(request)