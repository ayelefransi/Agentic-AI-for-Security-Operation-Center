"""
Authentication and authorization middleware.
Provides API key management and real bcrypt-hashed user session authentication.
"""

import os
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any, List

import bcrypt
import jwt
from fastapi import HTTPException, Security, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


JWT_SECRET = os.environ.get("NEXUS_JWT_SECRET", "nexus_soc_production_secret_key_super_secure_32bytes_min")
SESSION_COOKIE_NAME = "nexus_session"


# ── User Model & Auth Store ───────────────────────────────────────────────────

class User(BaseModel):
    id: str
    email: str
    name: str
    password_hash: str
    role: str  # "admin" | "analyst"
    failed_attempts: int = 0
    locked_until: Optional[datetime] = None


class UserStore:
    """In-memory & env-seeded user store with bcrypt and account lockout protection."""

    def __init__(self):
        self._users: Dict[str, User] = {}
        self._seed_default_users()

    def _seed_default_users(self):
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@nexus.ai").lower()
        admin_pass = os.environ.get("ADMIN_PASSWORD", "NexusAdmin2026!")
        admin_hash = bcrypt.hashpw(admin_pass.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        analyst_email = os.environ.get("ANALYST_EMAIL", "analyst@nexus.ai").lower()
        analyst_pass = os.environ.get("ANALYST_PASSWORD", "NexusAnalyst2026!")
        analyst_hash = bcrypt.hashpw(analyst_pass.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        self._users[admin_email] = User(
            id="usr_admin_01",
            email=admin_email,
            name="Alex Mercer",
            password_hash=admin_hash,
            role="admin",
        )
        if "admin@awra.ai" not in self._users:
            self._users["admin@awra.ai"] = User(
                id="usr_admin_awra",
                email="admin@awra.ai",
                name="Alex Mercer",
                password_hash=admin_hash,
                role="admin",
            )

        self._users[analyst_email] = User(
            id="usr_analyst_01",
            email=analyst_email,
            name="Elena Vance",
            password_hash=analyst_hash,
            role="analyst",
        )
        if "analyst@awra.ai" not in self._users:
            self._users["analyst@awra.ai"] = User(
                id="usr_analyst_awra",
                email="analyst@awra.ai",
                name="Elena Vance",
                password_hash=analyst_hash,
                role="analyst",
            )

    def authenticate(self, email: str, password: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Validate email & password with bcrypt.
        Enforces 15-minute lock after 5 failed attempts.
        Returns: (User, None) on success or (None, error_message) on failure.
        """
        normalized_email = (email or "").strip().lower()
        user = self._users.get(normalized_email)

        if not user:
            return None, "Email or password is incorrect."

        # Check account lockout
        now = _utc_now()
        if user.locked_until:
            lock_exp = user.locked_until
            if lock_exp.tzinfo is None:
                lock_exp = lock_exp.replace(tzinfo=timezone.utc)
            if lock_exp > now:
                remaining_mins = int((lock_exp - now).total_seconds() / 60) + 1
                return None, f"Account locked for {remaining_mins} more minutes due to multiple failed attempts."
            else:
                user.locked_until = None
                user.failed_attempts = 0

        # Verify bcrypt hash
        try:
            valid = bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8"))
        except Exception:
            valid = False

        if not valid:
            user.failed_attempts += 1
            if user.failed_attempts >= 5:
                user.locked_until = now + timedelta(minutes=15)
                return None, "Account temporarily locked for 15 minutes due to 5 failed attempts."
            return None, "Email or password is incorrect."

        # Success - reset failed attempts
        user.failed_attempts = 0
        user.locked_until = None
        return user, None

    def get_by_id(self, user_id: str) -> Optional[User]:
        for user in self._users.values():
            if user.id == user_id:
                return user
        return None

    def list_users(self) -> List[Dict[str, Any]]:
        """Return safe user summaries (excluding password hashes)."""
        now = _utc_now()
        results: List[Dict[str, Any]] = []
        for user in self._users.values():
            locked = False
            if user.locked_until:
                lock_exp = user.locked_until if user.locked_until.tzinfo else user.locked_until.replace(tzinfo=timezone.utc)
                locked = lock_exp > now
            results.append({
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "status": "locked" if locked else "active",
            })
        return results

    def create_user(self, email: str, name: str, password: str, role: str = "analyst") -> Tuple[Optional[User], Optional[str]]:
        normalized_email = (email or "").strip().lower()
        if not normalized_email or "@" not in normalized_email:
            return None, "Valid email is required."
        if normalized_email in self._users:
            return None, "A user with that email already exists."
        if len(password or "") < 8:
            return None, "Password must be at least 8 characters."
        if role not in ("admin", "analyst"):
            return None, "Role must be 'admin' or 'analyst'."

        pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        user = User(
            id=f"usr_{secrets.token_hex(4)}",
            email=normalized_email,
            name=(name or normalized_email.split("@")[0]).strip(),
            password_hash=pw_hash,
            role=role,
        )
        self._users[normalized_email] = user
        return user, None

    def update_user_role(self, user_id: str, role: str) -> Tuple[Optional[User], Optional[str]]:
        if role not in ("admin", "analyst"):
            return None, "Role must be 'admin' or 'analyst'."
        user = self.get_by_id(user_id)
        if not user:
            return None, "User not found."
        user.role = role
        return user, None

    def delete_user(self, user_id: str) -> bool:
        target = self.get_by_id(user_id)
        if not target:
            return False
        if target.email in self._users:
            del self._users[target.email]
            return True
        return False

    def create_session_token(self, user: User, remember_me: bool = False) -> str:
        """Create an 8-hour (or 30-day if remember_me) signed JWT session token."""
        now = _utc_now()
        duration = timedelta(days=30) if remember_me else timedelta(hours=8)
        exp = int((now + duration).timestamp())

        payload = {
            "sub": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "iat": int(now.timestamp()),
            "exp": exp,
        }
        return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

    def verify_session_token(self, token: str) -> Optional[User]:
        """Validate a JWT session token and return the associated User."""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user_id = payload.get("sub")
            if not user_id:
                return None
            return self.get_by_id(user_id)
        except Exception:
            return None


class LoginRateLimiter:
    """Dedicated per-IP rate limiter for login requests."""

    def __init__(self, max_attempts: int = 10, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: Dict[str, List[float]] = defaultdict(list)

    def check_and_record(self, client_key: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        recent = [t for t in self._attempts[client_key] if t > cutoff]
        if len(recent) >= self.max_attempts:
            self._attempts[client_key] = recent
            return False
        recent.append(now)
        self._attempts[client_key] = recent
        return True

    def reset(self):
        self._attempts.clear()


user_store = UserStore()
login_rate_limiter = LoginRateLimiter(max_attempts=10, window_seconds=60)


# ── API Key Management (Preserved for compatibility) ──────────────────────────

class APIKey(BaseModel):
    """API key model."""
    key: str
    name: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    permissions: list[str] = []
    rate_limit: int = 100


class APIKeyStore:
    """In-memory API key store for backwards compatibility."""

    def __init__(self):
        self._keys: dict[str, APIKey] = {
            "demo_key_12345": APIKey(
                key="demo_key_12345",
                name="Demo Key",
                created_at=_utc_now(),
                permissions=["read", "write"],
                rate_limit=60
            )
        }

    def validate_key(self, key: str) -> Optional[APIKey]:
        api_key = self._keys.get(key)
        if not api_key:
            return None
        if api_key.expires_at:
            exp = api_key.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < _utc_now():
                return None
        return api_key

    def create_key(
        self,
        name: str,
        permissions: list[str],
        expires_days: Optional[int] = None
    ) -> APIKey:
        key = f"sk_{secrets.token_urlsafe(32)}"
        expires_at = None
        if expires_days is not None:
            expires_at = _utc_now() + timedelta(days=expires_days)

        api_key = APIKey(
            key=key,
            name=name,
            created_at=_utc_now(),
            expires_at=expires_at,
            permissions=permissions
        )
        self._keys[key] = api_key
        return api_key

    def revoke_key(self, key: str) -> bool:
        if key in self._keys:
            del self._keys[key]
            return True
        return False


api_key_store = APIKeyStore()


# ── Authentication Dependencies ───────────────────────────────────────────────

security = HTTPBearer(auto_error=False)


async def get_api_key(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> Optional[APIKey]:
    if not credentials:
        return None
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
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return api_key


def require_permission(permission: str):
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


class OptionalAuth:
    """Optional authentication for endpoints that work with or without auth."""

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


async def get_current_user(request: Request) -> Optional[User]:
    """Extract authenticated user from session cookie or Authorization header."""
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token:
        user = user_store.verify_session_token(cookie_token)
        if user:
            return user

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        user = user_store.verify_session_token(token)
        if user:
            return user

    return None


async def require_admin_user(request: Request) -> User:
    """Require an authenticated admin user."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
