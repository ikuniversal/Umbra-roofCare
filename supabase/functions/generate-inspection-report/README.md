# generate-inspection-report

Renders an inspection PDF report with `@react-pdf/renderer` (Deno build),
uploads it to the private `inspection-reports` storage bucket, signs a
7-day URL, and writes that URL onto `inspections.report_pdf_url`.

## Deploy

CLI:

```bash
supabase functions deploy generate-inspection-report \
  --project-ref <YOUR_PROJECT_REF>
```

Or via the Supabase dashboard: **Edge Functions → Create function →**
paste the contents of `index.tsx` and `deno.json`.

The function inherits `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
the project's default secrets, so no extra env vars are required.

## Invocation

```ts
await supabase.functions.invoke("generate-inspection-report", {
  body: { inspection_id: "<uuid>" },
});
```

Returns `{ signed_url, path }` on success.
