"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  Calculator,
  FileSignature,
  FileText,
  Home,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/painel", label: "Painel", icon: Home },
  { href: "/simulacoes", label: "Simulações", icon: Calculator },
  { href: "/processos", label: "Processos", icon: FileText },
  { href: "/pessoas", label: "Pessoas", icon: Users },
  { href: "/pendencias", label: "Pendências", icon: AlertCircle },
] as const;

const RODAPE = [
  { href: "/configuracoes/formularios", label: "Formulários", icon: FileSignature },
  { href: "/configuracoes/escritorio", label: "Configurações", icon: Settings },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: (typeof ITEMS)[number]["href"] | (typeof RODAPE)[number]["href"];
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
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
}

export function SidebarNav() {
  const pathname = usePathname();
  const ativo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3" aria-label="Navegação principal">
      {ITEMS.map((item) => (
        <NavLink key={item.href} {...item} active={ativo(item.href)} />
      ))}

      <div className="mt-auto">
        {RODAPE.map((item) => (
          <NavLink key={item.href} {...item} active={ativo(item.href)} />
        ))}
      </div>
    </nav>
  );
}
