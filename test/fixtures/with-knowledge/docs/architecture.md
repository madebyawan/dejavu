# Architecture

## Webhooks

The webhook handler verifies the provider signature, stores the event with its idempotency key, and acknowledges within two seconds. Processing happens in the background worker.

## Database

The ledger lives in Postgres. Migrations run before each deploy and must be backwards compatible for one release.

## Frontend

The checkout page is a server-rendered form with progressive enhancement.
