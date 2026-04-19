import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canCaptureInspection } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  Inspection,
  InspectionFinding,
  InspectionTemplate,
  Member,
  Property,
  TemplateCheckpoint,
} from "@/lib/types";
import {
  DEFAULT_CHECKPOINTS,
  sortCheckpoints,
} from "@/lib/inspections/template";
import { mergeResults } from "@/lib/inspections/scoring";
import { CaptureFlow } from "./capture-flow";

export default async function CapturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const { data: insp } = await supabase
    .from("inspections")
    .select("*")
    .eq("id", id)
    .maybeSingle<Inspection>();
  if (!insp) notFound();

  if (
    !canCaptureInspection(
      session.roles,
      { inspector_id: insp.inspector_id, status: insp.status },
      session.userId,
    )
  ) {
    redirect(`/inspections/${id}`);
  }

  const [memberRes, propRes, templateRes, findingsRes] = await Promise.all([
    insp.member_id
      ? supabase
          .from("members")
          .select("id, first_name, last_name")
          .eq("id", insp.member_id)
          .maybeSingle<Pick<Member, "id" | "first_name" | "last_name">>()
      : Promise.resolve({ data: null }),
    insp.property_id
      ? supabase
          .from("properties")
          .select("id, street, city, state, zip")
          .eq("id", insp.property_id)
          .maybeSingle<Pick<Property, "id" | "street" | "city" | "state" | "zip">>()
      : Promise.resolve({ data: null }),
    insp.template_id
      ? supabase
          .from("inspection_templates")
          .select("*")
          .eq("id", insp.template_id)
          .maybeSingle<InspectionTemplate>()
      : Promise.resolve({ data: null }),
    supabase
      .from("inspection_findings")
      .select("*")
      .eq("inspection_id", insp.id),
  ]);

  const member = (memberRes.data ?? null) as Pick<
    Member,
    "id" | "first_name" | "last_name"
  > | null;
  const property = (propRes.data ?? null) as Pick<
    Property,
    "id" | "street" | "city" | "state" | "zip"
  > | null;
  const template = (templateRes.data ?? null) as InspectionTemplate | null;
  const findings = (findingsRes.data ?? []) as InspectionFinding[];

  const checkpoints: TemplateCheckpoint[] = template?.checkpoints
    ? (template.checkpoints as TemplateCheckpoint[])
    : DEFAULT_CHECKPOINTS;
  const sorted = sortCheckpoints(checkpoints);
  const results = mergeResults(sorted, insp.checkpoint_results);

  return (
    <div className="min-h-screen bg-brand-bg pb-32">
      <CaptureFlow
        inspectionId={insp.id}
        opcoId={insp.opco_id ?? ""}
        member={member}
        property={property}
        checkpoints={sorted}
        initialResults={results}
        initialFindings={findings}
      />
    </div>
  );
}
