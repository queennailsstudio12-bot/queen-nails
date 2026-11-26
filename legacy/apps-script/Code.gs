const STUDIO = {
  name: 'Queen Nails Studio · by Sofía',
  tagline: 'Tus uñas merecen sentirse como una reina.',
  location: 'Alfonso López, Usme – Bogotá D. C.',
  timezone: 'America/Bogota',
  calendarId: 'queennailsstudio12@gmail.com',
  services: [
    { id: 'manicure', name: 'Manicure y semipermanente', minutes: 60 },
    { id: 'acrilicas', name: 'Uñas acrílicas', minutes: 60 },
    { id: 'polygel', name: 'Uñas en polygel', minutes: 60 },
    { id: 'fortalecimiento', name: 'Recubrimiento y fortalecimiento', minutes: 60 },
    { id: 'diseno', name: 'Diseño personalizado', minutes: 60 },
    { id: 'asesoria', name: 'Asesoría personalizada', minutes: 60 }
  ],
  // 0 domingo ... 6 sábado. Último turno de una hora: 19:00.
  schedule: {
    1: [['09:00', '20:00']],
    2: [['09:00', '20:00']],
    3: [['09:00', '20:00']],
    4: [['09:00', '20:00']],
    5: [['09:00', '20:00']],
    6: [['09:00', '20:00']]
  },
  slotStepMinutes: 60,
  bookingWindowDays: 60
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Agenda tu cita · Queen Nails Studio')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getConfig() {
  return {
    name: STUDIO.name,
    tagline: STUDIO.tagline,
    location: STUDIO.location,
    timezone: STUDIO.timezone,
    services: STUDIO.services,
    bookingWindowDays: STUDIO.bookingWindowDays,
    ready: Object.keys(STUDIO.schedule).length > 0 && !!CalendarApp.getCalendarById(STUDIO.calendarId)
  };
}

function getSlots(serviceId, date) {
  const service = service_(serviceId);
  if (!service || !validDate_(date) || !inWindow_(date)) throw new Error('Selecciona un servicio y una fecha válidos.');
  const calendar = calendar_();
  const periods = STUDIO.schedule[weekday_(date)] || [];
  const result = [];
  const now = Date.now();
  for (const period of periods) {
    const from = minutes_(period[0]);
    const to = minutes_(period[1]);
    if (from >= to) continue;
    for (let minute = from; minute + service.minutes <= to; minute += STUDIO.slotStepMinutes) {
      const time = label_(minute);
      const start = instant_(date, time);
      const end = new Date(start.getTime() + service.minutes * 60000);
      if (start.getTime() <= now) continue;
      if (calendar.getEvents(start, end).length) continue;
      result.push({ time: time });
    }
  }
  return result;
}

function book(data) {
  if (!data || typeof data !== 'object') throw new Error('Datos inválidos.');
  const service = service_(data.serviceId);
  const name = String(data.name || '').trim();
  const phone = String(data.phone || '').trim();
  const date = String(data.date || '');
  const time = String(data.time || '');
  if (!service || !validDate_(date) || !inWindow_(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Servicio, fecha u hora inválidos.');
  if (name.length < 2 || name.length > 80 || !/^[+\d\s()-]{7,25}$/.test(phone)) throw new Error('Revisa tu nombre y celular.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('La agenda está ocupada. Intenta nuevamente.');
  try {
    const validSlot = getSlots(service.id, date).some(slot => slot.time === time);
    if (!validSlot) throw new Error('Ese horario ya no está disponible. Elige otro.');
    const start = instant_(date, time);
    const end = new Date(start.getTime() + service.minutes * 60000);
    const event = calendar_().createEvent(`${service.name} · ${name}`, start, end, {
      description: `Reserva Queen Nails Studio\nClienta: ${name}\nCelular: ${phone}`,
      location: STUDIO.location
    });
    return { reservationId: event.getId(), service: service.name, date: date, time: time };
  } finally {
    lock.releaseLock();
  }
}

function calendar_() {
  const calendar = CalendarApp.getCalendarById(STUDIO.calendarId);
  if (!calendar) throw new Error('El calendario del estudio no está disponible.');
  return calendar;
}
function service_(id) { return STUDIO.services.find(service => service.id === id); }
function validDate_(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return Utilities.formatDate(instant_(value, '12:00'), STUDIO.timezone, 'yyyy-MM-dd') === value;
}
function weekday_(date) { return instant_(date, '12:00').getUTCDay(); }
function minutes_(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Horario inválido.');
  const parts = time.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}
function label_(minute) { return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0'); }
function instant_(date, time) { return new Date(`${date}T${time}:00-05:00`); }
function today_() { return Utilities.formatDate(new Date(), STUDIO.timezone, 'yyyy-MM-dd'); }
function inWindow_(date) {
  const today = today_();
  const limit = instant_(today, '12:00');
  limit.setUTCDate(limit.getUTCDate() + STUDIO.bookingWindowDays);
  return date >= today && date <= Utilities.formatDate(limit, STUDIO.timezone, 'yyyy-MM-dd');
}
