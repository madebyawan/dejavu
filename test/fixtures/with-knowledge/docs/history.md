# Project history

## 2024

The service started as a single process that handled checkout, invoicing, reporting, and email receipts. Reporting moved to the analytics team in the autumn, and invoicing moved to the billing service the following spring.

## 2025

The team split the background worker from the web process to keep checkout latency low during traffic peaks. The ledger schema was normalized, card tokens moved to the vault, and the old reporting tables were archived.

## Glossary

Ledger: the append-only table of money movements. Vault: the tokenization provider. Checkout: the customer-facing payment page.
