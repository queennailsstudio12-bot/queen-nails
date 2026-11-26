// Utilidades compartidas: conexión a Supabase, formatos y errores.
(function () {
  const cfg = window.QN_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_KEY && !/TU-PROYECTO|TU-CLAVE/.test(cfg.SUPABASE_URL + cfg.SUPABASE_KEY));
  let sb = null;

  function client(auth = false) {
    if (!configured) return null;
    if (!sb) sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
      auth: { persistSession: auth, autoRefreshToken: auth, detectSessionInUrl: auth, storageKey: 'qn-panel' }
    });
    return sb;
  }

  function friendly(error) {
    if (!error) return 'Ocurrió un error.';
    if (error.code === 'P0001' && error.message) return error.message;
    if (/fetch|network|Failed to fetch|NetworkError/i.test(error.message || '')) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
    if (error.code === '42501' || /permission|JWT|not authorized/i.test(error.message || '')) return 'Tu sesión expiró o no tienes permiso. Vuelve a iniciar sesión.';
    console.error(error);
    return 'No pudimos completar la acción. Inténtalo de nuevo.';
  }

  async function rpc(name, args = {}) {
    const { data, error } = await client().rpc(name, args);
    if (error) { const e = new Error(friendly(error)); e.raw = error; throw e; }
    return data;
  }

  // Ejecuta una consulta del cliente de Supabase y lanza un error claro si falla.
  async function q(promise) {
    const { data, error } = await promise;
    if (error) { const e = new Error(friendly(error)); e.raw = error; throw e; }
    return data;
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  const dUTC = f => new Date(f + 'T12:00:00Z');
  const fmt = (f, o) => new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', ...o }).format(dUTC(f));
  const fechaLarga = f => fmt(f, { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaCorta = f => fmt(f, { weekday: 'short', day: 'numeric', month: 'short' });
  const h12 = t => { const [h, m] = t.slice(0, 5).split(':').map(Number); return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`; };
  const addDays = (f, n) => { const d = dUTC(f); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const dur = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`;
  const telLocal = t => String(t || '').replace(/^57(?=3\d{9}$)/, '');
  const wa = (num, text) => `https://wa.me/${String(num).replace(/\D/g, '').replace(/^(3\d{9})$/, '57$1')}?text=${encodeURIComponent(text)}`;

  // Enlaces de calendario para la clienta
  const p2 = n => String(n).padStart(2, '0');
  function icsDates(fecha, hora, min) {
    const [y, mo, d] = fecha.split('-').map(Number), [hh, mm] = hora.split(':').map(Number);
    const s = new Date(Date.UTC(y, mo - 1, d, hh + 5, mm)), e = new Date(s.getTime() + min * 60000); // Bogotá = UTC-5
    const f = x => `${x.getUTCFullYear()}${p2(x.getUTCMonth() + 1)}${p2(x.getUTCDate())}T${p2(x.getUTCHours())}${p2(x.getUTCMinutes())}00Z`;
    return [f(s), f(e)];
  }
  function googleCal({ titulo, fecha, hora, min, detalle, lugar }) {
    const [a, b] = icsDates(fecha, hora, min);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(titulo) +
      '&dates=' + a + '/' + b + '&ctz=America/Bogota&details=' + encodeURIComponent(detalle || '') + '&location=' + encodeURIComponent(lugar || '');
  }
  function descargarIcs({ titulo, fecha, hora, min, detalle, lugar }) {
    const [a, b] = icsDates(fecha, hora, min), x = t => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const now = new Date(), st = `${now.getUTCFullYear()}${p2(now.getUTCMonth() + 1)}${p2(now.getUTCDate())}T${p2(now.getUTCHours())}${p2(now.getUTCMinutes())}00Z`;
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Queen Nails Studio//Reservas//ES', 'BEGIN:VEVENT',
      'UID:' + a + '-' + Math.random().toString(36).slice(2) + '@queennails', 'DTSTAMP:' + st, 'DTSTART:' + a, 'DTEND:' + b,
      'SUMMARY:' + x(titulo), 'DESCRIPTION:' + x(detalle), 'LOCATION:' + x(lugar),
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:' + x(titulo), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const l = document.createElement('a');
    l.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar;charset=utf-8' }));
    l.download = 'cita-queen-nails.ics'; document.body.appendChild(l); l.click();
    setTimeout(() => { URL.revokeObjectURL(l.href); l.remove(); }, 1000);
  }

  window.QN = { configured, client, rpc, q, friendly, esc, money, fechaLarga, fechaCorta, fmt, h12, addDays, hoy, toMin, fromMin, dur, telLocal, wa, googleCal, descargarIcs };
})();
