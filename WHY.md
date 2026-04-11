# Why

> _Filled in at S6 with the final 200-word narrative. Stub below so CI sees the file._

The obvious version of "slow query dashboard" is an APM — ship logs to a hosted service, stare at graphs. I built this dashboard because the APM model makes you leave your editor to find answers that are locally knowable: is this a seq scan, is there an index on the WHERE column, what's the p95 for this query pattern? Everything a Postgres DBA would ask is answerable with data the middleware already has in-process.

_(paragraph two — what the dashboard does differently: rules-first suggestions, LLM fallback as the fallback not the star, Monaco plan viewer that collapses the full workflow into a side panel you never leave)_

_(paragraph three — the branch-switch story: two Neon branches, identical data, different indexes, the live 1200ms → 18ms p95 drop as the interview moment)_
