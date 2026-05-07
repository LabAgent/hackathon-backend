# 🐿️ Sandy's Treedome Lab — Backend

> Multi-agent AI lab management system powered by LangGraph, NestJS, and sponge-worthy science.

## Overview

Sandy's Treedome Lab is a **SpongeBob-themed research platform** that uses a **4-agent LangGraph orchestration** to handle scientific research, inventory management, and database operations. Each agent is a specialist with its own tools, personality, and permissions.

### Key Highlights

- **4 AI Agents** orchestrated via LangGraph StateGraph (Planner → Research / Inventory / Database)
- **13 specialized tools** with role-based access control
- **Real-time SSE streaming** — see agent reasoning, routing, and tool calls live
- **Tavily web search** with 3-tier fallback (API → LLM → Cache)
- **Full authentication** — JWT + refresh tokens + TOTP MFA + email verification
- **14 TypeORM entities** with relationships, soft deletes, and audit trails
- **SpongeBob-themed agent personas** ("By Neptune's trident!", "That's no barnacle!")

## Architecture

### Multi-Agent System

```
User Message
     │
     ▼
┌─────────────────────────────────────────────────────┐
│              🧠 PLANNER AGENT                        │
│       Central Coordinator (LangGraph StateGraph)     │
│   Analyzes intent → Routes to specialist agent      │
│   Synthesizes final response from results            │
│                                                      │
│   Tool: route_to_agent(agent, task)                  │
└──────────┬──────────────┬──────────────┬─────────────┘
           │              │              │
     ┌─────▼────┐  ┌─────▼────┐  ┌─────▼──────┐
     │ 🔬 RESEARCH│  │ 📦 INVEN │  │ 🗄️ DATABASE│
     │   AGENT    │  │  AGENT   │  │   AGENT    │
     │            │  │          │  │            │
     │• web_search│  │•check_   │  │• query_    │
     │• suggest_  │  │  stock   │  │  records   │
     │  hypothesis│  │• update_ │  │• create_   │
     │• create_   │  │  stock   │  │  record    │
     │  experiment│  │• alert_  │  │• update_   │
     │• analyze_  │  │  low_    │  │  record    │
     │  findings  │  │  stock   │  │• delete_   │
     └────────────┘  │• suggest │  │  record    │
                      │  reorder │  └────────────┘
                      └──────────┘
```

### LangGraph Flow

```
START → planner ──→ { research | inventory | database } ──→ planner ──→ END
```

1. **START → Planner** — Analyzes user intent, decides routing
2. **Planner → Specialist** — Conditional edges route to the correct agent
3. **Specialist → Planner** — Results return for synthesis
4. **Planner → END** — Final response delivered via SSE stream

If LangGraph fails, a **fallback `runDirect()`** method iterates agents sequentially (max 15 iterations).

### Agent Details

#### 🧠 Planner Agent
- **Role:** Central coordinator, analyzes intent, delegates to specialists
- **Tool:** `route_to_agent(agent, task)` — routes to research/inventory/database
- **Personality:** Enthusiastic SpongeBob quotes ("Tartar sauce!", "Holy shrimp!")

#### 🔬 Research Agent
- **Role:** Scientific research and real-time web search
- **Tools:**
  - `web_search(query, count)` — Tavily API search with 3-tier fallback
  - `suggest_hypothesis(topic, existingData)` — AI-generated scientific hypotheses
  - `create_experiment_log(projectId, result, ...)` — Log experiment results (supports project name or ID)
  - `analyze_findings(projectId, question)` — LLM-powered analysis of project experiments (supports project name or ID)

**Web Search Fallback Chain:**
```
1. Tavily API (searchDepth: "advanced")
    ↓ timeout/error
2. LLM via OpenRouter (direct API call)
    ↓ timeout/error
3. Local cache (ILIKE fuzzy match on topic)
    ↓ no results
4. "Search unavailable" message
```

