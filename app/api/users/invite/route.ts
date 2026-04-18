import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  ROLES,
  canInviteUsers,
  isSuperAdmin,
} from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

const payloadSchema = z.object({
  full_name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(30).optional().or(z.literal("")),
  opco_id: z.string().uuid(),
  roles: z
    .array(z.enum(ROLES as [Role, ...Role[]]))
    .min(1),
});

function generateTempPassword(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#%";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!canInviteUsers(session.roles)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { full_name, email, phone, opco_id, roles } = parsed.data;

  if (!isSuperAdmin(session.roles) && opco_id !== session.opcoId) {
    return NextResponse.json(
      { ok: false, error: "Cannot invite users to a different OpCo" },
      { status: 403 },
    );
  }

  if (
    !isSuperAdmin(session.roles) &&
    roles.includes("super_admin")
  ) {
    return NextResponse.json(
      { ok: false, error: "Only super admins can grant super_admin" },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  const tempPassword = generateTempPassword();

  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });

  if (createErr || !created.user) {
    return NextResponse.json(
      {
        ok: false,
        error: createErr?.message ?? "Failed to create auth user",
      },
      { status: 400 },
    );
  }

  const userId = created.user.id;

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email,
        full_name,
        phone: phone || null,
        opco_id,
      },
      { onConflict: "id" },
    );

  if (profileErr) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { ok: false, error: profileErr.message },
      { status: 400 },
    );
  }

  const roleRows = roles.map((role) => ({
    user_id: userId,
    role,
    opco_id,
    granted_by: session.userId,
  }));

  const { error: rolesErr } = await admin
    .from("user_roles")
    .upsert(roleRows, { onConflict: "user_id,role,opco_id" });

  if (rolesErr) {
    return NextResponse.json(
      { ok: false, error: rolesErr.message },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    userId,
    tempPassword,
  });
}
