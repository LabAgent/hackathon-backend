# Sandy's Treedome Lab — AI Lab Management System

> 🐿️ **"Shhh — don't tell Mr. Krabs, but this lab is powered by multi-agent AI!"**
>
> A full-stack SpongeBob-themed lab management system featuring LangGraph-powered multi-agent orchestration, real-time web search, and role-based access control.

## Architecture Overview

### Multi-Agent System (LangGraph)

The platform uses **LangGraph** for agent orchestration — a `StateGraph` that routes queries between specialized agents:

```
┌──────────────────────────────────────────────────────┐
│                    Planner Agent                       │
│         (Sandy Cheeks' Central Coordinator)            │
│   Analyzes intent → Routes to specialist agent         │
│   Synthesizes final response from specialist results   │
└──────────┬──────────┬──────────┬─────────────────────┘
           │          │          │
     ┌─────▼────┐ ┌──▼──────┐ ┌─▼──────────┐
     │ Research  │ │Inventory│ │  Database  │
     │  Agent   │ │  Agent  │ │   Agent    │
     │          │ │         │ │            │
     │• Web     │ │• Check  │ │• Query     │
     │  Search  │ │  Stock  │ │  Records   │
     │  (Tavily)│ │• Update │ │• Create    │
     │• Suggest │ │  Stock  │ │  Records   │
     │  Hypothesis│• Alert  │ │• Update    │
     │• Analyze │ │  Low    │ │  Records   │
     │  Findings│ │  Stock  │ │• Delete    │
     └──────────┘ │• Suggest│ │  Records   │
                  │  Reorder│ └────────────┘
                  └─────────┘
```

**LangGraph Flow:**
1. `START → planner` (Planner analyzes user intent)
2. `planner → research | inventory | database` (Conditional routing via `route_to_agent`)
3. `research | inventory | database → planner` (Specialist returns results to Planner)
4. `planner → END` (Planner synthesizes final response)

Each agent has its own system prompt, tool set, and streaming capability. The Planner uses the `route_to_agent` tool to delegate, while specialists use domain-specific tools.

### Tools

| Agent | Tool | Description |
|-------|------|-------------|
| **Planner** | `route_to_agent` | Routes queries to Research, Inventory, or Database agents |
| **Research** | `web_search` | Real-time web search via **Tavily API** (with LLM fallback) |
| **Research** | `suggest_hypothesis` | AI-generated scientific hypotheses |
| **Research** | `create_experiment_log` | Log experiment results for a project |
| **Research** | `analyze_findings` | Analyze experiment data from a project |
| **Inventory** | `check_stock` | Query inventory by name, category, or low stock |
| **Inventory** | `update_stock` | Update item quantity with automatic transaction logging |
| **Inventory** | `alert_low_stock` | Find items below minimum threshold |
| **Inventory** | `suggest_reorder` | Calculate reorder suggestions |
| **Database** | `query_records` | Query any table with filters |
| **Database** | `create_record` | Create new records |
| **Database** | `update_record` | Update existing records |
| **Database** | `delete_record` | Delete records |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS, TypeORM, PostgreSQL |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Zustand, React Router v7 |
| **AI Orchestration** | LangGraph (StateGraph), OpenAI SDK (via OpenRouter) |
| **Web Search** | Tavily Search API (with LLM fallback) |
| **Auth** | JWT + Refresh Tokens + MFA (TOTP) |
| **Real-time** | Server-Sent Events (SSE) for streaming agent responses |

## Features

### Core
- **Multi-Agent AI Chat**: Real-time streaming with Planner → Specialist routing
- **Research Management**: Create projects, log experiments, analyze findings
- **Inventory Management**: Track supplies, low stock alerts, reorder suggestions
- **Role-Based Access**: User, Researcher, Lab Assistant, Admin roles
- **MFA Support**: TOTP-based two-factor authentication
- **Admin Panel**: User management, account lockout, role assignment

