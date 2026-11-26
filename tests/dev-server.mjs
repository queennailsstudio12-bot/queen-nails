// Servidor de desarrollo: imita Supabase (REST + RPC + login) sobre un Postgres local (PGlite)
// para probar las páginas sin crear el proyecto real.
// Uso: node tests/dev-server.mjs  →  http://localhost:8787  (panel: dueña@demo / demo1234)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);
const OWNER = '11111111-1111-1111-1111-111111111111';
const EMAIL = 'duena@demo.co', PASS = 'demo1234';
const TOKEN = 'header.' + Buffer.from(JSON.stringify({ sub: OWNER, exp: 4102444800, role: 'authenticated' })).toString('base64url') + '.sig';

const tsz = v => new Date(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString();
const db = new PGlite({
  extensions: { btree_gist },
  parsers: { 1082: v => v, 1083: v => v, 1114: v => v.replace(' ', 'T'), 1184: tsz, 1700: v => Number(v), 20: v => Number(v) }
});
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  insert into auth.users values ('${OWNER}', '${EMAIL}');`);
await db.exec(readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8'));
await db.exec(`insert into admins values ('${OWNER}');
  update servicios set precio = case nombre when 'Manicure y semipermanente' then 45000 when 'Uñas acrílicas' then 90000 when 'Uñas en polygel' then 85000 when 'Diseño personalizado' then 15000 else 0 end;
  update servicios set descripcion = 'Limado, cutícula y esmaltado semipermanente de larga duración.' where nombre = 'Manicure y semipermanente';
  insert into productos (nombre, precio, costo, stock, stock_min) values ('Aceite para cutícula', 18000, 7000, 6, 2), ('Crema de manos', 22000, 9000, 1, 2);`);
// Citas de ejemplo para mañana
await db.exec(`select set_config('request.jwt.claim.sub', '${OWNER}', false);
do $$ declare s uuid[]; d date := (now() at time zone 'America/Bogota')::date + 1; begin
  while extract(dow from d) = 0 loop d := d + 1; end loop;
  select array_agg(id order by orden) into s from servicios;
  perform reservar_cita(array[s[1]], d, '10:00', 'Laura Gómez', '3001112233');
  perform reservar_cita(array[s[2], s[5]], d, '14:00', 'Camila Ruiz', '3104445566');
  perform crear_cita_admin(array[s[3]], d, '17:00', 'Valentina Díaz', '3157778899', (select id from profesionales limit 1));
end $$;
select set_config('request.jwt.claim.sub', '', false);`);

// ---------- utilidades ----------
const ident = s => { if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw Object.assign(new Error('identificador inválido'), { code: '42601' }); return `"${s}"`; };
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
async function bodyOf(req) { let b = ''; for await (const c of req) b += c; return b ? JSON.parse(b) : {}; }
const authed = req => (req.headers.authorization || '') === 'Bearer ' + TOKEN;

async function asRole(req, fn) {
  return db.transaction(async tx => {
    await tx.exec(authed(req) ? `set local role authenticated; select set_config('request.jwt.claim.sub', '${OWNER}', true);` : `set local role anon; select set_config('request.jwt.claim.sub', '', true);`);
    return fn(tx);
  });
}

function filters(params, values) {
  const where = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const m = /^(eq|neq|gt|gte|lt|lte|in|is)\.(.*)$/s.exec(v);
    if (!m) throw Object.assign(new Error('filtro no soportado: ' + v), { code: 'PGRST100' });
    const col = ident(k), [, op, val] = m;
    if (op === 'in') {
      const list = val.replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, ''));
      where.push(`${col}::text in (${list.map(x => { values.push(x); return '$' + values.length; }).join(',') || 'null'})`);
    } else if (op === 'is') where.push(`${col} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`);
    else { values.push(val); where.push(`${col}::text ${{ eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[op]} $${values.length}`.replace(/::text (>|>=|<|<=) /, '$&')); }
  }
  return where;
}
// Comparaciones de orden con tipo correcto (fechas/números) en lugar de texto
function typedFilters(params, values) {
  return filters(params, values).map(w => w.replace(/^("[^"]+")::text (>=|<=|>|<) (\$\d+)$/, (_, c, op, p) => `${c} ${op} ${p}`));
}
const selectCols = s => !s || s === '*' ? '*' : s.split(',').map(c => ident(c.trim())).join(',');

async function rest(req, res, table, url) {
  ident(table);
  const p = url.searchParams, values = [];
  const where = typedFilters(p, values);
  const W = where.length ? ' where ' + where.join(' and ') : '';
  const prefer = req.headers.prefer || '';
  const ret = /return=representation/.test(prefer);
  const out = await asRole(req, async tx => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      let sql = `select ${selectCols(p.get('select'))} from ${ident(table)}${W}`;
      if (p.get('order')) sql += ' order by ' + p.get('order').split(',').map(o => { const [c, dir] = o.split('.'); return ident(c) + (dir === 'desc' ? ' desc' : ' asc'); }).join(',');
      const range = /^(\d+)-(\d+)$/.exec(req.headers.range || '');
      const limit = p.get('limit') || (range ? Number(range[2]) - Number(range[1]) + 1 : null), offset = p.get('offset') || (range ? range[1] : null);
      if (limit) sql += ' limit ' + Number(limit);
      if (offset) sql += ' offset ' + Number(offset);
      return (await tx.query(sql, values)).rows;
    }
    const sel = ret ? ' returning ' + selectCols(p.get('select')) : '';
    if (req.method === 'POST') {
      const body = await bodyOf(req), rows = Array.isArray(body) ? body : [body], result = [];
      for (const r of rows) {
        const cols = Object.keys(r), vals = cols.map(c => typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : r[c]);
        const q = await tx.query(`insert into ${ident(table)} (${cols.map(ident).join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')})${sel}`, vals);
        result.push(...q.rows);
      }
      return result;
    }
    if (req.method === 'PATCH') {
      const body = await bodyOf(req), cols = Object.keys(body);
      const set = cols.map((c, i) => `${ident(c)} = $${values.length + i + 1}`).join(',');
      return (await tx.query(`update ${ident(table)} set ${set}${W}${sel}`, [...values, ...cols.map(c => body[c])])).rows;
    }
    if (req.method === 'DELETE') return (await tx.query(`delete from ${ident(table)}${W}${sel}`, values)).rows;
  });
  return ret || req.method === 'GET' ? send(res, req.method === 'POST' ? 201 : 200, out) : send(res, 204);
}

