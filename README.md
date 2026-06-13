# DevWeave

<div align="center">

### A distributed, real-time code editor built for conflict-free collaboration

Edit together in Monaco, watch remote cursors move live, restore shared code without
disconnecting collaborators, and scale WebSocket traffic across Node.js instances.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Yjs](https://img.shields.io/badge/Sync-Yjs_CRDT-f5ab00)](https://yjs.dev/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Realtime-Redis-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**[Architecture](#architecture) · [Engineering Highlights](#engineering-highlights) · [Quick Start](#quick-start) · [API](#api)**

</div>

---

## Engineering Highlights

### Conflict-free editing, not last-write-wins

DevWeave binds Monaco to a shared `Y.Text` through `y-monaco`. Each keystroke is
transmitted as a compact Yjs update, so simultaneous edits converge without locks,
manual conflict resolution, or full-document overwrites.

### Live restore without breaking the room

Owners can create snapshots manually or rely on automatic five-minute snapshots.
Restoring a version replaces the server's live Yjs state, persists it, and broadcasts
the authoritative update to every connected client. Everyone stays in the session and
continues editing from the restored state.

### Realtime and durable data have separate jobs

PostgreSQL is the source of truth for users, documents, ownership, and version history.
Redis handles fast, ephemeral work: Pub/Sub fan-out, Socket.IO's multi-instance adapter,
presence, and chat. This avoids forcing one database to solve two different problems.

### Designed for horizontal WebSocket scaling

The Socket.IO Redis adapter carries room broadcasts across backend instances, while
application-level Pub/Sub distributes Yjs updates and realtime events. Each instance
maintains an in-memory `Y.Doc` that converges from the same CRDT update stream and can
rehydrate from PostgreSQL after a restart.

### More than an editor demo

DevWeave includes JWT authentication, bcrypt password hashing, document ownership and
CRUD, guest link sharing, live cursors, presence, room chat, version history, and
server-side JavaScript execution in a VM2 sandbox.

---

## Architecture

```mermaid
flowchart LR
    User((Developer))

    subgraph Client["CLIENT · React"]
        direction TB
        UI["Dashboard & Auth"]
        Monaco["Monaco Editor"]
        YClient["Yjs + y-monaco"]
        Realtime["Socket.IO Client"]
        History["Version History"]

        UI --> Monaco
        Monaco <--> YClient
        YClient <--> Realtime
    end

    subgraph API["APPLICATION · Node.js"]
        direction TB
        Express["Express REST API"]
        Auth["JWT Auth & Ownership"]
        Socket["Socket.IO Handlers"]
        Services["Document & Version Services"]
        YServer["In-memory Y.Doc Cache"]

        Express --> Auth --> Services
        Socket <--> YServer
        Socket --> Services
    end

    subgraph Data["DURABLE STATE"]
        Postgres[("PostgreSQL")]
        Prisma["Prisma ORM"]
        Prisma --> Postgres
    end

    subgraph RT["REALTIME INFRASTRUCTURE"]
        Redis[("Redis")]
        PubSub["Pub/Sub"]
        Adapter["Socket.IO Adapter"]
        Ephemeral["Presence & Chat"]

        Redis --- PubSub
        Redis --- Adapter
        Redis --- Ephemeral
    end

    User --> Client
    UI <-->|"HTTPS · JWT"| Express
    History <-->|"Snapshots & restore"| Express
    Realtime <-->|"WebSocket · Yjs updates"| Socket
    Services <-->|"Documents · users · versions"| Prisma
    YServer -->|"Debounced persistence"| Prisma
    Socket <-->|"Cross-instance fan-out"| PubSub
    Socket <-->|"Room broadcasts"| Adapter
    Socket <-->|"Ephemeral state"| Ephemeral

    classDef client fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e,stroke-width:2px;
    classDef server fill:#ede9fe,stroke:#7c3aed,color:#4c1d95,stroke-width:2px;
    classDef database fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px;
    classDef realtime fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-width:2px;
    classDef actor fill:#fef3c7,stroke:#d97706,color:#78350f,stroke-width:2px;

    class UI,Monaco,YClient,Realtime,History client;
    class Express,Auth,Socket,Services,YServer server;
    class Postgres,Prisma database;
    class Redis,PubSub,Adapter,Ephemeral realtime;
    class User actor;
```

### What happens after a keystroke?

1. `y-monaco` converts the Monaco edit into a Yjs update.
2. The client sends the binary update through Socket.IO.
3. The backend merges it into its in-memory `Y.Doc` and publishes it through Redis.
4. Other backend instances forward the update to collaborators in the same room.
5. Yjs applies updates in any arrival order and all replicas converge.
6. The merged document and encoded Yjs state are persisted to PostgreSQL after a short debounce.

---

## Product Experience

| Capability | How it works |
|---|---|
| Collaborative editor | Monaco + Yjs CRDT + `y-monaco` |
| Live awareness | Remote cursors, selections, presence, and room chat |
| Version safety | Manual snapshots, five-minute auto-snapshots, live restore |
| Accounts | JWT signup/login with bcrypt password hashing |
| Document workspace | Create, rename, delete, list, and open owned documents |
| Guest collaboration | Join an existing document through a shared link |
| Code execution | JavaScript runs on the backend in a VM2 sandbox |
| Multi-instance delivery | Redis Pub/Sub + Socket.IO Redis adapter |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, React Router, Monaco Editor, Yjs, y-monaco, Tailwind CSS, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO, Joi, JWT, bcrypt, VM2 |
| Durable data | PostgreSQL, Prisma ORM |
| Realtime infrastructure | Redis Pub/Sub, Socket.IO Redis adapter, presence and chat storage |

---

## Project Structure

```text
devweave/
├── frontend/src/
│   ├── pages/          # Welcome, auth, dashboard, and editor screens
│   ├── components/     # Monaco, toolbar, cursors, chat, terminal, history
│   └── services/       # REST, auth, Socket.IO, and Yjs client integration
├── backend/
│   ├── routes/         # Auth, documents, versions, chat, and execution API
│   ├── sockets/        # Connection handlers and Redis subscribers
│   ├── services/       # Collaboration, versions, presence, chat, and execution
│   ├── repositories/   # Prisma-backed document persistence
│   ├── prisma/         # Schema and database migrations
│   └── redis/          # Redis clients and Pub/Sub management
└── SYSTEM_DESIGN_AND_INTERVIEW_GUIDE.md
```

For implementation details, tradeoffs, event flows, and interview talking points, see
[SYSTEM_DESIGN_AND_INTERVIEW_GUIDE.md](./SYSTEM_DESIGN_AND_INTERVIEW_GUIDE.md).

---

## Quick Start

### Prerequisites

- Node.js 16+
- PostgreSQL
- Redis

### 1. Install

```bash
git clone https://github.com/sahuhasrh/devweave.git
cd devweave
npm run install:all
```

### 2. Configure

```bash
cp .env.example backend/.env
```

Set the required values in `backend/.env`:

```env
DATABASE_URL=postgresql://devweave_user:devweave_password@localhost:5432/devweave
JWT_SECRET=replace-with-a-long-random-secret
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TLS=false
PORT=5000
CLIENT_URL=http://localhost:3000
```

### 3. Prepare the database

```bash
cd backend
npm run db:migrate
cd ..
```

### 4. Run

```bash
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

Open [http://localhost:3000](http://localhost:3000).

---

## API

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /api/auth/signup` | Public | Create an account and receive a JWT |
| `POST /api/auth/login` | Public | Log in and receive a JWT |
| `GET /api/auth/me` | Authenticated | Get the current user |
| `GET /api/documents` | Authenticated | List documents owned by the current user |
| `POST /api/documents` | Authenticated | Create a document |
| `GET /api/documents/:id` | Public / optional auth | Fetch a document |
| `PATCH /api/documents/:id` | Owner | Rename or update a document |
| `DELETE /api/documents/:id` | Owner | Delete a document and its versions |
| `POST /api/documents/:id/versions` | Owner | Save a version snapshot |
| `GET /api/documents/:id/history` | Owner | List version history |
| `POST /api/documents/:id/versions/:versionId/restore` | Owner | Restore and broadcast a version |
| `POST /api/execute` | Public | Execute JavaScript in the server sandbox |

---

## Key Design Decisions

| Decision | Why |
|---|---|
| Yjs instead of full-document sync | Concurrent edits merge deterministically instead of overwriting one another |
| Custom Socket.IO Yjs provider | Keeps document updates on the same transport as cursors, presence, and chat |
| PostgreSQL for durable state | Supports ownership, ordered history, relational queries, and restart recovery |
| Redis for ephemeral state and fan-out | Keeps high-frequency realtime traffic away from the durable database |
| Separate cursor channel | Cursor movement stays lightweight and does not become document history |
| Debounced persistence | Batches rapid keystrokes while retaining a recent durable CRDT snapshot |

---

## License

Released under the [MIT License](./LICENSE).
