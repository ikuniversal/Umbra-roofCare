// Supabase's deploy bundler expects `index.ts` as the entrypoint. The
// actual handler lives in `index.tsx` (JSX needs the .tsx extension for
// Deno's parser); importing it here registers `Deno.serve` at top level.
import "./index.tsx";
