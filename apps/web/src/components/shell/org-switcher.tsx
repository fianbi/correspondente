"use client";

import { useTransition } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";
import type { MembershipSummary } from "@corr/db";
import { ORG_ROLE_LABELS } from "@corr/core";
import { setActiveOrg } from "@/server/actions/org";
import { cn } from "@/lib/utils";

export function OrgSwitcher({
  memberships,
  activeOrgId,
}: {
  memberships: MembershipSummary[];
  activeOrgId: string;
}) {
  const [pending, startTransition] = useTransition();
  const active = memberships.find((m) => m.orgId === activeOrgId) ?? memberships[0];

  if (!active) return null;

  // Com um escritório só, um seletor seria ruído: mostra só a identificação.
  if (memberships.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-600 text-white">
          <Building2 className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{active.orgName}</p>
          <p className="truncate text-xs text-ink-muted">{ORG_ROLE_LABELS[active.role]}</p>
        </div>
      </div>
    );
  }

  return (
    <details className="group px-2 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-muted">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-600 text-white">
          <Building2 className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-ink">{active.orgName}</span>
          <span className="block truncate text-xs text-ink-muted">{ORG_ROLE_LABELS[active.role]}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-muted transition group-open:rotate-180" aria-hidden />
      </summary>

      <ul className="mt-1 space-y-0.5">
        {memberships.map((membership) => (
          <li key={membership.orgId}>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => void setActiveOrg(membership.orgId))}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                membership.orgId === activeOrgId
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <span className="flex-1 truncate">{membership.orgName}</span>
              {membership.orgId === activeOrgId ? <Check className="size-4" aria-hidden /> : null}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
