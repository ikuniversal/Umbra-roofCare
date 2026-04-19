import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { FINDING_SEVERITY_ORDER } from "@/lib/labels";
import type {
  DecisionRule,
  DecisionRuleAction,
  DecisionRuleActions,
  DecisionRuleConditions,
  FindingSeverity,
  Inspection,
  InspectionFinding,
  Property,
} from "@/lib/types";

export interface OpportunityCreated {
  opportunityId: string;
  type: string;
  priority: string;
  ruleId: string;
  ruleName: string;
  isSecondary: boolean;
}

export interface EvaluationResult {
  inspectionId: string;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  opportunities: OpportunityCreated[];
}

// Evaluate a completed inspection against decision engine rules and
// create any opportunities the winning rule requires.
//
// Semantics:
// - Rules evaluated in ascending priority. Lower priority number wins.
// - OpCo-scoped rules override the global default by name (name match
//   inside opco supersedes null opco_id).
// - First matching rule wins; no further rules are evaluated.
// - Side effects are idempotent: if an opportunity with the same
//   (inspection_id, type) already exists we skip creation.
export async function evaluateInspection(
  inspectionId: string,
): Promise<EvaluationResult> {
  const supabase = await createClient();

  const { data: insp, error: inspErr } = await supabase
    .from("inspections")
    .select("*")
    .eq("id", inspectionId)
    .maybeSingle<Inspection>();

  if (inspErr || !insp) {
    throw new Error(inspErr?.message ?? "Inspection not found");
  }

  const [{ data: findingsData }, { data: propertyData }, { data: rulesData }] =
    await Promise.all([
      supabase
        .from("inspection_findings")
        .select("*")
        .eq("inspection_id", inspectionId),
      insp.property_id
        ? supabase
            .from("properties")
            .select("*")
            .eq("id", insp.property_id)
            .maybeSingle<Property>()
        : Promise.resolve({ data: null }),
      supabase
        .from("decision_engine_rules")
        .select("*")
        .eq("active", true)
        .order("priority", { ascending: true }),
    ]);

  const findings = (findingsData ?? []) as InspectionFinding[];
  const property = (propertyData ?? null) as Property | null;
  const rules = resolveRules(
    (rulesData ?? []) as DecisionRule[],
    insp.opco_id,
  );

  const context = buildContext(insp, findings, property);

  const matchingRule = rules.find((r) => evaluateConditions(r.conditions, context));

  if (!matchingRule) {
    await logActivity({
      opcoId: insp.opco_id,
      userId: null,
      entityType: "inspection",
      entityId: insp.id,
      action: "decision_engine.no_match",
      detail: { score: insp.overall_score },
    });
    return {
      inspectionId: insp.id,
      matchedRuleId: null,
      matchedRuleName: null,
      opportunities: [],
    };
  }

  await logActivity({
    opcoId: insp.opco_id,
    userId: null,
    entityType: "inspection",
    entityId: insp.id,
    action: "decision_engine.rule_matched",
    detail: { rule_id: matchingRule.id, rule_name: matchingRule.name },
  });

  const opportunities: OpportunityCreated[] = [];

  if (matchingRule.actions.create_opportunity) {
    const created = await createOpportunityFromAction(
      supabase,
      insp,
      property,
      matchingRule,
      matchingRule.actions.create_opportunity,
      false,
    );
    if (created) opportunities.push(created);
  }

  if (matchingRule.actions.create_opportunity_secondary) {
    const created = await createOpportunityFromAction(
      supabase,
      insp,
      property,
      matchingRule,
      matchingRule.actions.create_opportunity_secondary,
      true,
    );
    if (created) opportunities.push(created);
  }

  return {
    inspectionId: insp.id,
    matchedRuleId: matchingRule.id,
    matchedRuleName: matchingRule.name,
    opportunities,
  };
}

interface EvaluationContext {
  score: number;
  severities: Set<FindingSeverity>;
  categories: Set<string>;
  maxSeverityRank: number;
  roofAge: number | null;
}

function buildContext(
  insp: Inspection,
  findings: InspectionFinding[],
  property: Property | null,
): EvaluationContext {
  const severities = new Set<FindingSeverity>();
  const categories = new Set<string>();
  let maxSeverityRank = 0;
  for (const f of findings) {
    severities.add(f.severity);
    categories.add(f.category);
    const rank = severityRank(f.severity);
    if (rank > maxSeverityRank) maxSeverityRank = rank;
  }
  return {
    score: insp.overall_score ?? 0,
    severities,
    categories,
    maxSeverityRank,
    roofAge: property?.roof_age_years ?? null,
  };
}

