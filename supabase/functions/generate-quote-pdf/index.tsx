// Supabase Edge Function: generate-quote-pdf
//
// Renders a customer-facing quote PDF, uploads to the private
// `inspection-reports` bucket, signs a 30-day URL, and writes it back to
// quotes.pdf_url. Mirrors generate-inspection-report's architecture.

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";
import { createClient } from "@supabase/supabase-js";

const BRAND = {
  primary: "#1F2937",
  accent: "#D97706",
  bg: "#FAF7F0",
  card: "#FFFFFF",
  muted: "#6B6358",
  faint: "#9A9184",
  border: "#E4DDC9",
  success: "#3A6E42",
  error: "#9B2C2C",
} as const;

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

interface QuoteData {
  quote: {
    id: string;
    opco_id: string;
    opportunity_id: string;
    quote_number: string;
    valid_until: string | null;
    subtotal_materials: number;
    subtotal_labor: number;
    discount_amount: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    notes: string | null;
    terms: string | null;
    created_at: string;
  };
  opco: {
    name: string;
    state: string | null;
    contractor_license_number: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  member: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  property: {
    street: string;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
  preparedBy: { full_name: string | null; email: string | null } | null;
  lineItems: Array<{
    id: string;
    kind: string;
    description: string;
    quantity: number;
    unit: string | null;
    unit_price: number;
    line_total: number;
  }>;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: BRAND.bg,
    padding: 40,
    fontFamily: "Inter",
    fontSize: 10,
    color: BRAND.primary,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    paddingBottom: 16,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brand: { fontFamily: "Fraunces", fontWeight: 700, fontSize: 22 },
  sub: {
    fontFamily: "Inter",
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
  h1: {
    fontFamily: "Fraunces",
    fontWeight: 700,
    fontSize: 18,
    marginBottom: 6,
  },
  h2: {
    fontFamily: "Fraunces",
    fontWeight: 700,
    fontSize: 13,
    marginBottom: 6,
    marginTop: 16,
  },
  row: { flexDirection: "row", gap: 12 },
  card: {
    backgroundColor: BRAND.card,
    borderColor: BRAND.border,
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    flex: 1,
  },
  table: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 4,
  },
  thead: {
    backgroundColor: BRAND.bg,
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  colDesc: { flex: 3 },
  colQty: { width: 40, textAlign: "right" },
  colUnit: { width: 40, textAlign: "right" },
  colPrice: { width: 60, textAlign: "right" },
  colTotal: { width: 60, textAlign: "right" },
  body: { fontFamily: "Inter", fontSize: 10, color: BRAND.primary },
  muted: { color: BRAND.muted },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function fmtMoney(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const KIND_LABEL: Record<string, string> = {
  material: "Materials",
  labor: "Labor",
  fee: "Fees",
  discount: "Discounts",
};

const KIND_ORDER = ["material", "labor", "fee", "discount"];

function QuoteDocument({ data }: { data: QuoteData }) {
  const { quote, opco, member, property, preparedBy, lineItems } = data;
  const groups: Record<string, QuoteData["lineItems"]> = {};
  for (const li of lineItems) {
    (groups[li.kind] ??= []).push(li);
  }
  const address = property
    ? [property.street, property.city, property.state, property.zip]
        .filter(Boolean)
        .join(", ")
    : "—";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Umbra</Text>
            <Text style={styles.sub}>
              RoofCare · {opco?.name ?? ""}
              {opco?.state ? ` · ${opco.state}` : ""}
            </Text>
            {opco?.contractor_license_number ? (
              <Text style={[styles.label, { marginTop: 6 }]}>
                License #{opco.contractor_license_number}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.label}>Quote number</Text>
            <Text
              style={{
                fontFamily: "Fraunces",
                fontWeight: 700,
                fontSize: 16,
                marginTop: 2,
              }}
            >
              {quote.quote_number}
            </Text>
            <Text style={[styles.label, { marginTop: 6 }]}>
              Issued {fmtDate(quote.created_at)}
            </Text>
            {quote.valid_until ? (
              <Text style={styles.label}>
                Valid until {fmtDate(quote.valid_until)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.card}>
            <Text style={styles.label}>Prepared for</Text>
            <Text style={[styles.h1, { marginTop: 4 }]}>
              {member
                ? `${member.first_name} ${member.last_name}`
                : "Valued member"}
            </Text>
            <Text style={[styles.body, styles.muted]}>{address}</Text>
            {member?.email ? (
              <Text style={[styles.body, styles.muted, { marginTop: 4 }]}>
                {member.email}
              </Text>
            ) : null}
            {member?.phone ? (
              <Text style={[styles.body, styles.muted]}>{member.phone}</Text>
            ) : null}
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Prepared by</Text>
            <Text style={[styles.h1, { marginTop: 4 }]}>
              {preparedBy?.full_name ?? preparedBy?.email ?? "Umbra team"}
            </Text>
            {opco?.phone ? (
              <Text style={[styles.body, styles.muted]}>{opco.phone}</Text>
            ) : null}
            {opco?.email ? (
              <Text style={[styles.body, styles.muted]}>{opco.email}</Text>
            ) : null}
          </View>
        </View>

        {KIND_ORDER.map((kind) => {
          const rows = groups[kind];
          if (!rows || rows.length === 0) return null;
          return (
            <View key={kind}>
              <Text style={styles.h2}>{KIND_LABEL[kind]}</Text>
              <View style={styles.table}>
                <View style={styles.thead}>
                  <Text style={[styles.label, styles.colDesc]}>Description</Text>
                  <Text style={[styles.label, styles.colQty]}>Qty</Text>
                  <Text style={[styles.label, styles.colUnit]}>Unit</Text>
                  <Text style={[styles.label, styles.colPrice]}>Price</Text>
                  <Text style={[styles.label, styles.colTotal]}>Total</Text>
                </View>
                {rows.map((r) => (
                  <View key={r.id} style={styles.tr}>
                    <Text style={[styles.body, styles.colDesc]}>
                      {r.description}
                    </Text>
                    <Text style={[styles.body, styles.colQty]}>
                      {r.quantity}
                    </Text>
                    <Text style={[styles.body, styles.colUnit, styles.muted]}>
                      {r.unit ?? "—"}
                    </Text>
                    <Text style={[styles.body, styles.colPrice, styles.muted]}>
                      {fmtMoney(r.unit_price)}
                    </Text>
                    <Text
                      style={[
                        styles.body,
                        styles.colTotal,
                        { fontFamily: "Fraunces", fontWeight: 700 },
                      ]}
                    >
                      {fmtMoney(r.line_total)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <View
          style={[
            styles.card,
            {
              marginTop: 20,
              alignSelf: "flex-end",
              width: 260,
            },
          ]}
        >
          <TotalsRow label="Materials" value={quote.subtotal_materials} />
          <TotalsRow label="Labor" value={quote.subtotal_labor} />
          {quote.discount_amount > 0 ? (
            <TotalsRow label="Discount" value={-quote.discount_amount} />
          ) : null}
          <TotalsRow
            label={`Tax (${(quote.tax_rate * 100).toFixed(2)}%)`}
            value={quote.tax_amount}
          />
          <View
            style={{
              marginTop: 6,
              paddingTop: 6,
              borderTopWidth: 1,
              borderTopColor: BRAND.border,
            }}
          >
            <View style={styles.totalsRow}>
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Total
              </Text>
              <Text
                style={{
                  fontFamily: "Fraunces",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {fmtMoney(quote.total)}
              </Text>
            </View>
          </View>
        </View>

        {quote.notes ? (
          <>
            <Text style={styles.h2}>Notes</Text>
            <Text style={styles.body}>{quote.notes}</Text>
          </>
        ) : null}
        {quote.terms ? (
          <>
            <Text style={styles.h2}>Terms</Text>
            <Text style={styles.body}>{quote.terms}</Text>
          </>
        ) : null}

        <View style={{ marginTop: 30 }}>
          <Text style={styles.label}>Accepted by</Text>
          <View
            style={{
              marginTop: 30,
              borderTopWidth: 1,
              borderTopColor: BRAND.primary,
              width: 220,
            }}
          />
          <Text style={[styles.label, { marginTop: 4 }]}>Signature + date</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={[styles.label, styles.muted]}>
            {opco?.name ?? "Umbra RoofCare"}
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

function TotalsRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.totalsRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.body}>{fmtMoney(value)}</Text>
    </View>
  );
}

async function loadData(
  supabase: ReturnType<typeof createClient>,
  quoteId: string,
): Promise<QuoteData | null> {
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return null;

  const [{ data: lineItems }, { data: opp }, { data: opco }, { data: preparedBy }] =
    await Promise.all([
      supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", quote.id)
        .order("kind", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("opportunities")
        .select("member_id, inspection_id")
        .eq("id", quote.opportunity_id)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("name, state, contractor_license_number, phone, email")
        .eq("id", quote.opco_id)
        .maybeSingle(),
      quote.prepared_by
        ? supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", quote.prepared_by)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  let member = null;
  let property = null;
  if (opp?.member_id) {
    const { data } = await supabase
      .from("members")
      .select("first_name, last_name, email, phone")
      .eq("id", opp.member_id)
      .maybeSingle();
    member = data;
    const { data: propData } = await supabase
      .from("properties")
      .select("street, city, state, zip")
      .eq("member_id", opp.member_id)
      .eq("is_primary", true)
      .maybeSingle();
    property = propData;
  }

  return {
    quote,
    opco,
    member,
    property,
    preparedBy,
    lineItems: lineItems ?? [],
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

  let body: { quote_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }
  const quoteId = body.quote_id;
  if (!quoteId) {
    return jsonResponse({ error: "quote_id required" }, { status: 400 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: "Server not configured" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const data = await loadData(supabase, quoteId);
  if (!data) return jsonResponse({ error: "Quote not found" }, { status: 404 });

  const element = React.createElement(QuoteDocument, { data });
  const stream = await pdf(element as any).toBuffer();
  const chunks: Uint8Array[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const pdfBytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    pdfBytes.set(c, offset);
    offset += c.byteLength;
  }

  const path = `${data.quote.opco_id}/quotes/${data.quote.id}-${Date.now()}.pdf`;
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
    .createSignedUrl(path, 60 * 60 * 24 * 30);
  if (signErr || !signed?.signedUrl) {
    return jsonResponse(
      { error: signErr?.message ?? "Could not sign URL" },
      { status: 500 },
    );
  }

  await supabase
    .from("quotes")
    .update({ pdf_url: signed.signedUrl })
    .eq("id", quoteId);

  return jsonResponse({ signed_url: signed.signedUrl, path });
});
