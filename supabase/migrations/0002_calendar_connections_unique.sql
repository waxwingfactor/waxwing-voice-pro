do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_connections_client_id_calendar_id_key'
  ) then
    alter table calendar_connections
      add constraint calendar_connections_client_id_calendar_id_key
      unique (client_id, calendar_id);
  end if;
end $$;