#### 📦 Inventory Agent
- **Role:** Lab inventory management
- **Tools:**
  - `check_stock(itemName, category, lowStockOnly)` — Search inventory (fuzzy name match)
  - `update_stock(itemId, newQuantity, reason)` — Change quantities + auto-log transaction
  - `alert_low_stock()` — Find items below minimum threshold
  - `suggest_reorder(itemId?)` — Calculate restock quantities (3x minimum)

#### 🗄️ Database Agent
- **Role:** Safe CRUD operations on 7 database tables
- **Tools:**
  - `query_records(table, filters, limit)` — Filtered queries (ILIKE auto on text fields)
  - `create_record(table, data)` — Create with validation + smart defaults
  - `update_record(table, id, data)` — Update existing records
  - `delete_record(table, id)` — Delete records

**Resilient `create_record`:** Supports 3 input formats:
```json
{"table": "projects", "data": {"name": "X"}}           // Standard
{"table": "projects", "data": "{\"name\": \"X\"}"}      // JSON string
{"table": "projects", "name": "X"}                      // Top-level fallback
```

### Role-Based Tool Permissions

| Tool | admin | researcher | lab_assistant | user |
|------|:-----:|:----------:|:-------------:|:----:|
| `web_search` | ✅ | ✅ | ❌ | ✅ |
| `create_experiment_log` | ✅ | ✅ | ❌ | ❌ |
| `suggest_hypothesis` | ✅ | ✅ | ❌ | ✅ |
| `analyze_findings` | ✅ | ✅ | ❌ | ❌ |
| `check_stock` | ✅ | ✅ | ✅ | ✅ |
| `update_stock` | ✅ | ❌ | ✅ | ❌ |
| `alert_low_stock` | ✅ | ✅ | ✅ | ✅ |
| `suggest_reorder` | ✅ | ✅ | ✅ | ✅ |
| `query_records` | ✅ | ✅ | ✅ | ✅ |
| `create_record` | ✅ | ✅ | ✅ | ❌ |
| `update_record` | ✅ | ✅ | ❌ | ❌ |
| `delete_record` | ✅ | ❌ | ❌ | ❌ |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | NestJS 11 |
| **ORM** | TypeORM 0.3.28 + PostgreSQL |
| **AI Orchestration** | LangGraph (`@langchain/langgraph`), OpenAI SDK via OpenRouter |
| **Web Search** | Tavily Search API (`@tavily/core`) |
| **Auth** | Passport JWT, bcrypt, otplib (TOTP MFA), qrcode |
| **Email** | NestJS Mailer + Handlebars + Nodemailer |
| **Validation** | class-validator, class-transformer |
| **API Docs** | Swagger (`@nestjs/swagger`) |
| **Rate Limiting** | `@nestjs/throttler` |
| **File Upload** | Cloudinary |
| **HTTP Client** | Axios (`@nestjs/axios`) |

## Data Models

### Core Entities

| Entity | Table | Key Fields |
|--------|-------|------------|
| **User** | `users` | UUID PK, email, passwordHash, role (user/admin/researcher/lab_assistant), MFA fields, lockout fields |
| **Project** | `projects` | id, name, description, status (planned/ongoing/completed), priority |
| **Inventory** | `inventory` | id, name, category, quantity, unit, minRequired, location |
| **ExperimentsLog** | `experiments_log` | id, projectId (FK), result, success, notes, hypothesis, methodology, status |
| **ProjectRequirement** | `project_requirements` | id, projectId (FK), inventoryId (FK), requiredQuantity |
| **InventoryTransaction** | `inventory_transactions` | id, inventoryId (FK), changeAmount, reason |

### AI/Agent Entities

| Entity | Table | Key Fields |
|--------|-------|------------|
| **AgentConversation** | `agent_conversations` | UUID PK, title, userId (FK) |
| **AgentMessage** | `agent_messages` | UUID PK, conversationId (FK), role, content, reasoning, toolCalls (JSON), agentName |
| **AgentTask** | `agent_tasks` | id, task, status, result |
| **AiActionLog** | `ai_actions_log` | id, actionType, description, metadata (JSON) |
| **ResearchCache** | `research_cache` | id, topic, summary, source |

