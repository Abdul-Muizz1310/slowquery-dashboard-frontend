/**
 * Spec 02 — ExplainPlanViewer recursive plan tree renderer.
 *
 * Each node renders its Node Type with cost / row counts. Sort and
 * Seq Scan nodes get a hotspot colour because they're the two patterns
 * the rules engine cares about most. A malformed tree falls back to a
 * raw JSON <pre> rather than crashing the page.
 */

import type { ExplainPlan } from "@/lib/api/schemas";

interface ExplainPlanViewerProps {
  plan: ExplainPlan;
}

interface PlanNode {
  "Node Type"?: string;
  "Total Cost"?: number;
  "Plan Rows"?: number;
  "Relation Name"?: string;
  Plans?: PlanNode[];
}

function isPlanNode(value: unknown): value is PlanNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "Node Type" in value &&
    typeof (value as PlanNode)["Node Type"] === "string"
  );
}

function severityForNode(node: PlanNode): string {
  const t = node["Node Type"] ?? "";
  if (t === "Sort" || t === "Seq Scan") return "text-red-700 bg-red-50 hotspot";
  return "text-zinc-800";
}

function renderNode(node: PlanNode, depth: number): React.ReactElement {
  const cost = node["Total Cost"];
  const rows = node["Plan Rows"];
  return (
    <div key={`${node["Node Type"]}-${depth}`} className="border-l border-zinc-200 pl-3 mt-2">
      <div className={`font-mono text-xs px-2 py-1 rounded ${severityForNode(node)}`}>
        {node["Node Type"]}
      </div>
      <div className="text-xs text-zinc-500 mt-1 pl-2">
        {node["Relation Name"] && <span className="mr-2">on {node["Relation Name"]}</span>}
        {cost !== undefined && <span className="mr-2">cost {cost}</span>}
        {rows !== undefined && <span>rows {rows}</span>}
      </div>
      {Array.isArray(node.Plans) &&
        node.Plans.map((child) =>
          isPlanNode(child) ? (
            <div
              key={`${child["Node Type"]}-${child["Total Cost"] ?? "_"}-${child["Relation Name"] ?? "_"}`}
            >
              {renderNode(child, depth + 1)}
            </div>
          ) : null,
        )}
    </div>
  );
}

export function ExplainPlanViewer({ plan }: ExplainPlanViewerProps) {
  if (!isPlanNode(plan.plan_json)) {
    return (
      <pre className="m-0 p-3 font-mono text-xs text-zinc-900 bg-zinc-50 rounded border border-zinc-200 overflow-x-auto">
        {JSON.stringify(plan.plan_json, null, 2)}
      </pre>
    );
  }
  return <div className="text-sm">{renderNode(plan.plan_json, 0)}</div>;
}

export function PlanNotAvailable() {
  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
      EXPLAIN plan not captured yet for this fingerprint.
    </div>
  );
}
