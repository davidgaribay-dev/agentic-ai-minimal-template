---
name: coding-standards
description: Project coding standards and conventions. Preload into agents that write code.
user-invocable: false
---

# Coding Standards

## Backend Python

### Exception Chaining (REQUIRED)
```python
try:
    result = operation()
except ValueError as e:
    raise ValidationError(str(e)) from e  # ALWAYS chain
else:
    return result
```

### Typed Dependencies (REQUIRED)
```python
from backend.api.deps import SessionDep
from backend.auth.deps import CurrentUser
from backend.rbac.deps import OrgContextDep, TeamContextDep
```

### Domain Exceptions (REQUIRED)
```python
# Use these, not HTTPException or ValueError
raise ResourceNotFoundError("Team", team_id)
raise ValidationError("email", "Invalid format")
raise AuthorizationError("Cannot delete")
```

### Timestamps (REQUIRED)
```python
from datetime import UTC, datetime
now = datetime.now(UTC)  # ALWAYS use UTC
```

### Constants (REQUIRED)
```python
MAX_RETRIES = 3  # Use constants, not magic numbers
```

## Frontend TypeScript

### i18n (REQUIRED)
```typescript
const { t } = useTranslation()
<Button>{t("com_save")}</Button>  // NEVER hardcode strings
```

### Path Aliases (REQUIRED)
```typescript
import { Button } from "@/components/ui/button"  // Use @/ prefix
```

### Error Display (REQUIRED)
```typescript
{mutation.isError && <ErrorAlert error={mutation.error} />}
```

### Form State (REQUIRED)
```typescript
form.setValue("field", value, { shouldDirty: true })
```
