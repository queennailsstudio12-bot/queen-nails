-- =====================================================================
-- QUEEN NAILS STUDIO · Sistema de reservas y gestión
-- Ejecutar completo en Supabase → SQL Editor → New query → Run.
-- Se puede volver a ejecutar: no borra datos.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

-- Cuentas con acceso al panel (dueña). Ver README para agregar la cuenta.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creado timestamptz not null default now()
);

create table if not exists config_negocio (
  id int primary key default 1 check (id = 1),
  nombre text not null default 'Queen Nails Studio · by Sofía',
  eslogan text default 'Tus uñas merecen sentirse como una reina.',
  direccion text default 'Alfonso López, Usme – Bogotá D. C.',
  whatsapp text default '573228676258',
  paso_min int not null default 30 check (paso_min between 5 and 120),
  dias_reserva int not null default 30 check (dias_reserva between 1 and 180),
  min_anticipacion_min int not null default 60 check (min_anticipacion_min between 0 and 2880),
  horas_cancelar int not null default 3 check (horas_cancelar between 0 and 72),
  max_citas_telefono int not null default 3 check (max_citas_telefono between 1 and 20),
  confirmacion_auto boolean not null default false,
  aviso text,
  pin_hash text,
  actualizado timestamptz not null default now()
);

-- Horario general del estudio. dia: 0 domingo … 6 sábado.
create table if not exists horarios (
  dia smallint primary key check (dia between 0 and 6),
  activo boolean not null default true,
  abre time not null default '09:00',
  cierra time not null default '20:00',
  descanso_ini time,
  descanso_fin time,
  check (cierra > abre),
  check ((descanso_ini is null) = (descanso_fin is null)),
  check (descanso_fin is null or descanso_fin > descanso_ini)
);

create table if not exists profesionales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 2 and 60),
  telefono text,
  activo boolean not null default true,
  comision numeric not null default 0 check (comision between 0 and 100),
  comision_producto numeric not null default 0 check (comision_producto between 0 and 100),
  orden int not null default 0,
  creado timestamptz not null default now()
);

create table if not exists servicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 2 and 80),
  descripcion text,
  categoria text,
  dur_min int not null default 60 check (dur_min between 5 and 720),
  precio numeric not null default 0 check (precio >= 0),
  activo boolean not null default true,
  reserva_online boolean not null default true,
  requiere_valoracion boolean not null default false,
  orden int not null default 0,
  creado timestamptz not null default now()
);

-- Si un servicio no tiene filas aquí, lo pueden hacer todas las profesionales.
create table if not exists profesional_servicio (
  profesional_id uuid not null references profesionales(id) on delete cascade,
  servicio_id uuid not null references servicios(id) on delete cascade,
  primary key (profesional_id, servicio_id)
);

-- Descansos, vacaciones y ausencias. profesional_id null = todo el estudio.
-- hora_ini/hora_fin null = el día completo.
create table if not exists bloqueos (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid references profesionales(id) on delete cascade,
  desde date not null,
  hasta date not null,
  hora_ini time,
  hora_fin time,
  motivo text,
  creado timestamptz not null default now(),
  check (hasta >= desde),
  check ((hora_ini is null) = (hora_fin is null)),
  check (hora_fin is null or hora_fin > hora_ini)
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null unique,
  email text,
  cumpleanos date,
  notas text,
  creado timestamptz not null default now()
);

create table if not exists citas (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  fecha date not null,
  hora time not null,
  dur_min int not null check (dur_min between 5 and 720),
  profesional_id uuid not null references profesionales(id),
  cliente_id uuid references clientes(id) on delete set null,
  cliente text not null,
  telefono text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','confirmada','cancelada','atendida','no_asistio')),
  origen text not null default 'online' check (origen in ('online','panel')),
  nota text,
  nota_interna text,
  precio_estimado numeric not null default 0,
  grupo_id uuid,
  recordatorio_enviado boolean not null default false,
  cancelada_por text,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  rango tsrange generated always as
    (tsrange(fecha + hora, fecha + hora + dur_min * interval '1 minute')) stored,
  -- Impide dos citas activas que se crucen para la misma profesional.
  constraint sin_choques exclude using gist (profesional_id with =, rango with &&)
    where (estado in ('pendiente','confirmada','atendida'))
);
create index if not exists citas_fecha_idx on citas (fecha);
create index if not exists citas_tel_idx on citas (telefono);

create table if not exists cita_servicios (
  cita_id uuid not null references citas(id) on delete cascade,
  servicio_id uuid references servicios(id) on delete set null,
  nombre text not null,
  precio numeric not null default 0,
  dur_min int not null,
  orden int not null default 0
);
create index if not exists cita_servicios_cita_idx on cita_servicios (cita_id);

create table if not exists registros_tecnicos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  fecha date not null default current_date,
  servicio text,
  detalle text not null,
  creado timestamptz not null default now()
);

create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text,
  marca text,
  precio numeric not null default 0 check (precio >= 0),
  costo numeric not null default 0 check (costo >= 0),
  stock int not null default 0,
  stock_min int not null default 0,
  uso_interno boolean not null default false,
  activo boolean not null default true,
  creado timestamptz not null default now()
);

create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  fecha date not null,
  hora time not null,
  cita_id uuid references citas(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  cliente text,
  telefono text,
  profesional_id uuid references profesionales(id),
  subtotal numeric not null check (subtotal >= 0),
  descuento numeric not null default 0 check (descuento >= 0),
  total numeric not null check (total >= 0),
  propina numeric not null default 0 check (propina >= 0),
  nota text,
  anulada boolean not null default false,
  anulada_motivo text,
  creada timestamptz not null default now()
);
create index if not exists ventas_fecha_idx on ventas (fecha);

create table if not exists venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  tipo text not null check (tipo in ('servicio','producto')),
  servicio_id uuid references servicios(id) on delete set null,
  producto_id uuid references productos(id) on delete set null,
  descripcion text not null,
  cantidad int not null default 1 check (cantidad > 0),
  precio numeric not null check (precio >= 0),
  costo numeric not null default 0,
  profesional_id uuid references profesionales(id),
  comision numeric not null default 0
);
create index if not exists venta_items_venta_idx on venta_items (venta_id);

