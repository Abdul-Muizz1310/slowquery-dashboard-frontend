/**
 * Detail payloads for GET /_slowquery/queries/{id}. Shape matches the
 * target contract pinned in spec 00: fingerprint + canonical_sql +
 * explain_plan + suggestions + recent_samples.
 */

import {
  FINGERPRINT_N_PLUS_ONE_ID,
  FINGERPRINT_ORDERS_BY_CREATED_AT_ID,
  FINGERPRINT_USERS_ORDERS_ID,
  fingerprintNPlusOne,
  fingerprintOrdersByCreatedAt,
  fingerprintUsersOrders,
} from "./fingerprints";

export const detailOrdersByCreatedAt = {
  fingerprint: fingerprintOrdersByCreatedAt,
  canonical_sql:
    "SELECT id, user_id, total_cents, status, created_at\nFROM orders\nORDER BY created_at DESC, id DESC\nLIMIT ?",
  explain_plan: {
    fingerprint_id: FINGERPRINT_ORDERS_BY_CREATED_AT_ID,
    plan_json: {
      "Node Type": "Limit",
      "Total Cost": 19321.42,
      "Plan Rows": 20,
      Plans: [
        {
          "Node Type": "Sort",
          "Total Cost": 19321.42,
          "Plan Rows": 100000,
          "Sort Key": ["orders.created_at DESC", "orders.id DESC"],
          Plans: [
            {
              "Node Type": "Seq Scan",
              "Relation Name": "orders",
              "Total Cost": 2145.0,
              "Plan Rows": 100000,
            },
          ],
        },
      ],
    },
    plan_text:
      "Limit  (cost=19321.42..19321.47 rows=20)\n  ->  Sort  (cost=19321.42..19571.42 rows=100000)\n        Sort Key: created_at DESC, id DESC\n        ->  Seq Scan on orders  (cost=0.00..2145.00 rows=100000)",
    cost: 19321.42,
    captured_at: "2026-04-12T01:00:15.001Z",
  },
  suggestions: [
    {
      id: 501,
      fingerprint_id: FINGERPRINT_ORDERS_BY_CREATED_AT_ID,
      kind: "index",
      source: "rules",
      rule: "sort_without_index",
      sql: "CREATE INDEX IF NOT EXISTS ix_orders_created_at ON orders(created_at);",
      rationale:
        "Sort node with high cost on orders.created_at. An ordered index removes the sort and the Seq Scan.",
      applied_at: null,
    },
  ],
  recent_samples: [
    {
      id: 9001,
      fingerprint_id: FINGERPRINT_ORDERS_BY_CREATED_AT_ID,
      params: { limit: 20 },
      duration_ms: 2041,
      rows: 20,
      sampled_at: "2026-04-12T01:02:44.112Z",
    },
    {
      id: 9000,
      fingerprint_id: FINGERPRINT_ORDERS_BY_CREATED_AT_ID,
      params: { limit: 20 },
      duration_ms: 1820,
      rows: 20,
      sampled_at: "2026-04-12T01:02:40.003Z",
    },
  ],
} as const;

export const detailUsersOrders = {
  fingerprint: fingerprintUsersOrders,
  canonical_sql:
    "SELECT id, user_id, total_cents, status, created_at\nFROM orders\nWHERE user_id = ?",
  explain_plan: {
    fingerprint_id: FINGERPRINT_USERS_ORDERS_ID,
    plan_json: {
      "Node Type": "Bitmap Heap Scan",
      "Relation Name": "orders",
      "Total Cost": 812.44,
      "Plan Rows": 118,
    },
    plan_text: "Bitmap Heap Scan on orders  (cost=4.30..812.44 rows=118)",
    cost: 812.44,
    captured_at: "2026-04-12T01:00:14.004Z",
  },
  suggestions: [
    {
      id: 502,
      fingerprint_id: FINGERPRINT_USERS_ORDERS_ID,
      kind: "index",
      source: "llm",
      rule: null,
      sql: "CREATE INDEX IF NOT EXISTS ix_orders_user_id ON orders(user_id);",
      rationale:
        "WHERE user_id = ? filters the majority of rows; an index keeps the query selective under scale.",
      applied_at: null,
    },
    {
      id: 503,
      fingerprint_id: FINGERPRINT_USERS_ORDERS_ID,
      kind: "rewrite",
      source: "rules",
      rule: "select_star",
      sql: null,
      rationale: "Select only the columns you use; the response serialises all of them regardless.",
      applied_at: null,
    },
  ],
  recent_samples: [],
} as const;

export const detailNPlusOne = {
  fingerprint: fingerprintNPlusOne,
  canonical_sql:
    "SELECT id, order_id, product_id, qty, price_cents\nFROM order_items\nWHERE order_id = ?",
  explain_plan: null,
  suggestions: [],
  recent_samples: [
    {
      id: 9100,
      fingerprint_id: FINGERPRINT_N_PLUS_ONE_ID,
      params: { order_id: 42 },
      duration_ms: 38,
      rows: 3,
      sampled_at: "2026-04-12T01:02:44.001Z",
    },
  ],
} as const;

export const detailsById: Record<string, unknown> = {
  [FINGERPRINT_ORDERS_BY_CREATED_AT_ID]: detailOrdersByCreatedAt,
  [FINGERPRINT_USERS_ORDERS_ID]: detailUsersOrders,
  [FINGERPRINT_N_PLUS_ONE_ID]: detailNPlusOne,
};
