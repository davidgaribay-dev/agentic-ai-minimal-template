# Claude Code Agent Architecture

This project uses a hierarchical agent structure with **team leads** that coordinate **specialists** for efficient parallel work.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MAIN CONVERSATION                            │
│  (Claude orchestrates based on task + agent descriptions)        │
└─────────────────────┬────────────────────┬─────────────────────┘
                      │                    │
        ┌─────────────┴────────┐   ┌──────┴──────────────┐
        ▼                      ▼   ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ backend-lead  │      │ frontend-lead │      │ code-reviewer │
│   (sonnet)    │      │   (sonnet)    │      │   (sonnet)    │
│  Orchestrator │      │  Orchestrator │      │  Orchestrator │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                      │
   ┌────┼────┬────┐       ┌────┼────┐           ┌────┼────┐
   ▼    ▼    ▼    ▼       ▼    ▼    ▼           ▼    ▼    ▼
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│rbac │ api │ db  │agent│core │state│comp │route│i18n │sec  │
│     │     │     │     │     │     │     │     │     │     │
│ snt │ snt │ snt │ snt │ snt │ snt │ snt │ snt │ snt │ snt │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
         Backend Specialists      Frontend       Review
                            (all sonnet)
```

## How It Works

1. **Main conversation** receives a task
2. **Claude delegates** to the appropriate team lead based on task description
3. **Team lead analyzes** and requests specific specialists
4. **Specialists execute** their focused tasks (can run in parallel)
5. **Results bubble up** through lead back to main conversation

## Agent Files

### Team Leads (Orchestrators)
| Agent | Model | Purpose |
|-------|-------|---------|
| `backend-lead.md` | sonnet | Coordinates backend implementation |
| `frontend-lead.md` | sonnet | Coordinates frontend implementation |
| `code-reviewer.md` | sonnet | Coordinates code review |

### Backend Specialists
| Agent | Model | Focus |
|-------|-------|-------|
| `backend-rbac.md` | sonnet | Permissions, auth, role mappings |
| `backend-api.md` | sonnet | FastAPI routes, typed deps |
| `backend-db.md` | sonnet | SQLModel, Alembic, queries |
| `backend-agent.md` | sonnet | LangGraph, tools, streaming |
| `backend-core.md` | sonnet | Exceptions, caching, secrets |

### Frontend Specialists
| Agent | Model | Focus |
|-------|-------|-------|
| `frontend-state.md` | sonnet | TanStack Query, Zustand |
| `frontend-components.md` | sonnet | React, shadcn/ui, forms |
| `frontend-routing.md` | sonnet | TanStack Router, navigation |
| `frontend-i18n.md` | sonnet | Translations, i18next |

### Review Specialists
| Agent | Model | Focus |
|-------|-------|-------|
| `review-backend.md` | sonnet | Ruff, MyPy, Python patterns |
| `review-frontend.md` | sonnet | TypeScript, React patterns |
| `review-security.md` | sonnet | OWASP, secrets, auth |

## Usage Examples

### Implementing a New Feature
```
User: "Add a new API endpoint for user preferences"

Claude delegates to: backend-lead
  → backend-lead requests: backend-db (for model)
  → backend-lead requests: backend-api (for route)
  → backend-lead requests: backend-rbac (for permissions)
  → backend-lead requests: code-reviewer (for review)
```

### Code Review
```
User: "Review my changes"

Claude delegates to: code-reviewer
  → code-reviewer runs: git diff
  → code-reviewer requests: review-backend (for .py files)
  → code-reviewer requests: review-frontend (for .tsx files)
  → code-reviewer requests: review-security (for auth code)
  → code-reviewer synthesizes: prioritized feedback
```

### Frontend Feature
```
User: "Add a settings page for notifications"

Claude delegates to: frontend-lead
  → frontend-lead requests: frontend-routing (for route)
  → frontend-lead requests: frontend-state (for API hooks)
  → frontend-lead requests: frontend-components (for UI)
  → frontend-lead requests: frontend-i18n (for translations)
```

## Key Benefits

1. **Parallel Execution**: Independent specialists can work simultaneously
2. **Focused Expertise**: Each agent knows its domain deeply
3. **High Quality**: Sonnet model for all agents ensures best reasoning
4. **Consistent Quality**: Standards enforced by specialized knowledge
5. **Clear Delegation**: Descriptions enable automatic routing

## Skills (Preloadable Knowledge)

Located in `.claude/skills/`:

- `coding-standards/SKILL.md` - Project conventions
- `multi-tenant/SKILL.md` - Architecture patterns

Agents can preload these via `skills:` in their frontmatter.

## Customization

To add a new specialist:

1. Create `.claude/agents/my-specialist.md`
2. Set `model: sonnet` for best quality
3. Write focused instructions for the domain
4. Add to relevant lead's "Available Specialists" table
5. Restart Claude Code or run `/agents` to reload
