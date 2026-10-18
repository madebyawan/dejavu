---
id: W-0001
status: accepted
confidence: high
supersedes: [W-0002]
superseded_by: []
---

# Deduplicate webhook events by idempotency key before processing

## Context

Duplicate webhook deliveries charged one customer twice.

## Evidence

Incident review linked from the [architecture doc](../../docs/architecture.md).

## Prevention

Insert the event with a unique idempotency key and skip processing on conflict.
