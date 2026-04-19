"use server";

import { createClient } from "@/lib/supabase/server";

export interface LogActivityInput {
  opcoId: string | null;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  detail?: Record<string, unknown>;
}

// Best-effort activity logger. Any failure is logged but never surfaced —
// users should not see a write succeed and then error because audit
// logging hit an RLS snag. The trail is diagnostic, not transactional.
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("activity_log").insert({
      opco_id: input.opcoId,
      user_id: input.userId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      detail: input.detail ?? null,
    });
    if (error) {
      console.error("[activity] insert failed", {
        action: input.action,
        error: error.message,
      });
    }
  } catch (err) {
    console.error("[activity] unexpected error", err);
  }
}
