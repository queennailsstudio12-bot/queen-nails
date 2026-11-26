insert into admins (user_id) select id from auth.users where email = 'queennailsstudio12@gmail.com' on conflict do nothing;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on config_negocio from authenticated;
grant select (id, nombre, eslogan, direccion, whatsapp, paso_min, dias_reserva, min_anticipacion_min, horas_cancelar, max_citas_telefono, confirmacion_auto, aviso, actualizado),
      update (nombre, eslogan, direccion, whatsapp, paso_min, dias_reserva, min_anticipacion_min, horas_cancelar, max_citas_telefono, confirmacion_auto, aviso, actualizado)
  on config_negocio to authenticated;

select (select count(*) from admins) as cuentas_duena,
       (select string_agg(u.email, ', ') from admins a join auth.users u on u.id = a.user_id) as correo_duena;
