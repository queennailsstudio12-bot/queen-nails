import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function nextMonday() {
  const now = new Date();
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', weekday: 'short' }).format(now);
  const offset = (8 - ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day)) % 7 || 7;
  const future = new Date(now.getTime() + offset * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(future);
}

test('Apps Script ofrece 09:00–19:00 y bloquea una segunda reserva', () => {
  const events = [];
  const calendar = {
    getEvents(start, end) { return events.filter(event => event.start < end && event.end > start); },
    createEvent(title, start, end) { const event = { title, start, end, getId: () => 'event-1' }; events.push(event); return event; }
  };
  const context = vm.createContext({
    CalendarApp: { getCalendarById: () => calendar },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: { formatDate: (date, timezone) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) },
    HtmlService: {}, Date, Error, Object, String
  });
  vm.runInContext(readFileSync(new URL('./apps-script/Code.gs', import.meta.url), 'utf8'), context);
  const date = nextMonday();
  const slots = vm.runInContext(`getSlots('manicure', '${date}')`, context);
  assert.equal(slots.length, 11);
  assert.equal(slots[0].time, '09:00');
  assert.equal(slots.at(-1).time, '19:00');
  const booking = vm.runInContext(`book({serviceId:'manicure',date:'${date}',time:'09:00',name:'Ana Pérez',phone:'3001234567'})`, context);
  assert.equal(booking.reservationId, 'event-1');
  assert.equal(events.length, 1);
  assert.throws(() => vm.runInContext(`book({serviceId:'manicure',date:'${date}',time:'09:00',name:'Eva Pérez',phone:'3007654321'})`, context), /ya no está disponible/);
  assert.equal(events.length, 1);
});
