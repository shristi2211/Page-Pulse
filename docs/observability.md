# Observability & Rollback Plan — Page Pulse

## 1. Observability Stack

```
Application (Pino logs + Prometheus metrics)
        │
        ├── Metrics ──→ Prometheus ──→ Grafana (dashboards)
        │
        ├── Logs ────→ Loki / ELK Stack ──→ Kibana / Grafana
        │
        └── Traces ──→ OpenTelemetry ──→ Jaeger / Tempo
```

---

## 2. Metrics to Monitor

### 2.1 API Layer
| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| Request rate (req/sec) | Prometheus | — (baseline) |
| P50 / P95 / P99 latency | Prometheus | P99 > 2000ms |
| HTTP error rate (4xx) | Prometheus | > 10% of total |
| HTTP error rate (5xx) | Prometheus | > 2% of total |
| Concurrent requests | Prometheus | > 400 (of 500 limit) |
| Rate limit hits (429) | Prometheus | > 5% of traffic |

### 2.2 Cache Layer (Redis)
| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| Cache hit ratio | Redis INFO | < 60% |
| Redis memory usage | Redis INFO | > 80% of maxmemory |
| Redis connected clients | Redis INFO | > 200 |
| Redis ops/sec | Redis INFO | — |
| Cache evictions | Redis INFO | > 100/min |

### 2.3 Queue Layer (BullMQ)
| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| Queue length (waiting) | Bull Board | > 1000 jobs |
| Queue processing rate | Bull Board | — |
| Failed jobs count | Bull Board | > 50/hour |
| Job processing time (avg) | Bull Board | > 4000ms |
| Dead letter queue size | Bull Board | > 10 (any) |

### 2.4 Worker Layer
| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| External fetch success rate | Prometheus | < 80% |
| External fetch latency (P95) | Prometheus | > 4000ms |
| Worker CPU usage | Prometheus | > 85% |
| Worker memory usage | Prometheus | > 512MB |
| Worker crash count | Prometheus | > 0 in 5 min |

### 2.5 Database (PostgreSQL)
| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| Active connections | pg_stat_activity | > 80 of max |
| Query latency (P95) | pg_stat_statements | > 500ms |
| Replication lag | pg_stat_replication | > 30 seconds |
| Disk usage | node_exporter | > 80% |
| Dead tuples (bloat) | pg_stat_user_tables | — (weekly VACUUM) |

### 2.6 Infrastructure
| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| CPU usage per container | Prometheus | > 85% for 5 min |
| Memory usage per container | Prometheus | > 80% |
| Network I/O | Prometheus | Sudden 10x spike |
| Disk I/O | Prometheus | > 90% saturation |

---

## 3. Logging Strategy

### Log Levels in Production
```
INFO  → Request received, audit complete, cache hit/miss
WARN  → External website slow (> 3s), retry attempt, cache miss rate high
ERROR → Fetch failed, Redis unavailable, DB write failed, 5xx response
FATAL → Uncaught exception, process crash
```

### Log Format (Pino JSON)
```json
{
  "level": "INFO",
  "time": "2026-07-25T13:37:00.000Z",
  "service": "page-pulse",
  "env": "production",
  "requestId": "REQ-A1B2C3D4E5F6",
  "method": "POST",
  "path": "/audit",
  "url": "https://google.com",
  "duration": 182,
  "statusCode": 200,
  "cached": false
}
```

### Log Aggregation
- **Dev**: Pino pretty-print to console
- **Production**: Pino JSON → **Loki** (via Promtail) → **Grafana** dashboards
- **Retention**: 30 days hot, 1 year cold (S3/GCS)
- **Sensitive data**: URLs and IPs are logged but PII-scrubbed

---

## 4. Distributed Tracing

Use **OpenTelemetry** to trace requests across services:

```
Client Request
    │
    ├── [Span 1] API Server: receive request, validate
    │       │
    │       ├── [Span 2] Redis: cache lookup (HIT/MISS)
    │       │
    │       └── [Span 3] BullMQ: enqueue job
    │
    └── [Span 4] Worker: dequeue job
            │
            ├── [Span 5] HTTP Fetch: external website
            │
            └── [Span 6] PostgreSQL: save result
```