create table if not exists venta_pagos (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  metodo text not null check (metodo in ('efectivo','nequi','daviplata','tarjeta','transferencia','abono','otro')),
  monto numeric not null check (monto > 0)
);

create table if not exists stock_movs (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  cantidad int not null,
  motivo text,
  venta_id uuid references ventas(id) on delete set null,
  creado timestamptz not null default now()
);

create table if not exists abonos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  cita_id uuid references citas(id) on delete set null,
  cliente text not null,
  telefono text,
  fecha date not null,
  monto numeric not null check (monto > 0),
  metodo text not null check (metodo in ('efectivo','nequi','daviplata','tarjeta','transferencia','otro')),
  estado text not null default 'disponible' check (estado in ('disponible','usado','devuelto')),
  venta_id uuid references ventas(id) on delete set null,
  devuelto_fecha date,
  nota text,
  creado timestamptz not null default now()
);

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  concepto text not null,
  categoria text,
  monto numeric not null check (monto > 0),
  metodo text not null default 'efectivo' check (metodo in ('efectivo','nequi','daviplata','tarjeta','transferencia','otro')),
  creado timestamptz not null default now()
);

create table if not exists gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  monto numeric not null check (monto > 0),
  dia_mes int check (dia_mes between 1 and 31),
  activo boolean not null default true,
  creado timestamptz not null default now()
);

create table if not exists cajas (
  fecha date primary key,
  apertura numeric not null default 0 check (apertura >= 0),
  contado numeric check (contado >= 0),
  nota text,
  cerrada_at timestamptz
);

create table if not exists pagos_pro (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references profesionales(id),
  fecha date not null,
  monto numeric not null check (monto > 0),
  tipo text not null default 'pago' check (tipo in ('pago','adelanto')),
  metodo text not null default 'efectivo' check (metodo in ('efectivo','nequi','daviplata','tarjeta','transferencia','otro')),
  nota text,
  anulado boolean not null default false,
  creado timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. FUNCIONES BASE
-- ---------------------------------------------------------------------

create or replace function es_dueno() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

create or replace function ahora_local() returns timestamp
language sql stable as $$ select (now() at time zone 'America/Bogota') $$;

create or replace function _solo_dueno() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_dueno() then raise exception 'No autorizado.'; end if;
end $$;

create or replace function _tel(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if length(d) = 10 and left(d, 1) = '3' then d := '57' || d; end if;
  if length(d) < 8 or length(d) > 15 then
    raise exception 'Revisa tu número de celular.';
  end if;
  return d;
end $$;

create or replace function _nombre(p text) returns text
language plpgsql immutable as $$
declare n text := regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g');
begin
  if length(n) < 2 or length(n) > 80 then raise exception 'Escribe tu nombre (2 a 80 letras).'; end if;
  return n;
end $$;

create or replace function _hora(p text) returns time
language plpgsql immutable as $$
begin
  if p is null or p !~ '^([01]\d|2[0-3]):[0-5]\d(:00)?$' then raise exception 'Hora inválida.'; end if;
  return p::time;
end $$;

-- ¿La profesional puede hacer todos estos servicios?
create or replace function _pro_hace(p_pro uuid, p_servicios uuid[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(bool_and(
    not exists (select 1 from profesional_servicio r where r.servicio_id = s.id)
    or exists (select 1 from profesional_servicio r where r.servicio_id = s.id and r.profesional_id = p_pro)
  ), true)
  from unnest(coalesce(p_servicios, '{}'::uuid[])) as s(id)
$$;

-- Upsert de clienta por celular. Devuelve su id.
create or replace function _cliente(p_nombre text, p_tel text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if p_tel is null then return null; end if;
  insert into clientes (nombre, telefono) values (p_nombre, p_tel)
  on conflict (telefono) do update set nombre = clientes.nombre
  returning id into v;
  return v;
end $$;

create or replace function _toca_cita() returns trigger
language plpgsql as $$ begin new.actualizada := now(); return new; end $$;
drop trigger if exists citas_actualizada on citas;
create trigger citas_actualizada before update on citas for each row execute function _toca_cita();

-- ---------------------------------------------------------------------
-- 3. FUNCIONES PÚBLICAS (página de reservas, sin iniciar sesión)
-- ---------------------------------------------------------------------

create or replace function publico_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'negocio', (select jsonb_build_object(
        'nombre', nombre, 'eslogan', eslogan, 'direccion', direccion, 'whatsapp', whatsapp,
        'paso_min', paso_min, 'dias_reserva', dias_reserva, 'horas_cancelar', horas_cancelar,
        'aviso', aviso) from config_negocio where id = 1),
    'hoy', to_char(ahora_local(), 'YYYY-MM-DD'),
    'ahora', to_char(ahora_local(), 'YYYY-MM-DD"T"HH24:MI'),
    'horarios', (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'activo', activo,
        'abre', to_char(abre, 'HH24:MI'), 'cierra', to_char(cierra, 'HH24:MI')) order by dia), '[]') from horarios),
    'servicios', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre,
        'descripcion', descripcion, 'categoria', categoria, 'dur_min', dur_min, 'precio', precio,
        'requiere_valoracion', requiere_valoracion) order by orden, nombre), '[]')
        from servicios where activo and reserva_online),
    'profesionales', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by orden, nombre), '[]')
        from profesionales where activo),
    'rel', (select coalesce(jsonb_agg(jsonb_build_object('profesional_id', profesional_id, 'servicio_id', servicio_id)), '[]')
        from profesional_servicio)
  )
$$;

-- Horarios de un día para una duración. Solo devuelve horas dentro del horario
-- de atención y sin descansos; "libre=false" significa que ya hay una cita.
create or replace function disponibilidad(
  p_fecha date, p_dur int, p_prof uuid default null,
  p_servicios uuid[] default null, p_ignorar uuid default null)
returns table (hora text, libre boolean, profesional_id uuid)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_variable
declare
  c config_negocio; h horarios; v_now timestamp := ahora_local();
  t timestamp; t_fin timestamp; v_cierre timestamp; p record;
  v_pro uuid; v_alguna boolean; v_ign uuid;
