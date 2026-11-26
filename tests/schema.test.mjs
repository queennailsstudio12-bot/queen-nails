// Prueba el esquema SQL en un Postgres local (PGlite), simulando Supabase.
// Uso: npm install && npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const OWNER = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

async function setup() {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    insert into auth.users values ('${OWNER}', 'queennailsstudio12@gmail.com'), ('${OTHER}', 'otra@x.com');
  `);
  await db.exec(schema);
  await db.exec(schema); // se puede ejecutar dos veces sin error
  await db.exec(`insert into admins (user_id) values ('${OWNER}');`);
  return db;
}

const as = async (db, who) => {
  if (who === 'anon') await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  else await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${who}', false);`);
};
const asRoot = db => db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
const one = async (db, sql, params) => (await db.query(sql, params)).rows[0];
const all = async (db, sql, params) => (await db.query(sql, params)).rows;

async function nextWeekday(db, dow) {
  const r = await one(db, `select (d)::date::text f from generate_series(ahora_local()::date + 1, ahora_local()::date + 8, interval '1 day') d
                           where extract(dow from d) = $1 limit 1`, [dow]);
  return r.f;
}

test('flujo completo de reservas y panel', async () => {
  const db = await setup();
  await asRoot(db);
  const svcs = await all(db, `select id, nombre from servicios order by orden`);
  assert.equal(svcs.length, 6);
  const [s1, s2] = svcs.map(s => s.id);
  const pro = (await one(db, `select id from profesionales`)).id;
  const lunes = await nextWeekday(db, 1);
  const domingo = await nextWeekday(db, 0);

  // --- Clienta (anon) ---
  await as(db, 'anon');
  const cfg = (await one(db, `select publico_config() c`)).c;
  assert.equal(cfg.servicios.length, 6);
  assert.equal(cfg.negocio.whatsapp, '573228676258');

  const slots = await all(db, `select * from disponibilidad($1, 60)`, [lunes]);
  assert.equal(slots[0].hora, '09:00');
  assert.equal(slots.at(-1).hora, '19:00'); // paso 30 min, último inicio 19:00
  assert.equal(slots.length, 21);
  assert.deepEqual(await all(db, `select * from disponibilidad($1, 60)`, [domingo]), []);

  // Tablas cerradas para anon
  await assert.rejects(db.query(`select * from citas`), /permission denied/);
  await assert.rejects(db.query(`select * from clientes`), /permission denied/);
  await assert.rejects(db.query(`select clientes_resumen()`), /permission denied/);
  await assert.rejects(db.query(`select _cliente('x','573001112233')`), /permission denied/);

  const tok = (await one(db, `select reservar_cita($1, $2, '10:00', 'Ana Pérez', '300 123 4567') t`, [[s1, s2], lunes])).t;
  assert.ok(tok);
  // 2 servicios = 120 min → 10:00 y 11:00 y 9:30/10:30/11:30 ocupados
  const after = Object.fromEntries((await all(db, `select hora, libre from disponibilidad($1, 60)`, [lunes])).map(r => [r.hora, r.libre]));
  assert.equal(after['09:00'], true);
  assert.equal(after['09:30'], false);
  assert.equal(after['10:00'], false);
  assert.equal(after['11:30'], false);
  assert.equal(after['12:00'], true);

  // Doble reserva rechazada
  await assert.rejects(db.query(`select reservar_cita($1, $2, '11:00', 'Eva', '3009998877')`, [[s1], lunes]), /ya no está disponible/);
  // Validaciones
  await assert.rejects(db.query(`select reservar_cita($1, $2, '15:00', 'E', '3009998877')`, [[s1], lunes]), /nombre/);
  await assert.rejects(db.query(`select reservar_cita($1, $2, '15:00', 'Eva', '123')`, [[s1], lunes]), /celular/);
  await assert.rejects(db.query(`select reservar_cita($1, $2, '15:00', 'Eva', '3009998877')`, [[s1], domingo]), /no está disponible/);

  const mi = (await one(db, `select mi_cita($1) m`, [tok])).m;
  assert.equal(mi.estado, 'pendiente');
  assert.equal(mi.dur_min, 120);
  assert.equal(mi.servicios, svcs[0].nombre + ' + ' + svcs[1].nombre);
  assert.equal(mi.puede_modificar, true);

  await db.query(`select confirmar_cita($1)`, [tok]);
  assert.equal((await one(db, `select mi_cita($1) m`, [tok])).m.estado, 'confirmada');

  // Reagendar: puede moverse a 10:30 (se cruza solo consigo misma)
  await db.query(`select reagendar_cita($1, $2, '10:30')`, [tok, lunes]);
  assert.equal((await one(db, `select mi_cita($1) m`, [tok])).m.hora, '10:30');

  // Grupo de 2 personas a las 15:00 → 15:00 y 16:00
  const g = (await one(db, `select reservar_grupo($1, '15:00', $2::jsonb, 'Luisa', '3105551234') g`,
    [lunes, JSON.stringify([{ nombre: 'Mamá', servicios: [s1] }, { nombre: 'Hija', servicios: [s2] }])])).g;
  assert.deepEqual(g.map(x => x.hora), ['15:00', '16:00']);

  // Límite por teléfono (3 activas): Luisa tiene 2, una más permitida, la cuarta no
  await db.query(`select reservar_cita($1, $2, '18:00', 'Luisa', '3105551234')`, [[s1], lunes]);
  await assert.rejects(db.query(`select reservar_cita($1, $2, '19:00', 'Luisa', '3105551234')`, [[s1], lunes]), /citas activas/);

  // --- Usuario autenticado que NO es la dueña ---
  await as(db, OTHER);
  assert.equal((await all(db, `select * from citas`)).length, 0);
  await assert.rejects(db.query(`select caja_dia(current_date)`), /No autorizado/);
  await assert.rejects(db.query(`select pin_hash from config_negocio`), /permission denied/);

  // --- Dueña ---
  await as(db, OWNER);
  assert.equal((await one(db, `select mi_rol() r`)).r, 'dueno');
  const citas = await all(db, `select id, cliente, estado from citas order by fecha, hora`);
  assert.equal(citas.length, 4);
  // Descanso de todo el día bloquea la disponibilidad
  await db.query(`insert into bloqueos (desde, hasta, motivo) values ($1, $1, 'Vacaciones')`, [await nextWeekday(db, 2)]);
  await asRoot(db);
  assert.deepEqual(await all(db, `select * from disponibilidad($1, 60)`, [await nextWeekday(db, 2)]), []);
  await as(db, OWNER);

  // Cita desde el panel
  const idPanel = (await one(db, `select crear_cita_admin($1, $2, '13:00', 'Marta', '', $3) id`, [[s1], lunes, pro])).id;
  assert.ok(idPanel);
  await assert.rejects(db.query(`select crear_cita_admin($1, $2, '13:30', 'Marta', '', $3)`, [[s1], lunes, pro]), /acaba de ocuparse/);

  // Productos, abonos y venta
  await db.query(`update servicios set precio = 50000 where id = $1`, [s1]);
  await db.query(`update profesionales set comision = 40, comision_producto = 10`);
  const prod = (await one(db, `insert into productos (nombre, precio, costo, stock) values ('Aceite cutícula', 20000, 8000, 5) returning id`)).id;
  const ab = (await one(db, `select registrar_abono('Ana Pérez', '3001234567', 10000, 'nequi') id`)).id;
  await assert.rejects(db.query(`select registrar_venta($1, null, null, null, $2::jsonb, 0, 0, $3::jsonb, $4)`,
    [citas[0].id, JSON.stringify([{ tipo: 'servicio', servicio_id: s1, descripcion: 'Manicure', cantidad: 1, precio: 50000 }]),
     JSON.stringify([{ metodo: 'efectivo', monto: 10000 }]), [ab]]), /no coinciden/);
  const venta = (await one(db, `select registrar_venta($1, 'Ana Pérez', '3001234567', null, $2::jsonb, 7000, 5000, $3::jsonb, $4) v`,
    [citas[0].id, JSON.stringify([
      { tipo: 'servicio', servicio_id: s1, descripcion: 'Manicure', cantidad: 1, precio: 50000 },
      { tipo: 'producto', producto_id: prod, descripcion: 'Aceite cutícula', cantidad: 1, precio: 20000 }]),
     JSON.stringify([{ metodo: 'efectivo', monto: 40000 }, { metodo: 'nequi', monto: 18000 }]), [ab]])).v;
  // total 70000 - 7000 = 63000 + 5000 propina = 68000 = 40000 + 18000 + 10000 abono
  assert.equal(venta.numero, 1);
  assert.equal((await one(db, `select stock from productos where id = $1`, [prod])).stock, 4);
  assert.equal((await one(db, `select estado from abonos where id = $1`, [ab])).estado, 'usado');
  assert.equal((await one(db, `select estado from citas where id = $1`, [citas[0].id])).estado, 'atendida');
  const items = await all(db, `select tipo, comision::int c from venta_items order by tipo desc`);
  assert.deepEqual(items.map(i => i.c), [18000, 1800]); // 50000*0.9*40% ; 20000*0.9*10%

  await db.query(`insert into gastos (fecha, concepto, monto) values (ahora_local()::date, 'Algodón', 3000)`);
  await db.query(`insert into cajas (fecha, apertura) values (ahora_local()::date, 50000)`);
  const caja = (await one(db, `select caja_dia(ahora_local()::date) c`)).c;
  assert.equal(Number(caja.efectivo_esperado), 50000 + 40000 - 3000);
  assert.equal(Number(caja.ingresos.nequi), 18000 + 10000);

  const saldo = await one(db, `select * from saldo_pros()`);
  assert.equal(Number(saldo.saldo), 18000 + 1800 + 5000);
  await db.query(`select pagar_profesional($1, 10000, 'adelanto', 'efectivo')`, [pro]);
  assert.equal(Number((await one(db, `select * from saldo_pros()`)).saldo), 14800);

  const rep = (await one(db, `select reporte(ahora_local()::date - 7, ahora_local()::date) r`)).r;
  assert.equal(Number(rep.resumen.total), 63000);
  assert.equal(Number(rep.resumen.utilidad), 63000 - 19800 - 8000 - 3000);

  const cli = await all(db, `select * from clientes_resumen()`);
  assert.ok(cli.find(c => c.nombre === 'Ana Pérez' && Number(c.gastado) === 63000));
  const hist = (await one(db, `select cliente_historial($1) h`, [cli.find(c => c.nombre === 'Ana Pérez').id])).h;
  assert.equal(hist.ventas.length, 1);

  // Anular devuelve stock y abono
  await db.query(`select anular_venta($1, 'error')`, [venta.id]);
  assert.equal((await one(db, `select stock from productos where id = $1`, [prod])).stock, 5);
  assert.equal((await one(db, `select estado from abonos where id = $1`, [ab])).estado, 'disponible');

  // PIN
  assert.equal((await one(db, `select pin_estado() p`)).p, false);
  await db.query(`select pin_guardar('1234')`);
  assert.equal((await one(db, `select pin_verificar('1234') p`)).p, true);
  assert.equal((await one(db, `select pin_verificar('0000') p`)).p, false);
  await assert.rejects(db.query(`select pin_guardar('5678', '9999')`), /no es correcto/);
  await db.query(`select pin_quitar('1234')`);
  assert.equal((await one(db, `select pin_estado() p`)).p, false);

  // Cancelación por la clienta
  await as(db, 'anon');
  await db.query(`select cancelar_cita($1)`, [g[0].token]);
  assert.equal((await one(db, `select mi_cita($1) m`, [g[0].token])).m.estado, 'cancelada');
  await assert.rejects(db.query(`select cancelar_cita($1)`, [g[0].token]), /ya no se puede modificar/);

  const dias = await all(db, `select * from dias_disponibles(60)`);
  assert.ok(dias.length >= 30);
});
