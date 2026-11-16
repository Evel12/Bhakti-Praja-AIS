"""Bearer token authentication matching Laravel HttpQuizGenerator."""

import hmac
from fastapi import Depends, HTTPException, Request, status

from app.config import Settings, get_settings


def verify_bearer_token(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> str:
    """Validate Authorization: Bearer <token> header in constant time."""
    expected = settings.ai_service_api_key.strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service API key is not configured.",
        )

    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Bearer token.",
        )

    if not hmac.compare_digest(token.strip(), expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Bearer token.",
        )

    return token.strip()