begin
  select * into c from config_negocio where id = 1;
  if p_dur is null or p_dur < 5 or p_dur > 720 or p_fecha is null then return; end if;
  if p_fecha < v_now::date or p_fecha > v_now::date + c.dias_reserva then return; end if;
  select * into h from horarios where dia = extract(dow from p_fecha)::int;
  if not found or not h.activo then return; end if;
  if p_ignorar is not null then select ci.id into v_ign from citas ci where ci.token = p_ignorar; end if;

  t := p_fecha + h.abre;
  v_cierre := p_fecha + h.cierra;
  while t + p_dur * interval '1 minute' <= v_cierre loop
    t_fin := t + p_dur * interval '1 minute';
    if t >= v_now + c.min_anticipacion_min * interval '1 minute'
       and not (h.descanso_ini is not null and t < p_fecha + h.descanso_fin and t_fin > p_fecha + h.descanso_ini) then
      v_pro := null; v_alguna := false;
      for p in
        select pr.id from profesionales pr
        where pr.activo and (p_prof is null or pr.id = p_prof) and _pro_hace(pr.id, p_servicios)
        order by pr.orden, pr.nombre
      loop
        if exists (select 1 from bloqueos b
                   where (b.profesional_id is null or b.profesional_id = p.id)
                     and p_fecha between b.desde and b.hasta
                     and (b.hora_ini is null or (t < p_fecha + b.hora_fin and t_fin > p_fecha + b.hora_ini))) then
          continue;
        end if;
        v_alguna := true;
        if not exists (select 1 from citas ci
                       where ci.profesional_id = p.id
                         and ci.estado in ('pendiente','confirmada','atendida')
                         and (v_ign is null or ci.id <> v_ign)
                         and ci.rango && tsrange(t, t_fin)) then
          v_pro := p.id;
          exit;
        end if;
      end loop;
      if v_alguna then
        hora := to_char(t, 'HH24:MI'); libre := v_pro is not null; profesional_id := v_pro;
        return next;
      end if;
    end if;
    t := t + c.paso_min * interval '1 minute';
  end loop;
end $$;

