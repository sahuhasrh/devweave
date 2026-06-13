# DevWeave

**Real-time collaborative code editor** — multiple developers edit the same document with conflict-free merges (Yjs CRDT), live cursors, presence, room chat, in-browser JavaScript execution, persistent accounts, and full version history.

---

## ✨ Highlights

- **Conflict-free collaborative editing** — Yjs CRDT + `y-monaco` keep every collaborator's cursor and edits in sync without merge conflicts
- **Authentication** — JWT-based signup/login with bcrypt password hashing; logged-in users get persisted, ownable documents
- **My Documents dashboard** — Logged-in users land on `/dashboard`, can list owned documents, rename them, delete them, or create a new document
- **Persistent storage** — Documents, users, and version history now live in **PostgreSQL** (via Prisma), replacing the old Redis-only model
- **Version history** — Owner-only manual "Save Version" snapshots, automatic 5-minute auto-snapshots, and one-click restore that broadcasts the authoritative Yjs state to all collaborators live
- **Live presence & cursors** — See who's in the room and where their cursor is, in real time
- **Room chat** — Built-in chat per document
- **In-browser JS execution** — Run code sandboxed with VM2, no local setup needed
- **Anonymous or authenticated use** — Share a `?doc=<uuid>` link for instant anonymous collaboration, or sign in to own and manage your documents
- **Scale-out ready** — Redis Pub/Sub + Socket.IO adapter support multi-instance deployments

---

## Architecture

```mermaid
flowchart TB
  subgraph Browser["Browser (React)"]
    App[App.js / React Router]
    Auth[Login / Signup]
    Dashboard[Dashboard / My Documents]
    Editor[Monaco + y-monaco]
    Yjs[Y.Doc / Y.Text]
    SocketC[socket.io-client]
    VH[Version History UI]
    App --> Editor
    App --> Auth
    App --> Dashboard
    Editor --> Yjs
    Yjs --> SocketC
    VH --> SocketC
  end

  subgraph Server["Node.js (Express + Socket.IO)"]
    Routes[REST /api]
    AuthSvc[Auth Service - JWT/bcrypt]
    Handlers[Socket handlers]
    Services[Services layer]
    VersionSvc[Version Service]
    Routes --> AuthSvc
    Routes --> Services
    Handlers --> Services
    Services --> VersionSvc
  end

  subgraph Postgres["PostgreSQL (Prisma)"]
    Users[(Users)]
    Docs[(Documents)]
    Versions[(DocumentVersions)]
  end

  subgraph Redis["Redis"]
    PS[Pub/Sub]
    Adapter[Socket.IO adapter]
    Presence[Presence / Chat]
  end

  SocketC <-->|WebSocket| Handlers
  Services --> Docs
  Services --> Users
  VersionSvc --> Versions
  Handlers --> Adapter
  Handlers --> PS
  Handlers --> Presence
```

---

## Tech stack

| Layer | Technologies |
|-------|----------------|
| Frontend | React, React Router, Monaco Editor, Yjs, y-monaco, Tailwind CSS, Socket.IO client |
| Backend | Node.js, Express, Socket.IO, Joi, VM2 (sandboxed JS execution), JWT, bcrypt |
| Database | PostgreSQL via Prisma ORM (users, documents, version history) |
| Realtime infra | Redis (Pub/Sub, Socket.IO adapter, presence, chat) |

---

## Project structure

```
├── backend/
│   ├── server.js
│   ├── routes/
│   │   ├── api.js
│   │   └── auth.js
│   ├── middleware/
│   │   └── auth.js
│   ├── sockets/
│   │   ├── handlers/
│   │   └── subscribers.js
│   ├── services/
│   │   ├── authService.js
│   │   ├── documentService.js
│   │   └── versionService.js
│   ├── repositories/
│   │   └── documentRepository.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── lib/
│   │   └── prisma.js
│   ├── redis/
│   └── scripts/
│       └── migrate-redis-to-postgres.js
│
└── frontend/
    └── src/
        ├── App.js
        ├── pages/
        │   ├── Dashboard.js
        │   ├── Login.js
        │   ├── Signup.js
        │   └── EditorPage.js
        ├── components/
        │   ├── Toolbar.js
        │   └── VersionHistory.js
        └── services/
            ├── api.js
            ├── auth.js
            └── yjsProvider.js
```

---

## Quick start

### Prerequisites

- Node.js 16+
- PostgreSQL (local or cloud)
- Redis (local or cloud)

### Install

```bash
git clone https://github.com/sahuhasrh/devweave.git
cd devweave
npm run install:all
```

### Environment

```bash
cp .env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://devweave_user:devweave_password@localhost:5432/devweave
JWT_SECRET=your-secret-key

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TLS=false

PORT=5000
CLIENT_URL=http://localhost:3000
```

### Database setup

```bash
# Start PostgreSQL (if needed)
docker run -d --name devweave-postgres \
  -e POSTGRES_USER=devweave_user \
  -e POSTGRES_PASSWORD=devweave_password \
  -e POSTGRES_DB=devweave \
  -p 5432:5432 postgres:16-alpine

# Apply schema
cd backend
npm run db:migrate

# Optional: migrate existing Redis documents into PostgreSQL
npm run db:migrate-redis
```

### Run

```bash
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

Open [http://localhost:3000](http://localhost:3000). Sign up or log in to land on `/dashboard`, where you can create, rename, delete, and open owned documents. You can still open `?doc=<uuid>` directly to collaborate anonymously via shareable link.

---

## API

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | — | Health check / Redis & DB connectivity |
| `POST /api/auth/signup` | — | Create account |
| `POST /api/auth/login` | — | Log in, receive JWT |
| `GET /api/auth/me` | ✅ | Get current user |
| `GET /api/documents` | ✅ | List documents owned by the current user, newest updated first |
| `POST /api/documents` | ✅ | Create an owned document |
| `GET /api/documents/:id` | optional | Fetch document metadata/content |
| `PATCH /api/documents/:id` | ✅ (owner) | Update document metadata |
| `DELETE /api/documents/:id` | ✅ (owner) | Delete a document and its versions |
| `POST /api/documents/:id/versions` | ✅ (owner) | Save a manual version snapshot |
| `GET /api/documents/:id/history` | ✅ (owner) | List version history |
| `POST /api/documents/:id/versions/:versionId/restore` | ✅ (owner) | Restore a version and broadcast to all collaborators |

See `backend/routes/api.js` and `backend/routes/auth.js` for full details.

---

## How it works

- **Collaboration**: Monaco ↔ `y-monaco` ↔ `Y.Doc` ↔ Socket.IO ↔ document handlers ↔ document service, with Redis Pub/Sub fanning out updates across server instances.
- **Dashboard**: Authenticated users fetch `GET /api/documents`, see owned documents ordered by `updatedAt`, and can create, rename, delete, or open each document at `/?doc=<id>`.
- **Persistence**: Documents are stored in PostgreSQL with a `content` snapshot, base64-encoded `yjsState` (for reload after restart), and a `version` counter used as a stale-update guard.
- **Auto-save**: When the first user joins a document, a 5-minute auto-snapshot timer starts, capturing version history without manual action.
- **Restore**: Restoring a version updates the live server-side `Y.Doc`, persists its full encoded Yjs state, then rebroadcasts that authoritative state via `yjs:sync` so collaboration continues without reload.
- **Anonymous access preserved**: Link-based collaboration (`?doc=<uuid>`) still works without an account; authentication is only required for owning/managing documents, delete/rename, and version history via REST.

---

## License

[MIT](./LICENSE)
