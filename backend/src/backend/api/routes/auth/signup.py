"""User registration routes."""

from typing import Annotated, Any

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status

from backend.audit.schemas import AuditAction, Target
from backend.audit.service import audit_service
from backend.auth import (
    SessionDep,
    UserCreate,
    UserPublic,
    create_user,
    get_user_by_email,
)
from backend.auth.models import UserRegisterWithInvitation
from backend.core.logging import get_logger
from backend.core.storage import (
    InvalidFileTypeError,
    StorageError,
    upload_file,
)
from backend.invitations import crud as invitation_crud
from backend.invitations.models import InvitationStatus
from backend.organizations import crud as org_crud
from backend.organizations.models import OrganizationCreate, OrgRole
from backend.teams import crud as team_crud
from backend.teams.models import TeamCreate, TeamRole

router = APIRouter()
logger = get_logger(__name__)


@router.post("/signup", response_model=UserPublic)
async def register_user(
    request: Request,
    session: SessionDep,
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
    full_name: Annotated[str | None, Form()] = None,
    organization_name: Annotated[str | None, Form()] = None,
    organization_logo: Annotated[UploadFile | None, File()] = None,
    team_name: Annotated[str | None, Form()] = None,
    team_logo: Annotated[UploadFile | None, File()] = None,
) -> Any:
    """Create new user, organization, and default team.

    When a user signs up without an invitation, they create a new organization
    and become its owner. A default team is also created automatically.

    Accepts multipart/form-data with optional logo file uploads for organization and team.

    For users with an invitation, use the /signup-with-invitation endpoint instead.
    """
    user = get_user_by_email(session=session, email=email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    user_create = UserCreate(
        email=email,
        password=password,
        full_name=full_name,
    )
    user = create_user(session=session, user_create=user_create)

    # Generate organization name if not provided (require it now)
    org_name = organization_name
    if not org_name:
        org_name = email.split("@")[0].title() + "'s Organization"

    # Upload organization logo if provided
    org_logo_url: str | None = None
    if organization_logo and organization_logo.file:
        if not organization_logo.content_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not determine organization logo file type",
            )
        try:
            org_logo_url = upload_file(
                file=organization_logo.file,
                content_type=organization_logo.content_type,
                folder="org-logos",
                filename=f"signup-{user.id}",
            )
        except InvalidFileTypeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e
        except StorageError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload organization logo: {e}",
            ) from e

    # Create organization with logo
    org_create = OrganizationCreate(
        name=org_name,
        logo_url=org_logo_url,
    )
    organization, owner_membership = org_crud.create_organization(
        session=session,
        organization_in=org_create,
        owner=user,
    )

    # Update logo filename to use actual org ID after org is created
    if org_logo_url:
        try:
            # Re-upload with correct org ID
            if organization_logo and organization_logo.file:
                organization_logo.file.seek(0)
                final_org_logo_url = upload_file(
                    file=organization_logo.file,
                    content_type=organization_logo.content_type
                    or "application/octet-stream",
                    folder="org-logos",
                    filename=str(organization.id),
                )
                organization.logo_url = final_org_logo_url
                session.add(organization)
        except Exception:
            # Non-critical - keep the original upload
            pass

    # Generate team name if not provided
    team_name_final = team_name if team_name else "General"

    # Upload team logo if provided
    team_logo_url: str | None = None
    if team_logo and team_logo.file:
        if not team_logo.content_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not determine team logo file type",
            )
        try:
            team_logo_url = upload_file(
                file=team_logo.file,
                content_type=team_logo.content_type,
                folder="team-logos",
                filename=f"signup-{user.id}",
            )
        except InvalidFileTypeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e
        except StorageError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload team logo: {e}",
            ) from e

    # Create default team with logo
    team_create = TeamCreate(
        name=team_name_final,
        logo_url=team_logo_url,
    )
    team, _ = team_crud.create_team(
        session=session,
        organization_id=organization.id,
        team_in=team_create,
        created_by_id=user.id,
        creator_org_member_id=owner_membership.id,
    )

    # Update team logo filename to use actual team ID after team is created
    if team_logo_url:
        try:
            # Re-upload with correct team ID
            if team_logo and team_logo.file:
                team_logo.file.seek(0)
                final_team_logo_url = upload_file(
                    file=team_logo.file,
                    content_type=team_logo.content_type or "application/octet-stream",
                    folder="team-logos",
                    filename=str(team.id),
                )
                team.logo_url = final_team_logo_url
                session.add(team)
        except Exception:
            # Non-critical - keep the original upload
            pass

    session.commit()
    session.refresh(organization)
    session.refresh(team)

    logger.info(
        "user_registered_with_org_and_team",
        email=user.email,
        organization_id=str(organization.id),
        team_id=str(team.id),
    )

    await audit_service.log(
        AuditAction.USER_SIGNUP,
        actor=user,
        request=request,
        organization_id=organization.id,
        team_id=team.id,
        targets=[
            Target(type="user", id=str(user.id), name=user.email),
            Target(
                type="organization", id=str(organization.id), name=organization.name
            ),
            Target(type="team", id=str(team.id), name=team.name),
        ],
        metadata={
            "signup_method": "direct",
            "organization_created": True,
            "team_created": True,
            "org_logo_uploaded": org_logo_url is not None,
            "team_logo_uploaded": team_logo_url is not None,
        },
    )

    return user