-- Días del periodo de reserva con al menos una hora libre.
create or replace function dias_disponibles(p_dur int, p_prof uuid default null, p_servicios uuid[] default null)
returns table (fecha date, libres int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_variable
declare d date; v_hoy date := ahora_local()::date; v_dias int; n int;
begin
  select dias_reserva into v_dias from config_negocio where id = 1;
  for d in select generate_series(v_hoy, v_hoy + v_dias, interval '1 day')::date loop
    select count(*) filter (where x.libre) into n from disponibilidad(d, p_dur, p_prof, p_servicios) x;
    fecha := d; libres := n; return next;
  end loop;
end $$;

-- Valida servicios y devuelve duración total, precio total y nombres.
create or replace function _servicios(p_ids uuid[], p_online boolean)
returns table (dur int, precio numeric, nombres text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_variable
declare n int;
begin
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 4 then
    raise exception 'Elige entre 1 y 4 servicios.';
  end if;
  select count(*) into n from servicios s
   where s.id = any(p_ids) and s.activo
     and (not p_online or (s.reserva_online and not s.requiere_valoracion));
  if n <> (select count(distinct x) from unnest(p_ids) x) or n <> cardinality(p_ids) then
    raise exception 'Uno de los servicios ya no está disponible.';
  end if;
  return query
    select sum(s.dur_min)::int, sum(s.precio), string_agg(s.nombre, ' + ' order by array_position(p_ids, s.id))
    from servicios s where s.id = any(p_ids);
end $$;

-- Inserta la cita y sus servicios. Convierte el choque de horario en un mensaje claro.
create or replace function _crear_cita(
  p_fecha date, p_hora time, p_dur int, p_pro uuid, p_cliente_id uuid, p_cliente text, p_tel text,
  p_estado text, p_origen text, p_nota text, p_servicios uuid[], p_grupo uuid default null)
returns citas
language plpgsql security definer set search_path = public as $$
declare v citas;
begin
  begin
    insert into citas (fecha, hora, dur_min, profesional_id, cliente_id, cliente, telefono, estado, origen, nota,
                       precio_estimado, grupo_id)
    values (p_fecha, p_hora, p_dur, p_pro, p_cliente_id, p_cliente, p_tel, p_estado, p_origen, nullif(trim(p_nota), ''),
            coalesce((select sum(precio) from servicios where id = any(p_servicios)), 0), p_grupo)
    returning * into v;
  exception when exclusion_violation then
    raise exception 'Ese horario acaba de ocuparse. Elige otro.';
  end;
  insert into cita_servicios (cita_id, servicio_id, nombre, precio, dur_min, orden)
  select v.id, s.id, s.nombre, s.precio, s.dur_min, array_position(p_servicios, s.id)
  from servicios s where s.id = any(p_servicios);
  return v;
end $$;

create or replace function _limite_tel(p_tel text) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_max int; n int;
begin
  select max_citas_telefono into v_max from config_negocio where id = 1;
  select count(*) into n from citas
   where telefono = p_tel and estado in ('pendiente','confirmada')
     and fecha + hora >= ahora_local();
  if n >= v_max then
    raise exception 'Ya tienes % citas activas. Escríbenos por WhatsApp si necesitas otra.', n;
  end if;
end $$;

create or replace function reservar_cita(
  p_servicios uuid[], p_fecha date, p_hora text, p_cliente text, p_telefono text,
  p_prof uuid default null, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s record; v_nom text := _nombre(p_cliente); v_tel text := _tel(p_telefono);
  v_hora time := _hora(p_hora); v_pro uuid; v_auto boolean; v citas;
begin
  if length(coalesce(p_nota, '')) > 300 then raise exception 'La nota es demasiado larga.'; end if;
  select * into s from _servicios(p_servicios, true);
  select d.profesional_id into v_pro
    from disponibilidad(p_fecha, s.dur, p_prof, p_servicios) d
   where d.hora = to_char(v_hora, 'HH24:MI') and d.libre;
  if v_pro is null then raise exception 'Ese horario ya no está disponible. Elige otro.'; end if;
  perform _limite_tel(v_tel);
  select confirmacion_auto into v_auto from config_negocio where id = 1;
  v := _crear_cita(p_fecha, v_hora, s.dur, v_pro, _cliente(v_nom, v_tel), v_nom, v_tel,
                   case when v_auto then 'confirmada' else 'pendiente' end, 'online', p_nota, p_servicios);
  return v.token;
end $$;

-- Reserva para varias personas, una después de otra a partir de p_hora.
-- p_items: [{"nombre": "Hija", "servicios": ["uuid", ...]}, ...]
create or replace function reservar_grupo(
  p_fecha date, p_hora text, p_items jsonb, p_cliente text, p_telefono text,
  p_prof uuid default null, p_nota text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_nom text := _nombre(p_cliente); v_tel text := _tel(p_telefono); v_hora time := _hora(p_hora);
  it jsonb; ids uuid[]; s record; v_total int := 0; v_todos uuid[] := '{}'; v_pro uuid;
  v_auto boolean; v_grupo uuid := gen_random_uuid(); t time; v citas; v_cli uuid; res jsonb := '[]'; v_persona text; i int := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 2 or jsonb_array_length(p_items) > 6 then
    raise exception 'La reserva en grupo es para 2 a 6 personas.';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    ids := array(select jsonb_array_elements_text(it->'servicios')::uuid);
    select * into s from _servicios(ids, true);
    v_total := v_total + s.dur;
    v_todos := v_todos || ids;
  end loop;
  select d.profesional_id into v_pro
    from disponibilidad(p_fecha, v_total, p_prof, v_todos) d
   where d.hora = to_char(v_hora, 'HH24:MI') and d.libre;
  if v_pro is null then raise exception 'Ese horario ya no está disponible para todo el grupo. Elige otro.'; end if;
  perform _limite_tel(v_tel);
  select confirmacion_auto into v_auto from config_negocio where id = 1;
  v_cli := _cliente(v_nom, v_tel);
  t := v_hora;
  for it in select * from jsonb_array_elements(p_items) loop
    i := i + 1;
    ids := array(select jsonb_array_elements_text(it->'servicios')::uuid);
    select * into s from _servicios(ids, true);
    v_persona := nullif(left(trim(coalesce(it->>'nombre', '')), 40), '');
    v := _crear_cita(p_fecha, t, s.dur, v_pro, v_cli,
                     v_nom || coalesce(' (' || v_persona || ')', ' (persona ' || i || ')'), v_tel,
                     case when v_auto then 'confirmada' else 'pendiente' end, 'online', p_nota, ids, v_grupo);
    res := res || jsonb_build_object('nombre', coalesce(v_persona, 'Persona ' || i), 'servicios', s.nombres,
                                     'hora', to_char(t, 'HH24:MI'), 'dur_min', s.dur, 'token', v.token);
    t := t + s.dur * interval '1 minute';
  end loop;
  return res;
end $$;

create or replace function _cita_token(p_token uuid) returns citas
language plpgsql stable security definer set search_path = public as $$
declare v citas;
begin
  select * into v from citas where token = p_token;
  if not found then raise exception 'No encontramos esta cita.'; end if;
  return v;
end $$;

create or replace function mi_cita(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v citas; c config_negocio;
begin
  select * into v from citas where token = p_token;
  if not found then return null; end if;
  select * into c from config_negocio where id = 1;
  return jsonb_build_object(
    'fecha', v.fecha, 'hora', to_char(v.hora, 'HH24:MI'), 'dur_min', v.dur_min, 'estado', v.estado,
    'cliente', v.cliente, 'precio', v.precio_estimado,
    'servicios', (select string_agg(nombre, ' + ' order by orden) from cita_servicios where cita_id = v.id),
    'servicio_ids', (select coalesce(jsonb_agg(servicio_id order by orden), '[]') from cita_servicios where cita_id = v.id),
    'profesional', (select nombre from profesionales where id = v.profesional_id),
    'profesional_id', v.profesional_id,
    'puede_modificar', v.estado in ('pendiente','confirmada')
        and (v.fecha + v.hora) - ahora_local() >= c.horas_cancelar * interval '1 hour',
    'horas_cancelar', c.horas_cancelar);
end $$;

create or replace function confirmar_cita(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v citas := _cita_token(p_token);
begin
  if v.estado <> 'pendiente' then return; end if;
  if v.fecha + v.hora < ahora_local() then raise exception 'Esta cita ya pasó.'; end if;
  update citas set estado = 'confirmada' where id = v.id;
end $$;

create or replace function _puede_modificar(v citas) returns void
language plpgsql stable security definer set search_path = public as $$
declare h int;
begin
  select horas_cancelar into h from config_negocio where id = 1;
  if v.estado not in ('pendiente','confirmada') then raise exception 'Esta cita ya no se puede modificar.'; end if;
  if (v.fecha + v.hora) - ahora_local() < h * interval '1 hour' then
    raise exception 'Faltan menos de % horas para tu cita. Escríbenos por WhatsApp.', h;
  end if;
end $$;

create or replace function cancelar_cita(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v citas := _cita_token(p_token);
begin
  perform _puede_modificar(v);
  update citas set estado = 'cancelada', cancelada_por = 'clienta' where id = v.id;
end $$;

create or replace function reagendar_cita(p_token uuid, p_fecha date, p_hora text) returns void
language plpgsql security definer set search_path = public as $$
declare v citas := _cita_token(p_token); v_hora time := _hora(p_hora); ok boolean;
begin
  perform _puede_modificar(v);
  select true into ok from disponibilidad(p_fecha, v.dur_min, v.profesional_id, null, p_token) d
   where d.hora = to_char(v_hora, 'HH24:MI') and d.libre;
  if ok is null then raise exception 'Ese horario ya no está disponible. Elige otro.'; end if;
  begin
    update citas set fecha = p_fecha, hora = v_hora, recordatorio_enviado = false where id = v.id;
  exception when exclusion_violation then
    raise exception 'Ese horario acaba de ocuparse. Elige otro.';
  end;
end $$;

-- ---------------------------------------------------------------------
-- 4. FUNCIONES DEL PANEL (solo la dueña)
-- ---------------------------------------------------------------------

create or replace function mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select case when es_dueno() then 'dueno' else 'ninguno' end
$$;

create or replace function crear_cita_admin(
  p_servicios uuid[], p_fecha date, p_hora text, p_cliente text, p_telefono text,
  p_prof uuid, p_nota text default null, p_estado text default 'confirmada', p_dur int default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare s record; v_nom text := _nombre(p_cliente); v_tel text; v citas; v_dur int;
begin
  perform _solo_dueno();
  v_tel := case when coalesce(trim(p_telefono), '') = '' then 'sin-telefono' else _tel(p_telefono) end;
  if p_estado not in ('pendiente','confirmada') then raise exception 'Estado inválido.'; end if;
  select * into s from _servicios(p_servicios, false);
  v_dur := coalesce(p_dur, s.dur);
  if exists (select 1 from bloqueos b where (b.profesional_id is null or b.profesional_id = p_prof)
               and p_fecha between b.desde and b.hasta and b.hora_ini is null) then
    raise exception 'Ese día está marcado como descanso.';
  end if;
  v := _crear_cita(p_fecha, _hora(p_hora), v_dur, p_prof,
                   case when v_tel = 'sin-telefono' then null else _cliente(v_nom, v_tel) end,
                   v_nom, v_tel, p_estado, 'panel', p_nota, p_servicios);
  return v.id;
end $$;

create or replace function mover_cita(p_id uuid, p_fecha date, p_hora text, p_prof uuid default null, p_dur int default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _solo_dueno();
  begin
    update citas set fecha = p_fecha, hora = _hora(p_hora),
                     profesional_id = coalesce(p_prof, profesional_id),
                     dur_min = coalesce(p_dur, dur_min), recordatorio_enviado = false
     where id = p_id;
  exception when exclusion_violation then
    raise exception 'Ese horario se cruza con otra cita.';
  end;
end $$;

-- Cobro (punto de venta).
-- p_items: [{"tipo":"servicio|producto","servicio_id":..,"producto_id":..,"descripcion":"..","cantidad":1,"precio":50000,"profesional_id":..}]
-- p_pagos: [{"metodo":"efectivo","monto":30000}, ...]
create or replace function registrar_venta(
  p_cita uuid, p_cliente text, p_telefono text, p_pro uuid, p_items jsonb,
  p_descuento numeric, p_propina numeric, p_pagos jsonb, p_abonos uuid[] default '{}', p_nota text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sub numeric; v_desc numeric := coalesce(p_descuento, 0); v_prop numeric := coalesce(p_propina, 0);
  v_tot numeric; v_pag numeric; v_ab numeric := 0; v_nab int := 0; v_factor numeric;
  v_now timestamp := ahora_local(); v_id uuid; v_num bigint; it jsonb; v_pro uuid; v_pct numeric;
  v_cant int; v_precio numeric; v_costo numeric; v_tel text; v_cli uuid; v_nom text;
begin
  perform _solo_dueno();
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Agrega al menos un servicio o producto.'; end if;
  select sum((x->>'cantidad')::int * (x->>'precio')::numeric) into v_sub from jsonb_array_elements(p_items) x;
  if v_desc < 0 or v_desc > v_sub then raise exception 'El descuento no puede ser mayor al subtotal.'; end if;
  if v_prop < 0 then raise exception 'La propina no puede ser negativa.'; end if;
  v_tot := v_sub - v_desc;
  if cardinality(coalesce(p_abonos, '{}')) > 0 then
    select coalesce(sum(monto), 0), count(*) into v_ab, v_nab from abonos where id = any(p_abonos) and estado = 'disponible';
    if v_nab <> cardinality(p_abonos) then raise exception 'Uno de los abonos ya fue usado o devuelto.'; end if;
  end if;
  select coalesce(sum((x->>'monto')::numeric), 0) into v_pag from jsonb_array_elements(coalesce(p_pagos, '[]')) x;
  if v_pag + v_ab <> v_tot + v_prop then
    raise exception 'Los pagos ($%) no coinciden con el total a cobrar ($%).', v_pag + v_ab, v_tot + v_prop;
  end if;
  v_pro := coalesce(p_pro, (select profesional_id from citas where id = p_cita));
  v_nom := nullif(trim(coalesce(p_cliente, '')), '');
  v_tel := case when coalesce(trim(p_telefono), '') = '' or p_telefono = 'sin-telefono' then null else _tel(p_telefono) end;
  if v_tel is not null and v_nom is not null then v_cli := _cliente(v_nom, v_tel); end if;
  if v_cli is null and p_cita is not null then select cliente_id into v_cli from citas where id = p_cita; end if;

  insert into ventas (fecha, hora, cita_id, cliente_id, cliente, telefono, profesional_id, subtotal, descuento, total, propina, nota)
  values (v_now::date, v_now::time, p_cita, v_cli, v_nom, v_tel, v_pro, v_sub, v_desc, v_tot, v_prop, nullif(trim(p_nota), ''))
  returning id, numero into v_id, v_num;

  v_factor := case when v_sub > 0 then v_tot / v_sub else 0 end;
  for it in select * from jsonb_array_elements(p_items) loop
    v_cant := (it->>'cantidad')::int; v_precio := (it->>'precio')::numeric;
    if v_cant is null or v_cant <= 0 or v_precio is null or v_precio < 0 then raise exception 'Revisa cantidades y precios.'; end if;
    select case when it->>'tipo' = 'producto' then comision_producto else comision end into v_pct
      from profesionales where id = coalesce((it->>'profesional_id')::uuid, v_pro);
    v_costo := 0;
    if it->>'tipo' = 'producto' then
      select costo into v_costo from productos where id = (it->>'producto_id')::uuid;
      update productos set stock = stock - v_cant where id = (it->>'producto_id')::uuid;
      insert into stock_movs (producto_id, cantidad, motivo, venta_id)
      values ((it->>'producto_id')::uuid, -v_cant, 'Venta #' || v_num, v_id);
    end if;
    insert into venta_items (venta_id, tipo, servicio_id, producto_id, descripcion, cantidad, precio, costo, profesional_id, comision)
    values (v_id, it->>'tipo', (it->>'servicio_id')::uuid, (it->>'producto_id')::uuid, it->>'descripcion', v_cant, v_precio,
            coalesce(v_costo, 0), coalesce((it->>'profesional_id')::uuid, v_pro),
            round(v_cant * v_precio * v_factor * coalesce(v_pct, 0) / 100));
  end loop;

  insert into venta_pagos (venta_id, metodo, monto)
  select v_id, x->>'metodo', (x->>'monto')::numeric from jsonb_array_elements(coalesce(p_pagos, '[]')) x
  where (x->>'monto')::numeric > 0;
  if v_ab > 0 then
    insert into venta_pagos (venta_id, metodo, monto) values (v_id, 'abono', v_ab);
    update abonos set estado = 'usado', venta_id = v_id where id = any(p_abonos);
  end if;
  if p_cita is not null then update citas set estado = 'atendida' where id = p_cita; end if;
  return jsonb_build_object('id', v_id, 'numero', v_num);
end $$;

create or replace function anular_venta(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v ventas; it record;
begin
  perform _solo_dueno();
  select * into v from ventas where id = p_id for update;
  if not found or v.anulada then raise exception 'La venta no existe o ya está anulada.'; end if;
  update ventas set anulada = true, anulada_motivo = nullif(trim(p_motivo), '') where id = p_id;
  for it in select * from venta_items where venta_id = p_id and tipo = 'producto' and producto_id is not null loop
    update productos set stock = stock + it.cantidad where id = it.producto_id;
    insert into stock_movs (producto_id, cantidad, motivo, venta_id) values (it.producto_id, it.cantidad, 'Anulación venta #' || v.numero, p_id);
  end loop;
  update abonos set estado = 'disponible', venta_id = null where venta_id = p_id and estado = 'usado';
  if v.cita_id is not null then
    update citas set estado = 'confirmada' where id = v.cita_id and estado = 'atendida';
  end if;
end $$;

create or replace function registrar_abono(p_cliente text, p_telefono text, p_monto numeric, p_metodo text,
  p_cita uuid default null, p_nota text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; v_nom text := _nombre(p_cliente); v_tel text;
begin
  perform _solo_dueno();
  v_tel := case when coalesce(trim(p_telefono), '') = '' then null else _tel(p_telefono) end;
  insert into abonos (cliente_id, cita_id, cliente, telefono, fecha, monto, metodo, nota)
  values (_cliente(v_nom, v_tel), p_cita, v_nom, v_tel, ahora_local()::date, p_monto, p_metodo, nullif(trim(p_nota), ''))
  returning id into v;
  return v;
end $$;

create or replace function devolver_abono(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _solo_dueno();
  update abonos set estado = 'devuelto', devuelto_fecha = ahora_local()::date where id = p_id and estado = 'disponible';
  if not found then raise exception 'Solo se puede devolver un abono disponible.'; end if;
end $$;

create or replace function ajustar_stock(p_prod uuid, p_cant int, p_motivo text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform _solo_dueno();
  if p_cant = 0 then raise exception 'La cantidad no puede ser 0.'; end if;
  update productos set stock = stock + p_cant where id = p_prod returning stock into n;
  insert into stock_movs (producto_id, cantidad, motivo) values (p_prod, p_cant, coalesce(nullif(trim(p_motivo), ''), 'Ajuste'));
  return n;
end $$;

create or replace function pagar_profesional(p_prof uuid, p_monto numeric, p_tipo text, p_metodo text, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform _solo_dueno();
  insert into pagos_pro (profesional_id, fecha, monto, tipo, metodo, nota)
  values (p_prof, ahora_local()::date, p_monto, p_tipo, p_metodo, nullif(trim(p_nota), '')) returning id into v;
  return v;
end $$;

create or replace function saldo_pros()
returns table (profesional_id uuid, nombre text, comisiones numeric, propinas numeric, pagado numeric, saldo numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, x.com, y.prop, z.pag, x.com + y.prop - z.pag
  from profesionales p
  cross join lateral (select coalesce(sum(i.comision), 0) com from venta_items i join ventas v on v.id = i.venta_id
                      where i.profesional_id = p.id and not v.anulada) x
  cross join lateral (select coalesce(sum(v.propina), 0) prop from ventas v where v.profesional_id = p.id and not v.anulada) y
  cross join lateral (select coalesce(sum(g.monto), 0) pag from pagos_pro g where g.profesional_id = p.id and not g.anulado) z
  where es_dueno()
  order by p.orden, p.nombre
$$;

create or replace function clientes_resumen()
returns table (id uuid, nombre text, telefono text, notas text, cumpleanos date, visitas int, ultima date,
               proxima timestamp, gastado numeric, no_asistio int, canceladas int, abono_disponible numeric)
language sql stable security definer set search_path = public as $$
  select c.id, c.nombre, c.telefono, c.notas, c.cumpleanos,
    (select count(*) from citas ci where ci.cliente_id = c.id and ci.estado = 'atendida')::int,
    (select max(ci.fecha) from citas ci where ci.cliente_id = c.id and ci.estado = 'atendida'),
    (select min(ci.fecha + ci.hora) from citas ci where ci.cliente_id = c.id and ci.estado in ('pendiente','confirmada')
       and ci.fecha + ci.hora >= ahora_local()),
    (select coalesce(sum(v.total), 0) from ventas v where v.cliente_id = c.id and not v.anulada),
    (select count(*) from citas ci where ci.cliente_id = c.id and ci.estado = 'no_asistio')::int,
    (select count(*) from citas ci where ci.cliente_id = c.id and ci.estado = 'cancelada')::int,
    (select coalesce(sum(a.monto), 0) from abonos a where a.cliente_id = c.id and a.estado = 'disponible')
  from clientes c
  where es_dueno()
  order by c.nombre
$$;

create or replace function cliente_historial(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform _solo_dueno();
  return jsonb_build_object(
    'cliente', (select to_jsonb(c) from clientes c where c.id = p_id),
    'citas', (select coalesce(jsonb_agg(jsonb_build_object('id', ci.id, 'fecha', ci.fecha, 'hora', to_char(ci.hora, 'HH24:MI'),
                'estado', ci.estado, 'servicios', (select string_agg(nombre, ' + ' order by orden) from cita_servicios where cita_id = ci.id))
                order by ci.fecha desc, ci.hora desc), '[]')
              from (select * from citas where cliente_id = p_id order by fecha desc, hora desc limit 100) ci),
    'ventas', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'numero', v.numero, 'fecha', v.fecha, 'total', v.total,
                'anulada', v.anulada, 'items', (select string_agg(descripcion || case when cantidad > 1 then ' x' || cantidad else '' end, ', ')
                from venta_items where venta_id = v.id)) order by v.fecha desc), '[]')
              from (select * from ventas where cliente_id = p_id order by creada desc limit 100) v),
    'registros', (select coalesce(jsonb_agg(to_jsonb(r) order by r.fecha desc, r.creado desc), '[]') from registros_tecnicos r where r.cliente_id = p_id),
    'abonos', (select coalesce(jsonb_agg(to_jsonb(a) order by a.creado desc), '[]') from abonos a where a.cliente_id = p_id));
end $$;

create or replace function caja_dia(p_fecha date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cj cajas; ing jsonb; egr jsonb; v_ef numeric;
begin
  perform _solo_dueno();
  select * into cj from cajas where fecha = p_fecha;
  with m as (
    select p.metodo, p.monto from venta_pagos p join ventas v on v.id = p.venta_id
     where v.fecha = p_fecha and not v.anulada and p.metodo <> 'abono'
    union all select a.metodo, a.monto from abonos a where a.fecha = p_fecha)
  select coalesce(jsonb_object_agg(metodo, total), '{}') into ing from (select metodo, sum(monto) total from m group by metodo) t;
  with m as (
    select g.metodo, g.monto from gastos g where g.fecha = p_fecha
    union all select pp.metodo, pp.monto from pagos_pro pp where pp.fecha = p_fecha and not pp.anulado
    union all select a.metodo, a.monto from abonos a where a.devuelto_fecha = p_fecha and a.estado = 'devuelto')
  select coalesce(jsonb_object_agg(metodo, total), '{}') into egr from (select metodo, sum(monto) total from m group by metodo) t;
  v_ef := coalesce(cj.apertura, 0) + coalesce((ing->>'efectivo')::numeric, 0) - coalesce((egr->>'efectivo')::numeric, 0);
  return jsonb_build_object(
    'fecha', p_fecha, 'abierta', cj.fecha is not null, 'apertura', coalesce(cj.apertura, 0), 'contado', cj.contado,
    'nota', cj.nota, 'cerrada_at', cj.cerrada_at, 'ingresos', ing, 'egresos', egr, 'efectivo_esperado', v_ef,
    'diferencia', case when cj.contado is null then null else cj.contado - v_ef end,
    'ventas', (select count(*) from ventas where fecha = p_fecha and not anulada),
    'total_ventas', (select coalesce(sum(total), 0) from ventas where fecha = p_fecha and not anulada),
    'propinas', (select coalesce(sum(propina), 0) from ventas where fecha = p_fecha and not anulada),
    'abonos_recibidos', (select coalesce(sum(monto), 0) from abonos where fecha = p_fecha),
    'gastos', (select coalesce(sum(monto), 0) from gastos where fecha = p_fecha),
    'pagos_pro', (select coalesce(sum(monto), 0) from pagos_pro where fecha = p_fecha and not anulado));
end $$;

create or replace function reporte(p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; v_dias int := p_hasta - p_desde + 1; v_fijos numeric;
begin
  perform _solo_dueno();
  if p_hasta < p_desde then raise exception 'Rango de fechas inválido.'; end if;
  select coalesce(sum(monto), 0) * v_dias / 30.0 into v_fijos from gastos_fijos where activo;
  with v as (select * from ventas where fecha between p_desde and p_hasta and not anulada),
       i as (select i.* from venta_items i join v on v.id = i.venta_id),
       t as (select
         (select count(*) from v) ventas,
         (select coalesce(sum(total), 0) from v) total,
         (select coalesce(sum(descuento), 0) from v) descuentos,
         (select coalesce(sum(propina), 0) from v) propinas,
         (select coalesce(sum(cantidad * precio), 0) from i where tipo = 'servicio') servicios_bruto,
         (select coalesce(sum(cantidad * precio), 0) from i where tipo = 'producto') productos_bruto,
         (select coalesce(sum(comision), 0) from i) comisiones,
         (select coalesce(sum(cantidad * costo), 0) from i where tipo = 'producto') costo_productos,
         (select coalesce(sum(monto), 0) from gastos where fecha between p_desde and p_hasta) gastos)
  select jsonb_build_object(
    'resumen', (select jsonb_build_object('ventas', ventas, 'total', total, 'descuentos', descuentos, 'propinas', propinas,
        'servicios', servicios_bruto, 'productos', productos_bruto, 'comisiones', comisiones, 'costo_productos', costo_productos,
        'gastos', gastos, 'gastos_fijos', round(v_fijos),
        'utilidad', total - comisiones - costo_productos - gastos - round(v_fijos),
        'ticket_promedio', case when ventas > 0 then round(total / ventas) else 0 end) from t),
    'citas', (select jsonb_build_object(
        'total', count(*), 'atendidas', count(*) filter (where estado = 'atendida'),
        'canceladas', count(*) filter (where estado = 'cancelada'), 'no_asistio', count(*) filter (where estado = 'no_asistio'),
        'pendientes', count(*) filter (where estado in ('pendiente','confirmada')),
        'online', count(*) filter (where origen = 'online'), 'panel', count(*) filter (where origen = 'panel'))
        from citas where fecha between p_desde and p_hasta),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('fecha', d::date, 'total', coalesce(x.total, 0), 'ventas', coalesce(x.n, 0)) order by d), '[]')
        from generate_series(p_desde, p_hasta, interval '1 day') d
        left join (select fecha, sum(total) total, count(*) n from v group by fecha) x on x.fecha = d::date),
    'por_metodo', (select coalesce(jsonb_object_agg(metodo, total), '{}') from
        (select p.metodo, sum(p.monto) total from venta_pagos p join v on v.id = p.venta_id group by p.metodo) x),
    'por_servicio', (select coalesce(jsonb_agg(jsonb_build_object('nombre', descripcion, 'cantidad', cant, 'total', total) order by total desc), '[]')
        from (select descripcion, sum(cantidad) cant, sum(cantidad * precio) total from i where tipo = 'servicio' group by descripcion) x),
    'por_producto', (select coalesce(jsonb_agg(jsonb_build_object('nombre', descripcion, 'cantidad', cant, 'total', total, 'costo', costo) order by total desc), '[]')
        from (select descripcion, sum(cantidad) cant, sum(cantidad * precio) total, sum(cantidad * costo) costo from i where tipo = 'producto' group by descripcion) x),
    'por_profesional', (select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'ingresos', coalesce(a.ing, 0),
          'comision', coalesce(a.com, 0), 'propinas', coalesce(b.prop, 0), 'atendidas', coalesce(c.n, 0)) order by p.orden, p.nombre), '[]')
        from profesionales p
        left join (select profesional_id, sum(cantidad * precio) ing, sum(comision) com from i group by profesional_id) a on a.profesional_id = p.id
        left join (select profesional_id, sum(propina) prop from v group by profesional_id) b on b.profesional_id = p.id
        left join (select profesional_id, count(*) n from citas where fecha between p_desde and p_hasta and estado = 'atendida' group by profesional_id) c on c.profesional_id = p.id),
    'top_clientes', (select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'visitas', n, 'total', total) order by total desc), '[]')
        from (select coalesce(c.nombre, v.cliente, 'Sin nombre') nombre, count(*) n, sum(v.total) total
              from v left join clientes c on c.id = v.cliente_id group by 1 order by 3 desc limit 10) x),
    'gastos_cat', (select coalesce(jsonb_agg(jsonb_build_object('categoria', cat, 'total', total) order by total desc), '[]')
        from (select coalesce(nullif(categoria, ''), 'Otros') cat, sum(monto) total from gastos where fecha between p_desde and p_hasta group by 1) x)
  ) into r;
  return r;
end $$;

-- PIN de seguridad (secciones protegidas del panel)
create or replace function _pin_hash(p_pin text, p_salt text) returns text
language sql immutable as $$ select p_salt || ':' || encode(sha256(convert_to(p_salt || p_pin, 'UTF8')), 'hex') $$;

create or replace function pin_estado() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  perform _solo_dueno();
  return (select pin_hash is not null from config_negocio where id = 1);
end $$;

create or replace function pin_verificar(p_pin text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare h text;
begin
  perform _solo_dueno();
  select pin_hash into h from config_negocio where id = 1;
  if h is null then return true; end if;
  return _pin_hash(coalesce(p_pin, ''), split_part(h, ':', 1)) = h;
end $$;

create or replace function pin_guardar(p_nuevo text, p_actual text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_salt text := replace(gen_random_uuid()::text, '-', '');
begin
  perform _solo_dueno();
  if not pin_verificar(p_actual) then raise exception 'El PIN actual no es correcto.'; end if;
  if p_nuevo !~ '^\d{4,6}$' then raise exception 'El PIN debe tener de 4 a 6 números.'; end if;
  update config_negocio set pin_hash = _pin_hash(p_nuevo, v_salt) where id = 1;
end $$;

create or replace function pin_quitar(p_actual text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _solo_dueno();
  if not pin_verificar(p_actual) then raise exception 'El PIN actual no es correcto.'; end if;
  update config_negocio set pin_hash = null where id = 1;
end $$;

-- Liberar espacio: borra citas canceladas / no asistió y movimientos de inventario antiguos.
create or replace function limpieza(p_antes date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a int; b int;
begin
  perform _solo_dueno();
  if p_antes > ahora_local()::date - 30 then raise exception 'Solo se pueden borrar datos de hace más de 30 días.'; end if;
  delete from citas where fecha < p_antes and estado in ('cancelada','no_asistio')
    and not exists (select 1 from ventas v where v.cita_id = citas.id);
  get diagnostics a = row_count;
  delete from stock_movs where creado < p_antes;
  get diagnostics b = row_count;
  return jsonb_build_object('citas', a, 'movimientos', b);
end $$;

-- ---------------------------------------------------------------------
-- 5. SEGURIDAD (Row Level Security)
-- Clientas: solo usan las funciones públicas. Panel: solo la dueña.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['admins','config_negocio','horarios','profesionales','servicios','profesional_servicio',
    'bloqueos','clientes','citas','cita_servicios','registros_tecnicos','productos','ventas','venta_items',
    'venta_pagos','stock_movs','abonos','gastos','gastos_fijos','cajas','pagos_pro'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists dueno_todo on public.%I', t);
    execute format('create policy dueno_todo on public.%I for all to authenticated using (es_dueno()) with check (es_dueno())', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Permisos de tabla para el panel. Los proyectos nuevos de Supabase no siempre los dan solos;
-- RLS (dueno_todo) sigue limitando todo a la dueña.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- El hash del PIN no se lee ni se cambia directamente desde el panel (solo con las funciones pin_*).
revoke all on config_negocio from authenticated;
grant select (id, nombre, eslogan, direccion, whatsapp, paso_min, dias_reserva, min_anticipacion_min, horas_cancelar,
              max_citas_telefono, confirmacion_auto, aviso, actualizado),
      update (nombre, eslogan, direccion, whatsapp, paso_min, dias_reserva, min_anticipacion_min, horas_cancelar,
              max_citas_telefono, confirmacion_auto, aviso, actualizado)
  on config_negocio to authenticated;

-- Funciones públicas
do $$
declare f text;
begin
  -- Ninguna función queda abierta por defecto…
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  -- Panel: funciones sin "_" al inicio (cada una verifica que sea la dueña).
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' and left(p.proname, 1) <> '_' loop
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- …excepto las que usa la página de reservas.
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in
             ('publico_config','disponibilidad','dias_disponibles','reservar_cita','reservar_grupo',
              'mi_cita','confirmar_cita','cancelar_cita','reagendar_cita') loop
    execute format('grant execute on function %s to anon', f);
  end loop;
end $$;

-- Avisos en tiempo real de nuevas citas en el panel
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'citas') then
    alter publication supabase_realtime add table public.citas;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. DATOS INICIALES
-- ---------------------------------------------------------------------
insert into config_negocio (id) values (1) on conflict (id) do nothing;

insert into horarios (dia, activo, abre, cierra) values
  (0, false, '09:00', '20:00'), (1, true, '09:00', '20:00'), (2, true, '09:00', '20:00'),
  (3, true, '09:00', '20:00'), (4, true, '09:00', '20:00'), (5, true, '09:00', '20:00'),
  (6, true, '09:00', '20:00')
on conflict (dia) do nothing;

insert into profesionales (nombre, orden)
select 'Sofía', 1 where not exists (select 1 from profesionales);

insert into servicios (nombre, dur_min, precio, orden)
select x.nombre, 60, 0, x.orden
from (values ('Manicure y semipermanente', 1), ('Uñas acrílicas', 2), ('Uñas en polygel', 3),
             ('Recubrimiento y fortalecimiento', 4), ('Diseño personalizado', 5), ('Asesoría personalizada', 6)) as x(nombre, orden)
where not exists (select 1 from servicios);
