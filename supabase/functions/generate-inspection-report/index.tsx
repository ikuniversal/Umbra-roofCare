// Supabase Edge Function: generate-inspection-report
//
// Renders a PDF report for a completed inspection using @react-pdf/renderer,
// uploads it to the private `inspection-reports` bucket, signs a 7-day URL,
// and stores the signed URL on the inspection record.
//
// Invoked from the app via `supabase.functions.invoke("generate-inspection-report",
// { body: { inspection_id } })`.

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
  pdf,
} from "@react-pdf/renderer";
import { createClient } from "@supabase/supabase-js";

// ---- Branding tokens mirroring tailwind.config.ts --------------------
const BRAND = {
  primary: "#1F2937",
  accent: "#D97706",
  bg: "#FAF7F0",
  card: "#FFFFFF",
  muted: "#6B6358",
  faint: "#9A9184",
  border: "#E4DDC9",
  success: "#3A6E42",
  warn: "#A06428",
  error: "#9B2C2C",
} as const;

// Register editorial fonts. Google Fonts direct URLs work from Deno's
// fetch context inside the function runtime.
Font.register({
  family: "Fraunces",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/fraunces/v35/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk.woff2",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/fraunces/v35/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea9wxXmAk.woff2",
      fontWeight: 700,
    },
  ],
});
Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIa2ZL7.woff2",
      fontWeight: 600,
    },
  ],
});
Font.register({
  family: "IBMPlexMono",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n1ioSG1tQI_hMnFZrc9P0ww.woff2",
      fontWeight: 500,
    },
  ],
});

