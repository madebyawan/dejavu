# Epistemology

## Known

- Webhook deliveries can arrive more than once ([architecture](../docs/architecture.md)).

## Assumptions

- The card provider is the only webhook source.

## Open questions

- Should webhook events older than 30 days be pruned?

## Superseded

- Webhooks were polled hourly instead of pushed.
