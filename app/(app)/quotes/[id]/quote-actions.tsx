"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { acceptQuote, sendQuote } from "@/lib/quotes/actions";
import type { Quote } from "@/lib/types";

export function QuoteActions({
  quote,
  editable,
  canAccept,
}: {
  quote: Quote;
  editable: boolean;
  canAccept: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pdfPending, setPdfPending] = React.useState(false);
  const [pdfStatus, setPdfStatus] = React.useState<string | null>(null);

  const send = async () => {
    setPending("send");
    setError(null);
    try {
      await sendQuote(quote.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setPending(null);
    }
  };

  const accept = async () => {
    setPending("accept");
    setError(null);
    try {
      const jobId = await acceptQuote(quote.id);
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
      setPending(null);
    }
  };

  const generatePdf = async () => {
    setPdfStatus(null);
    setPdfPending(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.functions.invoke(
        "generate-quote-pdf",
        { body: { quote_id: quote.id } },
      );
      if (err) throw err;
      setPdfStatus("Generated.");
      router.refresh();
    } catch (err) {
      setPdfStatus(
        err instanceof Error
          ? err.message
          : "PDF generation failed (is the edge function deployed?).",
      );
    } finally {
      setPdfPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {quote.pdf_url ? (
        <Button asChild variant="outline" size="sm">
          <a href={quote.pdf_url} target="_blank" rel="noreferrer">
            PDF
          </a>
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        onClick={generatePdf}
        disabled={pdfPending}
      >
        {pdfPending
          ? "Generating…"
          : quote.pdf_url
            ? "Regenerate PDF"
            : "Generate PDF"}
      </Button>
      {editable && quote.status === "draft" ? (
        <Button size="sm" onClick={send} disabled={pending === "send"}>
          {pending === "send" ? "Sending…" : "Mark as sent"}
        </Button>
      ) : null}
      {canAccept && quote.status !== "accepted" ? (
        <AcceptButton onAccept={accept} pending={pending === "accept"} />
      ) : null}
      {error ? (
        <span className="text-xs text-brand-error">{error}</span>
      ) : null}
      {pdfStatus ? (
        <span className="text-xs text-brand-muted">{pdfStatus}</span>
      ) : null}
    </div>
  );
}

function AcceptButton({
  onAccept,
  pending,
}: {
  onAccept: () => Promise<void>;
  pending: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="accent">
          Accept quote
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept this quote?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-brand-muted">
          Accepting creates a new job, marks the opportunity scheduled, and
          locks the quote for further edits.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await onAccept();
              setOpen(false);
            }}
            disabled={pending}
          >
            {pending ? "Accepting…" : "Accept + create job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
