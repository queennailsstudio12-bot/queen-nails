const $ = selector => document.querySelector(selector);
const serviceSelect = $('#service');
const dateInput = $('#date');
const timeSelect = $('#time');
const form = $('#booking-form');
const status = $('#form-status');
const submit = $('#submit');
let config;

function setStatus(message, success = false) { status.textContent = message; status.classList.toggle('success', success); }
function localDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function option(value, label) { const element = document.createElement('option'); element.value = value; element.textContent = label; return element; }

async function loadSlots() {
  timeSelect.replaceChildren(option('', 'Selecciona un horario'));
  timeSelect.disabled = true;
  setStatus('');
  if (!serviceSelect.value || !dateInput.value || !config.ready) return;
  setStatus('Consultando horarios disponibles…');
  try {
    const response = await fetch(`/api/slots?service=${encodeURIComponent(serviceSelect.value)}&date=${encodeURIComponent(dateInput.value)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No pudimos consultar los horarios');
    for (const slot of data.slots) timeSelect.add(option(slot.time, slot.time));
    timeSelect.disabled = data.slots.length === 0;
    setStatus(data.slots.length ? '' : 'No quedan horarios para este día. Prueba otra fecha.');
  } catch (error) { setStatus(error.message); }
}

async function init() {
  $('#year').textContent = new Date().getFullYear();
  try {
    const response = await fetch('/api/config');
    config = await response.json();
    for (const service of config.services) {
      serviceSelect.add(option(service.id, service.name));
      const card = document.createElement('article');
      card.className = 'service-card';
      const symbol = document.createElement('span'); symbol.className = 'symbol'; symbol.textContent = '✧';
      const title = document.createElement('h3'); title.textContent = service.name;
      const duration = document.createElement('p'); duration.textContent = `${service.minutes} min aprox.`;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Elegir servicio';
      button.addEventListener('click', () => { serviceSelect.value = service.id; $('#reserva').scrollIntoView({ behavior: 'smooth' }); loadSlots(); });
      card.append(symbol, title, duration, button);
      $('#service-grid').append(card);
    }
    dateInput.min = localDate();
    dateInput.max = localDate(config.bookingWindowDays);
    if (!config.ready) {
      $('#setup-message').hidden = false;
      form.querySelectorAll('input,select,button').forEach(element => element.disabled = true);
    }
  } catch { setStatus('No pudimos cargar la agenda. Recarga la página.'); submit.disabled = true; }
}

serviceSelect.addEventListener('change', loadSlots);
dateInput.addEventListener('change', loadSlots);
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  submit.disabled = true;
  setStatus('Confirmando tu cita…');
  try {
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch('/api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo confirmar la cita');
    form.reset();
    timeSelect.replaceChildren(option('', 'Elige fecha'));
    timeSelect.disabled = true;
    setStatus(`¡Cita confirmada! ${result.service}, ${result.date} a las ${result.time}. Te esperamos en Queen Nails Studio.`, true);
  } catch (error) { await loadSlots(); setStatus(error.message); }
  finally { submit.disabled = false; }
});

init();
