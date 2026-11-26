import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { studio } from './config.mjs';
import { availableSlots, bogotaDate, eventId, interval, validDate } from './scheduling.mjs';
import { busyIntervals, calendarConfigured, createEvent } from './google-calendar.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
let bookingQueue = Promise.resolve();

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(data));
}

function serviceById(id) { return studio.services.find(service => service.id === id); }
function isReady() { return Object.keys(studio.schedule).length > 0 && calendarConfigured(); }
function inBookingWindow(date) {
  const today = bogotaDate();
  const limit = new Date(`${today}T12:00:00-05:00`);
  limit.setUTCDate(limit.getUTCDate() + studio.bookingWindowDays);
  return date >= today && date <= limit.toISOString().slice(0, 10);
}

async function slotsFor(service, date) {
  const day = interval(date, '00:00', 24 * 60);
  const busy = await busyIntervals(day.start, day.end);
  return availableSlots({ date, duration: service.minutes, schedule: studio.schedule, step: studio.slotStepMinutes, busy });
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 5000) throw Object.assign(new Error('Solicitud demasiado grande'), { status: 413 });
  }
  try { return JSON.parse(body); } catch { throw Object.assign(new Error('Datos inválidos'), { status: 400 }); }
}

function validateBooking(data) {
  const service = serviceById(data.serviceId);
  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();
  if (!service || !validDate(data.date) || !/^\d{2}:\d{2}$/.test(data.time || '') || !inBookingWindow(data.date)) throw Object.assign(new Error('Servicio, fecha u hora inválidos'), { status: 400 });
  if (name.length < 2 || name.length > 80 || !/^[+\d\s()-]{7,25}$/.test(phone)) throw Object.assign(new Error('Revisa tu nombre y número de teléfono'), { status: 400 });
  return { service, name, phone };
}

async function book(data) {
  const { service, name, phone } = validateBooking(data);
  const slots = await slotsFor(service, data.date);
  const chosen = slots.find(slot => slot.time === data.time);
  if (!chosen) throw Object.assign(new Error('Ese horario ya no está disponible. Elige otro.'), { status: 409 });
  try {
    const event = await createEvent({ id: eventId(data.date, data.time), start: chosen.start, end: chosen.end, service: service.name, name, phone });
    return { reservationId: event.id, service: service.name, date: data.date, time: data.time };
  } catch (error) {
    if (error.status === 409) throw Object.assign(new Error('Ese horario ya fue reservado. Elige otro.'), { status: 409 });
    throw error;
  }
}

const assets = { '/': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/logo.jpeg': ['../logo/logo.jpeg', 'image/jpeg'] };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, { name: studio.name, tagline: studio.tagline, location: studio.location, timezone: studio.timezone, services: studio.services, ready: isReady(), bookingWindowDays: studio.bookingWindowDays });
    if (req.method === 'GET' && url.pathname === '/api/slots') {
      const service = serviceById(url.searchParams.get('service'));
      const date = url.searchParams.get('date');
      if (!service || !validDate(date) || !inBookingWindow(date)) return json(res, 400, { error: 'Selecciona una fecha y un servicio válidos' });
      if (!isReady()) return json(res, 503, { error: 'Las reservas aún no están habilitadas' });
      return json(res, 200, { slots: await slotsFor(service, date) });
    }
    if (req.method === 'POST' && url.pathname === '/api/book') {
      if (!isReady()) return json(res, 503, { error: 'Las reservas aún no están habilitadas' });
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) return json(res, 403, { error: 'Origen no permitido' });
      const data = await readBody(req);
      const pending = bookingQueue.then(() => book(data));
      bookingQueue = pending.catch(() => {});
      return json(res, 201, await pending);
    }
    if (req.method === 'GET' && assets[url.pathname]) {
      const [file, type] = assets[url.pathname];
      const content = await readFile(path.join(root, 'public', file));
      res.writeHead(200, { 'content-type': type === 'image/jpeg' ? type : `${type}; charset=utf-8`, 'x-content-type-options': 'nosniff' });
      return res.end(content);
    }
    json(res, 404, { error: 'Página no encontrada' });
  } catch (error) {
    console.error(error);
    json(res, error.status || 500, { error: error.status ? error.message : 'No pudimos completar la solicitud. Inténtalo de nuevo.' });
  }
});

server.listen(port, () => console.log(`Queen Nails Studio: http://localhost:${port}`));
