---
name: docker-patterns
description: Docker and Docker Compose patterns for local development and production — multi-stage Dockerfiles, Compose service orchestration, networking, volume strategies, container security hardening, secret management, debugging, and anti-patterns. Use this skill whenever setting up Docker Compose for local dev, writing or reviewing a Dockerfile, designing a multi-container architecture, troubleshooting container networking or volume issues, migrating a project to containers, or when the user says "dockerize this", "docker compose", "multi-stage build", "container security", "why is my container broken", or mentions volumes, networks, healthchecks, or deployment stages. Do NOT trigger for Kubernetes manifests (different skill) or for the Kadmon harness itself, which runs on the host.
---

# Docker Patterns

Practical Docker and Docker Compose patterns for containerized development and production. Covers the decisions you actually face: which Compose file to write, how to stage the Dockerfile, where to put secrets, how to debug a broken container.

## When to Activate

- Setting up Docker Compose for local development
- Designing a multi-container architecture (app + db + cache + mail + etc.)
- Writing or reviewing a multi-stage Dockerfile
- Troubleshooting networking, volumes, or service discovery
- Reviewing a Dockerfile for security and image size
- Migrating from local-process dev to containerized workflow

## Docker Compose for Local Development

### Standard Web App Stack

```yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      target: dev                   # dev stage of a multi-stage Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - .:/app                      # bind mount for hot reload
      - /app/node_modules           # anonymous volume — preserves container deps
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/app_dev
      - REDIS_URL=redis://redis:6379/0
      - NODE_ENV=development
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    command: npm run dev

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  mailpit:                          # local email testing
    image: axllent/mailpit
    ports:
      - "8025:8025"                 # web UI
      - "1025:1025"                 # SMTP

volumes:
  pgdata:
  redisdata:
```

### Multi-Stage Dockerfile — dev + build + production

```dockerfile
# Stage 1 — deps
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2 — dev (hot reload, debug tools)
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage 3 — build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

# Stage 4 — production (minimal image, non-root)
FROM node:22-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001
USER appuser
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

### Override Files — dev and prod from one base

```yaml
# docker-compose.override.yml — auto-loaded, dev-only tweaks
services:
  app:
    environment:
      - DEBUG=app:*
      - LOG_LEVEL=debug
    ports:
      - "9229:9229"                 # Node debugger

# docker-compose.prod.yml — explicit for production
services:
  app:
    build:
      target: production
    restart: always
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
```

```bash
docker compose up                                                  # dev (auto-loads override)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d   # prod
```

## Networking

Services in the same Compose network resolve by service name:

```
# From the "app" container:
postgres://postgres:postgres@db:5432/app_dev   # "db" resolves to the db container
redis://redis:6379/0                           # "redis" resolves to the redis container
```

### Custom networks for isolation

```yaml
services:
  frontend:
    networks: [frontend-net]
  api:
    networks: [frontend-net, backend-net]
  db:
    networks: [backend-net]         # only reachable from api

networks:
  frontend-net:
  backend-net:
```

### Expose only what you need

```yaml
services:
  db:
    ports:
      - "127.0.0.1:5432:5432"       # host-only, not network-reachable
    # Omit ports entirely in production — reachable only within the Docker network
```

## Volume Strategies

```yaml
volumes:
  pgdata:                            # named volume — persists, Docker-managed

# In a service:
volumes:
  - .:/app                           # bind mount — source code for hot reload
  - /app/node_modules                # anonymous volume — protects container's node_modules
  - /app/.next                       # anonymous volume — protects build cache
  - pgdata:/var/lib/postgresql/data  # named volume — persistent db data
  - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql   # init script bind
```

## Container Security

### Dockerfile hardening

- Pin to a specific tag, never `:latest`
- Run as a non-root user (`adduser -S`, `USER`)
- Use `alpine` or `distroless` for smaller attack surface
- No secrets in image layers — ever

### Compose hardening

```yaml
services:
  app:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /app/.cache
    cap_drop: [ALL]
    cap_add:
      - NET_BIND_SERVICE              # only if binding to ports <1024
```

### Secret Management

```yaml
# GOOD — env vars injected at runtime from .env (never committed)
services:
  app:
    env_file: [.env]
    environment:
      - API_KEY                       # inherits from host environment

# GOOD — Docker secrets (Swarm mode)
secrets:
  db_password:
    file: ./secrets/db_password.txt
services:
  db:
    secrets: [db_password]

# BAD — hardcoded in image
# ENV API_KEY=sk-proj-xxxxx           # NEVER
```

## `.dockerignore`

```
node_modules
.git
.env
.env.*
dist
coverage
*.log
.next
.cache
docker-compose*.yml
Dockerfile*
README.md
tests/
```

## Debugging

```bash
# Logs
docker compose logs -f app
docker compose logs --tail=50 db

# Shell into a running container
docker compose exec app sh
docker compose exec db psql -U postgres

# Inspect
docker compose ps
docker compose top
docker stats

# Rebuild
docker compose up --build
docker compose build --no-cache app

# Cleanup
docker compose down                  # stop, remove containers
docker compose down -v               # also remove volumes (destructive — confirm first)
docker system prune                  # remove unused images/containers
```

### Network debugging

```bash
docker compose exec app nslookup db                        # DNS resolution
docker compose exec app wget -qO- http://api:3000/health   # reachability
docker network ls
docker network inspect <project>_default
```

## Anti-Patterns

- **Using `docker compose` alone in production** — use Kubernetes, ECS, or Docker Swarm for production orchestration
- **Storing data in containers without volumes** — containers are ephemeral; all data vanishes on restart
- **Running as root** — always create and use a non-root user
- **Using `:latest`** — pin to specific versions for reproducible builds
- **One giant container with every service** — one process per container
- **Secrets in `docker-compose.yml`** — use `.env` (gitignored) or Docker secrets

## Integration

- **arkitect agent** (opus) — primary owner. arkitect handles architecture and deployment design decisions; this skill is the containerization playbook it reaches for when the design question is "how do we run this reliably in containers".
- **api-design skill** — related. `api-design` covers the HTTP surface of the service; `docker-patterns` covers how to run and isolate that service.
- **security-review skill** — complementary. The "Container Security" section here overlaps with the secrets-management and dependency-security sections of `security-review`; load both when reviewing a production Dockerfile.
- **/abra-kdabra command** — entry point. When planning a containerization or deployment change, arkitect loads this skill during the planning phase.

## no_context Application

Docker recommendations must map to the real project — the actual services, the actual ports, the actual database. Before suggesting "add a `healthcheck` to your db service", verify the project *has* a db service and read the Compose file to see whether one already exists. Before recommending a multi-stage Dockerfile, read the existing Dockerfile if any — often the fix is a three-line edit, not a full rewrite. The `no_context` principle here means: read the actual `Dockerfile`, `docker-compose.yml`, and `.dockerignore` before making any structural recommendation.
