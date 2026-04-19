// Supabase's deploy bundler expects `index.ts` as the entrypoint. The
// actual handler lives in `index.tsx`; importing it here registers
// `Deno.serve` at top level.
import "./index.tsx";
