-- RLS das tabelas da extensão.

--> statement-breakpoint
do $$
declare
  t text;
begin
  foreach t in array array['api_tokens', 'site_mappings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to app_user using (org_id = public.current_org_id()) with check (org_id = public.current_org_id())',
      t || '_tenant_access', t
    );
  end loop;
end
$$;
