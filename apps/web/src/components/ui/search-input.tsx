"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/field";

/**
 * Campo de busca que filtra enquanto se digita.
 *
 * Espera uma pausa curta na digitação antes de atualizar a URL: buscar a cada
 * tecla faria uma consulta por letra. O termo fica na URL (`?q=`), então
 * voltar, recarregar e compartilhar o endereço mantêm o filtro.
 */
export function SearchInput({
  placeholder,
  label,
  param = "q",
  delay = 700,
}: {
  placeholder: string;
  label: string;
  param?: string;
  delay?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? "";
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  const lastSent = useRef(current);

  function apply(term: string) {
    lastSent.current = term;
    const params = new URLSearchParams(searchParams.toString());
    if (term) params.set(param, term);
    else params.delete(param);
    const query = params.toString();
    startTransition(() => {
      router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
    });
  }

  useEffect(() => {
    const term = value.trim();
    if (term === lastSent.current) return;
    const timer = setTimeout(() => apply(term), delay);
    return () => clearTimeout(timer);
    // `apply` muda a cada render; o que importa é o texto digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  return (
    <div className="relative max-w-md min-w-60 flex-1" role="search">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // Enter não precisa esperar a pausa.
          if (event.key === "Enter") {
            event.preventDefault();
            apply(value.trim());
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className="pr-9 pl-9"
      />
      {pending ? (
        <Loader2
          className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-muted"
          aria-label="Buscando"
        />
      ) : null}
    </div>
  );
}
