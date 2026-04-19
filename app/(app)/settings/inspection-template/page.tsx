import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canEditInspectionTemplate } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { InspectionTemplate, TemplateCheckpoint } from "@/lib/types";
import {
  DEFAULT_CHECKPOINTS,
  DEFAULT_TEMPLATE_NAME,
} from "@/lib/inspections/template";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateEditor } from "./template-editor";

export default async function InspectionTemplateSettingsPage() {
  const session = await requireSession();
  if (!canEditInspectionTemplate(session.roles)) redirect("/settings/profile");

  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("inspection_templates")
    .select("*")
    .or(
      session.opcoId
        ? `opco_id.is.null,opco_id.eq.${session.opcoId}`
        : "opco_id.is.null",
    )
    .order("opco_id", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  const rows = (templates ?? []) as InspectionTemplate[];
  const editable = rows.find((t) => t.opco_id === session.opcoId && session.opcoId !== null);
  const fallback = rows.find((t) => t.opco_id === null);
  const chosen = editable ?? fallback;

  const checkpoints: TemplateCheckpoint[] = chosen?.checkpoints
    ? (chosen.checkpoints as TemplateCheckpoint[])
    : DEFAULT_CHECKPOINTS;

  return (
    <div className="space-y-6">
      <div>
        <p className="label-mono">Phase 3 · Delivery</p>
        <h2 className="mt-1 font-serif text-2xl font-light text-brand-primary">
          Inspection template
        </h2>
        <p className="mt-2 text-sm text-brand-muted">
          Tune the 20-point scoring checklist inspectors use in the field.
          Weights sum to the maximum possible score (ideally 100). OpCo-level
          templates override the Umbra default.
        </p>
      </div>

      <Card>
        <CardHeader>
          <p className="label-mono">
            {chosen?.opco_id ? "OpCo template" : "Umbra default"}
          </p>
          <CardTitle>
            {chosen?.name ?? DEFAULT_TEMPLATE_NAME}
            <span className="ml-2 text-sm text-brand-muted">
              v{chosen?.version ?? 1}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateEditor
            opcoId={session.opcoId}
            template={chosen ?? null}
            initialCheckpoints={checkpoints}
          />
        </CardContent>
      </Card>
    </div>
  );
}
