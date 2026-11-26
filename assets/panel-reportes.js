// Panel · Reportes: ingresos, utilidad, servicios, productos, profesionales y clientas.
window.PN_Reportes = (() => {
  const { $, sb, metodoLbl, toast } = PN;
  const { esc, money, fechaCorta, hoy, addDays } = QN;
  const R = { preset: 'mes', desde: '', hasta: '' };

  function rango() {
    const t = hoy(), d = new Date(t + 'T12:00:00Z'), dow = (d.getUTCDay() + 6) % 7;
    const ym = t.slice(0, 7), [y, m] = ym.split('-').map(Number);
    const fin = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
    switch (R.preset) {
      case 'hoy': return [t, t];
      case 'semana': return [addDays(t, -dow), t];
      case 'mes': return [ym + '-01', t];
      case 'mespasado': { const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return [`${py}-${String(pm).padStart(2, '0')}-01`, fin(py, pm)]; }
      case '30': return [addDays(t, -29), t];
      case 'anio': return [`${y}-01-01`, t];
      default: return [R.desde || addDays(t, -29), R.hasta || t];
    }
  }

  async function show(v) {
    const [a, b] = rango();
    v.innerHTML = `<div class="toolbar"><div class="seg scroll">${[['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Este mes'], ['mespasado', 'Mes pasado'], ['30', '30 días'], ['anio', 'Año'], ['custom', 'Elegir fechas']].map(([k, l]) => `<button type="button" data-p="${k}" class="${R.preset === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${R.preset === 'custom' ? `<div class="inline"><input type="date" id="r-a" value="${a}" aria-label="Desde"><input type="date" id="r-b" value="${b}" aria-label="Hasta"><button type="button" class="btn sm primary" id="r-go">Ver</button></div>` : ''}</div>
      <div class="pad" id="rp"><p class="muted">Calculando…</p></div>`;
    v.querySelector('.seg').addEventListener('click', e => { const x = e.target.closest('[data-p]'); if (x) { R.preset = x.dataset.p; PN.go('reportes'); } });
    $('#r-go')?.addEventListener('click', () => { R.desde = $('#r-a').value; R.hasta = $('#r-b').value; PN.go('reportes'); });
    const r = await QN.rpc('reporte', { p_desde: a, p_hasta: b });
    const s = r.resumen, c = r.citas;
    const max = Math.max(1, ...r.por_dia.map(d => Number(d.total)));
    const showDays = r.por_dia.length <= 62;
    const pct = (x, t) => t ? Math.round(x * 100 / t) + '%' : '—';
    $('#rp').innerHTML = `<p class="muted small">${esc(fechaCorta(a))} – ${esc(fechaCorta(b))}</p>
      <div class="stats">
        <div class="hl"><small>Ventas</small><b>${money(s.total)}</b><span>${s.ventas} venta${s.ventas == 1 ? '' : 's'} · ticket ${money(s.ticket_promedio)}</span></div>
        <div class="${Number(s.utilidad) >= 0 ? 'ok' : 'warn'}"><small>Utilidad estimada</small><b>${money(s.utilidad)}</b><span>${pct(Number(s.utilidad), Number(s.total))} de las ventas</span></div>
        <div><small>Servicios</small><b>${money(s.servicios)}</b></div>
        <div><small>Productos</small><b>${money(s.productos)}</b></div>
        <div><small>Propinas</small><b>${money(s.propinas)}</b><span>no suman a la utilidad</span></div>
        <div><small>Descuentos</small><b>${money(s.descuentos)}</b></div>
      </div>
      <section class="card"><h3>¿De dónde sale la utilidad?</h3><table class="tbl">
        <tr><td>Ventas (después de descuentos)</td><td>${money(s.total)}</td></tr>
        <tr><td>− Comisiones de profesionales</td><td>${money(s.comisiones)}</td></tr>
        <tr><td>− Costo de productos vendidos</td><td>${money(s.costo_productos)}</td></tr>
        <tr><td>− Gastos registrados</td><td>${money(s.gastos)}</td></tr>
        <tr><td>− Gastos fijos (proporcional)</td><td>${money(s.gastos_fijos)}</td></tr>
        <tr class="tot"><td>Utilidad</td><td>${money(s.utilidad)}</td></tr></table></section>
      <section class="card"><h3>Citas</h3><div class="stats sm">
        <div><small>Total</small><b>${c.total}</b></div><div><small>Atendidas</small><b>${c.atendidas}</b></div>
        <div><small>Canceladas</small><b>${c.canceladas}</b></div><div><small>No asistió</small><b>${c.no_asistio}</b></div>
        <div><small>Reservaron en línea</small><b>${c.online}</b><span>${pct(c.online, c.total)}</span></div><div><small>Pendientes</small><b>${c.pendientes}</b></div></div></section>
      ${showDays && r.por_dia.length > 1 ? `<section class="card"><h3>Ventas por día</h3><div class="bars">${r.por_dia.map(d => `<div class="bar" title="${esc(fechaCorta(d.fecha))}: ${money(d.total)}"><i style="height:${Math.round(Number(d.total) * 100 / max)}%"></i><small>${+String(d.fecha).slice(8)}</small></div>`).join('')}</div></section>` : ''}
      <section class="card"><h3>Formas de pago</h3>${table(Object.entries(r.por_metodo).sort((x, y) => y[1] - x[1]).map(([m, t]) => [metodoLbl(m), money(t)]))}</section>
      <section class="card"><h3>Servicios más vendidos</h3>${table(r.por_servicio.map(x => [x.nombre, x.cantidad + '×', money(x.total)]))}</section>
      <section class="card"><h3>Productos</h3>${table(r.por_producto.map(x => [x.nombre, x.cantidad + '×', money(x.total), 'gan. ' + money(x.total - x.costo)]))}</section>
      ${r.por_profesional.length > 1 || r.por_profesional.some(p => Number(p.comision) > 0) ? `<section class="card"><h3>Por profesional</h3>${table(r.por_profesional.map(x => [x.nombre, x.atendidas + ' citas', money(x.ingresos), 'com. ' + money(x.comision), 'prop. ' + money(x.propinas)]))}</section>` : ''}
      <section class="card"><h3>Mejores clientas</h3>${table(r.top_clientes.map(x => [x.nombre, x.visitas + ' compra' + (x.visitas > 1 ? 's' : ''), money(x.total)]))}</section>
      <section class="card"><h3>Gastos por categoría</h3>${table(r.gastos_cat.map(x => [x.categoria, money(x.total)]))}</section>
      <button type="button" class="btn ghost full" id="r-csv">⬇️ Descargar ventas en Excel (CSV)</button>`;
    $('#r-csv').addEventListener('click', e => exportar(e.target, a, b));
  }

  const table = rows => rows.length ? `<table class="tbl">${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="muted small">Sin datos en este periodo.</p>';

  async function exportar(btn, a, b) {
    await PN.run(btn, async () => {
      const ventas = await QN.q(sb.from('ventas').select('*').gte('fecha', a).lte('fecha', b).order('fecha').order('numero'));
      const ids = ventas.map(v => v.id);
      const [items, pagos] = ids.length ? await Promise.all([
        QN.q(sb.from('venta_items').select('*').in('venta_id', ids)),
        QN.q(sb.from('venta_pagos').select('*').in('venta_id', ids))
      ]) : [[], []];
      const rows = [['Fecha', 'Hora', 'Número', 'Clienta', 'Celular', 'Detalle', 'Subtotal', 'Descuento', 'Total', 'Propina', 'Pagos', 'Anulada', 'Nota']];
      for (const v of ventas) rows.push([v.fecha, String(v.hora).slice(0, 5), v.numero, v.cliente || '', v.telefono || '',
        items.filter(i => i.venta_id === v.id).map(i => `${i.descripcion} x${i.cantidad} ${i.precio}`).join(' | '),
        v.subtotal, v.descuento, v.total, v.propina,
        pagos.filter(p => p.venta_id === v.id).map(p => `${metodoLbl(p.metodo)} ${p.monto}`).join(' | '), v.anulada ? 'Sí' : '', v.nota || '']);
      PN.downloadFile(`ventas-${a}-a-${b}.csv`, PN.csv(rows), 'text/csv;charset=utf-8');
    }).catch(() => toast('No se pudo exportar', 'err'));
  }

  const mod = { title: 'Reportes', show, protected: true };
  PN.register('reportes', mod);
  return mod;
})();
