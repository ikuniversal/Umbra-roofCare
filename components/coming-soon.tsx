import { PageHeader } from "@/components/page-header";

export function ComingSoon({
  phase,
  title,
  description,
  eyebrow,
}: {
  phase: number;
  title: string;
  description: string;
  eyebrow?: string;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        eyebrow={eyebrow ?? `Module · Phase ${phase}`}
        title={title}
        description={description}
      />
      <div className="mt-10 flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-brand-border-strong bg-brand-card/60 py-20 text-center">
        <p className="label-mono">In development</p>
        <p className="font-serif text-2xl font-light text-brand-primary">
          Coming in Phase {phase}
        </p>
        <p className="max-w-md text-sm text-brand-muted">
          This module is scheduled for a later phase. The Phase 1 foundation
          ships the schema, RBAC, and shell that make it possible.
        </p>
      </div>
    </div>
  );
}
