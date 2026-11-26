// Panel · Caja: punto de venta, caja del día, gastos, abonos y ventas.
window.PN_Caja = (() => {
  const { $, D, sb, modal, closeModal, ask, toast, run, opt, metodoOpts, proOpts, metodoLbl, telShow, waLink, num } = PN;
  const { esc, money, h12, fechaLarga, fechaCorta, hoy, addDays } = QN;
  const C = { tab: 'cobrar', fecha: hoy(), mes: hoy().slice(0, 7) };
  const CATS = ['Insumos y materiales', 'Arriendo', 'Servicios públicos', 'Transporte', 'Publicidad', 'Alimentación', 'Mantenimiento', 'Otros'];
  let P = null; // venta en curso

  const newSale = () => ({ cita: null, items: [], cliente: '', tel: '', pro: PN.activePros()[0]?.id || '', descTipo: '$', desc: 0, prop: 0, pagos: [{ metodo: 'efectivo', monto: '' }], abonosDisp: [], abonosSel: [], nota: '' });

  async function show(v, arg) {
    if (arg?.cita) {
      C.tab = 'cobrar';
      const c = arg.cita;
      P = newSale();
      P.cita = c; P.cliente = c.cliente; P.tel = telShow(c.telefono); P.pro = c.profesional_id;
      P.items = (c.items || []).map(i => ({ tipo: 'servicio', servicio_id: i.servicio_id, producto_id: null, descripcion: i.nombre, cantidad: 1, precio: Number(i.precio) || Number(PN.svc(i.servicio_id)?.precio) || 0 }));
      await loadAbonos();
    }
    if (arg?.tab) C.tab = arg.tab;
    v.innerHTML = `<div class="toolbar"><div class="seg scroll">${[['cobrar', 'Cobrar'], ['caja', 'Caja del día'], ['ventas', 'Ventas'], ['gastos', 'Gastos'], ['abonos', 'Abonos']].map(([k, l]) => `<button type="button" data-tab="${k}" class="${C.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div></div><div id="cj" class="pad"></div>`;
    v.querySelector('.toolbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { C.tab = b.dataset.tab; PN.go('caja'); } });
    const el = $('#cj');
    if (C.tab === 'cobrar') renderPOS(el);
    else if (C.tab === 'caja') await renderCaja(el);
    else if (C.tab === 'ventas') await renderVentas(el);
    else if (C.tab === 'gastos') await renderGastos(el);
    else await renderAbonos(el);
  }

  // =================== PUNTO DE VENTA ===================
  async function loadAbonos() {
    P.abonosDisp = []; P.abonosSel = [];
    const tel = String(P.tel || '').replace(/\D/g, '');
    if (tel.length < 10 && !P.cita?.cliente_id) return;
    let q = sb.from('abonos').select('*').eq('estado', 'disponible');
    q = P.cita?.cliente_id ? q.eq('cliente_id', P.cita.cliente_id) : q.eq('telefono', tel.length === 10 ? '57' + tel : tel);
    P.abonosDisp = await QN.q(q).catch(() => []);
    P.abonosSel = P.abonosDisp.map(a => a.id);
  }

  function calc() {
    const sub = P.items.reduce((a, i) => a + num(i.cantidad) * num(i.precio), 0);
    const desc = Math.min(sub, Math.round(P.descTipo === '%' ? sub * num(P.desc) / 100 : num(P.desc)));
    const total = sub - desc, prop = Math.max(0, num(P.prop));
    const ab = P.abonosDisp.filter(a => P.abonosSel.includes(a.id)).reduce((a, x) => a + Number(x.monto), 0);
    const aPagar = total + prop - ab;
    const pagado = P.pagos.reduce((a, p) => a + num(p.monto), 0);
    return { sub, desc, total, prop, ab, aPagar, pagado, dif: pagado - aPagar };
  }

  function renderPOS(el) {
    if (!P) P = newSale();
    const svcs = D.svcs.filter(s => s.activo), prods = D.prods.filter(p => p.activo);
    el.innerHTML = `<form id="pos" autocomplete="off">
      ${P.cita ? `<div class="note">Cobrando la cita de <b>${esc(P.cita.cliente)}</b> · ${esc(fechaCorta(P.cita.fecha))} ${h12(String(P.cita.hora).slice(0, 5))} <button type="button" class="link" data-x-cita>Quitar</button></div>` : ''}
      <section class="card">
        <h3>Clienta</h3>
        <div class="grid2"><div><label for="pc">Nombre</label><input id="pc" data-k="cliente" value="${esc(P.cliente)}" placeholder="Opcional"></div>
        <div><label for="pt">Celular</label><input id="pt" data-k="tel" type="tel" inputmode="tel" value="${esc(P.tel)}" placeholder="Opcional"></div></div>
        ${PN.multiPro() ? `<label for="pp">Atendió</label><select id="pp" data-k="pro">${proOpts(P.pro)}</select>` : ''}
      </section>
      <section class="card">
        <h3>Servicios y productos</h3>
        <div id="pos-items">${P.items.length ? P.items.map((it, i) => `<div class="item-row">
          <div class="item-name"><b>${esc(it.descripcion)}</b><small>${it.tipo === 'producto' ? 'Producto' + (PN.D.prods.find(p => p.id === it.producto_id) ? ' · stock ' + PN.D.prods.find(p => p.id === it.producto_id).stock : '') : 'Servicio'}</small></div>
          <input class="qty" type="number" min="1" step="1" data-i="${i}" data-f="cantidad" value="${it.cantidad}" aria-label="Cantidad">
          <input class="money-in" type="number" min="0" step="100" data-i="${i}" data-f="precio" value="${it.precio}" aria-label="Precio">
          <button type="button" class="icon-btn" data-rm="${i}" aria-label="Quitar">✕</button></div>`).join('') : '<p class="muted">Agrega lo que vas a cobrar.</p>'}</div>
        <div class="grid2 mt">
          <select data-add="servicio" aria-label="Agregar servicio">${opt('', '＋ Agregar servicio')}${svcs.map(s => opt(s.id, `${s.nombre}${s.precio > 0 ? ' · ' + money(s.precio) : ''}`)).join('')}</select>
          <select data-add="producto" aria-label="Agregar producto">${opt('', prods.length ? '＋ Agregar producto' : 'Sin productos')}${prods.map(p => opt(p.id, `${p.nombre} · ${money(p.precio)} (${p.stock})`)).join('')}</select>
        </div>
        <button type="button" class="btn sm ghost mt" data-libre>＋ Otro concepto</button>
      </section>
      <section class="card">
        <h3>Descuento y propina</h3>
        <div class="grid2">
          <div><label for="pd">Descuento</label><div class="inline"><input id="pd" type="number" min="0" data-k="desc" value="${P.desc || ''}" placeholder="0"><select data-k="descTipo" aria-label="Tipo de descuento">${opt('$', '$', P.descTipo)}${opt('%', '%', P.descTipo)}</select></div></div>
          <div><label for="pr">Propina</label><input id="pr" type="number" min="0" step="500" data-k="prop" value="${P.prop || ''}" placeholder="0"></div>
        </div>
        ${P.abonosDisp.length ? `<label>Abonos de la clienta</label>${P.abonosDisp.map(a => `<label class="check"><input type="checkbox" data-ab="${a.id}"${P.abonosSel.includes(a.id) ? ' checked' : ''}><span>${money(a.monto)} · ${esc(fechaCorta(a.fecha))} · ${esc(metodoLbl(a.metodo))}</span></label>`).join('')}` : ''}
      </section>
      <section class="card">
        <h3>Pago</h3>
        <div id="pos-pagos">${P.pagos.map((p, i) => `<div class="pay-row"><select data-pi="${i}" data-pf="metodo" aria-label="Método">${metodoOpts(p.metodo)}</select>
          <input type="number" min="0" step="100" data-pi="${i}" data-pf="monto" value="${p.monto}" placeholder="Monto" aria-label="Monto">
          ${P.pagos.length > 1 ? `<button type="button" class="icon-btn" data-prm="${i}" aria-label="Quitar pago">✕</button>` : ''}</div>`).join('')}</div>
        <div class="row-btns"><button type="button" class="btn sm ghost" data-exacto>Completar con lo que falta</button><button type="button" class="btn sm ghost" data-pagoadd>＋ Pago mixto</button></div>
        <label for="pn">Nota</label><input id="pn" data-k="nota" value="${esc(P.nota)}" maxlength="200" placeholder="Opcional">
      </section>
      <div id="pos-tot" class="totals"></div>
      <p class="err" id="pos-err"></p>
      <div class="row-btns"><button class="btn primary grow" id="pos-ok">Cobrar</button><button type="button" class="btn ghost" data-limpiar>Limpiar</button></div>
    </form>`;
    renderTotals();
    const f = $('#pos');
    f.addEventListener('input', e => {
      const t = e.target, d = t.dataset;
      if (d.k && t.tagName === 'INPUT') P[d.k] = t.value;
      else if (d.i !== undefined) P.items[+d.i][d.f] = t.value;
      else if (d.pi !== undefined) P.pagos[+d.pi][d.pf] = t.value;
      renderTotals();
    });
    f.addEventListener('change', async e => {
      const t = e.target, d = t.dataset;
      if (d.k && t.tagName === 'SELECT') { P[d.k] = t.value; renderTotals(); }
      else if (d.pi !== undefined && d.pf === 'metodo') P.pagos[+d.pi].metodo = t.value;
      else if (d.ab) { P.abonosSel = t.checked ? [...P.abonosSel, d.ab] : P.abonosSel.filter(x => x !== d.ab); renderTotals(); }
      else if (d.add && t.value) {
        if (d.add === 'servicio') { const s = PN.svc(t.value); P.items.push({ tipo: 'servicio', servicio_id: s.id, producto_id: null, descripcion: s.nombre, cantidad: 1, precio: Number(s.precio) }); }
        else { const p = D.prods.find(x => x.id === t.value); P.items.push({ tipo: 'producto', servicio_id: null, producto_id: p.id, descripcion: p.nombre, cantidad: 1, precio: Number(p.precio) }); }
        renderPOS(el);
      } else if (d.k === 'tel') { await loadAbonos(); renderPOS(el); }
    });
    f.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const d = b.dataset;
      if (d.rm !== undefined) { P.items.splice(+d.rm, 1); renderPOS(el); }
      else if (d.prm !== undefined) { P.pagos.splice(+d.prm, 1); renderPOS(el); }
      else if (d.pagoadd !== undefined) { P.pagos.push({ metodo: 'nequi', monto: '' }); renderPOS(el); }
      else if (d.exacto !== undefined) {
        const k = calc(); const last = P.pagos[P.pagos.length - 1];
        last.monto = Math.max(0, num(last.monto) + (k.aPagar - k.pagado)); renderPOS(el);
      } else if (d.libre !== undefined) conceptoLibre(el);
      else if (d.limpiar !== undefined) { P = newSale(); renderPOS(el); }
      else if (d.xCita !== undefined) { P.cita = null; renderPOS(el); }
    });
    f.addEventListener('submit', e => { e.preventDefault(); cobrar($('#pos-ok')); });
  }

  function renderTotals() {
    const k = calc(), el = $('#pos-tot'); if (!el) return;
    const ef = P.pagos.some(p => p.metodo === 'efectivo');
    el.innerHTML = `<div><span>Subtotal</span><b>${money(k.sub)}</b></div>
      ${k.desc ? `<div><span>Descuento</span><b>−${money(k.desc)}</b></div>` : ''}
      <div><span>Total</span><b>${money(k.total)}</b></div>
      ${k.prop ? `<div><span>Propina</span><b>${money(k.prop)}</b></div>` : ''}
      ${k.ab ? `<div><span>Abonos</span><b>−${money(k.ab)}</b></div>` : ''}
      <div class="big"><span>A pagar</span><b>${money(Math.max(0, k.aPagar))}</b></div>
      ${k.dif < 0 ? `<div class="warn"><span>Falta</span><b>${money(-k.dif)}</b></div>` : k.dif > 0 ? `<div class="${ef ? 'ok' : 'warn'}"><span>${ef ? 'Cambio' : 'Sobra'}</span><b>${money(k.dif)}</b></div>` : ''}`;
    const btn = $('#pos-ok'); if (btn) btn.textContent = `Cobrar ${money(k.total + k.prop)}`;
  }

  function conceptoLibre(el) {
    const b = modal('Otro concepto', `<form id="cl"><label for="cl-d">Descripción</label><input id="cl-d" name="d" required maxlength="80">
      <div class="grid2"><div><label for="cl-p">Precio</label><input id="cl-p" name="p" type="number" min="0" step="100" required></div>
      <div><label for="cl-t">Tipo</label><select id="cl-t" name="t">${opt('servicio', 'Servicio')}${opt('producto', 'Producto (sin inventario)')}</select></div></div>
      <button class="btn primary full mt">Agregar</button></form>`);
    $('#cl', b).addEventListener('submit', e => {
      e.preventDefault(); const fd = new FormData(e.target);
      P.items.push({ tipo: fd.get('t') === 'producto' ? 'producto' : 'servicio', servicio_id: null, producto_id: null, descripcion: fd.get('d'), cantidad: 1, precio: num(fd.get('p')) });
      closeModal(); renderPOS(el);
    });
  }

  async function cobrar(btn) {
    const k = calc(), err = m => { $('#pos-err').textContent = m; };
    err('');
    if (!P.items.length) return err('Agrega al menos un servicio o producto.');
    if (P.items.some(i => num(i.cantidad) < 1 || num(i.precio) < 0)) return err('Revisa cantidades y precios.');
    if (k.aPagar < 0) return err('Los abonos superan el total. Quita alguno.');
    let pagos = P.pagos.map(p => ({ metodo: p.metodo, monto: num(p.monto) })).filter(p => p.monto > 0);
    let cambio = 0;
    if (k.dif < 0) return err(`Falta registrar ${money(-k.dif)} en el pago.`);
    if (k.dif > 0) {
      const ef = pagos.find(p => p.metodo === 'efectivo');
      if (!ef || ef.monto < k.dif) return err(`Los pagos superan lo que se debe por ${money(k.dif)}. Revisa los montos.`);
      ef.monto -= k.dif; cambio = k.dif;
      pagos = pagos.filter(p => p.monto > 0);
    }
    if (P.items.some(i => i.tipo === 'producto' && i.producto_id)) {
      const low = P.items.filter(i => i.producto_id).find(i => (D.prods.find(p => p.id === i.producto_id)?.stock ?? 0) < num(i.cantidad));
      if (low && !(await ask('Stock insuficiente', `El inventario de <b>${esc(low.descripcion)}</b> quedará en negativo. ¿Registrar la venta de todas formas?`, 'Sí, registrar', false))) return;
    }
    let r;
    try {
      r = await run(btn, () => QN.rpc('registrar_venta', {
        p_cita: P.cita?.id || null, p_cliente: P.cliente || null, p_telefono: P.tel || null, p_pro: P.pro || PN.activePros()[0]?.id || null,
        p_items: P.items.map(i => ({ ...i, cantidad: num(i.cantidad), precio: num(i.precio) })),
        p_descuento: k.desc, p_propina: k.prop, p_pagos: pagos, p_abonos: P.abonosSel, p_nota: P.nota || null
      }));
    } catch (e) { return err(e.message); }
    P = newSale();
    PN.safe(PN.loadBase());
    window.PN_Agenda.updatePendBadge();
    await comprobante(r.id, { cambio, nueva: true });
    if (PN.current() === 'caja') renderPOS($('#cj'));
  }

  // =================== COMPROBANTE ===================
  async function comprobante(id, { cambio = 0, nueva = false } = {}) {
    const [[v], items, pagos] = await Promise.all([
      QN.q(sb.from('ventas').select('*').eq('id', id)),
      QN.q(sb.from('venta_items').select('*').eq('venta_id', id)),
      QN.q(sb.from('venta_pagos').select('*').eq('venta_id', id))
    ]);
    const n = D.cfg;
    const recibo = `<div class="receipt">
      <img src="assets/logo.jpg" alt="" width="70" height="70">
      <h4>${esc(n.nombre || 'Queen Nails Studio')}</h4><p>${esc(n.direccion || '')}</p>
      <p>Comprobante #${v.numero}<br>${esc(fechaLarga(v.fecha))} · ${h12(String(v.hora).slice(0, 5))}</p>
      ${v.cliente ? `<p>Clienta: ${esc(v.cliente)}</p>` : ''}
      <table>${items.map(i => `<tr><td>${esc(i.descripcion)}${i.cantidad > 1 ? ' x' + i.cantidad : ''}</td><td>${money(i.cantidad * i.precio)}</td></tr>`).join('')}
      <tr class="sep"><td>Subtotal</td><td>${money(v.subtotal)}</td></tr>
      ${Number(v.descuento) ? `<tr><td>Descuento</td><td>−${money(v.descuento)}</td></tr>` : ''}
      <tr class="tot"><td>Total</td><td>${money(v.total)}</td></tr>
      ${Number(v.propina) ? `<tr><td>Propina</td><td>${money(v.propina)}</td></tr>` : ''}
      ${pagos.map(p => `<tr><td>${esc(metodoLbl(p.metodo))}</td><td>${money(p.monto)}</td></tr>`).join('')}
      ${cambio ? `<tr><td>Cambio</td><td>${money(cambio)}</td></tr>` : ''}</table>
      ${v.anulada ? `<p class="void">ANULADA${v.anulada_motivo ? ': ' + esc(v.anulada_motivo) : ''}</p>` : '<p>¡Gracias por tu visita! 💖</p>'}
    </div>`;
    const texto = `*${n.nombre || 'Queen Nails Studio'}*\nComprobante #${v.numero} · ${fechaLarga(v.fecha)}\n` +
      items.map(i => `• ${i.descripcion}${i.cantidad > 1 ? ' x' + i.cantidad : ''}: ${money(i.cantidad * i.precio)}`).join('\n') +
      (Number(v.descuento) ? `\nDescuento: −${money(v.descuento)}` : '') + `\n*Total: ${money(v.total)}*` +
      (Number(v.propina) ? `\nPropina: ${money(v.propina)}` : '') + `\n¡Gracias por tu visita! 💖`;
    const b = modal(nueva ? `Venta registrada ✓` : `Venta #${v.numero}`, `
      ${cambio ? `<p class="change">Cambio a entregar: <b>${money(cambio)}</b></p>` : ''}
      ${recibo}
      <div class="action-grid">
        <button class="btn ghost" data-print>🖨️ Imprimir</button>
        ${v.telefono ? `<a class="btn wa" target="_blank" rel="noopener" href="${esc(waLink(v.telefono, texto))}">📲 Enviar por WhatsApp</a>` : ''}
        ${!v.anulada ? '<button class="btn ghost danger-text" data-anular>Anular venta</button>' : ''}
        <button class="btn primary" data-close>${nueva ? 'Nueva venta' : 'Cerrar'}</button>
      </div>`);
    b.addEventListener('click', async e => {
      if (e.target.closest('[data-print]')) PN.printHtml(recibo);
      if (e.target.closest('[data-anular]')) anular(v);
    });
  }

  async function anular(v) {
    const b = modal(`Anular venta #${v.numero}`, `<form id="an"><p>Se devolverá el inventario y los abonos usados. La venta quedará en el historial como anulada.</p>
      <label for="an-m">Motivo</label><input id="an-m" name="m" required maxlength="120"><p class="err" id="an-e"></p>
      <button class="btn danger full">Anular venta</button></form>`);
    $('#an', b).addEventListener('submit', async e => {
      e.preventDefault();
      try { await run(e.target.querySelector('button'), () => QN.rpc('anular_venta', { p_id: v.id, p_motivo: new FormData(e.target).get('m') }), 'Venta anulada'); }
      catch (ex) { $('#an-e', b).textContent = ex.message; return; }
      PN.safe(PN.loadBase()); closeModal(); if (PN.current() === 'caja') PN.go('caja');
    });
  }

  // =================== CAJA DEL DÍA ===================
  async function renderCaja(el) {
    const k = await QN.rpc('caja_dia', { p_fecha: C.fecha });
    const sum = o => Object.values(o || {}).reduce((a, x) => a + Number(x), 0);
    const rows = o => Object.entries(o || {}).map(([m, x]) => `<tr><td>${esc(metodoLbl(m))}</td><td>${money(x)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Nada registrado</td></tr>';
    const cerrada = !!k.cerrada_at;
    const hist = await QN.q(sb.from('cajas').select('*').order('fecha', { ascending: false }).limit(15)).catch(() => []);
    el.innerHTML = `<div class="datebar"><button type="button" class="icon-btn" data-d="-1" aria-label="Día anterior">‹</button>
        <label class="date-label"><span>${esc(fechaLarga(C.fecha))}</span><input type="date" id="cj-f" value="${C.fecha}" aria-label="Fecha"></label>
        <button type="button" class="icon-btn" data-d="1" aria-label="Día siguiente">›</button></div>
      ${!k.abierta ? `<section class="card"><h3>Abrir caja</h3><p class="muted">¿Con cuánto efectivo empiezas el día?</p>
        <form id="ab-f" class="inline"><input name="ap" type="number" min="0" step="1000" placeholder="Efectivo inicial" required><button class="btn primary">Abrir caja</button></form></section>` : ''}
      <div class="stats">
        <div><small>Ventas</small><b>${money(k.total_ventas)}</b><span>${k.ventas} venta${k.ventas == 1 ? '' : 's'}</span></div>
        <div><small>Propinas</small><b>${money(k.propinas)}</b></div>
        <div><small>Abonos recibidos</small><b>${money(k.abonos_recibidos)}</b></div>
        <div><small>Gastos y pagos</small><b>${money(Number(k.gastos) + Number(k.pagos_pro))}</b></div>
      </div>
      <section class="card"><h3>Entradas por método <small class="muted">${money(sum(k.ingresos))}</small></h3><table class="tbl">${rows(k.ingresos)}</table></section>
      <section class="card"><h3>Salidas por método <small class="muted">${money(sum(k.egresos))}</small></h3><table class="tbl">${rows(k.egresos)}</table></section>
      <section class="card highlight"><h3>Efectivo en caja</h3>
        <table class="tbl"><tr><td>Apertura</td><td>${money(k.apertura)}</td></tr><tr><td>+ Entradas en efectivo</td><td>${money(k.ingresos?.efectivo || 0)}</td></tr>
        <tr><td>− Salidas en efectivo</td><td>${money(k.egresos?.efectivo || 0)}</td></tr><tr class="tot"><td>Debe haber</td><td>${money(k.efectivo_esperado)}</td></tr>
        ${cerrada ? `<tr><td>Contado</td><td>${money(k.contado)}</td></tr><tr class="${Number(k.diferencia) === 0 ? 'ok' : 'warn'}"><td>Diferencia</td><td>${Number(k.diferencia) > 0 ? '+' : ''}${money(k.diferencia)}</td></tr>` : ''}</table>
        ${k.abierta && !cerrada ? `<form id="ci-f"><label for="ci-c">Efectivo contado al cerrar</label><input id="ci-c" name="c" type="number" min="0" step="100" required>
          <label for="ci-n">Nota</label><input id="ci-n" name="n" maxlength="200"><button class="btn primary full mt">Cerrar caja</button></form>` : ''}
        ${cerrada ? `<p class="muted small">Cerrada ${new Date(k.cerrada_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}${k.nota ? ' · ' + esc(k.nota) : ''}</p><button class="btn sm ghost" data-reabrir>Reabrir caja</button>` : ''}
      </section>
      <section class="card"><h3>Cierres de caja</h3>${hist.length ? `<table class="tbl">${hist.map(h => `<tr><td><button type="button" class="link" data-goto="${h.fecha}">${esc(fechaCorta(h.fecha))}</button></td><td>Apertura ${money(h.apertura)}</td><td>${h.cerrada_at ? 'Contado ' + money(h.contado) : '<span class="badge pendiente">Abierta</span>'}</td></tr>`).join('')}</table>` : '<p class="muted">Aún no hay cierres.</p>'}</section>`;
    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.d) { C.fecha = addDays(C.fecha, +b.dataset.d); PN.go('caja'); }
      else if (b.dataset.goto) { C.fecha = b.dataset.goto; PN.go('caja'); }
      else if (b.dataset.reabrir !== undefined) { await run(b, () => QN.q(sb.from('cajas').update({ cerrada_at: null, contado: null }).eq('fecha', C.fecha)), 'Caja reabierta'); PN.go('caja'); }
    });
    $('#cj-f').addEventListener('change', e => { if (e.target.value) { C.fecha = e.target.value; PN.go('caja'); } });
    $('#ab-f')?.addEventListener('submit', async e => {
      e.preventDefault();
      await run(e.target.querySelector('button'), () => QN.q(sb.from('cajas').insert({ fecha: C.fecha, apertura: num(new FormData(e.target).get('ap')) })), 'Caja abierta').catch(() => {});
      PN.go('caja');
    });
    $('#ci-f')?.addEventListener('submit', async e => {
      e.preventDefault(); const fd = new FormData(e.target);
      await run(e.target.querySelector('button'), () => QN.q(sb.from('cajas').update({ contado: num(fd.get('c')), nota: fd.get('n') || null, cerrada_at: new Date().toISOString() }).eq('fecha', C.fecha)), 'Caja cerrada').catch(() => {});
      PN.go('caja');
    });
  }

  // =================== VENTAS ===================
  async function renderVentas(el) {
    const ventas = await QN.q(sb.from('ventas').select('*').eq('fecha', C.fecha).order('creada', { ascending: false }));
    const pagos = ventas.length ? await QN.q(sb.from('venta_pagos').select('*').in('venta_id', ventas.map(v => v.id))) : [];
    const ok = ventas.filter(v => !v.anulada);
    el.innerHTML = `<div class="datebar"><button type="button" class="icon-btn" data-d="-1" aria-label="Día anterior">‹</button>
      <label class="date-label"><span>${esc(fechaLarga(C.fecha))}</span><input type="date" id="vt-f" value="${C.fecha}" aria-label="Fecha"></label>
      <button type="button" class="icon-btn" data-d="1" aria-label="Día siguiente">›</button></div>
      <p class="day-sum"><b>${ok.length}</b> venta${ok.length === 1 ? '' : 's'} · ${money(ok.reduce((a, v) => a + Number(v.total), 0))}</p>
      ${ventas.map(v => `<button type="button" class="list-row${v.anulada ? ' void' : ''}" data-v="${v.id}"><span><b>#${v.numero} · ${esc(v.cliente || 'Sin nombre')}</b><small>${h12(String(v.hora).slice(0, 5))} · ${esc(pagos.filter(p => p.venta_id === v.id).map(p => metodoLbl(p.metodo)).join(', '))}${v.anulada ? ' · ANULADA' : ''}</small></span><b>${money(v.total)}</b></button>`).join('') || '<p class="muted">No hay ventas este día.</p>'}`;
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.d) { C.fecha = addDays(C.fecha, +b.dataset.d); PN.go('caja'); }
      else if (b.dataset.v) comprobante(b.dataset.v);
    });
    $('#vt-f').addEventListener('change', e => { if (e.target.value) { C.fecha = e.target.value; PN.go('caja'); } });
  }

  // =================== GASTOS ===================
  async function renderGastos(el) {
    const [y, m] = C.mes.split('-').map(Number);
    const fin = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const gastos = await QN.q(sb.from('gastos').select('*').gte('fecha', C.mes + '-01').lte('fecha', fin).order('fecha', { ascending: false }));
    el.innerHTML = `<section class="card"><h3>Nuevo gasto</h3><form id="gf">
        <div class="grid2"><div><label for="g-c">Concepto</label><input id="g-c" name="concepto" required maxlength="100" placeholder="Ej.: esmaltes, arriendo"></div>
        <div><label for="g-m">Monto</label><input id="g-m" name="monto" type="number" min="1" step="100" required></div></div>
        <div class="grid3"><div><label for="g-cat">Categoría</label><select id="g-cat" name="categoria">${CATS.map(c => opt(c, c)).join('')}</select></div>
        <div><label for="g-me">Pagado con</label><select id="g-me" name="metodo">${metodoOpts('efectivo')}</select></div>
        <div><label for="g-f">Fecha</label><input id="g-f" name="fecha" type="date" value="${hoy()}" required></div></div>
        <button class="btn primary full mt">Guardar gasto</button></form></section>
      <div class="datebar"><label class="date-label"><span>Gastos de ${new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span><input type="month" id="g-mes" value="${C.mes}" aria-label="Mes"></label></div>
      <p class="day-sum">Total del mes: <b>${money(gastos.reduce((a, g) => a + Number(g.monto), 0))}</b></p>
      ${gastos.map(g => `<div class="list-row"><span><b>${esc(g.concepto)}</b><small>${esc(fechaCorta(g.fecha))} · ${esc(g.categoria || '')} · ${esc(metodoLbl(g.metodo))}</small></span><b>${money(g.monto)}</b><button type="button" class="icon-btn" data-del="${g.id}" aria-label="Borrar gasto">🗑</button></div>`).join('') || '<p class="muted">Sin gastos este mes.</p>'}`;
    $('#gf').addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(e.target);
      await run(e.target.querySelector('button'), () => QN.q(sb.from('gastos').insert({ ...fd, monto: num(fd.monto) })), 'Gasto guardado').catch(() => {});
      PN.go('caja');
    });
    $('#g-mes').addEventListener('change', e => { if (e.target.value) { C.mes = e.target.value; PN.go('caja'); } });
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-del]'); if (!b) return;
      if (await ask('¿Borrar este gasto?', 'Esta acción no se puede deshacer.', 'Sí, borrar')) { await run(b, () => QN.q(sb.from('gastos').delete().eq('id', b.dataset.del)), 'Gasto borrado').catch(() => {}); PN.go('caja'); }
    });
  }

  // =================== ABONOS ===================
  async function renderAbonos(el) {
    const [disp, otros] = await Promise.all([
      QN.q(sb.from('abonos').select('*').eq('estado', 'disponible').order('fecha', { ascending: false })),
      QN.q(sb.from('abonos').select('*').neq('estado', 'disponible').gte('fecha', addDays(hoy(), -60)).order('fecha', { ascending: false }))
    ]);
    const row = a => `<div class="list-row"><span><b>${esc(a.cliente)}</b><small>${esc(fechaCorta(a.fecha))} · ${esc(metodoLbl(a.metodo))}${a.nota ? ' · ' + esc(a.nota) : ''}${a.estado !== 'disponible' ? ' · ' + (a.estado === 'usado' ? 'Usado' : 'Devuelto') : ''}</small></span><b>${money(a.monto)}</b>${a.estado === 'disponible' ? `<button type="button" class="btn sm ghost" data-dev="${a.id}">Devolver</button>` : ''}</div>`;
    el.innerHTML = `<p class="muted">Los abonos son anticipos que deja una clienta. Al cobrar su servicio se descuentan automáticamente.</p>
      <button type="button" class="btn primary full" data-nuevo>＋ Registrar abono</button>
      <h3 class="sec-title mt">Disponibles · ${money(disp.reduce((a, x) => a + Number(x.monto), 0))}</h3>${disp.map(row).join('') || '<p class="muted">No hay abonos pendientes.</p>'}
      <h3 class="sec-title mt">Usados o devueltos (60 días)</h3>${otros.map(row).join('') || '<p class="muted">—</p>'}`;
    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.nuevo !== undefined) nuevoAbono({}, () => PN.go('caja'));
      else if (b.dataset.dev) {
        if (await ask('¿Devolver este abono?', 'Se registrará como salida de dinero de hoy.', 'Sí, devolver')) { await run(b, () => QN.rpc('devolver_abono', { p_id: b.dataset.dev }), 'Abono devuelto').catch(() => {}); PN.go('caja'); }
      }
    });
  }

  function nuevoAbono(pre = {}, done) {
    const b = modal('Registrar abono', `<form id="naf">
      <div class="grid2"><div><label for="na-c">Clienta</label><input id="na-c" name="cliente" required maxlength="80" value="${esc(pre.cliente || '')}"></div>
      <div><label for="na-t">Celular</label><input id="na-t" name="telefono" type="tel" value="${esc(telShow(pre.telefono || ''))}"></div></div>
      <div class="grid2"><div><label for="na-m">Monto</label><input id="na-m" name="monto" type="number" min="1" step="1000" required></div>
      <div><label for="na-me">Método</label><select id="na-me" name="metodo">${metodoOpts('nequi')}</select></div></div>
      <label for="na-n">Nota</label><input id="na-n" name="nota" maxlength="120" placeholder="Ej.: anticipo diseño">
      <p class="err" id="na-e"></p><button class="btn primary full mt">Guardar abono</button></form>`);
    $('#naf', b).addEventListener('submit', async e => {
      e.preventDefault(); const fd = PN.formData(e.target);
      try { await run(e.target.querySelector('button'), () => QN.rpc('registrar_abono', { p_cliente: fd.cliente, p_telefono: fd.telefono, p_monto: num(fd.monto), p_metodo: fd.metodo, p_cita: pre.cita_id || null, p_nota: fd.nota || null }), 'Abono registrado'); }
      catch (ex) { $('#na-e', b).textContent = ex.message; return; }
      closeModal(); done && done();
    });
  }

  const mod = { title: 'Caja', show, nuevoAbono, comprobante };
  PN.register('caja', mod);
  return mod;
})();
