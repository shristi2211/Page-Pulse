# Technology Decision Record — Page Pulse

Each entry follows: **Chosen → Why → Alternative → Why Rejected**

---

## TDR-01: Runtime — Node.js

**Chosen:** Node.js 20 LTS

**Why:**
- Non-blocking I/O is ideal for URL fetching (I/O-bound, not CPU-bound)
- Single-threaded event loop handles many concurrent connections efficiently
- Massive npm ecosystem (axios, cheerio, BullMQ, Pino all native)
- Consistent language (TypeScript) across frontend and backend

**Alternative:** Python (FastAPI / aiohttp)

**Rejected because:**
- Slower cold start in Docker
- GIL (Global Interpreter Lock) limits true concurrency in workers
- Team familiarity with Node.js is higher

---

## TDR-02: Web Framework — Express.js

**Chosen:** Express.js 4.x

**Why:**
- Minimal, un-opinionated — full control over middleware
- Fastest startup time among Node.js frameworks
- Production-tested, battle-hardened
- Easier to containerize and scale horizontally

**Alternative 1:** NestJS

**Rejected because:**
- Unnecessary complexity (decorators, modules, DI container) for a single-feature API
- Heavier memory footprint
- Overkill for this scope

**Alternative 2:** Fastify

**Rejected because:**
- Smaller ecosystem
- Less familiar to most Node.js developers
- Express middleware compatibility layer adds overhead

---

## TDR-03: Caching — Redis

**Chosen:** Redis 7.x (with ioredis client)

**Why:**
- Sub-millisecond read/write latency
- **Shared cache** across all API server instances (unlike in-memory)
- Native TTL support per key — perfect for cache expiry
- Also used by BullMQ (dual-purpose infrastructure)
- Redis Cluster / Sentinel for high availability
- Persistent snapshots (RDB/AOF) for crash recovery

**Alternative 1:** NodeCache (current in-process solution)

**Rejected because:**
- Not shared across multiple server instances
- Lost on server restart
- Memory tied to API server process

**Alternative 2:** Memcached

**Rejected because:**
- No persistence — all cache lost on restart
- No native data structures (lists, sets) needed for BullMQ
- No built-in clustering with same simplicity as Redis

---

## TDR-04: Job Queue — BullMQ

**Chosen:** BullMQ (Redis-backed)

**Why:**
- Uses existing Redis infrastructure (no new dependency)
- Built-in: retries, backoff, dead letter queue, priority, rate limiting
- Dashboard (Bull Board) for monitoring
- TypeScript-native with full type support
- Handles exactly-once job processing with Redis locks

**Alternative 1:** RabbitMQ

**Rejected because:**
- Separate infrastructure (AMQP broker) — extra operational burden
- Overkill for this scale (10k/day = low throughput)
- No built-in retry backoff as elegant as BullMQ

**Alternative 2:** AWS SQS

**Rejected because:**
- Vendor lock-in
- Extra latency (network hop to AWS)
- Cost at high throughput
- Not self-hostable for on-premise deployments

**Alternative 3:** Kafka

**Rejected because:**
- Designed for millions of events/second — extreme overkill
- Complex ZooKeeper/KRaft cluster management
- 10k/day = ~0.1 events/second; Kafka's minimum overhead is enormous

---

## TDR-05: Database — PostgreSQL

**Chosen:** PostgreSQL 16

**Why:**
- ACID-compliant — audit results must be reliably stored
- JSONB column for flexible audit result storage + indexed queries
- Read Replica support for analytics without primary load
- Excellent connection pooling with PgBouncer
- Rich ecosystem: pgAdmin, Metabase, built-in full-text search

**Alternative 1:** MongoDB

**Rejected because:**
- No ACID transactions across documents (pre-4.0)
- Schema flexibility is not needed — audit result shape is fixed
- PostgreSQL's JSONB is equally flexible without sacrificing consistency

**Alternative 2:** MySQL

**Rejected because:**
- Weaker JSONB support vs PostgreSQL
- Less powerful full-text search
- PostgreSQL has better `EXPLAIN ANALYZE` tooling

---

## TDR-06: Load Balancer — Nginx

**Chosen:** Nginx 1.25

**Why:**
- Handles SSL termination efficiently
- Built-in rate limiting, gzip, static file serving
- Extremely low memory footprint (~2MB per worker)
- Reverse proxy + load balancer in one binary
- Industry standard, excellent documentation

**Alternative:** AWS Application Load Balancer (ALB)

**Rejected because:**
- Vendor lock-in to AWS
- Cost per hour even when idle
- Less control over custom headers and routing rules
- Nginx is more portable across cloud providers

---

## TDR-07: Language — TypeScript

**Chosen:** TypeScript 5.x (strict mode)

**Why:**
- Catches type errors at compile time (reduces runtime bugs)
- Zod v4 schemas generate TypeScript types automatically
- IDE autocomplete dramatically speeds development
- Self-documenting code — types serve as inline documentation

**Alternative:** JavaScript (plain)

**Rejected because:**
- No compile-time safety
- Debugging runtime type errors in production is costly
- No interface definitions for API contracts

---

## TDR-08: Containerization — Docker + Docker Compose

**Chosen:** Docker with multi-stage builds

**Why:**
- Reproducible environments (dev = staging = production)
- Multi-stage build: builder image → slim production image (~180MB vs ~800MB)
- Non-root user for security
- Docker Compose for local dev (API + Redis + PostgreSQL + Worker in one command)
- Native Kubernetes/ECS/Railway/Render support

**Alternative:** PM2 (bare metal)

**Rejected because:**
- Environment inconsistency between developer machines and production
- No resource limits (runaway process can take down server)
- Harder to scale horizontally

---

## TDR-09: Logging — Pino

**Chosen:** Pino 9.x

**Why:**
- Fastest Node.js logger (5x faster than Winston in benchmarks)
- Structured JSON output — parseable by Datadog, ELK, Loki
- Low-overhead — async log transport doesn't block event loop
- Serializers for request/response objects built-in

**Alternative:** Winston

**Rejected because:**
- 5-10x slower than Pino under load
- Not JSON-first by default
- More configuration required for structured logging
