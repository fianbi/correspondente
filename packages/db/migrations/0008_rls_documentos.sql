-- RLS das tabelas do M3 e o bucket privado de documentos.

--> statement-breakpoint
do $$
declare
  t text;
begin
  foreach t in array array['documents', 'pendencies', 'access_links']
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
-- Bucket privado: nada aqui é servido por URL pública. O acesso acontece
-- sempre por URL assinada de curta duração, emitida depois de conferir quem
-- está pedindo — seja a equipe logada, seja um link de acesso válido.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
