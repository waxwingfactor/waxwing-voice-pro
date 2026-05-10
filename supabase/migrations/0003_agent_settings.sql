alter table clients
  add column if not exists agent_name text not null default 'Morgan',
  add column if not exists agent_voice_name text not null default 'Kore',
  add column if not exists agent_pace text not null default 'balanced',
  add column if not exists agent_warmth text not null default 'balanced',
  add column if not exists agent_initial_greeting text,
  add column if not exists qualification_min_credit_score int not null default 600,
  add column if not exists qualification_income_multiple numeric(4, 2) not null default 3.00,
  add column if not exists auto_book_showings boolean not null default true,
  add column if not exists ask_pets_on_no_pet_properties boolean not null default false;

update clients
set agent_initial_greeting = coalesce(
  agent_initial_greeting,
  'Hi, this is ' || agent_name || ' with ' || name || '. What property are you calling about?'
);

alter table clients
  alter column agent_initial_greeting set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_agent_pace_check'
  ) then
    alter table clients
      add constraint clients_agent_pace_check
      check (agent_pace in ('slow', 'balanced', 'fast'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'clients_agent_warmth_check'
  ) then
    alter table clients
      add constraint clients_agent_warmth_check
      check (agent_warmth in ('reserved', 'balanced', 'warm'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'clients_qualification_min_credit_score_check'
  ) then
    alter table clients
      add constraint clients_qualification_min_credit_score_check
      check (qualification_min_credit_score between 300 and 850);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'clients_qualification_income_multiple_check'
  ) then
    alter table clients
      add constraint clients_qualification_income_multiple_check
      check (qualification_income_multiple between 1 and 6);
  end if;
end $$;
