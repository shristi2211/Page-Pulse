# Architecture Document — Page Pulse (Scale: 10,000 Audits/Day, 500 Concurrent)

## 1. Overview

Page Pulse at production scale must handle **10,000 audits/day** (~7/min average, peak ~120/min) and **500 concurrent requests**. The architecture is horizontally scalable, queue-backed, and cache-first.

---

## 2. System Architecture Diagram

```
                         Users (500 concurrent)
                               │
                               ▼
                      ┌─────────────────┐
                      │   Load Balancer  │  ← Nginx / AWS ALB
                      │  (Round Robin)   │
                      └────────┬────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │  API Server 1│ │  API Server 2│ │  API Server N│  ← Node.js + Express
      │  (Docker)    │ │  (Docker)    │ │  (Docker)    │     p-limit: 50 each
      └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
             └────────────────┼─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Redis Cache    │  ← Shared, TTL=5min
                    │  (Cache-Aside)   │
                    └────────┬─────────┘
                             │
               ┌─────────────┴──────────────┐
               │                            │
          Cache HIT                   Cache MISS
               │                            │
               ▼                            ▼
        Return Cached                 ┌──────────────┐
           Result                     │  BullMQ      │  ← Job Queue (Redis-backed)
                                      │  Job Queue   │
                                      └──────┬───────┘
                                             │
                           ┌─────────────────┼─────────────────┐
                           ▼                 ▼                  ▼
                    ┌────────────┐   ┌────────────┐   ┌────────────┐
                    │  Worker 1  │   │  Worker 2  │   │  Worker N  │  ← Audit workers
                    └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
                          └───────────────┬┴──────────────────┘
                                          │
                                          ▼
                              External Website (HTTP Fetch)
                                          │
                                          ▼
                               ┌──────────────────┐
                               │   PostgreSQL      │  ← Audit history, analytics
                               │   (Primary +      │
                               │    Read Replica)  │
                               └──────────────────┘
```

---

## 3. Component Breakdown

### 3.1 Load Balancer (Nginx / AWS ALB)
- Distributes requests across API servers using **Round Robin** or **Least Connections**
- Handles SSL termination (HTTPS → HTTP internally)
- Rate limiting at the edge (global)
- Health checks on `/health` endpoint
- Sticky sessions NOT required (stateless API)

### 3.2 API Servers (Node.js + Express — Multiple Instances)
- Each instance handles HTTP requests
- Validates URL (Zod)
- Checks Redis cache first
- If cache miss → pushes job to BullMQ queue
- Returns `202 Accepted` with `jobId` for async processing (at scale)
- p-limit: 50 concurrent external fetches per server
- Runs inside Docker containers (auto-restart, resource limits)

### 3.3 Redis Cache
- **Cache-Aside pattern**: API checks Redis before fetching
- TTL: 5 minutes (configurable via `CACHE_TTL_SECONDS`)
- Shared across all API servers (unlike current NodeCache which is per-process)
- Key: normalized URL string
- Value: serialized audit result JSON

### 3.4 BullMQ Job Queue (Redis-backed)
- Decouples HTTP layer from expensive external fetches
- Jobs: `{ url, requestId, timestamp }`
- Priority queues: premium users get higher priority
- Retry policy: 3 retries with exponential backoff
- Dead Letter Queue (DLQ) for permanently failed jobs

### 3.5 Worker Processes
- Pull jobs from BullMQ queue
- Perform actual HTTP fetch (5s timeout)
- Parse HTML (title, content-type, size)
- Store result in Redis (cache) + PostgreSQL (history)
- Scale independently from API servers
- Can run on cheaper hardware (CPU/memory bound, not I/O)

### 3.6 PostgreSQL
- **Primary** for writes (audit results, user data)
- **Read Replica** for analytics queries (history, trends)
- Schema: `audits(id, url, result_json, created_at, duration_ms, cached)`
- Enables: audit history, analytics dashboard, SLA reporting

---

## 4. Request Data Flow

### Synchronous Path (Cache Hit)
```
Client → LB → API Server → Redis (HIT) → Return Result (< 5ms)
```

### Asynchronous Path (Cache Miss)
```
Client → LB → API Server → Redis (MISS) → BullMQ (enqueue)
  → Return 202 { jobId }
  [Worker picks up job]
  → Fetch External Website (< 5s)
  → Store in Redis + PostgreSQL
  → WebSocket/Polling: Client polls GET /audit/status/:jobId
  → Return result when ready
```

---

## 5. State Management

| Data | Storage | TTL | Reason |
|------|---------|-----|--------|
| Audit cache | Redis | 5 min | Fast reads, shared across servers |
| Job queue | Redis (BullMQ) | Until processed | Reliable job delivery |
| Audit history | PostgreSQL | Permanent | Analytics, compliance |
| Rate limit counters | Redis | 1 min window | Shared across servers |
| Session/Auth tokens | Redis | Configurable | Fast auth lookup |

---

## 6. Scaling Strategy

- **Horizontal scaling**: Add API servers behind load balancer (stateless)
- **Worker scaling**: Add worker processes based on queue depth
- **Auto-scaling trigger**: Queue length > 500 jobs → spin up new worker
- **Redis**: Redis Cluster or Redis Sentinel for HA
- **PostgreSQL**: Primary + Read Replica, connection pooling (PgBouncer)
