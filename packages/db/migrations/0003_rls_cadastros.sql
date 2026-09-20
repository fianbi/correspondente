-- RLS das tabelas do M1. Mesma regra do 0001: `app_user` só enxerga linhas do
-- escritório fixado em `app.org_id` pela transação aberta por `withOrg()`.

--> statement-breakpoint
do $$
declare
  t text;
begin
  foreach t in array array[
    'people', 'person_incomes', 'agencies', 'real_estate_agencies',
    'brokers', 'processes', 'process_participants', 'org_counters'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to app_user using (org_id = public.current_org_id()) with check (org_id = public.current_org_id())',
      t || '_tenant_access', t
    );
  end loop;
end
$$;

--> statement-breakpoint
-- Bancos são referência global (o COMPE da Caixa é 104 para todo mundo): todo
-- escritório lê, ninguém escreve pela conexão da aplicação.
alter table public.banks enable row level security;

--> statement-breakpoint
create policy banks_read_all on public.banks
  for select to app_user
  using (true);

--> statement-breakpoint
revoke insert, update, delete on public.banks from app_user;
