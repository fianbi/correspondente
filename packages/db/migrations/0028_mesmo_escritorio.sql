-- Ligação só dentro do mesmo escritório.
--
-- A RLS esconde as linhas de outro escritório, mas a chave estrangeira não
-- passa por ela: com o id de uma pessoa de outro escritório, um processo
-- aceitava essa pessoa como participante. Estes gatilhos conferem, a cada
-- gravação, que o registro apontado é do mesmo escritório da linha.
--
-- `security definer` para enxergar o registro apontado mesmo quando ele é de
-- outro escritório (e responder "outro escritório" em vez de "não existe").

create or replace function public.exigir_mesmo_escritorio() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  referencia uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  dono uuid;
begin
  if referencia is null then
    return new;
  end if;

  execute format('select org_id from public.%I where id = $1', tg_argv[1])
    into dono
    using referencia;

  if dono is distinct from new.org_id then
    raise exception 'Registro de outro escritório em %.%', tg_table_name, tg_argv[0]
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end
$$;

--> statement-breakpoint
-- Responsável (processo, etapa, pendência) precisa ser da equipe do escritório.
create or replace function public.exigir_membro_do_escritorio() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  usuario uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  if usuario is null then
    return new;
  end if;

  if not exists (
    select 1 from public.org_members m where m.org_id = new.org_id and m.user_id = usuario
  ) then
    raise exception 'Usuário fora da equipe do escritório em %.%', tg_table_name, tg_argv[0]
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end
$$;

--> statement-breakpoint
do $$
declare
  ligacao text[];
begin
  -- tabela, coluna, tabela apontada
  foreach ligacao slice 1 in array array[
    ['person_incomes', 'person_id', 'people'],
    ['brokers', 'real_estate_agency_id', 'real_estate_agencies'],
    ['process_participants', 'person_id', 'people'],
    ['process_participants', 'process_id', 'processes'],
    ['processes', 'person_id', 'people'],
    ['processes', 'agency_id', 'agencies'],
    ['processes', 'broker_id', 'brokers'],
    ['processes', 'real_estate_agency_id', 'real_estate_agencies'],
    ['processes', 'risk_assessment_id', 'risk_assessments'],
    ['processes', 'flow_id', 'flows'],
    ['flow_stages', 'flow_id', 'flows'],
    ['process_events', 'process_id', 'processes'],
    ['process_field_values', 'process_id', 'processes'],
    ['process_stage_states', 'process_id', 'processes'],
    ['access_links', 'process_id', 'processes'],
    ['documents', 'person_id', 'people'],
    ['documents', 'process_id', 'processes'],
    ['pendencies', 'process_id', 'processes'],
    ['risk_assessments', 'person_id', 'people'],
    ['simulations', 'process_id', 'processes']
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'mesmo_escritorio_' || ligacao[2], ligacao[1]);
    execute format(
      'create trigger %I before insert or update of %I on public.%I
         for each row execute function public.exigir_mesmo_escritorio(%L, %L)',
      'mesmo_escritorio_' || ligacao[2], ligacao[2], ligacao[1], ligacao[2], ligacao[3]
    );
  end loop;

  foreach ligacao slice 1 in array array[
    ['processes', 'assigned_to'],
    ['process_stage_states', 'assigned_to'],
    ['pendencies', 'assigned_to']
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'membro_' || ligacao[2], ligacao[1]);
    execute format(
      'create trigger %I before insert or update of %I on public.%I
         for each row execute function public.exigir_membro_do_escritorio(%L)',
      'membro_' || ligacao[2], ligacao[2], ligacao[1], ligacao[2]
    );
  end loop;
end
$$;
