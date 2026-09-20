-- Tenancy: role da aplicação, helpers de contexto, RLS e espelho de auth.users.
--
-- A regra do sistema: a aplicação conecta como `app_user`, que NÃO tem
-- BYPASSRLS. Toda leitura/escrita de dado de escritório acontece dentro de
-- `withOrg()`, que fixa `app.org_id` na transação. Uma query que esqueça o
-- filtro de org volta vazia em vez de vazar dado de outro escritório.
--
-- A conexão administrativa (role `postgres`, dona das tabelas) continua passando
-- por cima da RLS de propósito: é ela que cria escritório no signup, roda
-- migration e resolve a qual tenant o usuário pertence.

--> statement-breakpoint
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin noinherit;
  end if;
end
$$;

--> statement-breakpoint
alter role app_user nobypassrls;

--> statement-breakpoint
grant usage on schema public to app_user;
--> statement-breakpoint
grant select, insert, update, delete on all tables in schema public to app_user;
--> statement-breakpoint
grant usage, select on all sequences in schema public to app_user;
--> statement-breakpoint
alter default privileges in schema public grant select, insert, update, delete on tables to app_user;
--> statement-breakpoint
alter default privileges in schema public grant usage, select on sequences to app_user;

--> statement-breakpoint
-- Escritório ativo da transação corrente. `true` no current_setting evita erro
-- quando a variável não foi definida: devolve NULL, e NULL nunca casa com um
-- org_id, então a policy nega por padrão.
create or replace function public.current_org_id() returns uuid
language sql
stable
set search_path = ''
as $$ select nullif(current_setting('app.org_id', true), '')::uuid $$;

--> statement-breakpoint
create or replace function public.current_app_user_id() returns uuid
language sql
stable
set search_path = ''
as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

--> statement-breakpoint
alter table public.orgs enable row level security;
--> statement-breakpoint
alter table public.org_members enable row level security;
--> statement-breakpoint
alter table public.profiles enable row level security;

--> statement-breakpoint
create policy orgs_tenant_access on public.orgs
  for all to app_user
  using (id = public.current_org_id())
  with check (id = public.current_org_id());

--> statement-breakpoint
create policy org_members_tenant_access on public.org_members
  for all to app_user
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

--> statement-breakpoint
-- Perfil é global (a mesma pessoa pode operar vários escritórios): fica visível
-- para quem compartilha escritório com ela, mas só o próprio dono escreve.
create policy profiles_shared_org_read on public.profiles
  for select to app_user
  using (
    exists (
      select 1
      from public.org_members m
      where m.user_id = profiles.id
        and m.org_id = public.current_org_id()
    )
  );

--> statement-breakpoint
create policy profiles_self_write on public.profiles
  for update to app_user
  using (id = public.current_app_user_id())
  with check (id = public.current_app_user_id());

--> statement-breakpoint
alter table public.profiles
  add constraint profiles_id_auth_users_fk
  foreign key (id) references auth.users (id) on delete cascade;

--> statement-breakpoint
-- O Supabase Auth é dono de `auth.users`; `public.profiles` é o espelho que o
-- resto do schema referencia. Manter os dois em sincronia por trigger evita
-- perfil faltando quando o usuário chega por convite ou OAuth, e não só pelo
-- formulário de cadastro.
create or replace function public.sync_profile_from_auth_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'usuario'), '@', 1)
    ),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case
          when public.profiles.full_name = '' then excluded.full_name
          else public.profiles.full_name
        end,
        updated_at = now();
  return new;
end
$$;

--> statement-breakpoint
drop trigger if exists on_auth_user_created on auth.users;
--> statement-breakpoint
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth_user();

--> statement-breakpoint
drop trigger if exists on_auth_user_updated on auth.users;
--> statement-breakpoint
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth_user();