interface ReportData {
  inspection: {
    id: string;
    opco_id: string;
    member_id: string | null;
    property_id: string | null;
    overall_score: number | null;
    condition_band: string | null;
    recommended_action: string | null;
    score_breakdown: Record<string, number | { score: number; weight: number }> | null;
    completed_at: string | null;
    scheduled_for: string | null;
    weather_at_inspection: string | null;
    notes: string | null;
    checkpoint_results: Array<{
      checkpoint_id: string;
      rating: string | null;
      notes: string | null;
      photo_urls: string[];
    }> | null;
    photos_manifest: { hero_photo_urls?: string[] } | null;
  };
  member: { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
  property: {
    street: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    roof_material: string | null;
    roof_age_years: number | null;
  } | null;
  inspector: { full_name: string | null; email: string | null } | null;
  findings: Array<{
    id: string;
    category: string;
    severity: string;
    description: string;
    location: string | null;
    photo_urls: string[] | null;
    estimated_repair_cents: number | null;
  }>;
  opportunities: Array<{
    id: string;
    type: string | null;
    priority: string;
    status: string;
    notes: string | null;
  }>;
  template: {
    name: string;
    checkpoints: Array<{
      id: string;
      label: string;
      category: string;
      weight: number;
      order: number;
    }>;
  } | null;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: BRAND.bg,
    padding: 36,
    fontFamily: "Inter",
    fontSize: 10,
    color: BRAND.primary,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    paddingBottom: 14,
    marginBottom: 18,
  },
  brand: {
    fontFamily: "Fraunces",
    fontWeight: 700,
    fontSize: 22,
    color: BRAND.primary,
  },
  brandSub: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 9,
    color: BRAND.muted,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 2,
  },
  label: {
    fontFamily: "IBMPlexMono",
    fontSize: 7,
    color: BRAND.muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: 500,
  },
  metric: {
    fontFamily: "Fraunces",
    fontWeight: 700,
    fontSize: 28,
    color: BRAND.primary,
  },
  h1: {
    fontFamily: "Fraunces",
    fontWeight: 700,
    fontSize: 20,
    color: BRAND.primary,
    marginTop: 4,
  },
  h2: {
    fontFamily: "Fraunces",
    fontWeight: 700,
    fontSize: 14,
    color: BRAND.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  body: { fontFamily: "Inter", fontSize: 10, color: BRAND.primary, lineHeight: 1.4 },
  muted: { color: BRAND.muted },
  row: { flexDirection: "row", gap: 12 },
  card: {
    backgroundColor: BRAND.card,
    borderColor: BRAND.border,
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
  },
  scoreCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    backgroundColor: BRAND.bg,
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  col: { flex: 1 },
  colNarrow: { width: 60, textAlign: "right" },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 8,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const BAND_COLOR: Record<string, string> = {
  healthy: BRAND.success,
  moderate: BRAND.accent,
  high_risk: BRAND.warn,
  critical: BRAND.error,
};

const SEV_COLOR: Record<string, string> = {
  info: BRAND.muted,
  minor: BRAND.primary,
  moderate: BRAND.accent,
  severe: BRAND.warn,
  critical: BRAND.error,
};

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ReportDocument({ data }: { data: ReportData }) {
  const { inspection, member, property, inspector, findings, opportunities, template } = data;
  const address = property
    ? [property.street, property.city, property.state, property.zip]
        .filter(Boolean)
        .join(", ")
    : "—";
  const bandColor = inspection.condition_band
    ? BAND_COLOR[inspection.condition_band] ?? BRAND.muted
    : BRAND.muted;

  const hero = inspection.photos_manifest?.hero_photo_urls ?? [];

  // Normalize score breakdown. Seed inserts `{ category: number }`, but
  // the app saves the new `{ score, weight }` shape — handle both.
  const breakdownEntries = Object.entries(inspection.score_breakdown ?? {}).map(
    ([category, v]) => {
      if (typeof v === "number") {
        return { category, percent: Math.round(v) };
      }
      return {
        category,
        percent: v.weight > 0 ? Math.round((v.score / v.weight) * 100) : 0,
      };
    },
  );

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <View>
              <Text style={styles.brand}>Umbra</Text>
              <Text style={styles.brandSub}>RoofCare · Inspection report</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.label}>Inspection ID</Text>
              <Text
                style={{
                  fontFamily: "IBMPlexMono",
                  fontSize: 8,
                  color: BRAND.primary,
                  marginTop: 2,
                }}
              >
                {inspection.id.slice(0, 8)}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.h1}>
          {member ? `${member.first_name} ${member.last_name}` : "Inspection report"}
        </Text>
        <Text style={[styles.body, styles.muted, { marginTop: 2 }]}>{address}</Text>

        <View style={[styles.row, { marginTop: 16 }]}>
          <View style={[styles.card, { width: 200, alignItems: "center" }]}>
            <View style={[styles.scoreCircle, { borderColor: bandColor }]}>
              <Text style={styles.metric}>
                {inspection.overall_score ?? "—"}
              </Text>
              <Text style={styles.label}>Score</Text>
            </View>
            {inspection.condition_band ? (
              <Text
                style={{
                  marginTop: 8,
                  color: bandColor,
                  fontFamily: "Fraunces",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {titleCase(inspection.condition_band)}
              </Text>
            ) : null}
            {inspection.recommended_action ? (
              <Text style={[styles.label, { marginTop: 4 }]}>
                Action · {titleCase(inspection.recommended_action)}
              </Text>
            ) : null}
          </View>

          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.label}>Details</Text>
            <View style={{ marginTop: 8, gap: 6 }}>
              <DetailRow label="Inspector" value={inspector?.full_name ?? inspector?.email ?? "—"} />
              <DetailRow label="Scheduled" value={formatDate(inspection.scheduled_for)} />
              <DetailRow label="Completed" value={formatDate(inspection.completed_at)} />
              <DetailRow label="Weather" value={inspection.weather_at_inspection ?? "—"} />
              {property?.roof_material ? (
                <DetailRow label="Roof material" value={titleCase(property.roof_material)} />
              ) : null}
              {property?.roof_age_years !== null && property?.roof_age_years !== undefined ? (
                <DetailRow label="Roof age" value={`${property.roof_age_years}y`} />
              ) : null}
            </View>
          </View>
        </View>

        {breakdownEntries.length > 0 ? (
          <>
            <Text style={styles.h2}>Score by category</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.label, styles.col]}>Category</Text>
                <Text style={[styles.label, styles.colNarrow]}>%</Text>
              </View>
              {breakdownEntries.map((row) => (
                <View key={row.category} style={styles.tableRow}>
                  <Text style={[styles.body, styles.col]}>{row.category}</Text>
                  <Text
                    style={[
                      styles.body,
                      styles.colNarrow,
                      { fontFamily: "Fraunces", fontWeight: 700 },
                    ]}
                  >
                    {row.percent}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.h2}>Findings ({findings.length})</Text>
        {findings.length === 0 ? (
          <Text style={[styles.body, styles.muted]}>
            No specific findings recorded.
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {findings.map((f) => (
              <View key={f.id} style={styles.card}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={[
                      styles.badge,
                      {
                        color: SEV_COLOR[f.severity] ?? BRAND.muted,
                        borderColor: SEV_COLOR[f.severity] ?? BRAND.border,
                      },
                    ]}
                  >
                    {titleCase(f.severity)}
                  </Text>
                  {f.estimated_repair_cents ? (
                    <Text
                      style={{
                        fontFamily: "Fraunces",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      ${(f.estimated_repair_cents / 100).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.body, { marginTop: 6 }]}>
                  {f.description}
                </Text>
                <Text style={[styles.label, { marginTop: 4 }]}>
                  {titleCase(f.category)}
                  {f.location ? ` · ${f.location}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {hero.length > 0 ? (
          <>
            <Text style={styles.h2}>Representative photos</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {hero.slice(0, 6).map((url, i) => (
                <View
                  key={`${url}-${i}`}
                  style={{
                    width: 160,
                    height: 110,
                    borderRadius: 4,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: BRAND.border,
                    backgroundColor: BRAND.border,
                  }}
                >
                  {/* react-pdf falls back silently when images fail to fetch. */}
                  <Image src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {opportunities.length > 0 ? (
          <>
            <Text style={styles.h2}>Decision engine output</Text>
            <View style={{ gap: 6 }}>
              {opportunities.map((o) => (
                <View key={o.id} style={styles.card}>
                  <Text
                    style={{
                      fontFamily: "Fraunces",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {titleCase(o.type ?? "opportunity")} · {titleCase(o.priority)}
                  </Text>
                  {o.notes ? (
                    <Text style={[styles.body, styles.muted, { marginTop: 4 }]}>
                      {o.notes}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {inspection.notes ? (
          <>
            <Text style={styles.h2}>Inspector notes</Text>
            <Text style={styles.body}>{inspection.notes}</Text>
          </>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={[styles.label, styles.muted]}>
            {inspector?.full_name ?? inspector?.email ?? "Umbra Inspector"}
          </Text>
          <Text style={[styles.label, styles.muted]}>
            Template · {template?.name ?? "Umbra Standard"}
          </Text>
          <Text
            style={[styles.label, styles.muted]}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>
  );
}

async function loadReportData(
  supabase: ReturnType<typeof createClient>,
  inspectionId: string,
): Promise<ReportData | null> {
  const { data: insp } = await supabase
    .from("inspections")
    .select("*")
    .eq("id", inspectionId)
    .maybeSingle();
  if (!insp) return null;

  const [
    { data: member },
    { data: property },
    { data: inspector },
    { data: findings },
    { data: opportunities },
    { data: template },
  ] = await Promise.all([
    insp.member_id
      ? supabase
          .from("members")
          .select("first_name,last_name,email,phone")
          .eq("id", insp.member_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    insp.property_id
      ? supabase
          .from("properties")
          .select("street,city,state,zip,roof_material,roof_age_years")
          .eq("id", insp.property_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    insp.inspector_id
      ? supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", insp.inspector_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("inspection_findings")
      .select("*")
      .eq("inspection_id", insp.id)
      .order("severity", { ascending: false }),
    supabase
      .from("opportunities")
      .select("id,type,priority,status,notes")
      .eq("inspection_id", insp.id),
    insp.template_id
      ? supabase
          .from("inspection_templates")
          .select("name,checkpoints")
          .eq("id", insp.template_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    inspection: insp,
    member,
    property,
    inspector,
    findings: findings ?? [],
    opportunities: opportunities ?? [],
    template,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      ...(init.headers ?? {}),
    },
  });
}

// deno-lint-ignore no-explicit-any
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  let body: { inspection_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }
  const inspectionId = body.inspection_id;
  if (!inspectionId) {
    return jsonResponse({ error: "inspection_id required" }, { status: 400 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: "Server not configured" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const data = await loadReportData(supabase, inspectionId);
  if (!data) return jsonResponse({ error: "Inspection not found" }, { status: 404 });

  const element = React.createElement(ReportDocument, { data });
  const stream = await pdf(element as any).toBuffer();
  // toBuffer returns a Node stream shim; collect bytes.
  const chunks: Uint8Array[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  const pdfBytes = new Uint8Array(
    chunks.reduce((acc, c) => acc + c.byteLength, 0),
  );
  let offset = 0;
  for (const c of chunks) {
    pdfBytes.set(c, offset);
    offset += c.byteLength;
  }

  const path = `${data.inspection.opco_id}/${data.inspection.id}/report-${Date.now()}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("inspection-reports")
    .upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) {
    return jsonResponse({ error: upErr.message }, { status: 500 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from("inspection-reports")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr || !signed?.signedUrl) {
    return jsonResponse(
      { error: signErr?.message ?? "Could not sign URL" },
      { status: 500 },
    );
  }

  await supabase
    .from("inspections")
    .update({ report_pdf_url: signed.signedUrl })
    .eq("id", data.inspection.id);

  await supabase.from("activity_log").insert({
    opco_id: data.inspection.opco_id,
    entity_type: "inspection",
    entity_id: data.inspection.id,
    action: "inspection.report_generated",
    detail: { path },
  });

  return jsonResponse({ signed_url: signed.signedUrl, path });
});
