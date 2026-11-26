import { createPrivateKey, sign } from 'node:crypto';

const scope = 'https://www.googleapis.com/auth/calendar';
let cachedToken = null;

function base64url(value) { return Buffer.from(value).toString('base64url'); }

export function calendarConfigured() {
  return Boolean(process.env.GOOGLE_CALENDAR_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

async function accessToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  if (!calendarConfigured()) throw new Error('Google Calendar no está configurado');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const body = `${header}.${claims}`;
  const key = createPrivateKey(process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'));
  const jwt = `${body}.${sign('RSA-SHA256', Buffer.from(body), key).toString('base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('No se pudo autenticar Google Calendar');
  cachedToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

async function calendarRequest(path, options = {}) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...options, headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Error de Google Calendar');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function busyIntervals(start, end) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const data = await calendarRequest('/freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: start, timeMax: end, items: [{ id: calendarId }] }) });
  const calendar = data.calendars?.[calendarId];
  if (!calendar || calendar.errors?.length) throw new Error('No se pudo consultar la disponibilidad del calendario');
  return calendar.busy || [];
}

export async function createEvent({ id, start, end, service, name, phone }) {
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);
  return calendarRequest(`/calendars/${calendarId}/events`, { method: 'POST', body: JSON.stringify({ id, summary: `${service} · ${name}`, description: `Reserva Queen Nails Studio\nClienta: ${name}\nTeléfono: ${phone}`, location: 'Alfonso López, Usme – Bogotá D. C.', start: { dateTime: start, timeZone: 'America/Bogota' }, end: { dateTime: end, timeZone: 'America/Bogota' } }) });
}