@router.post("/signup-with-invitation", response_model=UserPublic)
async def register_user_with_invitation(
    request: Request,
    session: SessionDep,
    user_in: UserRegisterWithInvitation,
) -> Any:
    """Create new user from an invitation.

    The user is automatically added to the organization (and team, if specified)
    based on the invitation details.
    """
    invitation = invitation_crud.get_invitation_by_token(
        session=session, token=user_in.token
    )
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation",
        )

    if not invitation.is_valid():
        if invitation.status == InvitationStatus.EXPIRED or invitation.is_expired():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation has expired",
            )
        if invitation.status == InvitationStatus.ACCEPTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation has already been accepted",
            )
        if invitation.status == InvitationStatus.REVOKED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation has been revoked",
            )

    existing_user = get_user_by_email(session=session, email=invitation.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists. Please login and accept the invitation.",
        )

    user_create = UserCreate(
        email=invitation.email,
        password=user_in.password,
        full_name=user_in.full_name,
    )
    user = create_user(session=session, user_create=user_create)

    org_role = OrgRole(invitation.org_role)
    org_membership = org_crud.add_org_member(
        session=session,
        organization_id=invitation.organization_id,
        user_id=user.id,
        role=org_role,
    )

    team_joined = None
    if invitation.team_id and invitation.team_role:
        team_role = TeamRole(invitation.team_role)
        team_crud.add_team_member(
            session=session,
            team_id=invitation.team_id,
            org_member_id=org_membership.id,
            role=team_role,
        )
        team_joined = invitation.team_id

    invitation_crud.accept_invitation(session=session, invitation=invitation)

    logger.info(
        "user_registered_via_invitation",
        email=user.email,
        organization_id=str(invitation.organization_id),
    )

    # Build targets list
    targets = [Target(type="user", id=str(user.id), name=user.email)]
    if team_joined:
        targets.append(Target(type="team", id=str(team_joined)))

    await audit_service.log(
        AuditAction.USER_SIGNUP_WITH_INVITATION,
        actor=user,
        request=request,
        organization_id=invitation.organization_id,
        team_id=team_joined,
        targets=targets,
        metadata={
            "signup_method": "invitation",
            "invitation_id": str(invitation.id),
            "org_role": org_role.value,
            "team_role": invitation.team_role if team_joined else None,
            "invited_by_id": str(invitation.invited_by_id)
            if invitation.invited_by_id
            else None,
        },
    )

    return user
