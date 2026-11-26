// Núcleo del panel: datos base, navegación, ventanas, avisos y PIN.
window.PN = (() => {
  const sb = QN.client(true);
  const { esc } = QN;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const METODOS = [['efectivo', 'Efectivo'], ['nequi', 'Nequi'], ['daviplata', 'Daviplata'], ['tarjeta', 'Tarjeta'], ['transferencia', 'Transferencia'], ['otro', 'Otro']];
  const metodoLbl = m => (METODOS.find(x => x[0] === m) || [m, m === 'abono' ? 'Abono' : m])[1];
  const ESTADOS = { pendiente: 'Por confirmar', confirmada: 'Confirmada', atendida: 'Atendida', cancelada: 'Cancelada', no_asistio: 'No asistió' };

  // Datos base que usan todas las secciones
  const D = { svcs: [], pros: [], prods: [], rel: [], cfg: {}, horarios: [], hasPin: false };
  const CFG_COLS = 'id,nombre,eslogan,direccion,whatsapp,paso_min,dias_reserva,min_anticipacion_min,horas_cancelar,max_citas_telefono,confirmacion_auto,aviso';

  async function loadBase() {
    const [svcs, pros, prods, rel, cfg, horarios, hasPin] = await Promise.all([
      QN.q(sb.from('servicios').select('*').order('orden').order('nombre')),
      QN.q(sb.from('profesionales').select('*').order('orden').order('nombre')),
      QN.q(sb.from('productos').select('*').order('nombre')),
      QN.q(sb.from('profesional_servicio').select('*')),
      QN.q(sb.from('config_negocio').select(CFG_COLS).eq('id', 1)),
      QN.q(sb.from('horarios').select('*').order('dia')),
      QN.rpc('pin_estado')
    ]);
    Object.assign(D, { svcs, pros, prods, rel, cfg: cfg[0] || {}, horarios, hasPin });
  }
  const svc = id => D.svcs.find(s => s.id === id);
  const pro = id => D.pros.find(p => p.id === id);
  const activePros = () => D.pros.filter(p => p.activo);
  const multiPro = () => activePros().length > 1;
  const bookingUrl = () => new URL('./', location.href).href;
  const manageUrl = token => bookingUrl() + '?t=' + token;

  // ---------- Navegación ----------
  const views = {};
  let current = 'agenda';
  function register(name, mod) { views[name] = mod; }
  async function go(name, arg) {
    const mod = views[name];
    if (!mod) return;
    if (mod.protected && !(await pinGate())) return;
    current = name;
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === (mod.tab || name)));
    $('#top-sub').textContent = mod.title || '';
    const v = $('#view');
    v.innerHTML = '<p class="muted pad">Cargando…</p>';
    v.scrollTop = 0; window.scrollTo(0, 0);
    try { await mod.show(v, arg); } catch (e) { v.innerHTML = `<div class="pad"><p class="err">${esc(e.message)}</p><button class="btn" onclick="PN.go('${name}')">Reintentar</button></div>`; console.error(e); }
  }
  const refresh = () => go(current);

  // ---------- Ventana (modal) ----------
  // Cada apertura crea un contenedor nuevo, así no quedan eventos de ventanas anteriores.
  let onCloseCb = null;
  function modal(title, html, { onClose, wide } = {}) {
    $('#modal-title').textContent = title;
    const old = $('#modal-body'), body = old.cloneNode(false);
    old.replaceWith(body);
    body.innerHTML = html;
    $('#modal').classList.toggle('wide', !!wide);
    $('#modal').hidden = false;
    document.body.classList.add('noscroll');
    onCloseCb = onClose || null;
    setTimeout(() => body.querySelector('input:not([type=hidden]):not([readonly]):not([type=checkbox]), select, textarea')?.focus({ preventScroll: true }), 60);
    return body;
  }
  function closeModal() {
    $('#modal').hidden = true;
    document.body.classList.remove('noscroll');
    const cb = onCloseCb; onCloseCb = null; cb && cb();
  }
  document.addEventListener('click', e => { if (e.target.closest('#modal [data-close]') || e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('ask')) document.querySelector('#ask [data-no]').click();
    else if (!$('#modal').hidden) closeModal();
  });

  // Confirmación en una capa propia, encima de cualquier ventana abierta.
  function ask(title, text, okLabel = 'Sí, continuar', danger = true) {
    return new Promise(res => {
      const el = document.createElement('div');
      el.id = 'ask'; el.className = 'modal ask'; el.setAttribute('role', 'alertdialog');
      el.innerHTML = `<div class="modal-box"><div class="modal-head"><h2>${esc(title)}</h2></div><div class="modal-body"><p>${text}</p>
        <div class="row-btns"><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okLabel)}</button><button class="btn ghost" data-no>Volver</button></div></div></div>`;
      document.body.appendChild(el);
      el.querySelector('[data-yes]').focus();
      el.addEventListener('click', e => {
        const y = e.target.closest('[data-yes]'), n = e.target.closest('[data-no]') || e.target === el;
        if (!y && !n) return;
        el.remove(); res(!!y);
      });
    });
  }

  let toastT;
  function toast(msg, kind = 'ok') {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast ' + kind; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, kind === 'err' ? 5000 : 2800);
  }

  // Ejecuta una acción mostrando errores como aviso. Desactiva el botón mientras trabaja.
  async function run(btn, fn, okMsg) {
    if (btn) { if (btn.disabled) return; btn.disabled = true; }
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) { toast(e.message, 'err'); throw e; }
    finally { if (btn) btn.disabled = false; }
  }
  const safe = p => p.catch(() => {});

  // ---------- PIN ----------
  const pinOk = () => { try { return sessionStorage.getItem('qn-pin') === '1'; } catch { return false; } };
  function pinGate() {
    if (!D.hasPin || pinOk()) return Promise.resolve(true);
    return new Promise(res => {
      const b = modal('🔒 Sección protegida', `<p class="muted">Escribe tu PIN de seguridad para continuar.</p>
        <form id="pin-f"><input id="pin-i" type="password" inputmode="numeric" maxlength="6" autocomplete="off" class="pin-input" aria-label="PIN">
        <p class="err" id="pin-e"></p><button class="btn primary full">Entrar</button></form>`, { onClose: () => res(false) });
      $('#pin-f', b).addEventListener('submit', async e => {
        e.preventDefault();
        try {
          if (await QN.rpc('pin_verificar', { p_pin: $('#pin-i', b).value })) {
            try { sessionStorage.setItem('qn-pin', '1'); } catch { /* */ }
            onCloseCb = null; closeModal(); res(true);
          } else { $('#pin-e', b).textContent = 'PIN incorrecto.'; $('#pin-i', b).select(); }
        } catch (err) { $('#pin-e', b).textContent = err.message; }
      });
    });
  }

  // ---------- Ayudas de formularios ----------
  const opt = (v, l, sel) => `<option value="${esc(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${esc(l)}</option>`;
  const metodoOpts = sel => METODOS.map(([v, l]) => opt(v, l, sel)).join('');
  const proOpts = (sel, empty) => (empty ? opt('', empty, sel) : '') + activePros().map(p => opt(p.id, p.nombre, sel)).join('');
  const formData = form => Object.fromEntries(new FormData(form));
  const num = v => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0; };
  const badge = estado => `<span class="badge ${estado}">${ESTADOS[estado] || estado}</span>`;
  const telShow = t => { const l = QN.telLocal(t); return l === 'sin-telefono' ? '' : l.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3'); };
  const waLink = (tel, text) => (!tel || tel === 'sin-telefono') ? '' : QN.wa(tel, text);

  function downloadFile(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function csv(rows) {
    return '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
  }
  function printHtml(html) {
    $('#print-area').innerHTML = html;
    document.body.classList.add('printing');
    setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); }, 50);
  }

  return { sb, $, $$, D, METODOS, metodoLbl, ESTADOS, CFG_COLS, loadBase, svc, pro, activePros, multiPro, bookingUrl, manageUrl,
    register, go, refresh, current: () => current, modal, closeModal, ask, toast, run, safe, pinGate,
    opt, metodoOpts, proOpts, formData, num, badge, telShow, waLink, downloadFile, csv, printHtml };
})();
