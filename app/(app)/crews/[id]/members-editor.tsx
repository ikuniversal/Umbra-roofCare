"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CREW_MEMBER_ROLE_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { CrewMemberRow, CrewMemberRole, Profile } from "@/lib/types";
import { addCrewMember, removeCrewMember } from "@/lib/crews/actions";

interface Props {
  crewId: string;
  members: CrewMemberRow[];
  profiles: Pick<Profile, "id" | "full_name" | "email">[];
  profileMap: Record<string, string>;
  canManage: boolean;
}

export function CrewMembersEditor({
  crewId,
  members,
  profiles,
  profileMap,
  canManage,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState("");
  const [role, setRole] = React.useState<CrewMemberRole>("tech");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const active = members.filter((m) => !m.left_at);
  const history = members.filter((m) => m.left_at);
  const activeIds = new Set(active.map((m) => m.profile_id));
  const addable = profiles.filter((p) => !activeIds.has(p.id));

  const add = async () => {
    if (!selectedId) return;
    setPending(true);
    setError(null);
    try {
      await addCrewMember({
        crew_id: crewId,
        profile_id: selectedId,
        role,
      });
      setSelectedId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setPending(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this member from the crew?")) return;
    setPending(true);
    setError(null);
    try {
      await removeCrewMember({ crew_id: crewId, member_row_id: id });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <p className="label-mono">Active members</p>
          <CardTitle>{active.length}</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-brand-muted">
              No one assigned yet.
            </p>
          ) : (
            <ul className="divide-y divide-brand-border">
              {active.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-serif text-base text-brand-primary">
                      {profileMap[m.profile_id] ?? "Unknown"}
                    </p>
                    <p className="text-xs text-brand-muted">
                      Joined {formatDate(m.joined_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {CREW_MEMBER_ROLE_LABELS[m.role]}
                    </Badge>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => remove(m.id)}
                        disabled={pending}
                        className="rounded-full border border-brand-border p-1 text-brand-muted hover:text-brand-error"
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <p className="label-mono">Add member</p>
            <CardTitle>New assignment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_140px_100px]">
            <div className="space-y-2">
              <Label>Person</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a profile" />
                </SelectTrigger>
                <SelectContent>
                  {addable.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email ?? "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as CrewMemberRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="tech">Tech</SelectItem>
                  <SelectItem value="helper">Helper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={add}
                disabled={pending || !selectedId}
                variant="accent"
                className="w-full"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            {error ? (
              <p className="md:col-span-3 text-xs text-brand-error">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {history.length > 0 ? (
        <Card>
          <CardHeader>
            <p className="label-mono">History</p>
            <CardTitle>Past members</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-brand-border">
              {history.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-brand-muted">
                    {profileMap[m.profile_id] ?? "Unknown"}
                  </span>
                  <span className="text-xs text-brand-faint">
                    {formatDate(m.joined_at)} — {formatDate(m.left_at)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
