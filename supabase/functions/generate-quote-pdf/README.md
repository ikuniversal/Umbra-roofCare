# generate-quote-pdf

Renders a customer-facing quote PDF via `@react-pdf/renderer` on Deno,
uploads to the private `inspection-reports` bucket, signs a 30-day URL,
and writes it back to `quotes.pdf_url`.

## Deploy

```bash
supabase functions deploy generate-quote-pdf --project-ref <PROJECT_REF>
```

Or via the Supabase dashboard: Edge Functions → Create function → paste
`index.tsx` and `deno.json`.

The function inherits `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
the project's default secrets.

## Invocation

```ts
await supabase.functions.invoke("generate-quote-pdf", {
  body: { quote_id: "<uuid>" },
});
```

Returns `{ signed_url, path }`.
