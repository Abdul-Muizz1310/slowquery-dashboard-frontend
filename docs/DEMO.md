# Demo script

> Stub — replaced with the real interview-ready walkthrough at S6.

## 30-second pitch

_(filled in at S6)_

## Step-by-step

1. Open `https://slowquery-dashboard-frontend.vercel.app`
2. Watch the fingerprints table populate — the top row is an `ORDER BY created_at DESC` query with p95 ~1200ms and a red `sort_without_index` badge.
3. Click into the detail view. Monaco shows the canonical SQL. The postgres-plan viewer shows a `Sort` node as the top cost driver. Suggestion card: `CREATE INDEX IF NOT EXISTS ix_orders_created_at ON orders(created_at);`.
4. Click "Apply on fast branch" — the dashboard POSTs to `/branches/switch`.
5. Return to the timeline view. Within ~3s the p95 line drops from 1200ms to ~18ms.
6. That's the whole story.
