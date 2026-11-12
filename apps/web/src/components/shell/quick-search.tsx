"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Calculator, FileText, Loader2, Search, User } from "lucide-react";
import { buscaRapida, type ResultadoDaBusca } from "@/server/actions/busca";
import { cn } from "@/lib/utils";

const ICONES = { processo: FileText, pessoa: User, simulacao: Calculator } as const;
const nuncaMuda = () => () => {};
const GRUPOS = { processo: "Processos", pessoa: "Pessoas", simulacao: "Simulações" } as const;

/**
 * Busca rápida de qualquer tela: Ctrl+K (ou ⌘K) abre, digita número do
 * processo, nome, CPF ou celular, setas escolhem e Enter abre. Espera a mesma
 * pausa de 700 ms das outras buscas antes de consultar.
 */
export function QuickSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ResultadoDaBusca[]>([]);
  const [buscado, setBuscado] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  // O servidor não sabe o sistema de quem abriu: renderiza "Ctrl K" e o
  // navegador troca por ⌘K no Mac depois de hidratar.
  const atalho = useSyncExternalStore(
    nuncaMuda,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "Ctrl K",
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function buscar(texto: string) {
    if (texto === buscado) return;
    setBuscado(texto);
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    startTransition(async () => {
      const achados = await buscaRapida(texto);
      setResultados(achados);
      setAtivo(0);
    });
  }

  useEffect(() => {
    const texto = termo.trim();
    const timer = setTimeout(() => buscar(texto), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo]);

  function abrir(resultado: ResultadoDaBusca | undefined) {
    if (!resultado) return;
    setOpen(false);
    setTermo("");
    setResultados([]);
    setBuscado("");
    router.push(resultado.href as Route);
  }


  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-2 mt-3 flex items-center gap-2 rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-ink-muted transition hover:border-brand-300 hover:text-ink"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 text-left">Buscar</span>
        <kbd className="hidden rounded border border-line bg-surface px-1.5 text-[11px] font-medium md:inline">
          {atalho}
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
          <button
            type="button"
            aria-label="Fechar busca"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Busca rápida"
            className="relative w-full max-w-xl overflow-hidden rounded-lg border border-line bg-surface shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-ink-muted" aria-hidden />
              <input
                ref={inputRef}
                value={termo}
                onChange={(event) => setTermo(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setAtivo((i) => Math.min(i + 1, resultados.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setAtivo((i) => Math.max(i - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    // Enter antes da pausa: busca já, sem esperar.
                    if (termo.trim() !== buscado) buscar(termo.trim());
                    else abrir(resultados[ativo]);
                  }
                }}
                placeholder="Nº do processo, nome, CPF ou celular"
                aria-label="Buscar"
                role="combobox"
                aria-expanded={resultados.length > 0}
                aria-controls="busca-rapida-resultados"
                className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              {pending ? (
                <Loader2 className="size-4 animate-spin text-ink-muted" aria-label="Buscando" />
              ) : null}
            </div>

            <ul id="busca-rapida-resultados" role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
              {resultados.map((resultado, index) => {
                const Icone = ICONES[resultado.tipo];
                const novoGrupo = index === 0 || resultados[index - 1]!.tipo !== resultado.tipo;
                return (
                  <li key={`${resultado.tipo}-${resultado.href}`} role="presentation">
                    {novoGrupo ? (
                      <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                        {GRUPOS[resultado.tipo]}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === ativo}
                      onMouseEnter={() => setAtivo(index)}
                      onClick={() => abrir(resultado)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2 text-left text-sm",
                        index === ativo ? "bg-brand-50" : null,
                      )}
                    >
                      <Icone className="size-4 shrink-0 text-ink-muted" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{resultado.titulo}</span>
                        {resultado.detalhe ? (
                          <span className="block truncate text-xs text-ink-muted">{resultado.detalhe}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
              {!pending && buscado.length >= 2 && resultados.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-ink-muted">
                  Nada encontrado para “{buscado}”.
                </li>
              ) : null}
              {buscado.length < 2 && resultados.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-ink-muted">
                  Digite pelo menos 2 letras ou números.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
