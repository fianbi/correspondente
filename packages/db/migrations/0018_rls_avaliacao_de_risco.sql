-- RLS das avaliações de risco capturadas do SICAQ.

--> statement-breakpoint
alter table public.risk_assessments enable row level security;

--> statement-breakpoint
create policy risk_assessments_tenant_access on public.risk_assessments
  for all to app_user
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
