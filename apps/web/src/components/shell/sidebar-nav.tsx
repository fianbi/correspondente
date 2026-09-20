"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, FileText, FolderOpen, Home, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/painel", label: "Painel", icon: Home },
  { href: "/processos", label: "Processos", icon: FileText },
  { href: "/pessoas", label: "Pessoas", icon: Users },
  { href: "/documentos", label: "Documentos", icon: FolderOpen },
  { href: "/pendencias", label: "Pendências", icon: AlertCircle },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3" aria-label="Navegação principal">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
              active
                ? "bg-brand-50 font-medium text-brand-700"
                : "text-ink-muted hover:bg-surface-muted hover:text-ink",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}

      <div className="mt-auto">
        <Link
          href="/configuracoes/escritorio"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
            pathname.startsWith("/configuracoes")
              ? "bg-brand-50 font-medium text-brand-700"
              : "text-ink-muted hover:bg-surface-muted hover:text-ink",
          )}
        >
          <Settings className="size-4 shrink-0" aria-hidden />
          Configurações
        </Link>
      </div>
    </nav>
  );
}
