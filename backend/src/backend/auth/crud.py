import uuid

from sqlalchemy import delete as sa_delete
from sqlmodel import Session, func, select

from backend.auth.models import (
    PASSWORD_HISTORY_LIMIT,
    PasswordHistory,
    User,
    UserCreate,
    UserUpdate,
)
from backend.core.security import get_password_hash, verify_password


def create_user(*, session: Session, user_create: UserCreate) -> User:
    """Create a new user in the database.

    Args:
        session: Database session
        user_create: User creation data

    Returns:
        Created user object
    """
    db_obj = User.model_validate(
        user_create,
        update={"hashed_password": get_password_hash(user_create.password)},
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> User:
    """Update a user in the database.

    Args:
        session: Database session
        db_user: Existing user object
        user_in: Update data

    Returns:
        Updated user object
    """
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data.pop("password")
        extra_data["hashed_password"] = get_password_hash(password)

    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    """Get a user by email address.

    Args:
        session: Database session
        email: User's email address

    Returns:
        User object if found, None otherwise
    """
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()


def get_user_by_id(*, session: Session, user_id: uuid.UUID) -> User | None:
    """Get a user by ID.

    Args:
        session: Database session
        user_id: User's UUID

    Returns:
        User object if found, None otherwise
    """
    return session.get(User, user_id)


# Dummy hash for timing-safe authentication when user doesn't exist
# This is a valid bcrypt hash that will always fail verification
# but takes the same time as a real verification
_DUMMY_HASH = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VIiOMjKQBNHxMK"


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    """Authenticate a user by email and password.

    This function is designed to be timing-safe to prevent user enumeration
    attacks. It always performs a password verification operation regardless
    of whether the user exists.

    Args:
        session: Database session
        email: User's email address
        password: User's password

    Returns:
        User object if credentials are valid, None otherwise
    """
    db_user = get_user_by_email(session=session, email=email)

    if not db_user:
        # Perform dummy password check to prevent timing attacks
        # This ensures the response time is consistent whether the user exists or not
        verify_password(password, _DUMMY_HASH)
        return None

    if not verify_password(password, db_user.hashed_password):
        return None

    return db_user


def check_password_history(*, session: Session, user: User, new_password: str) -> bool:
    """Check if password has been used recently.

    Args:
        session: Database session
        user: User to check password history for
        new_password: The new password to check

    Returns:
        True if password is allowed (not in history), False if recently used
    """
    # Get recent password history entries
    statement = (
        select(PasswordHistory)
        .where(PasswordHistory.user_id == user.id)
        .order_by(PasswordHistory.created_at.desc())  # type: ignore[attr-defined]
        .limit(PASSWORD_HISTORY_LIMIT)
    )
    history_entries = session.exec(statement).all()

    # Check against each historical password
    for entry in history_entries:
        if verify_password(new_password, entry.hashed_password):
            return False

    return True


def add_password_to_history(
    *, session: Session, user: User, hashed_password: str
) -> None:
    """Add a password to the user's history and prune old entries efficiently.

    Uses bulk DELETE with subquery to avoid N+1 query problem.
    Previous implementation: 3 SELECTs + N DELETEs
    Current implementation: 1 COUNT + 1 bulk DELETE (when pruning needed)

    Args:
        session: Database session
        user: User to add password history for
        hashed_password: The hashed password to store
    """
    # Add new entry
    history_entry = PasswordHistory(
        user_id=user.id,
        hashed_password=hashed_password,
    )
    session.add(history_entry)
    session.flush()  # Ensure new entry is visible for count

    # Count total entries for this user (single efficient COUNT query)
    count_statement = (
        select(func.count())
        .select_from(PasswordHistory)
        .where(PasswordHistory.user_id == user.id)
    )
    total_count = session.exec(count_statement).one()

    # If over limit, bulk delete oldest entries in single operation
    entries_to_delete = total_count - PASSWORD_HISTORY_LIMIT
    if entries_to_delete > 0:
        # Subquery to find IDs of oldest entries to delete
        oldest_ids_subquery = (
            select(PasswordHistory.id)
            .where(PasswordHistory.user_id == user.id)
            .order_by(PasswordHistory.created_at.asc())  # type: ignore[attr-defined]
            .limit(entries_to_delete)
            .subquery()
        )

        # Single bulk DELETE statement instead of N individual deletes
        # Use scalar_subquery via column reference for mypy compatibility
        delete_statement = sa_delete(PasswordHistory).where(
            PasswordHistory.id.in_(  # type: ignore[attr-defined]
                select(oldest_ids_subquery.c.id)
            )
        )
        session.exec(delete_statement)

    session.flush()