### Auth Entities

| Entity | Table | Key Fields |
|--------|-------|------------|
| **RefreshToken** | `refresh_tokens` | UUID PK, token (hashed, indexed), userId (FK), expiresAt, isRevoked |
| **PasswordReset** | `password_resets` | UUID PK, code (6-digit), userId (FK), expiresAt, used |
| **EmailVerificationToken** | `email_verification_tokens` | UUID PK, code (6-digit), userId (FK), expiresAt |

## API Endpoints

### Authentication (13 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user + send verification email |
| POST | `/api/auth/verify-email` | Verify email with 6-digit code |
| POST | `/api/auth/resend-verification` | Resend verification email |
| POST | `/api/auth/login` | Login (returns tokens or MFA challenge) |
| POST | `/api/auth/mfa/verify` | Verify MFA TOTP code |
| POST | `/api/auth/mfa/verify-backup` | Verify MFA with backup code |
| POST | `/api/auth/mfa/setup` | Generate TOTP secret + QR code |
| POST | `/api/auth/mfa/enable` | Enable MFA (generates backup codes) |
| POST | `/api/auth/mfa/disable` | Disable MFA (requires password) |
| POST | `/api/auth/mfa/backup-codes` | Regenerate backup codes |
| POST | `/api/auth/refresh` | Refresh access token (one-time use rotation) |
| POST | `/api/auth/logout` | Logout (revoke refresh token) |
| POST | `/api/auth/forgot-password` | Request password reset email |
| POST | `/api/auth/reset-password` | Reset password with code |

### Users (4 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user profile |
| PUT | `/api/users/me` | Update profile |
| PUT | `/api/users/me/password` | Change password |
| PUT | `/api/users/me/image` | Upload profile image |

### Admin (5 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List users (paginated, searchable) |
| GET | `/api/admin/users/:id` | Get user detail |
| PUT | `/api/admin/users/:id` | Update user (role, etc.) |
| POST | `/api/admin/users/:id/lock` | Lock/unlock user account |
| POST | `/api/admin/users/:id/deactivate` | Deactivate account |

### Research (8 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/research` | List all projects |
| POST | `/api/research` | Create project |
| GET | `/api/research/stats` | Project statistics |
| GET | `/api/research/:id` | Get project with experiments & requirements |
| PUT | `/api/research/:id` | Update project |
| DELETE | `/api/research/:id` | Delete project |
| POST | `/api/research/:id/experiments` | Add experiment log |
| PUT/DELETE | `/api/research/experiments/:id` | Update/delete experiment |

### Inventory (7 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | List items (filterable by category) |
| POST | `/api/inventory` | Create item |
| GET | `/api/inventory/stats` | Inventory statistics |
| GET | `/api/inventory/low-stock` | Low stock alerts |
| GET | `/api/inventory/:id` | Get specific item |
| PUT | `/api/inventory/:id` | Update item |
| DELETE | `/api/inventory/:id` | Delete item |

### Chat / AI Agent (3 endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message (SSE streaming response) |
| GET | `/api/chat` | List conversations |
| GET | `/api/chat/:id` | Get conversation with messages |

### SSE Event Types

| Event | Description |
|-------|-------------|
| `conversation_id` | New conversation created |
| `agent_start` | Agent begins processing |
| `reasoning` | Reasoning tokens streamed (chain-of-thought) |
| `content` | Response tokens streamed |
| `route` | Planner delegates to specialist agent |
| `tool_call` | Agent calls a tool |
| `tool_progress` | Tool execution progress message |
| `tool_result` | Tool execution result |
| `complete` | Agent finished |
| `error` | Error occurred |

## Project Structure

