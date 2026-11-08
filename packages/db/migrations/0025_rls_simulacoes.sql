-- RLS das simulações: cada escritório só vê as suas.

--> statement-breakpoint
alter table public.simulations enable row level security;

--> statement-breakpoint
create policy simulations_tenant_access on public.simulations
  for all to app_user
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

--> statement-breakpoint
-- A Simulação saiu do roteiro do processo: virou cadastro à parte. Processo
-- parado nela segue para a documentação pessoal, a primeira etapa agora.
update public.processes set step_key = 'documentacao_pessoal' where step_key = 'simulacao';
