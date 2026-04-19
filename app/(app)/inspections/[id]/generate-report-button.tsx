"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GenerateReportButton({
  inspectionId,
  currentUrl,
}: {
  inspectionId: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = async () => {
    setStatus(null);
    setPending(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke(
        "generate-inspection-report",
        { body: { inspection_id: inspectionId } },
      );
      if (error) throw error;
      const url =
        (data as { signed_url?: string } | null)?.signed_url ?? null;
      setStatus(url ? "Report generated." : "Report rendered.");
      router.refresh();
    } catch (err) {
      console.error("[report] invoke failed", err);
      setStatus(
        err instanceof Error
          ? err.message
          : "Report generation failed (is the edge function deployed?).",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" onClick={run} disabled={pending}>
        {pending
          ? "Generating…"
          : currentUrl
            ? "Regenerate report"
            : "Generate report"}
      </Button>
      {status ? (
        <span className="text-xs text-brand-muted">{status}</span>
      ) : null}
    </div>
  );
}
