const BOGOTA_OFFSET = '-05:00';

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T12:00:00${BOGOTA_OFFSET}`).toISOString().slice(0, 10) === value;
}

export function bogotaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function dayOfWeek(date) {
  return new Date(`${date}T12:00:00${BOGOTA_OFFSET}`).getUTCDay();
}

export function minutes(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Hora inválida');
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function timeLabel(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function interval(date, time, duration) {
  const start = new Date(`${date}T${time}:00${BOGOTA_OFFSET}`);
  return { start: start.toISOString(), end: new Date(start.getTime() + duration * 60_000).toISOString() };
}

export function availableSlots({ date, duration, schedule, step, busy = [], now = new Date() }) {
  if (!validDate(date) || !Number.isInteger(duration) || duration <= 0) return [];
  const periods = schedule[dayOfWeek(date)] || [];
  const result = [];
  for (const [from, to] of periods) {
    const startMinute = minutes(from), endMinute = minutes(to);
    for (let current = startMinute; current + duration <= endMinute; current += step) {
      const time = timeLabel(current);
      const slot = interval(date, time, duration);
      if (new Date(slot.start) <= now) continue;
      if (busy.some(item => Date.parse(item.start) < Date.parse(slot.end) && Date.parse(item.end) > Date.parse(slot.start))) continue;
      result.push({ time, ...slot });
    }
  }
  return result;
}

export function eventId(date, time) {
  return 'q' + Buffer.from(`${date}T${time}`, 'utf8').toString('hex');
}
