-- Activa los avisos en tiempo real del panel (reservas nuevas, confirmadas, canceladas y reagendadas).
alter table citas replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'citas') then
    alter publication supabase_realtime add table public.citas;
  end if;
end $$;

select tablename as tabla_con_avisos from pg_publication_tables where pubname = 'supabase_realtime';
