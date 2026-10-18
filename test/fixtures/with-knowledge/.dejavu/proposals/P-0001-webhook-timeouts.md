---
id: P-0001
status: proposed
confidence: low
created: 2026-10-01
supersedes: []
superseded_by: []
---

# Raise the webhook timeout to thirty seconds

## Context

Slow provider responses timed out during a traffic peak.

## Cause

The two-second acknowledgement budget is shared with signature verification.

## Evidence

- [Webhooks section](../../docs/architecture.md)

## Prevention

Measure verification time before changing the timeout.
