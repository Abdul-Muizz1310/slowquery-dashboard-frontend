import { defineSite } from "./define";

/** Everything a tab, a search result, an install and a link preview say about slowquery. */
export const SITE = defineSite({
  name: "slowquery",
  title: "slowquery dashboard — catch slow Postgres queries",
  description:
    "Live dashboard for slowquery-detective: Postgres query fingerprints, p95 timings, EXPLAIN plans with index suggestions, and a one-click slow/fast branch switch.",
  url: "https://slowquery-dashboard-frontend.vercel.app",
  accent: "#f97316",
  keywords: ["PostgreSQL", "slow queries", "EXPLAIN", "index suggestions", "SQLAlchemy", "FastAPI"],
  card: {
    comment: "live dashboard for slowquery-detective",
    headline: "catch slow queries.",
    highlight: "slow",
  },
  // Dashboard data only, no uploads: nothing to disallow. /demo keeps spec 05's noindex,
  // so it is left out of the sitemap.
  routes: { sitemap: ["/", "/timeline"], disallow: [] },
});