```
src/
├── main.ts                              # Bootstrap, CORS, Swagger, global pipes
├── app.module.ts                        # Root module
├── common/
│   ├── decorators/                      # @CurrentUser, @Public
│   ├── filters/                         # AllExceptionsFilter
│   ├── guards/                          # JwtAuthGuard, RolesGuard
│   ├── interceptors/                    # TransformInterceptor
│   └── validators/                      # Custom validators
├── config/                              # AppConfigService (env vars)
├── entities/                            # 14 TypeORM entities
│   ├── user.entity.ts
│   ├── project.entity.ts
│   ├── inventory.entity.ts
│   ├── experiments-log.entity.ts
│   ├── project-requirement.entity.ts
│   ├── inventory-transaction.entity.ts
│   ├── agent-conversation.entity.ts
│   ├── agent-message.entity.ts
│   ├── agent-task.entity.ts
│   ├── ai-action-log.entity.ts
│   ├── research-cache.entity.ts
│   ├── refresh-token.entity.ts
│   ├── password-reset.entity.ts
│   └── email-verification-token.entity.ts
├── modules/
│   ├── agent/
│   │   ├── agent.graph.ts              # LangGraph StateGraph orchestration
│   │   ├── agent.module.ts             # Module wiring
│   │   ├── agents/
│   │   │   ├── planner.agent.ts        # Planner config
│   │   │   ├── research.agent.ts       # Research config
│   │   │   ├── inventory.agent.ts      # Inventory config
│   │   │   ├── database.agent.ts       # Database config
│   │   │   └── index.ts                # AGENT_CONFIGS export
│   │   └── tools/
│   │       ├── definitions.ts          # 13 tool schemas (OpenAI function format)
│   │       └── executor.ts            # Tool execution + role permissions
│   ├── auth/
│   │   ├── auth.controller.ts          # Auth endpoints
│   │   ├── auth.service.ts             # Full auth lifecycle
│   │   ├── mfa.service.ts              # TOTP MFA logic
│   │   ├── strategies/                 # Passport JWT strategy
│   │   └── dto/                        # 8 DTOs
│   ├── chat/
│   │   ├── chat.controller.ts          # SSE endpoint
│   │   └── chat.service.ts             # Message persistence + agent invocation
│   ├── research/                        # Projects CRUD
│   ├── inventory/                       # Inventory CRUD + stats
│   ├── admin/                           # User management
│   ├── users/                           # Profile CRUD
│   ├── email/                           # Email service (Handlebars templates)
│   └── cloudinary/                      # Image upload
└── seed/                                # Admin user seeder
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- OpenRouter API key
- Tavily API key (free at [tavily.com](https://tavily.com))

### Docker Setup (Recommended)

```bash
cd ../code-it-up-6.0
docker compose up -d
# PostgreSQL on localhost:5433, pgAdmin on localhost:5050
# Database: sandy_lab, User: sandy, Password: sandy123
```

### Installation

```bash
cd hackathon-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database and API keys

# Start development server (TypeORM synchronize enabled)
npm run start:dev

# Seed admin user
npm run seed:admin
```

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=sandy
DB_PASSWORD=sandy123
DB_DATABASE=sandy_lab
DB_SSL=false

# AI
OPENROUTER_API_KEY=sk-or-v1-your-key
AI_MODEL=openai/gpt-4o-mini
TAVILY_API_KEY=tvly-your-key
MOCK_PIPELINE=false

# JWT
JWT_SECRET=your_jwt_secret_min_64_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_64_chars
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Server
PORT=3000
CORS_ORIGINS=http://localhost:5173
APP_URL=http://localhost:3000

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Cloudinary (optional)
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Security
MAX_FAILED_ATTEMPTS=5
LOCK_TIME_MINUTES=30
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start dev server with watch mode |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production server |
| `npm run seed:admin` | Create default admin user |
| `npm run test` | Run tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run lint` | Lint code |

### API Documentation

Swagger UI is available at `http://localhost:3000/api/docs` in development mode.

---
