import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canEditDecisionRules } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { DecisionRule } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RulesEditor } from "./rules-editor";

export default async function DecisionEngineSettingsPage() {
  const session = await requireSession();
  if (!canEditDecisionRules(session.roles)) redirect("/settings/profile");

  const supabase = await createClient();
  const { data } = await supabase
    .from("decision_engine_rules")
    .select("*")
    .or(
      session.opcoId
        ? `opco_id.is.null,opco_id.eq.${session.opcoId}`
        : "opco_id.is.null",
    )
    .order("priority", { ascending: true });

  const rules = (data ?? []) as DecisionRule[];

  return (
    <div className="space-y-6">
      <div>
        <p className="label-mono">Phase 3 · Delivery</p>
        <h2 className="mt-1 font-serif text-2xl font-light text-brand-primary">
          Decision Engine rules
        </h2>
        <p className="mt-2 text-sm text-brand-muted">
          When an inspection completes, rules evaluate in ascending priority
          order. First match wins. OpCo rules override Umbra defaults by name.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="label-mono">All rules</p>
          <CardTitle>
            {rules.length} rule{rules.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RulesEditor opcoId={session.opcoId} rules={rules} />
        </CardContent>
      </Card>
    </div>
  );
}
