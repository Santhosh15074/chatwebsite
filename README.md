## Chat Platform Monorepo (Scaffold)

- apps/
  - gateway: Fastify + Socket.IO
  - auth: Fastify + Mongo (register/login)
  - user: Fastify + Mongo (profiles)
- packages/
  - @shared/models: shared utils/schemas
- infra/
  - docker-compose.yml: Mongo + Redis

### Quick start

1. Start infra
```bash
cd infra && docker compose up -d
```
2. Install deps (root runs all workspaces)
```bash
npm install
```
3. Run services (in separate terminals)
```bash
npm --workspace apps/gateway run dev
npm --workspace apps/auth run dev
npm --workspace apps/user run dev
```

Set `JWT_SECRET`, `MONGO_URL`, `MONGO_DB` in env as needed.
