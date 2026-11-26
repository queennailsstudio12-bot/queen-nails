// Página pública de reservas de Queen Nails Studio (estilo perfil de negocio + ventana de reserva).
(() => {
  const { esc, money, h12, fechaLarga, fmt, dur, wa, rpc } = QN;
  const $ = s => document.querySelector(s);
  const TOKEN = new URLSearchParams(location.search).get('t');
  const MAX_SVCS = 4, MAX_PEOPLE = 6;
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const DCORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const S = {
    cfg: null, svcs: [], pros: [], rel: [],
    sel: [], pro: '', date: '', time: '', days: [], slots: null, month: '',
    loadingDays: false, loadingSlots: false, group: false, people: [], adding: false,
    step: 1, name: '', phone: '', nota: '', msg: '', busy: false, done: false, q: '', cat: '', t0: Date.now()
  };
  let reqDays = 0, reqSlots = 0;
  const app = () => $('#booking-app');

  // ---------- Datos derivados ----------
  const svc = id => S.svcs.find(s => s.id === id);
  const bookable = () => S.svcs.filter(s => !s.requiere_valoracion);
  const ids = () => S.group ? S.people.map(p => p.svc).filter(Boolean) : S.sel;
  const totalDur = () => ids().reduce((a, id) => a + (svc(id)?.dur_min || 0), 0);
  const allPriced = () => ids().length > 0 && ids().every(id => svc(id)?.precio > 0);
  const totalPrice = () => ids().reduce((a, id) => a + Number(svc(id)?.precio || 0), 0);
  const prosFor = () => S.pros.filter(p => ids().every(sid => {
    const r = S.rel.filter(x => x.servicio_id === sid);
    return !r.length || r.some(x => x.profesional_id === p.id);
  }));
  const negocio = () => S.cfg?.negocio || {};
  const waNum = () => negocio().whatsapp || '';
  const step1Ok = () => ids().length > 0 && !(S.group && S.people.some(p => !p.svc)) && !!S.date && !!S.time;

  // ---------- Mis citas guardadas en este celular ----------
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('qn-citas') || '[]'); } catch { return []; } },
    set(v) { try { localStorage.setItem('qn-citas', JSON.stringify(v.slice(-10))); } catch { /* sin almacenamiento */ } },
    add(items) { this.set([...this.get(), ...items]); }
  };
  function renderMisCitas() {
    const today = S.cfg?.hoy || QN.hoy();
    const list = store.get().filter(c => c.fecha >= today);
    store.set(list);
    const box = $('#mis-citas'), link = $('#mis-citas-link');
    if (!list.length) { box.hidden = true; link.hidden = true; return; }
    link.hidden = false;
    link.href = '?t=' + encodeURIComponent(list[0].t);
    box.hidden = false;
    box.className = 'mine';
    box.innerHTML = `<b>Tus próximas citas</b>` + list.map(c =>
      `<a href="?t=${encodeURIComponent(c.t)}"><span>${esc(c.servicios)}</span><small>${esc(fechaLarga(c.fecha))} · ${h12(c.hora)}</small><i aria-hidden="true">›</i></a>`).join('');
  }

  // ---------- Carga inicial ----------
  async function init() {
    $('#year').textContent = new Date().getFullYear();
    if (TOKEN) document.body.classList.add('manage');
    bindSheet();
    if (!QN.configured) {
      $('#svc-list').innerHTML = '<div class="notice">La agenda en línea se está configurando. Muy pronto podrás reservar aquí.</div>';
      return;
    }
    try {
      S.cfg = await rpc('publico_config');
      S.svcs = S.cfg.servicios || [];
      S.pros = S.cfg.profesionales || [];
      S.rel = S.cfg.rel || [];
    } catch (e) {
      $('#svc-list').innerHTML = `<p class="msg">No pudimos cargar la agenda. ${esc(e.message)}</p>`;
      if (TOKEN) { $('#mi-cita').hidden = false; $('#mi-cita').innerHTML = `<div class="manage-card"><p class="msg">${esc(e.message)}</p></div>`; }
      return;
    }
    paintBusiness();
    if (TOKEN) return Manage.load();
    renderMisCitas();
    renderCatalog();
    if (/^#reserv/.test(location.hash)) openBooking();
  }

  // ---------- Perfil del negocio ----------
  function openStatus() {
    const now = S.cfg.ahora || '', f = now.slice(0, 10), t = now.slice(11, 16);
    if (!f) return null;
    const dow = new Date(f + 'T12:00:00Z').getUTCDay(), H = d => S.cfg.horarios.find(h => h.dia === d);
    const hoy = H(dow);
    if (hoy?.activo && t >= hoy.abre && t < hoy.cierra) return { open: true, text: `Abierto ahora · cierra ${h12(hoy.cierra)}` };
    for (let k = 0; k < 8; k++) {
      const d = (dow + k) % 7, h = H(d);
      if (h?.activo && (k > 0 || t < h.abre)) return { open: false, text: `Cerrado · abre ${k === 0 ? 'hoy' : k === 1 ? 'mañana' : DIAS[d].toLowerCase()} ${h12(h.abre)}` };
    }
    return { open: false, text: 'Cerrado' };
  }

  function paintBusiness() {
    const n = negocio();
    if (n.nombre) $('#biz-name').textContent = n.nombre;
    if (n.direccion) {
      $('#biz-dir').textContent = n.direccion;
      $('#map').src = 'https://www.google.com/maps?q=' + encodeURIComponent(n.direccion) + '&output=embed';
    }
    if (n.aviso) { const a = $('#aviso'); a.hidden = false; a.textContent = n.aviso; }
    const st = openStatus();
    if (st) { const el = $('#open-status'); el.textContent = st.text; el.classList.toggle('open', st.open); }
    if (waNum()) {
      const link = wa(waNum(), 'Hola, quiero información sobre Queen Nails Studio ✨');
      $('#wa-btn').href = link; $('#wa-btn').hidden = false; $('#foot-wa').href = link;
    } else { $('#foot-wa').closest('.row').remove(); }
    // Horario por día
    const order = [1, 2, 3, 4, 5, 6, 0].map(d => S.cfg.horarios.find(h => h.dia === d)).filter(Boolean);
    const today = new Date((S.cfg.hoy || QN.hoy()) + 'T12:00:00Z').getUTCDay();
    $('#hours').innerHTML = order.map(h => `<li class="${h.dia === today ? 'today' : ''}"><span>${DIAS[h.dia]}</span><span>${h.activo ? h12(h.abre) + ' – ' + h12(h.cierra) : 'Cerrado'}</span></li>`).join('');
    // Profesionales
    if (S.pros.length) {
      $('#pros-box').hidden = false;
      $('#pros').innerHTML = S.pros.map(p => `<div class="pro"><span class="pro-av" aria-hidden="true">${esc(p.nombre[0])}</span><small>${esc(p.nombre)}</small></div>`).join('');
    }
  }

  // ---------- Catálogo de servicios ----------
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function renderCatalog() {
    const cats = [...new Set(S.svcs.map(s => s.categoria).filter(Boolean))];
    const catsEl = $('#cats');
    if (cats.length > 1) {
      catsEl.hidden = false;
      catsEl.innerHTML = [['', 'Todos'], ...cats.map(c => [c, c])].map(([v, l]) => `<button type="button" class="cat${S.cat === v ? ' on' : ''}" data-cat="${esc(v)}">${esc(l)}</button>`).join('');
    }
    const q = norm(S.q);
    const list = S.svcs.filter(s => (!S.cat || s.categoria === S.cat) && (!q || norm(s.nombre + ' ' + (s.descripcion || '')).includes(q)));
    $('#svc-list').innerHTML = list.map(s => `<article class="svc-card">
        <div class="svc-info"><h3>${esc(s.nombre)}</h3>${s.descripcion ? `<p>${esc(s.descripcion)}</p>` : ''}
          <div class="svc-meta"><span class="chip-dur">🕑 ${dur(s.dur_min)}</span>${s.precio > 0 ? `<b class="svc-price">${money(s.precio)}</b>` : ''}</div></div>
        ${s.requiere_valoracion
          ? (waNum() ? `<a class="button soft" target="_blank" rel="noopener" href="${wa(waNum(), 'Hola, quiero una valoración para ' + s.nombre)}">Valoración</a>` : '')
          : `<button type="button" class="button soft" data-book="${s.id}">Agendar</button>`}
      </article>`).join('') || `<p class="muted empty">No encontramos servicios con "${esc(S.q)}".</p>`;
  }
  $('#q').addEventListener('input', e => { S.q = e.target.value; renderCatalog(); });
  $('#cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { S.cat = b.dataset.cat; renderCatalog(); } });
  $('#svc-list').addEventListener('click', e => { const b = e.target.closest('[data-book]'); if (b) openBooking(b.dataset.book); });
  document.addEventListener('click', e => { if (e.target.closest('[data-open]')) openBooking(); });

  // ---------- Ventana de reserva ----------
  function bindSheet() {
    const sh = $('#sheet');
    sh.addEventListener('click', e => { if (e.target === sh || e.target.closest('[data-close]')) closeBooking(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sh.hidden) closeBooking(); });
    sh.addEventListener('click', onClick);
    sh.addEventListener('change', onChange);
    sh.addEventListener('input', onInput);
  }

  function openBooking(svcId) {
    if (!S.cfg) return;
    if (S.done) resetBooking();
    let changed = false;
    if (svcId) {
      if (S.group) { S.group = false; changed = true; }
      if (!S.sel.includes(svcId)) { S.sel = S.sel.length < MAX_SVCS ? [...S.sel, svcId] : [svcId]; changed = true; }
    }
    S.step = 1; S.adding = !ids().length;
    $('#sheet').hidden = false;
    document.body.classList.add('noscroll');
    renderBooking();
    if (changed || (ids().length && !S.days.length)) refreshDays();
  }
  function closeBooking() {
    $('#sheet').hidden = true;
    document.body.classList.remove('noscroll');
    if (S.done) resetBooking();
    if (/^#reserv/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }
  function resetBooking() {
    Object.assign(S, { sel: [], pro: '', date: '', time: '', days: [], slots: null, month: '', group: false, people: [], adding: false, step: 1, nota: '', msg: '', done: false, t0: Date.now() });
  }

  function renderBooking() {
    $('#sheet-title').textContent = S.step === 1 ? 'Reserva tu cita' : 'Tus datos';
    if (S.step === 1) {
      app().innerHTML = `<div class="sheet-scroll">
          <section class="bk-sec" id="bk-svcs"></section>
          <section class="bk-sec" id="bk-pro" hidden></section>
          <section class="bk-sec" id="bk-cal"></section>
          <section class="bk-sec" id="bk-hours"></section>
          <p class="msg" id="msg" role="alert"></p>
        </div>
        <footer class="sheet-foot"><div class="ab-sum" id="ab-sum"></div><button type="button" class="button primary" id="next">Continuar</button></footer>`;
      renderSvcs(); renderPro(); renderCal(); renderHours(); renderFoot();
    } else {
      const fin = QN.fromMin(QN.toMin(S.time) + totalDur());
      const what = S.group
        ? S.people.map((p, i) => `<li><span>${esc(p.nombre.trim() || 'Persona ' + (i + 1))} · ${esc(svc(p.svc)?.nombre || '')}</span><b>${svc(p.svc)?.precio > 0 ? money(svc(p.svc).precio) : ''}</b></li>`).join('')
        : S.sel.map(id => `<li><span>${esc(svc(id)?.nombre)}</span><b>${svc(id)?.precio > 0 ? money(svc(id).precio) : ''}</b></li>`).join('');
      app().innerHTML = `<div class="sheet-scroll">
          <button type="button" class="link-back" data-back>‹ Cambiar servicio, fecha u hora</button>
          <div class="summary">
            <p class="sum-when"><span aria-hidden="true">📅</span><b>${esc(fechaLarga(S.date))}</b><small>${h12(S.time)} – ${h12(fin)} · ${dur(totalDur())}${S.pro ? ' · con ' + esc(S.pros.find(p => p.id === S.pro)?.nombre) : ''}</small></p>
            <ul class="sum-list">${what}</ul>
            ${allPriced() ? `<p class="sum-total"><span>Total aproximado</span><b>${money(totalPrice())}</b></p>` : ''}
          </div>
          <div class="form-row">
            <div><label for="f-name">Nombre y apellido</label><input id="f-name" data-f="name" autocomplete="name" maxlength="80" placeholder="Ej.: Laura Gómez" value="${esc(S.name)}"></div>
            <div><label for="f-phone">Celular (WhatsApp)</label><input id="f-phone" data-f="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="300 000 0000" value="${esc(S.phone)}"></div>
          </div>
          <label for="f-nota">¿Algo que debamos saber? <span class="opt">(opcional)</span></label>
          <textarea id="f-nota" data-f="nota" maxlength="300" rows="2" placeholder="Ej.: traigo diseño de referencia, retiro de acrílico…">${esc(S.nota)}</textarea>
          <input class="hp" id="f-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <p class="form-hint">🔒 Usaremos tu número únicamente para contactarte sobre tu cita.</p>
          <p class="msg" id="msg" role="alert"></p>
        </div>
        <footer class="sheet-foot"><div class="ab-sum"><b>${allPriced() ? money(totalPrice()) : dur(totalDur())}</b><small>${esc(QN.fechaCorta(S.date))} · ${h12(S.time)}</small></div><button type="button" class="button primary" id="next">Confirmar reserva</button></footer>`;
      setTimeout(() => $('#f-name')?.focus({ preventScroll: true }), 250);
    }
    if (S.msg) setMsg(S.msg);
  }

  function renderSvcs() {
    const el = $('#bk-svcs'); if (!el) return;
    const val = S.svcs.filter(s => s.requiere_valoracion);
    if (S.group) {
      const opts = sel => `<option value="">Elige un servicio</option>` + bookable().map(s => `<option value="${s.id}"${s.id === sel ? ' selected' : ''}>${esc(s.nombre)}${s.precio > 0 ? ' · ' + money(s.precio) : ''}</option>`).join('');
      el.innerHTML = `<h3 class="bk-title">¿Quiénes vienen?</h3><p class="hint">Las atendemos una después de la otra, desde la hora que elijas.</p>
        ${S.people.map((p, i) => `<div class="person">
          <div class="person-head"><b>Persona ${i + 1}</b>${S.people.length > 2 ? `<button type="button" class="x" data-rm-person="${i}" aria-label="Quitar persona ${i + 1}">✕</button>` : ''}</div>
          <input data-pn="${i}" maxlength="40" placeholder="Nombre (opcional, ej. Mamá)" value="${esc(p.nombre)}" aria-label="Nombre de la persona ${i + 1}">
          <select data-ps="${i}" aria-label="Servicio de la persona ${i + 1}">${opts(p.svc)}</select></div>`).join('')}
        <div class="row-links">${S.people.length < MAX_PEOPLE ? '<button type="button" class="link-add" data-add-person>＋ Agregar persona</button>' : ''}<button type="button" class="link-muted" data-group="off">Reservar solo para mí</button></div>`;
      return;
    }
    const chosen = S.sel.map(id => svc(id)).filter(Boolean);
    const rows = chosen.map(s => `<div class="chosen"><div><b>${esc(s.nombre)}</b><small>${dur(s.dur_min)}${s.precio > 0 ? ' · ' + money(s.precio) : ''}</small></div><button type="button" class="x" data-rm-svc="${s.id}" aria-label="Quitar ${esc(s.nombre)}">✕</button></div>`).join('');
    const avail = bookable().filter(s => !S.sel.includes(s.id));
    const picker = (S.adding || !chosen.length) && avail.length ? `<div class="pick-list">${avail.map(s => `<button type="button" class="pick" data-svc="${s.id}"><span><b>${esc(s.nombre)}</b><small>${dur(s.dur_min)}${s.precio > 0 ? ' · ' + money(s.precio) : ''}</small></span><i aria-hidden="true">＋</i></button>`).join('')}</div>` : '';
    el.innerHTML = `<h3 class="bk-title">${chosen.length ? 'Servicios' : 'Elige un servicio'}</h3>
      ${rows}${picker}
      <div class="row-links">
        ${chosen.length && !S.adding && S.sel.length < MAX_SVCS && avail.length ? '<button type="button" class="link-add" data-adding>＋ Agregar otro servicio</button>' : ''}
        ${S.adding && chosen.length ? '<button type="button" class="link-muted" data-adding-off>Listo</button>' : ''}
        <button type="button" class="link-muted" data-group="on">👭 Vienen varias personas</button>
      </div>
      ${val.length && waNum() ? `<p class="info">✨ <b>${esc(val.map(s => s.nombre).join(', '))}</b> requiere valoración previa. <a target="_blank" rel="noopener" href="${wa(waNum(), 'Hola, quiero una valoración para ' + val.map(s => s.nombre).join(', '))}">Escríbenos</a>.</p>` : ''}`;
  }

  function renderPro() {
    const el = $('#bk-pro'); if (!el) return;
    if (S.pros.length <= 1 || !ids().length) { el.hidden = true; return; }
    el.hidden = false;
    const list = prosFor();
    if (S.pro && !list.some(p => p.id === S.pro)) S.pro = '';
    el.innerHTML = `<h3 class="bk-title">¿Quién te atiende?</h3><div class="pro-chips">
      <button type="button" class="pchip${!S.pro ? ' on' : ''}" data-pro=""><span class="pro-av">✦</span>Primero disponible</button>
      ${list.map(p => `<button type="button" class="pchip${S.pro === p.id ? ' on' : ''}" data-pro="${p.id}"><span class="pro-av">${esc(p.nombre[0])}</span>${esc(p.nombre)}</button>`).join('')}</div>`;
  }

  // Calendario mensual con los días disponibles
  function renderCal() {
    const el = $('#bk-cal'); if (!el) return;
    if (!ids().length || (S.group && S.people.some(p => !p.svc))) { el.innerHTML = ''; return; }
    if (S.loadingDays && !S.days.length) { el.innerHTML = '<h3 class="bk-title">Fecha</h3><div class="skeleton cal-skel"><i></i></div>'; return; }
    if (!S.days.length) { el.innerHTML = ''; return; }
    if (!S.days.some(d => d.libres > 0)) {
      el.innerHTML = `<h3 class="bk-title">Fecha</h3><p class="muted">No hay horarios libres para esta duración en los próximos días.${waNum() ? ` <a class="link-inline" target="_blank" rel="noopener" href="${wa(waNum(), 'Hola, quiero agendar una cita y no encuentro horario')}">Escríbenos por WhatsApp</a>.` : ''}</p>`;
      return;
    }
    const months = [...new Set(S.days.map(d => d.fecha.slice(0, 7)))];
    if (!months.includes(S.month)) S.month = (S.date || S.days.find(d => d.libres)?.fecha || S.days[0].fecha).slice(0, 7);
    const mi = months.indexOf(S.month);
    const [y, m] = S.month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7, nd = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const map = Object.fromEntries(S.days.map(d => [d.fecha, d.libres]));
    const hoy = S.cfg.hoy;
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= nd; d++) {
      const f = `${S.month}-${String(d).padStart(2, '0')}`, ok = map[f] > 0;
      cells += ok
        ? `<button type="button" class="cd${f === S.date ? ' on' : ''}${f === hoy ? ' today' : ''}" data-day="${f}" aria-label="${esc(fechaLarga(f))}">${d}</button>`
        : `<span class="cd off${f === hoy ? ' today' : ''}" aria-hidden="true">${d}</span>`;
    }
    const title = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    el.innerHTML = `<div class="cal-head"><h3 class="bk-title">${esc(title[0].toUpperCase() + title.slice(1))}</h3>
        <div class="cal-nav"><button type="button" class="icon-btn" data-month="-1"${mi > 0 ? '' : ' disabled'} aria-label="Mes anterior">‹</button><button type="button" class="icon-btn" data-month="1"${mi < months.length - 1 ? '' : ' disabled'} aria-label="Mes siguiente">›</button></div></div>
      <div class="cal"><div class="cal-wd">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(x => `<span>${x}</span>`).join('')}</div><div class="cal-grid">${cells}</div></div>`;
  }

  function renderHours() {
    const el = $('#bk-hours'); if (!el) return;
    if (!S.date || !ids().length) { el.innerHTML = ''; return; }
    const d = new Date(S.date + 'T12:00:00Z');
    const title = `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}`;
    if (S.loadingSlots) { el.innerHTML = `<h3 class="bk-title">${title}</h3><div class="skeleton slot-skel"><i></i><i></i><i></i><i></i></div>`; return; }
    const free = (S.slots || []).filter(s => s.libre);
    if (!free.length) { el.innerHTML = `<h3 class="bk-title">${title}</h3><p class="muted">No quedan horas este día. Elige otra fecha.</p>`; return; }
    const parts = [['Mañana', 0, 12], ['Tarde', 12, 18], ['Noche', 18, 24]].map(([label, a, b]) => {
      const list = free.filter(s => { const h = +s.hora.slice(0, 2); return h >= a && h < b; });
      return list.length ? `<p class="slot-label">${label}</p><div class="slots">${list.map(s => `<button type="button" class="slot${S.time === s.hora ? ' on' : ''}" data-time="${s.hora}">${h12(s.hora)}</button>`).join('')}</div>` : '';
    }).join('');
    el.innerHTML = `<h3 class="bk-title">${title} <small class="muted">· horas disponibles</small></h3>${free.length <= 4 ? '<p class="hurry">⚡ Quedan pocas horas este día</p>' : ''}${parts}`;
  }

  function renderFoot() {
    const sum = $('#ab-sum'), next = $('#next'); if (!sum || S.step !== 1) return;
    const n = ids().length;
    sum.innerHTML = n
      ? `<b>${allPriced() ? money(totalPrice()) : dur(totalDur())}</b><small>${S.group ? S.people.length + ' personas' : n + ' servicio' + (n > 1 ? 's' : '')}${allPriced() ? ' · ' + dur(totalDur()) : ''}${S.time ? ' · ' + esc(QN.fechaCorta(S.date)) + ' ' + h12(S.time) : ''}</small>`
      : '<small>Elige un servicio para ver horarios</small>';
    next.disabled = !step1Ok();
    next.textContent = !n ? 'Continuar' : !S.time ? 'Elige una hora' : 'Continuar';
  }

  const setMsg = m => { S.msg = m; const el = $('#msg'); if (el) el.textContent = m; };

  // ---------- Disponibilidad ----------
  async function refreshDays() {
    S.time = '';
    if (!ids().length || (S.group && S.people.some(p => !p.svc))) {
      S.days = []; S.slots = null; S.date = ''; renderCal(); renderHours(); renderFoot(); return;
    }
    const my = ++reqDays;
    S.loadingDays = true; S.days = []; renderCal(); renderHours(); renderFoot();
    try {
      const days = await rpc('dias_disponibles', { p_dur: totalDur(), p_prof: S.pro || null, p_servicios: ids() });
      if (my !== reqDays) return;
      S.days = days || [];
      if (!S.days.some(d => d.fecha === S.date && d.libres > 0)) S.date = S.days.find(d => d.libres > 0)?.fecha || '';
      S.month = (S.date || '').slice(0, 7);
    } catch (e) { if (my === reqDays) { S.days = []; setMsg(e.message); } }
    if (my !== reqDays) return;
    S.loadingDays = false;
    renderCal();
    await refreshSlots();
  }

  async function refreshSlots() {
    S.time = ''; renderFoot();
    if (!S.date) { S.slots = null; renderHours(); return; }
    const my = ++reqSlots;
    S.loadingSlots = true; renderHours();
    try {
      const slots = await rpc('disponibilidad', { p_fecha: S.date, p_dur: totalDur(), p_prof: S.pro || null, p_servicios: ids() });
      if (my !== reqSlots) return;
      S.slots = slots || [];
    } catch (e) { if (my === reqSlots) { S.slots = []; setMsg(e.message); } }
    if (my !== reqSlots) return;
    S.loadingSlots = false; renderHours(); renderFoot();
  }

  // ---------- Eventos de la ventana ----------
  function changedServices() { setMsg(''); renderSvcs(); renderPro(); refreshDays(); }

  function onClick(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.svc) {
      if (S.sel.length >= MAX_SVCS) return setMsg(`Puedes elegir hasta ${MAX_SVCS} servicios por cita.`);
      S.sel.push(d.svc); S.adding = false; changedServices();
    } else if (d.rmSvc) { S.sel = S.sel.filter(x => x !== d.rmSvc); S.adding = !S.sel.length; changedServices(); }
    else if (d.adding !== undefined) { S.adding = true; renderSvcs(); }
    else if (d.addingOff !== undefined) { S.adding = false; renderSvcs(); }
    else if (d.group === 'on') { const f = S.sel[0] || ''; S.group = true; S.people = [{ nombre: '', svc: f }, { nombre: '', svc: f }]; changedServices(); }
    else if (d.group === 'off') { S.group = false; S.sel = S.people.map(p => p.svc).filter(Boolean).slice(0, 1); S.adding = !S.sel.length; changedServices(); }
    else if (d.addPerson !== undefined) { S.people.push({ nombre: '', svc: S.people.at(-1)?.svc || '' }); changedServices(); }
    else if (d.rmPerson !== undefined) { S.people.splice(+d.rmPerson, 1); changedServices(); }
    else if (d.pro !== undefined) { S.pro = d.pro; renderPro(); refreshDays(); }
    else if (d.month) {
      const months = [...new Set(S.days.map(x => x.fecha.slice(0, 7)))];
      S.month = months[months.indexOf(S.month) + +d.month] || S.month; renderCal();
    } else if (d.day) { S.date = d.day; setMsg(''); renderCal(); refreshSlots(); }
    else if (d.time) {
      S.time = d.time; setMsg(''); renderHours(); renderFoot();
      if (matchMedia('(max-width: 720px)').matches) $('.sheet-foot')?.scrollIntoView({ block: 'nearest' });
    } else if (b.id === 'next') {
      if (S.step === 1) { if (step1Ok()) { S.step = 2; S.msg = ''; renderBooking(); } }
      else book();
    } else if (d.back !== undefined) { S.step = 1; S.msg = ''; renderBooking(); }
    else if (b.id === 'again') { resetBooking(); S.adding = true; renderBooking(); }
  }
  function onChange(e) {
    const d = e.target.dataset;
    if (d.ps !== undefined) { S.people[+d.ps].svc = e.target.value; changedServices(); }
  }
  function onInput(e) {
    const d = e.target.dataset;
    if (d.pn !== undefined) S.people[+d.pn].nombre = e.target.value;
    if (d.f) S[d.f] = e.target.value;
  }

  // ---------- Reservar ----------
  async function book() {
    if (S.busy) return;
    const name = S.name.trim(), phone = S.phone.trim(), nota = S.nota.trim();
    if ($('#f-hp')?.value || Date.now() - S.t0 < 3000) return; // anti-spam
    if (!step1Ok()) { S.step = 1; return renderBooking(); }
    if (name.length < 2) { $('#f-name').focus(); return setMsg('Escribe tu nombre.'); }
    if (phone.replace(/\D/g, '').length < 10) { $('#f-phone').focus(); return setMsg('Escribe tu número de celular (10 dígitos).'); }
    const btn = $('#next');
    S.busy = true; btn.disabled = true; btn.textContent = 'Reservando…'; setMsg('');
    try {
      let done;
      if (S.group) {
        const items = S.people.map(p => ({ nombre: p.nombre.trim(), servicios: [p.svc] }));
        const res = await rpc('reservar_grupo', { p_fecha: S.date, p_hora: S.time, p_items: items, p_cliente: name, p_telefono: phone, p_prof: S.pro || null, p_nota: nota || null });
        done = { group: res, token: res[0].token, fecha: S.date, hora: S.time, min: totalDur(), servicios: 'Reserva en grupo (' + res.length + ' personas)', name };
        store.add(res.map(r => ({ t: r.token, fecha: S.date, hora: r.hora, servicios: r.nombre + ': ' + r.servicios })));
      } else {
        const token = await rpc('reservar_cita', { p_servicios: S.sel, p_fecha: S.date, p_hora: S.time, p_cliente: name, p_telefono: phone, p_prof: S.pro || null, p_nota: nota || null });
        done = { token, fecha: S.date, hora: S.time, min: totalDur(), servicios: S.sel.map(id => svc(id)?.nombre).join(' + '), name };
        store.add([{ t: token, fecha: S.date, hora: S.time, servicios: done.servicios }]);
      }
      try { done.estado = (await rpc('mi_cita', { p_token: done.token }))?.estado; } catch { done.estado = 'pendiente'; }
      S.done = true;
      renderDone(done);
    } catch (e) {
      if (/ocup|disponible/i.test(e.message)) { S.step = 1; S.msg = e.message; renderBooking(); refreshSlots(); }
      else { setMsg(e.message); btn.disabled = false; btn.textContent = 'Confirmar reserva'; }
    } finally { S.busy = false; }
  }

  function manageUrl(token) { return location.href.split(/[?#]/)[0] + '?t=' + encodeURIComponent(token); }

  function calButtons(o) {
    return `<a class="alt" target="_blank" rel="noopener" href="${QN.googleCal(o)}">📅 Agregar a Google Calendar</a>
      <button type="button" class="alt" data-ics='${esc(JSON.stringify(o))}'>📅 Guardar en otro calendario (.ics)</button>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ics]');
    if (b) QN.descargarIcs(JSON.parse(b.dataset.ics));
  });

  function renderDone(d) {
    const n = negocio(), pend = d.estado !== 'confirmada';
    const detalle = d.group ? d.group.map(g => `${g.nombre}: ${g.servicios} a las ${h12(g.hora)}`).join('\n') : d.servicios;
    const msgWa = `Hola, soy ${d.name}. Reservé ${d.group ? 'para ' + d.group.length + ' personas' : d.servicios} el ${fechaLarga(d.fecha)} a las ${h12(d.hora)}. ${pend ? '¿Me confirman, por favor?' : '¡Nos vemos!'}\nMi cita: ${manageUrl(d.token)}`;
    const cal = { titulo: 'Cita en Queen Nails Studio', fecha: d.fecha, hora: d.hora, min: d.min, detalle: detalle + '\nGestiona tu cita: ' + manageUrl(d.token), lugar: n.direccion || '' };
    $('#sheet-title').textContent = pend ? 'Reserva recibida' : 'Cita confirmada';
    app().innerHTML = `<div class="sheet-scroll"><div class="done">
      <div class="check" aria-hidden="true">✓</div>
      <h3>${pend ? '¡Reserva recibida!' : '¡Cita confirmada!'}</h3>
      <p class="done-what">${d.group ? d.group.map(g => `<span>${esc(g.nombre)} · ${esc(g.servicios)} · <b>${h12(g.hora)}</b></span>`).join('') : `<b>${esc(d.servicios)}</b>`}</p>
      <p class="done-when">${esc(fechaLarga(d.fecha))} · ${h12(d.hora)}</p>
      <p class="muted">${pend ? 'Tu cita queda pendiente hasta que Sofía la confirme. Para hacerlo más rápido, escríbenos por WhatsApp.' : 'Te esperamos. Si necesitas cambiar algo, usa tu enlace personal.'}</p>
      ${waNum() ? `<a class="button primary wide" target="_blank" rel="noopener" href="${wa(waNum(), msgWa)}">${pend ? 'Confirmar por WhatsApp' : 'Escribir por WhatsApp'}</a>` : ''}
      <a class="alt" href="${esc(manageUrl(d.token))}">Ver, cambiar o cancelar mi cita</a>
      ${calButtons(cal)}
      <button type="button" class="alt ghost" id="again">Hacer otra reserva</button>
    </div></div>`;
    renderMisCitas();
  }

  // ---------- Mi cita (enlace personal) ----------
  const Manage = {
    M: null, mode: '', date: '', time: '', days: [], slots: null, msg: '', busy: false,
    el: () => $('#mi-cita'),
    async load() {
      this.el().hidden = false;
      this.el().innerHTML = '<div class="manage-card"><p class="muted">Cargando tu cita…</p></div>';
      try { this.M = await rpc('mi_cita', { p_token: TOKEN }); } catch (e) { this.M = null; this.msg = e.message; }
      this.render();
      this.el().addEventListener('click', e => this.click(e));
    },
    render() {
      const M = this.M, n = negocio();
      const head = `<a class="back-link" href="./">← Ir al inicio</a>`;
      if (!M) {
        this.el().innerHTML = `<div class="manage-card">${head}<h3>No encontramos esta cita</h3><p class="muted">Revisa el enlace o escríbenos.</p>${waNum() ? `<a class="button primary wide" target="_blank" rel="noopener" href="${wa(waNum(), 'Hola, no encuentro mi cita')}">Escribir por WhatsApp</a>` : ''}</div>`;
        return;
      }
      const lbl = { pendiente: 'Pendiente de confirmar', confirmada: 'Confirmada', cancelada: 'Cancelada', atendida: 'Atendida', no_asistio: 'No asistió' }[M.estado] || M.estado;
      const fin = QN.fromMin(QN.toMin(M.hora) + M.dur_min);
      let body = '';
      if (M.estado === 'cancelada' || M.estado === 'atendida' || M.estado === 'no_asistio') {
        body = `<a class="button primary wide" href="./#reservar">Reservar una nueva cita</a>`;
      } else if (this.mode === 'cx') {
        body = `<p class="warn">¿Seguro que quieres cancelar esta cita?</p>
          <button type="button" class="button danger wide" data-a="yes">Sí, cancelar mi cita</button>
          <button type="button" class="alt" data-a="back">No, volver</button>`;
      } else if (this.mode === 're') {
        body = this.reHtml();
      } else {
        const cal = { titulo: 'Cita en Queen Nails Studio', fecha: M.fecha, hora: M.hora, min: M.dur_min, detalle: M.servicios + '\nGestiona tu cita: ' + location.href, lugar: n.direccion || '' };
        body = (M.estado === 'pendiente' ? `<button type="button" class="button primary wide" data-a="ok">Confirmar mi asistencia</button>` : '') +
          (M.puede_modificar
            ? `<button type="button" class="alt" data-a="re">Cambiar fecha u hora</button><button type="button" class="alt" data-a="cx">Cancelar cita</button>`
            : `<p class="muted small">Faltan menos de ${M.horas_cancelar} horas: para cambios escríbenos por WhatsApp.</p>`) +
          calButtons(cal) +
          (waNum() ? `<a class="alt" target="_blank" rel="noopener" href="${wa(waNum(), `Hola, soy ${M.cliente}. Tengo cita el ${fechaLarga(M.fecha)} a las ${h12(M.hora)}.`)}">💬 Escribir por WhatsApp</a>` : '');
      }
      this.el().innerHTML = `<div class="manage-card">${head}
        <span class="badge ${M.estado}">${esc(lbl)}</span>
        <h3>${esc(M.servicios || 'Tu cita')}</h3>
        <p class="done-when">${esc(fechaLarga(M.fecha))}<br>${h12(M.hora)} – ${h12(fin)}</p>
        <p class="muted">${esc(M.cliente)}${S.pros.length > 1 && M.profesional ? ' · con ' + esc(M.profesional) : ''}${M.precio > 0 ? ' · ' + money(M.precio) + ' aprox.' : ''}</p>
        ${n.direccion ? `<p class="muted small">📍 ${esc(n.direccion)}</p>` : ''}
        ${this.msg ? `<p class="msg${this.ok ? ' ok' : ''}">${esc(this.msg)}</p>` : ''}
        <div class="manage-actions">${body}</div></div>`;
    },
    reHtml() {
      const chips = this.days.map(d => `<button type="button" class="day${d.fecha === this.date ? ' on' : ''}" data-mday="${d.fecha}"${d.libres || d.fecha === this.M.fecha ? '' : ' disabled'}>
          <small>${fmt(d.fecha, { weekday: 'short' }).replace('.', '')}</small><b>${+d.fecha.slice(8)}</b><small class="m">${fmt(d.fecha, { month: 'short' }).replace('.', '')}</small></button>`).join('');
      let slots = '<p class="muted">Cargando…</p>';
      if (this.slots) slots = this.slots.filter(s => s.libre).length
        ? `<div class="slots">${this.slots.filter(s => s.libre).map(s => `<button type="button" class="slot${this.time === s.hora ? ' on' : ''}" data-mtime="${s.hora}">${h12(s.hora)}</button>`).join('')}</div>`
        : '<p class="muted">No hay horarios libres este día.</p>';
      return `<p class="hint">Elige el nuevo día y la nueva hora:</p><div class="days">${chips}</div>
        ${this.date ? `<p class="day-title">${esc(fechaLarga(this.date))}</p>${slots}` : ''}
        <button type="button" class="button primary wide" data-a="save"${this.time ? '' : ' disabled'}>Guardar nuevo horario</button>
        <button type="button" class="alt" data-a="back">Volver</button>`;
    },
    async loadDays() {
      try { this.days = await rpc('dias_disponibles', { p_dur: this.M.dur_min, p_prof: this.M.profesional_id, p_servicios: null }); } catch (e) { this.msg = e.message; this.days = []; }
      this.date = this.days.some(d => d.fecha === this.M.fecha) ? this.M.fecha : (this.days.find(d => d.libres)?.fecha || '');
      await this.loadSlots();
    },
    async loadSlots() {
      this.slots = null; this.time = ''; this.render();
      if (!this.date) return;
      try { this.slots = await rpc('disponibilidad', { p_fecha: this.date, p_dur: this.M.dur_min, p_prof: this.M.profesional_id, p_servicios: null, p_ignorar: TOKEN }); }
      catch (e) { this.slots = []; this.msg = e.message; }
      this.render();
    },
    async click(e) {
      const b = e.target.closest('button');
      if (!b || b.disabled || this.busy) return;
      const d = b.dataset;
      if (d.mday) { this.date = d.mday; return this.loadSlots(); }
      if (d.mtime) { this.time = d.mtime; return this.render(); }
      if (!d.a) return;
      this.msg = ''; this.ok = false;
      if (d.a === 'back') { this.mode = ''; return this.render(); }
      if (d.a === 'cx') { this.mode = 'cx'; return this.render(); }
      if (d.a === 're') { this.mode = 're'; this.render(); return this.loadDays(); }
      this.busy = true; b.disabled = true;
      try {
        if (d.a === 'ok') await rpc('confirmar_cita', { p_token: TOKEN });
        else if (d.a === 'yes') await rpc('cancelar_cita', { p_token: TOKEN });
        else if (d.a === 'save') {
          await rpc('reagendar_cita', { p_token: TOKEN, p_fecha: this.date, p_hora: this.time });
          const list = store.get().map(c => c.t === TOKEN ? { ...c, fecha: this.date, hora: this.time } : c); store.set(list);
        }
        this.mode = '';
        this.M = await rpc('mi_cita', { p_token: TOKEN });
        this.ok = true;
        this.msg = { ok: '¡Gracias! Tu asistencia quedó confirmada.', yes: 'Tu cita fue cancelada.', save: '¡Listo! Tu cita cambió de horario.' }[d.a];
      } catch (err) {
        this.msg = err.message;
        if (this.mode === 're') await this.loadSlots();
      } finally { this.busy = false; }
      this.render();
    }
  };

  init();
})();
