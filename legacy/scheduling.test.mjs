import test from 'node:test';
import assert from 'node:assert/strict';
import { availableSlots, eventId, validDate } from './scheduling.mjs';

test('fecha válida y hora en Bogotá', () => {
  assert.equal(validDate('2026-11-20'), true);
  assert.equal(validDate('2026-02-30'), false);
  const slots = availableSlots({ date: '2026-11-20', duration: 60, schedule: { 5: [['09:00', '12:00']] }, step: 60, now: new Date('2026-11-19T12:00:00Z') });
  assert.deepEqual(slots.map(slot => slot.time), ['09:00', '10:00', '11:00']);
  assert.equal(slots[0].start, '2026-11-20T14:00:00.000Z');
});

test('los eventos ocupados eliminan horarios solapados', () => {
  const slots = availableSlots({ date: '2026-11-20', duration: 60, schedule: { 5: [['09:00', '12:00']] }, step: 60, busy: [{ start: '2026-11-20T15:30:00Z', end: '2026-11-20T16:30:00Z' }], now: new Date('2026-11-19T12:00:00Z') });
  assert.deepEqual(slots.map(slot => slot.time), ['09:00']);
});

test('una misma fecha y hora generan un ID de evento estable', () => {
  assert.equal(eventId('2026-11-20', '09:00'), eventId('2026-11-20', '09:00'));
  assert.notEqual(eventId('2026-11-20', '09:00'), eventId('2026-11-20', '10:00'));
});