function evaluateConditions(
  conditions: DecisionRuleConditions,
  ctx: EvaluationContext,
): boolean {
  if (
    conditions.score_lte !== undefined &&
    ctx.score > conditions.score_lte
  ) {
    return false;
  }
  if (
    conditions.score_gte !== undefined &&
    ctx.score < conditions.score_gte
  ) {
    return false;
  }
  if (conditions.score_between) {
    const [lo, hi] = conditions.score_between;
    if (ctx.score < lo || ctx.score > hi) return false;
  }
  if (conditions.has_finding_severity) {
    const want = conditions.has_finding_severity;
    const any = want.some((sev) => ctx.severities.has(sev));
    if (!any) return false;
  }
  if (conditions.has_finding_category) {
    if (!ctx.categories.has(conditions.has_finding_category)) return false;
  }
  if (conditions.severity_gte) {
    if (ctx.maxSeverityRank < severityRank(conditions.severity_gte)) {
      return false;
    }
  }
  if (conditions.no_finding_severity_above) {
    const cap = severityRank(conditions.no_finding_severity_above);
    if (ctx.maxSeverityRank > cap) return false;
  }
  if (conditions.roof_age_gte !== undefined) {
    if (ctx.roofAge === null || ctx.roofAge < conditions.roof_age_gte) {
      return false;
    }
  }
  return true;
}

function severityRank(severity: FindingSeverity): number {
  return FINDING_SEVERITY_ORDER.indexOf(severity) + 1;
}

// When both a default (opco_id null) and an OpCo-scoped rule share a name,
// the OpCo rule supersedes the default. Otherwise the full union is kept.
function resolveRules(
  rules: DecisionRule[],
  opcoId: string | null,
): DecisionRule[] {
  const scoped = rules.filter((r) => r.opco_id === opcoId);
  const defaults = rules.filter((r) => r.opco_id === null);
  const scopedNames = new Set(scoped.map((r) => r.name));
  const merged = [
    ...scoped,
    ...defaults.filter((r) => !scopedNames.has(r.name)),
  ];
  return merged.sort((a, b) => a.priority - b.priority);
}

type DecisionEngineSupabase = Awaited<ReturnType<typeof createClient>>;

async function createOpportunityFromAction(
  supabase: DecisionEngineSupabase,
  inspection: Inspection,
  property: Property | null,
  rule: DecisionRule,
  action: DecisionRuleAction,
  isSecondary: boolean,
): Promise<OpportunityCreated | null> {
  const { data: existing } = await supabase
    .from("opportunities")
    .select("id")
    .eq("inspection_id", inspection.id)
    .eq("type", action.type)
    .maybeSingle<{ id: string }>();

  if (existing) {
    return {
      opportunityId: existing.id,
      type: action.type,
      priority: action.priority,
      ruleId: rule.id,
      ruleName: rule.name,
      isSecondary,
    };
  }

  const notes = renderTemplate(action.notes_template, {
    score: inspection.overall_score ?? 0,
    roof_age: property?.roof_age_years ?? "?",
    band: inspection.condition_band ?? "?",
  });

  // Use the SECURITY DEFINER RPC so inspectors (whose RBAC usually excludes
  // direct INSERT on opportunities) can still trigger creation via the
  // completion flow. The RPC verifies the inspection's OpCo match.
  const { data: opportunityId, error: rpcError } = await supabase.rpc(
    "create_inspection_opportunity",
    {
      p_inspection_id: inspection.id,
      p_type: action.type,
      p_priority: action.priority,
      p_notes: notes,
    },
  );

  if (rpcError || !opportunityId) {
    console.error("[decision-engine] opportunity creation failed", rpcError);
    return null;
  }

  await logActivity({
    opcoId: inspection.opco_id,
    userId: null,
    entityType: "opportunity",
    entityId: opportunityId as string,
    action: "opportunity.created_from_inspection",
    detail: {
      inspection_id: inspection.id,
      rule_name: rule.name,
      type: action.type,
      priority: action.priority,
    },
  });

  return {
    opportunityId: opportunityId as string,
    type: action.type,
    priority: action.priority,
    ruleId: rule.id,
    ruleName: rule.name,
    isSecondary,
  };
}

function renderTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const v = vars[key as keyof typeof vars];
    return v === undefined ? match : String(v);
  });
}

export type { DecisionRuleActions };
