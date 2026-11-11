"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/**
 * Menu do celular. Em tela pequena a barra lateral some; no lugar dela fica
 * uma barra no topo com o botão que abre o mesmo menu por cima da página.
 *
 * Fecha sozinho ao trocar de tela, ao tocar fora dele e com Esc.
 */
export function MobileMenu({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navegou: o menu sai da frente da tela nova.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // A página por baixo não rola junto com o menu.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-3 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="menu-celular"
          aria-label="Abrir menu"
          className="rounded-md p-2 text-ink transition hover:bg-surface-muted"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <span className="truncate text-sm font-semibold text-ink">{title}</span>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div
            id="menu-celular"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-2 top-3 rounded-md p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
