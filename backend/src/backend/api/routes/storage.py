"""Storage proxy routes for serving uploaded files."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status
from fastapi.responses import Response

from backend.core.config import settings
from backend.core.logging import get_logger
from backend.core.storage import get_s3_client

router = APIRouter(prefix="/storage", tags=["storage"])
logger = get_logger(__name__)


@router.get("/{bucket}/{path:path}")
async def get_file(
    bucket: Annotated[str, Path()],
    path: Annotated[str, Path()],
) -> Response:
    """Proxy endpoint to serve files from S3 storage.

    This allows the frontend to access uploaded images (logos, etc.) without
    directly connecting to SeaweedFS, which may not be accessible from the browser.
    """
    # Security: only allow access to our configured bucket
    if bucket != settings.S3_BUCKET_NAME:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bucket not found",
        )

    try:
        client = get_s3_client()
        response = client.get_object(Bucket=bucket, Key=path)

        content: bytes = response["Body"].read()
        content_type = response.get("ContentType", "application/octet-stream")

        logger.debug("file_served", bucket=bucket, key=path, size=len(content))

        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=31536000",  # 1 year
            },
        )
    except Exception as e:
        error_code = getattr(e, "response", {}).get("Error", {}).get("Code")
        if error_code == "NoSuchKey":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found",
            ) from e

        logger.exception("file_serve_failed", bucket=bucket, key=path, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve file",
        ) from e
