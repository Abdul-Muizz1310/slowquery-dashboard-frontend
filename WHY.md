# Why

## The obvious version

The obvious version of "slow query dashboard" is an APM — ship logs to Datadog or New Relic, stare at graphs someone else designed, pay per seat. Every team already has one, and the dashboards are fine. You get latency percentiles, you get a query list sorted by total time, you get an EXPLAIN plan if you click deep enough. The problem is not that APMs are bad. The problem is that they make you leave your editor to find answers that are locally knowable: is this a sequential scan, is there an index on the WHERE column, what is the p95 for this query pattern? Everything a Postgres DBA would ask is answerable with data the middleware already has in-process.

## Why I built it differently

This dashboard puts rules-first suggestions front and center. When you click into a slow query, you see the canonical SQL, the EXPLAIN plan in a collapsible tree viewer, and a suggestion card that says exactly what to do — `CREATE INDEX IF NOT EXISTS ix_orders_created_at ON orders(created_at)`. The suggestion comes from deterministic rules (`sort_without_index`, `seq_scan_on_large_table`) that match plan node patterns, not from an LLM guessing. LLM fallback exists but it is the fallback, not the headline. The entire drill-down — fingerprints table, EXPLAIN viewer, suggestion, and "Apply" button — lives in one flow you never leave. The branch-switch story is the centerpiece: two Neon Postgres branches with identical data but different indexes. Click "Apply on fast branch," watch the live SSE timeline, and the p95 drops from 1200ms to 18ms in real time. That single interaction proves the suggestion was correct, the index works, and the dashboard detected the change — all in about three seconds.

## What I'd change if I did it again

I would add a flame chart visualization for the EXPLAIN plan instead of the collapsible tree. Flame charts make nested node costs spatially obvious in a way that indented text does not. I would also replace SSE polling with a WebSocket connection — SSE works well enough and the exponential backoff handles reconnection, but WebSocket would give bidirectional communication for future features like live query cancellation. Finally, the timeline buffer batches events in 100ms windows for rendering performance, but on high-throughput workloads this could drop data points. A ring buffer with configurable retention would be more robust.
