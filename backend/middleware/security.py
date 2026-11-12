"""
Security middleware for the SOC API.
Includes: CORS, rate limiting, request validation, security headers.
"""

import html
import re
import time
from collections import defaultdict
from typing import Callable, Dict

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware


# ── Rate Limiting ──────────────────────────────────────────────────────────────

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiter.
    Production: Use Redis for distributed rate limiting.
    """
    
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, list[float]] = defaultdict(list)
        
    async def dispatch(self, request: Request, call_next: Callable):
        client_id = self._get_client_id(request)
        
        current_time = time.time()
        cutoff_time = current_time - 60  # 1 minute window
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id]
            if req_time > cutoff_time
        ]
        
        if len(self.requests[client_id]) >= self.requests_per_minute:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded. Please try again later.",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )
        
        self.requests[client_id].append(current_time)
        return await call_next(request)
    
    def _get_client_id(self, request: Request) -> str:
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return f"key:{api_key}"
        
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"
        
        client_host = request.client.host if request.client else "unknown"
        return f"ip:{client_host}"


# ── Security Headers ──────────────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)
        
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data: https:; "
            "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
        )
        
        return response


# ── Request Size Limits ──────────────────────────────────────────────────────

class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Limit request body size to prevent DoS attacks."""
    
    def __init__(self, app, max_size_mb: float = 10):
        super().__init__(app)
        self.max_size_bytes = int(max_size_mb * 1024 * 1024)
    
    async def dispatch(self, request: Request, call_next: Callable):
        content_length = request.headers.get("Content-Length")
        
        if content_length:
            if int(content_length) > self.max_size_bytes:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={
                        "detail": f"Request body too large. Maximum size: {self.max_size_bytes / 1024 / 1024}MB"
                    }
                )
        
        return await call_next(request)


# ── CORS Configuration ────────────────────────────────────────────────────────

def get_cors_middleware(allowed_origins: list[str] = None):
    if allowed_origins is None:
        allowed_origins = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
        ]
    
    return CORSMiddleware(
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Total-Count", "X-Request-ID"],
        max_age=600,
    )


# ── Input Sanitization ────────────────────────────────────────────────────────

class InputSanitizer:
    """
    Sanitize user inputs to prevent injection attacks against the API.
    """
    
    SQL_PATTERNS = [
        r"(?i)(\bunion\b\s+\bselect\b)",
        r"(?i)(;\s*drop\s+table\b)",
        r"(?i)(;\s*delete\s+from\b)",
        r"(?i)('\s*or\s*'?1'?\s*=\s*'?1)",
        r"(?i)('\s*or\s*'1'='1)",
    ]
    
    COMMAND_INJECTION_PATTERNS = [
        r"(;\s*rm\s+-rf)",
        r"(&&\s*(?:wget|curl|bash|sh|nc)\b)",
        r"(\.\./\.\./)",
        r"(/etc/passwd)",
    ]

    TEMPLATE_INJECTION_PATTERNS = [
        r"(\{\{.*\}\})",
        r"(\{%.*%\})",
    ]
    
    @staticmethod
    def sanitize_alert(text: str, max_length: int = 50000) -> str:
        """
        Sanitize alert input while allowing real security event logs.
        """
        if not text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Alert text cannot be empty"
            )
        
        if len(text) > max_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Alert text too long. Maximum {max_length} characters."
            )
        
        # Check null bytes
        if "\x00" in text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Null bytes are not allowed in alert text"
            )

        # Check SQL injection
        for pattern in InputSanitizer.SQL_PATTERNS:
            if re.search(pattern, text):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Potential SQL injection detected"
                )
        
        # Check command injection / path traversal
        for pattern in InputSanitizer.COMMAND_INJECTION_PATTERNS:
            if re.search(pattern, text):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Potential command injection detected"
                )

        # Check template injection
        for pattern in InputSanitizer.TEMPLATE_INJECTION_PATTERNS:
            if re.search(pattern, text):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Template injection pattern detected"
                )
        
        return text.strip()
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename to prevent path traversal."""
        # Strip directory traversal sequences
        while ".." in filename:
            filename = filename.replace("..", "")
        # Remove path separators and illegal filesystem characters
        filename = re.sub(r'[\\/:*?"<>|]', '', filename)
        
        if len(filename) > 255:
            filename = filename[:255]
        
        return filename
    
    @staticmethod
    def escape_html(text: str) -> str:
        """Escape HTML to prevent XSS."""
        return html.escape(text)
