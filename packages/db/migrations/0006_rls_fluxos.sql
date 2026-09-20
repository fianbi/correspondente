-- RLS das tabelas do M2. Mesma regra das anteriores: `app_user` só enxerga
-- linhas do escritório fixado em `app.org_id` pela transação do `withOrg()`.

--> statement-breakpoint
do $$
declare
  t text;
begin
  foreach t in array array[
    'flows', 'flow_stages', 'process_field_values', 'process_stage_states', 'process_events'
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
-- Histórico é registro de auditoria: quem opera pode inserir e ler, nunca
-- reescrever nem apagar. Sem isso, "quem mudou o valor aprovado" viraria uma
-- pergunta sem resposta confiável.
revoke update, delete on public.process_events from app_user;