Traces visible in **Jaeger UI** — identify bottlenecks per request.

---

## 5. Alerting Rules

### Alert Channels
- **Email**: Low-severity warnings (< 5 min response expected)
- **Slack #incidents**: Medium-severity (response within 15 min)
- **PagerDuty**: High-severity, out-of-hours (response within 5 min)

### Alert Definitions

```yaml
# High severity — PagerDuty
- alert: ServiceDown
  condition: HTTP 503 for > 30 seconds
  channel: PagerDuty + Slack

- alert: ErrorRateHigh
  condition: 5xx rate > 5% for 2 minutes
  channel: PagerDuty + Slack

- alert: RedisUnavailable
  condition: Redis ping fails for > 10 seconds
  channel: PagerDuty

- alert: QueueBacklog
  condition: BullMQ queue > 1000 jobs for > 5 minutes
  channel: PagerDuty + Slack

# Medium severity — Slack
- alert: HighLatency
  condition: P99 > 2000ms for 5 minutes
  channel: Slack

- alert: CacheHitRateLow
  condition: Cache hit ratio < 60% for 10 minutes
  channel: Slack

- alert: WorkerFailureRate
  condition: > 50 failed jobs in 1 hour
  channel: Slack

# Low severity — Email
- alert: DiskSpaceWarning
  condition: Disk usage > 75%
  channel: Email

- alert: DeadLetterQueueNonEmpty
  condition: DLQ > 0 jobs
  channel: Email (daily digest)
```

---

## 6. Rollback Plan

### Deployment Strategy: Blue-Green

```
Current State: Blue (v1.2) serving 100% traffic
                        │
Deploy Green (v1.3) ────┘
                        │
Run smoke tests on Green (internal traffic 5%)
                        │
    ┌───────────────────┴─────────────────────┐
    │                                         │
Tests PASS                               Tests FAIL
    │                                         │
Shift 100% traffic                      Keep Blue active
to Green (v1.3)                         Green stays warm
    │                                         │
Decommission Blue                      Investigate + fix
after 30 min                           before next deploy
```

### Rollback Steps (< 5 minutes)

**Step 1: Detect** (automated)
```
Grafana alert: 5xx > 5% after deploy
→ Incident triggered automatically
```

**Step 2: Decision** (human)
```
On-call engineer:
  - Reviews error logs in Grafana
  - Confirms regression is deploy-related
  - Initiates rollback (Slack command: /rollback page-pulse v1.2)
```

**Step 3: Execute** (automated)
```bash
# Render.com
render deploys rollback --service page-pulse --deploy-id <previous-id>

# Railway
railway rollback

# Docker / Kubernetes
kubectl set image deployment/page-pulse app=page-pulse:v1.2
kubectl rollout status deployment/page-pulse

# Verify
curl https://page-pulse.onrender.com/health | jq '.version'
# Expected: "1.2.0"
```

**Step 4: Verify**
```
5xx error rate → returns to < 1%
P99 latency → returns to baseline
Queue processes normally
Redis cache intact (no flush needed)
```

**Step 5: Post-Mortem**
- Document in Notion/Confluence
- Root cause analysis within 24 hours
- Fix → new PR → redeploy within 48 hours

---

## 7. SLA Targets

| Metric | Target | Alert at |
|--------|--------|---------|
| Availability | 99.9% (8.7 hrs/year downtime) | < 99.5% |
| P95 API Latency | < 500ms | > 1000ms |
| P99 API Latency | < 2000ms | > 3000ms |
| Cache Hit Ratio | > 70% | < 60% |
| Audit Success Rate | > 95% | < 90% |
| Error Rate (5xx) | < 1% | > 2% |

---

## 8. Grafana Dashboard Panels

1. **Request Rate** — time series, req/sec
2. **Error Rate** — gauge, % 5xx
3. **Latency Heatmap** — P50/P95/P99
4. **Cache Hit/Miss Ratio** — pie chart + time series
5. **BullMQ Queue Depth** — time series with alert band
6. **Worker Success Rate** — gauge
7. **Redis Memory** — gauge
8. **Active DB Connections** — gauge
9. **Infrastructure Health** — CPU / RAM / Disk per container
10. **Geo map** — Where requests are coming from (IP geolocation)