async function rpc(req, res, fn) {
  const args = await bodyOf(req);
  const info = (await db.query(`select p.proretset, p.prorettype::regtype::text rt, p.proargnames, array(select format_type(t, null) from unnest(p.proargtypes) t) types
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [fn])).rows[0];
  if (!info) return send(res, 404, { code: 'PGRST202', message: 'función no encontrada' });
  const values = [], parts = [];
  for (const [k, v] of Object.entries(args)) {
    const i = (info.proargnames || []).indexOf(k);
    if (i < 0) return send(res, 404, { code: 'PGRST202', message: 'argumento desconocido ' + k });
    const type = info.types[i];
    values.push(v === null ? null : type.endsWith('[]') ? '{' + v.map(x => '"' + x + '"').join(',') + '}' : typeof v === 'object' ? JSON.stringify(v) : v);
    parts.push(`${ident(k)} => $${values.length}::${type}`);
  }
  const call = `${ident(fn)}(${parts.join(', ')})`;
  const out = await asRole(req, async tx => {
    if (info.proretset) return (await tx.query(`select * from ${call}`, values)).rows;
    const r = (await tx.query(`select ${call} as r`, values)).rows[0].r;
    return r;
  });
  send(res, 200, out ?? null);
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'OPTIONS') return send(res, 204);
    if (url.pathname === '/config.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      return res.end(`window.QN_CONFIG = { SUPABASE_URL: 'http://localhost:${PORT}', SUPABASE_KEY: 'dev-anon-key' };`);
    }
    if (url.pathname === '/auth/v1/token') {
      const b = await bodyOf(req);
      if (url.searchParams.get('grant_type') === 'password' && (b.email !== EMAIL || b.password !== PASS)) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
      return send(res, 200, { access_token: TOKEN, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: OWNER, email: EMAIL, aud: 'authenticated', role: 'authenticated' } });
    }
    if (url.pathname === '/auth/v1/user') return send(res, 200, { id: OWNER, email: EMAIL, aud: 'authenticated', role: 'authenticated' });
    if (url.pathname.startsWith('/auth/v1/')) return send(res, 204);
    if (url.pathname.startsWith('/rest/v1/rpc/')) return await rpc(req, res, url.pathname.slice(13));
    if (url.pathname.startsWith('/rest/v1/')) return await rest(req, res, url.pathname.slice(9), url);
    if (url.pathname.startsWith('/realtime/')) return send(res, 404);
    let file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root) || /[\\/](node_modules|legacy|tests|supabase)[\\/]/.test(file.slice(root.length))) return send(res, 404, { message: 'no' });
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT') return send(res, 404, { message: 'no encontrado' });
    const status = e.code === '42501' ? 403 : e.code === 'P0001' ? 400 : 400;
    if (e.code !== 'P0001') console.error(req.method, req.url, e.message);
    send(res, status, { code: e.code || 'XX000', message: e.message, details: e.detail || null, hint: null });
  }
}).listen(PORT, () => console.log(`Servidor de prueba: http://localhost:${PORT}  ·  panel: http://localhost:${PORT}/agenda.html (${EMAIL} / ${PASS})`));
