--> statement-breakpoint
alter table public.form_templates enable row level security;

--> statement-breakpoint
create policy form_templates_tenant_access on public.form_templates
  for all to app_user
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
