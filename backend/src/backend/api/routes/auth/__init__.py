"""Authentication routes package.

This package splits auth functionality into focused modules:
- login: Login and token authentication
- signup: User registration (with and without invitations)
- profile: User profile management (/me endpoints)
- password: Password change, recovery, and reset
- verification: Email verification (send code, verify, resend)
"""

from fastapi import APIRouter

from backend.api.routes.auth import login, password, profile, signup, verification

router = APIRouter(prefix="/auth", tags=["auth"])

router.include_router(login.router)
router.include_router(signup.router)
router.include_router(profile.router)
router.include_router(password.router)
router.include_router(verification.router)
