# Correspondente

SaaS de gestão para correspondente bancário habitacional: esteira de processos com fases
configuráveis, documentação organizada, acompanhamento por terceiros e automação de
captura/preenchimento nos portais dos bancos (foco inicial no Caixa Aqui).

## Estrutura

```
apps/web          Next.js 16 (App Router) — UI e rotas de servidor
packages/core     domínio compartilhado: papéis, formatos (CPF/CNPJ, BRL), erros
packages/db       schema Drizzle, migrations e repositórios com contexto de tenant
supabase/         stack local (Postgres, Auth, Storage)
docs/portais/     mapa de campos dos portais dos bancos (estrutura, sem dado pessoal)
docs/produto/     análise do mercado e dos concorrentes que embasou o desenho
fixtures/caixa/   HTML anonimizado das telas do portal, para os testes da extensão
```

## Como a auditoria sai de graça

Toda escrita de campo de processo passa por `applyProcessPatch`, que compara com o
que está gravado, aplica só o que mudou e registra cada alteração em `process_events`.
Como é um caminho só, a aba Histórico é apenas uma leitura — ninguém precisa lembrar de
"logar" nada, e não existe `updateProcess` genérico justamente para não abrir um segundo
caminho sem auditoria.

Os campos vêm de um catálogo único (`@corr/core/fields`), que declara onde cada valor
mora: coluna nativa de `processes` (o que entra em listagem e soma) ou
`process_field_values` (o que só interessa dentro de uma etapa). O mesmo catálogo vai
alimentar o gerador de formulários em PDF e o preenchimento da extensão.

## Documentos e acesso de terceiros

Os arquivos ficam num bucket privado: não existe URL permanente. Toda leitura passa por
uma URL assinada de curta duração, emitida depois de conferir quem está pedindo. O upload
vai direto do navegador para o armazenamento, com permissão assinada pelo servidor — o
caminho do arquivo é sempre decidido pelo servidor, nunca pelo cliente.

O link de acesso para cliente e corretor guarda apenas o hash do token, como senha: um
vazamento do banco não abre o portal de ninguém. O portal mostra andamento, checklist e o
que aquele link enviou — nunca documentos internos, que podem conter parecer de crédito.

## Como o isolamento entre escritórios funciona

Toda tabela tem `org_id` e duas barreiras independentes:

1. **Aplicação** — os repositórios de `@corr/db` só aceitam um `OrgContext`, produzido
   exclusivamente por `requireOrgContext()`, que confere o vínculo do usuário no banco.
2. **Banco** — a aplicação conecta como a role `app_user`, que **não** tem `BYPASSRLS`.
   `withOrg()` abre a transação e fixa `app.org_id` nela; as policies de RLS leem esse valor.
   Uma query que esqueça o filtro volta vazia em vez de vazar dados de outro escritório.

A conexão administrativa (`DATABASE_ADMIN_URL`, role `postgres`) passa por cima da RLS de
propósito e é usada só no que acontece fora de um tenant: migrations, criação de escritório
no cadastro e resolução de a qual escritório o usuário pertence.

## Dado pessoal nas capturas de portal

A pasta `benchmarks/` (telas salvas dos portais e análises de concorrentes) fica **fora do
controle de versão**: as capturas do Caixa Aqui contêm dado pessoal real — CPF, RG, endereço,
dados de cônjuge. Ela existe só na máquina de quem capturou.

O que é versionado é o que foi destilado dali:
[docs/portais/caixa-sicaq.md](docs/portais/caixa-sicaq.md), com apenas a estrutura dos
formulários — nome do campo, tipo, tamanho e as tabelas de código do portal.

Quem clonar o repositório não terá as capturas. Para rodar os testes da extensão (M4), o que
vale são as fixtures anonimizadas em `fixtures/`.

## Primeiros passos

```bash
pnpm install
cp .env.example .env.local          # ajuste as chaves com `pnpm supabase status`
pnpm supabase start                 # Postgres + Auth + Storage locais (precisa de Docker)
pnpm db:migrate                     # aplica as migrations e habilita a role app_user
pnpm db:seed                        # cria um usuário e um escritório de demonstração
pnpm dev                            # http://localhost:3000
```

Depois do seed, entre com `dev@correspondente.local` / `dev12345678`.

> O `pnpm supabase start` precisa do Docker Desktop rodando. Não rode `next build`
> enquanto o `pnpm dev` estiver de pé: os dois compartilham o diretório `.next` e o
> dev server quebra no meio.

## Scripts

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Sobe o app web em modo de desenvolvimento |
| `pnpm test` | Testes unitários (não precisam de banco) |
| `pnpm test:db` | Testes de isolamento de tenant (exigem Postgres local migrado) |
| `pnpm e2e` | Testes end-to-end no navegador (Playwright) |
| `pnpm typecheck` | `tsc --noEmit` em todos os pacotes |
| `pnpm db:generate` | Gera migration a partir do schema Drizzle |
| `pnpm db:custom --name=x` | Cria migration SQL manual (policies, funções, triggers) |
| `pnpm db:migrate` | Aplica migrations pendentes |
| `pnpm db:studio` | Drizzle Studio |

## Estado da implementação

- [x] **M0** — monorepo, autenticação, escritórios, isolamento multi-tenant, shell do app
- [x] **M1** — pessoas (dedupe por CPF), rendas, processos (tabela + Kanban), cadastros de apoio
- [x] **M2** — catálogo de campos, fluxo configurável por etapa, auditoria campo-a-campo
- [x] **M3** — documentos, checklist por fase, pendências, link de acesso para terceiros
- [ ] **M4** — extensão MV3: captura e preenchimento no Caixa Aqui
- [ ] **M5** — formulários PDF, resumo do processo, dashboard com indicadores
