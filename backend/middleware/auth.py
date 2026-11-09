"""
Authentication and authorization middleware.

For production: Replace with proper JWT or OAuth2.
This is a basic API key implementation for demonstration.
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel


# ── API Key Management ────────────────────────────────────────────────────────

class APIKey(BaseModel):
    """API key model."""
    key: str
    name: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    permissions: list[str] = []
    rate_limit: int = 100  # requests per minute


class APIKeyStore:
    """
    Simple in-memory API key store.
    
    Production: Use database with proper encryption.
    """
    
    def __init__(self):
        # Demo keys for testing
        self._keys: dict[str, APIKey] = {
            "demo_key_12345": APIKey(
                key="demo_key_12345",
                name="Demo Key",
                created_at=datetime.utcnow(),
                permissions=["read", "write"],
                rate_limit=60
            )
        }
    
    def validate_key(self, key: str) -> Optional[APIKey]:
        """Validate API key and return associated metadata."""
        api_key = self._keys.get(key)
        
        if not api_key:
            return None
        
        # Check expiration
        if api_key.expires_at and api_key.expires_at < datetime.utcnow():
            return None
        
        return api_key
    
    def create_key(
        self,
        name: str,
        permissions: list[str],
        expires_days: Optional[int] = None
    ) -> APIKey:
        """Create a new API key."""
        key = f"sk_{secrets.token_urlsafe(32)}"
        
        expires_at = None
        if expires_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_days)
        
        api_key = APIKey(
            key=key,
            name=name,
            created_at=datetime.utcnow(),
            expires_at=expires_at,
            permissions=permissions
        )
        
        self._keys[key] = api_key
        return api_key
    
    def revoke_key(self, key: str) -> bool:
        """Revoke an API key."""
        if key in self._keys:
            del self._keys[key]
            return True
        return False


# Global key store (in production, inject this as a dependency)
api_key_store = APIKeyStore()


# ── Authentication Dependencies ───────────────────────────────────────────────

security = HTTPBearer(auto_error=False)


async def get_api_key(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> Optional[APIKey]:
    """
    Dependency to extract and validate API key from request.
    
    Usage:
        @app.get("/protected")
        async def protected(api_key: APIKey = Depends(get_api_key)):
            ...
    """
    if not credentials:
        # Check for API key in header (alternative to Bearer token)
        # This will be set by the middleware if X-API-Key header is present
        return None
    
    # Validate the token
    api_key = api_key_store.validate_key(credentials.credentials)
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return api_key


async def require_auth(
    api_key: Optional[APIKey] = Security(get_api_key)
) -> APIKey:
    """
    Dependency that requires authentication.
    
    Usage:
        @app.get("/protected")
        async def protected(api_key: APIKey = Depends(require_auth)):
            ...
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return api_key


def require_permission(permission: str):
    """
    Dependency that requires a specific permission.
    
    Usage:
        @app.post("/analyze")
        async def analyze(
            api_key: APIKey = Depends(require_permission("write"))
        ):
            ...
    """
    async def permission_checker(
        api_key: APIKey = Security(require_auth)
    ) -> APIKey:
        if permission not in api_key.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required"
            )
        return api_key
    
    return permission_checker


# ── Optional Authentication ───────────────────────────────────────────────────

class OptionalAuth:
    """
    Optional authentication for endpoints that work with or without auth.
    
    Usage:
        @app.get("/stats")
        async def stats(api_key: Optional[APIKey] = Depends(OptionalAuth())):
            # If authenticated, return more data
            # If not, return public data only
    """
    
    async def __call__(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
    ) -> Optional[APIKey]:
        if not credentials:
            return None
        
        try:
            return api_key_store.validate_key(credentials.credentials)
        except Exception:
            return None
