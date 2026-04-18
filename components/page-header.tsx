import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-brand-border pb-6 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow ? <p className="label-mono">{eyebrow}</p> : null}
        <h1 className="mt-2 font-serif text-3xl font-light tracking-tight text-brand-primary md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-brand-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
