import { LogOut } from "lucide-react";
import type { SessionUser } from "@/server/session";

export function UserMenu({ user }: { user: SessionUser }) {
  return (
    <div className="flex items-center gap-2 border-t border-line px-3 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted text-xs font-semibold text-ink-muted">
        {user.fullName.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{user.fullName}</p>
        <p className="truncate text-xs text-ink-muted">{user.email}</p>
      </div>
      <form action="/auth/sair" method="post">
        <button
          type="submit"
          title="Sair"
          aria-label="Sair"
          className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
