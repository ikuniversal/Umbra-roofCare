"use client";

import Image from "next/image";
import { useState } from "react";
import { X } from "lucide-react";

interface PhotoGridProps {
  urls: string[];
  captions?: Record<string, string>;
  emptyMessage?: string;
  columns?: 2 | 3 | 4;
}

export function PhotoGrid({
  urls,
  captions,
  emptyMessage = "No photos yet.",
  columns = 3,
}: PhotoGridProps) {
  const [selected, setSelected] = useState<string | null>(null);

  if (urls.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-brand-border px-4 py-8 text-center text-sm text-brand-muted">
        {emptyMessage}
      </p>
    );
  }

  const gridCols =
    columns === 2
      ? "grid-cols-2"
      : columns === 4
        ? "grid-cols-2 md:grid-cols-4"
        : "grid-cols-2 md:grid-cols-3";

  return (
    <>
      <div className={`grid gap-3 ${gridCols}`}>
        {urls.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => setSelected(url)}
            className="group overflow-hidden rounded-md border border-brand-border bg-brand-card transition-colors hover:border-brand-border-strong"
          >
            <div className="relative aspect-[4/3] w-full bg-brand-bg">
              <Image
                src={url}
                alt={captions?.[url] ?? "Inspection photo"}
                fill
                sizes="(min-width: 768px) 33vw, 50vw"
                className="object-cover transition-transform group-hover:scale-[1.02]"
                unoptimized
              />
            </div>
            {captions?.[url] ? (
              <p className="px-3 py-2 text-xs text-brand-muted">
                {captions[url]}
              </p>
            ) : null}
          </button>
        ))}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/80 p-4"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal
        >
          <div className="relative max-h-[90vh] max-w-4xl">
            <Image
              src={selected}
              alt="Inspection photo"
              width={1600}
              height={1200}
              className="max-h-[90vh] w-auto rounded-md"
              unoptimized
            />
            <button
              type="button"
              className="absolute right-2 top-2 rounded-full bg-brand-bg p-2 text-brand-primary"
              onClick={(e) => {
                e.stopPropagation();
                setSelected(null);
              }}
              aria-label="Close photo"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
