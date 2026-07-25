# Failure Mode Analysis — Page Pulse

## Methodology: FMEA (Failure Mode and Effects Analysis)

Each failure is rated on:
- **Likelihood**: How likely it is to occur (1-5)
- **Impact**: How severe the effect is (1-5)
- **Risk Score**: Likelihood × Impact

---

## Failure 1: External Website Timeout / Unreachable (Risk: 5×5 = 25 — CRITICAL)

### Description
The URL being audited does not respond within the timeout window (5 seconds). This is the most common failure — any website can be slow, down, or geo-restricted.

### Effects Without Mitigation
- Worker hangs indefinitely
- Thread pool exhaustion → service unresponsive
- Queue backs up → cascading failure

### Current Mitigations (already implemented)
- ✅ **5-second axios timeout** — hard limit on every fetch
- ✅ **p-limit concurrency** — max 50 simultaneous fetches
- ✅ **Structured error response** — `TIMEOUT` / `UNREACHABLE` error codes

### Additional Mitigations at Scale
- **Circuit Breaker** (e.g., opossum library): If a domain fails 5 times in 1 min, stop fetching it for 30 seconds
- **Retry with exponential backoff** in BullMQ: `attempts: 3, backoff: { type: 'exponential', delay: 1000 }`
- **Dead Letter Queue**: After 3 failed retries, move job to DLQ for manual review
- **Adaptive timeout**: Increase timeout for known slow sites (stored in PostgreSQL)

### Recovery Flow
```
External website slow
        ↓
5s timeout fires (axios)
        ↓
Return TIMEOUT error (immediate)
        ↓
BullMQ: retry after 1s, 2s, 4s
        ↓
All retries fail → DLQ
        ↓
Alert: "URL unreachable after 3 attempts"
```

---

## Failure 2: Redis Crash / Unavailability (Risk: 3×5 = 15 — HIGH)

### Description
Redis goes down due to OOM (Out of Memory), network partition, or hardware failure. Since Redis is used for both caching AND job queue (BullMQ), this is a dual-risk failure.

### Effects Without Mitigation
- **Cache layer gone**: All requests hit external websites directly → 10-100x latency spike
- **BullMQ broken**: No new jobs can be queued → audit requests fail entirely
- **Rate limit counters lost**: IP bans reset → spike in abuse possible

### Current Mitigations (already implemented)
- ✅ **Graceful fallback**: If cache unavailable, fetch directly (no crash)

### Additional Mitigations at Scale
- **Redis Sentinel** (3-node cluster): Automatic failover in <30 seconds
  - 1 Primary + 2 Replicas
  - Sentinel monitors and promotes replica on primary failure
- **Redis Persistence**: AOF (Append-Only File) enabled — no data loss on restart
- **Separate Redis instances**: One for cache (can tolerate loss), one for BullMQ (must survive)
- **Health check**: GET /health checks Redis ping; if fail → return 503
- **Alert**: Redis down → PagerDuty alert within 30 seconds

### Recovery Flow
```
Redis Primary OOM crash
        ↓
Redis Sentinel detects (within 5s)
        ↓
Promotes Replica 1 to Primary
        ↓
API servers reconnect (ioredis auto-reconnect)
        ↓
Cache cold (empty) — first requests hit websites
        ↓
Cache warms up over 5 minutes
        ↓
Full recovery (< 2 minutes total downtime)
```

---

## Failure 3: Sudden Traffic Spike / Overload (Risk: 4×4 = 16 — HIGH)

### Description
Traffic spikes to 500+ concurrent requests (e.g., viral social media post, DDoS, scraper bots). Without protection, server CPU/memory exhausts and all requests fail.

### Effects Without Mitigation
- Node.js event loop blocked by too many simultaneous fetches
- Memory pressure → process crash (OOM kill)
- 503 errors for all users
- Queue backup of thousands of jobs

### Current Mitigations (already implemented)
- ✅ **Rate limiting**: 100 req/min per IP (express-rate-limit)
- ✅ **p-limit**: 50 max concurrent fetches per server
- ✅ **503 SERVER_BUSY**: Returns immediately when concurrency limit exceeded

### Additional Mitigations at Scale
- **Load Balancer rate limiting**: 500 req/sec global limit at Nginx level (before hitting API)
- **Auto-scaling**: Kubernetes HPA or Render auto-scale — CPU > 70% → add new API server
- **Queue buffer**: Burst traffic goes into BullMQ → processed at steady rate
- **Token bucket** at edge: 10 burst, 1 req/s sustained per IP
- **CDN caching**: Popular domains cached at CDN (Cloudflare) level — never hits API
- **Bot detection**: User-Agent filtering, JS challenge for suspicious clients

### Recovery Flow
```
Traffic spike: 2000 req/min
        ↓
Nginx: reject requests > 500 req/sec (429)
        ↓
Rate limiter: 100/min per IP → most bots blocked
        ↓
Remaining hits API → queue fills
        ↓
Auto-scaler: CPU 80% → launch 2 new API servers
        ↓
New servers join load balancer (< 60s)
        ↓
Queue drains, latency returns to normal
        ↓
After spike: auto-scaler terminates extra servers
```

---

## Failure 4 (Bonus): Database Write Failure (Risk: 2×4 = 8 — MEDIUM)

### Description
PostgreSQL is unavailable when workers try to save audit results.

### Mitigation
- **Write-through cache**: Result already saved to Redis — user gets response
- **Async write with retry**: BullMQ job saves to DB separately; retry 5 times
- **PostgreSQL Replica promotion**: Patroni/Barman for automatic failover
- **Dead Letter Queue**: Failed DB writes stored → replayed after DB recovery

---

## Summary Risk Matrix

| Failure | Likelihood | Impact | Risk | Status |
|---------|-----------|--------|------|--------|
| External timeout | 5 | 5 | **25** | ✅ Mitigated |
| Redis crash | 3 | 5 | **15** | ⚠️ Partial (needs Sentinel) |
| Traffic overload | 4 | 4 | **16** | ✅ Mitigated |
| DB write failure | 2 | 4 | **8** | ⚠️ Partial (needs async retry) |
| Worker crash | 2 | 3 | **6** | ✅ BullMQ auto-retry |
| LB failure | 1 | 5 | **5** | ✅ Nginx + health checks |