### SpongeBob Theme
- **Color Palette**: Ocean blues, Sandy yellows, Coral reds, Kelp greens
- **Lab Naming**: "Treedome Lab" branding throughout
- **Agent Personas**: Each agent uses SpongeBob-themed language
- **Underwater Aesthetics**: Gradient backgrounds, themed icons, Sandy's "S" logo

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- OpenRouter API key (for AI)
- Tavily API key (for web search) — free tier at [tavily.com](https://tavily.com)

### Backend Setup

```bash
cd hackathon-backend

# Install dependencies
npm install

# Create PostgreSQL database
createdb sandy_lab

# Configure environment
cp .env.example .env
# Edit .env with your database and API keys

# Run migrations (TypeORM synchronize is enabled for development)
npm run start:dev
```

### Frontend Setup

```bash
cd hackathon-frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:3000

# Start development server
npm run dev
```

### Environment Variables

#### Backend (.env)
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=sandy
DB_PASSWORD=your_password
DB_DATABASE=sandy_lab
DB_SSL=false

# AI
OPENROUTER_API_KEY=sk-or-v1-your-key
AI_MODEL=openai/gpt-4o-mini
TAVILY_API_KEY=tvly-your-key
MOCK_PIPELINE=false

# JWT
JWT_SECRET=your_jwt_secret_min_64_chars_long
JWT_REFRESH_SECRET=your_refresh_secret_min_64_chars_long

# Server
PORT=3000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3000
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/chat` | Send message to AI Lab Assistant (SSE stream) |
| `GET /api/chat` | List conversations |
| `GET /api/chat/:id` | Get conversation with messages |
| `GET /api/research` | List research projects |
| `POST /api/research` | Create research project |
| `GET /api/research/stats` | Get project statistics |
| `GET /api/inventory` | List inventory items |
| `POST /api/inventory` | Create inventory item |
| `GET /api/inventory/low-stock` | Get low stock alerts |
| `GET /api/inventory/stats` | Get inventory statistics |
| `POST /api/auth/register` | Register new user |
| `POST /api/auth/login` | Login |
| `POST /api/auth/refresh` | Refresh access token |
| `POST /api/auth/mfa/enable` | Enable MFA |
| `POST /api/auth/mfa/verify` | Verify MFA |

## LangGraph Implementation

The agent orchestration is implemented using `@langchain/langgraph`:

```typescript
const graph = new StateGraph(AgentGraphState)
  .addNode('planner', plannerNode)
  .addNode('research', specialistNode('research'))
  .addNode('inventory', specialistNode('inventory'))
  .addNode('database', specialistNode('database'))
  .addEdge(START, 'planner')
  .addConditionalEdges('planner', routeFromPlanner)
  .addEdge('research', 'planner')
  .addEdge('inventory', 'planner')
  .addEdge('database', 'planner');
```

- **StateGraph** manages agent state transitions
- **Conditional edges** route from Planner to specialist agents based on intent analysis
- **SSE streaming** provides real-time feedback during agent processing
- **Fallback mode**: If LangGraph fails, the system falls back to direct agent execution

## Project Structure

```
hackathon-backend/
├── src/
│   ├── modules/
│   │   ├── agent/
│   │   │   ├── agent.graph.ts          # LangGraph StateGraph orchestration
│   │   │   ├── agents/
│   │   │   │   ├── planner.agent.ts     # Planner system prompt & tools
│   │   │   │   ├── research.agent.ts    # Research agent prompt & tools
│   │   │   │   ├── inventory.agent.ts   # Inventory agent prompt & tools
│   │   │   │   └── database.agent.ts    # Database agent prompt & tools
│   │   │   └── tools/
│   │   │       ├── definitions.ts       # Tool definitions (OpenAI function schema)
│   │   │       └── executor.ts          # Tool execution (Tavily, DB, etc.)
│   │   ├── chat/                        # Chat SSE controller & service
│   │   ├── auth/                         # JWT auth, MFA, email verification
│   │   ├── inventory/                    # Inventory CRUD
│   │   ├── research/                     # Research projects CRUD
│   │   ├── admin/                        # Admin user management
│   │   └── users/                        # User profiles
│   ├── entities/                         # TypeORM entities
│   └── config/                          # NestJS config
│
hackathon-frontend/
├── src/
│   ├── pages/
│   │   ├── user/                         # Dashboard, Research, Inventory, Lab Assistant
│   │   ├── admin/                        # Admin panel
│   │   └── auth/                         # Login, Register, MFA
│   ├── hooks/
│   │   └── useAgentChat.ts               # SSE streaming hook for AI chat
│   ├── api/                              # Axios API client
│   ├── stores/                           # Zustand auth store
│   ├── components/
│   │   ├── layout/                       # UserLayout (SpongeBob theme), AdminLayout
│   │   ├── guards/                       # Auth, Admin, Guest guards
│   │   └── ui/                           # Reusable UI components
│   └── types/                            # TypeScript types
```

## Scoring Alignment

| Criteria | Points | Implementation |
|----------|--------|---------------|
| **AI Architecture** | 30 | LangGraph StateGraph with 4 agents, conditional routing, tool execution, SSE streaming |
| **Functionality** | 25 | Research (Tavily search), Inventory (stock management), Database (CRUD), role-based access |
| **UX/UI & SpongeBob Theme** | 15 | Ocean/sandy/coral/kelp color palette, Treedome Lab branding, underwater aesthetics |
| **Innovation** | 15 | Multi-agent orchestration, real-time SSE streaming, Tavily + LLM dual search, MFA |
| **Performance & Reliability** | 15 | Fallback mechanisms, mock mode, error handling, streaming responses |

## Team

Built for the CodeItUp 6.0 Hackathon — Sandy's Treedome Lab edition.

---

*"I'm ready! I'm ready! I'm ready!" — SpongeBob, probably also excited about multi-agent AI*