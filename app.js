/** @typedef {{ nombre: string, total: number, movimientos: number, porcentaje: number, sugerida?: boolean, presupuesto?: number|null, uso_meta_pct?: number|null }} CatDetalle */

let state = {
  moneda: "PEN",
  periodo: "",
  categorias: [],
  gastos: [],
  categoriasDetalle: [],
  categoriasProyectadoDetalle: [],
  mesTotal: 0,
  presupuestoTotal: null,
  usoPresupuestoMes: null,
};

let lastDashboardData = null;

function fmt(n, moneda) {
  if (n == null || Number.isNaN(n)) return "—";
  const num = Number(n).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${num} ${moneda || "PEN"}`;
}

function fmtGasto(g) {
  const moneda = g.moneda || "PEN";
  if (moneda === "PEN") {
    return fmt(g.monto_pen ?? g.monto, "PEN");
  }
  const pen = g.monto_pen != null ? ` (${fmt(g.monto_pen, "PEN")})` : "";
  return `${fmt(g.monto, moneda)}${pen}`;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function presupuestoEstado(usoPct) {
  if (usoPct == null || Number.isNaN(usoPct)) {
    return { clase: "meta-sin", texto: "—", hint: "Sin gastos proyectados" };
  }
  const pct = Math.round(usoPct * 10) / 10;
  if (pct > 100) {
    return {
      clase: "meta-excedido",
      texto: `${pct}%`,
      hint: `Excedido (+${(pct - 100).toFixed(0)}%)`,
    };
  }
  return {
    clase: "meta-ok",
    texto: `${pct}%`,
    hint: `Quedan ${(100 - pct).toFixed(0)}%`,
  };
}

function renderPresupuestoMes() {
  const gastadoEl = document.getElementById("presupuesto-gastado");
  const periodoEl = document.getElementById("presupuesto-periodo");
  const proyectadoSumaEl = document.getElementById("eg-proyectado-suma-tipo");
  const pctEl = document.getElementById("presupuesto-pct-mes");
  const hintEl = document.getElementById("presupuesto-hint-mes");
  const fill = document.getElementById("progress-fill-mes");
  const track = document.getElementById("progress-track-mes");
  const periodoLabel = window.finPeriodoLegible?.(state.periodo) || state.periodo;

  if (gastadoEl) gastadoEl.textContent = fmt(state.mesTotal, state.moneda);
  if (periodoEl) {
    const mov = `${state.gastos.length} movimiento(s)`;
    periodoEl.textContent = state.periodo ? `${periodoLabel} · ${mov}` : mov;
  }
  if (proyectadoSumaEl) {
    proyectadoSumaEl.textContent =
      state.presupuestoTotal > 0 ? fmt(state.presupuestoTotal, state.moneda) : "Sin definir";
  }

  const est = presupuestoEstado(state.usoPresupuestoMes);
  if (pctEl) {
    pctEl.textContent = state.presupuestoTotal > 0 ? est.texto : "—";
    pctEl.className = `presupuesto-pct presupuesto-valor ${est.clase}`;
  }
  if (hintEl) {
    hintEl.textContent =
      state.presupuestoTotal > 0
        ? est.hint
        : "Añade montos proyectados por categoría en la tabla de abajo";
  }

  if (fill && track) {
    if (state.presupuestoTotal > 0 && state.usoPresupuestoMes != null) {
      const width = Math.min(state.usoPresupuestoMes, 100);
      fill.style.width = `${width}%`;
      fill.className = `progress-fill ${state.usoPresupuestoMes > 100 ? "over" : ""}`;
      track.classList.remove("hidden");
    } else {
      fill.style.width = "0%";
      track.classList.add("hidden");
    }
  }
}

function proyectadosDesdeEstado(excluir) {
  const out = {};
  for (const c of state.categoriasProyectadoDetalle) {
    if (excluir && c.nombre === excluir) continue;
    if (c.proyectado > 0) out[c.nombre] = c.proyectado;
  }
  return out;
}

function presupuestosCategoriasDesdeEstado(excluir) {
  return proyectadosDesdeEstado(excluir);
}

function rellenarSelectProyectadoCategorias() {
  const sel = document.getElementById("eg-proyectado-categoria");
  if (!sel) return;
  const prev = sel.value;
  const cats = [...(state.categorias || [])].sort((a, b) => a.localeCompare(b, "es"));
  sel.innerHTML = cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if (prev && cats.includes(prev)) sel.value = prev;
}

function categoriaConGastos(c) {
  const mov = Number(c.movimientos) || 0;
  const total = Number(c.total) || 0;
  return mov > 0 && total > 0;
}

function renderCategoriasRealizadas() {
  const tbody = document.querySelector("#tabla-gastos-realizados tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const moneda = state.moneda;
  const filas = state.categoriasDetalle.filter(categoriaConGastos);

  if (!filas.length) {
    tbody.innerHTML =
      "<tr><td colspan='4'>Sin gastos realizados en este mes. Regístralos arriba.</td></tr>";
    return;
  }

  for (const cat of filas) {
    const tr = document.createElement("tr");
    tr.dataset.categoria = cat.nombre;
    tr.className = "fila-activa";
    tr.innerHTML = `
      <td>
        <span class="cat-nombre">${esc(cat.nombre)}</span>
        ${cat.sugerida ? '<span class="badge">sugerida</span>' : ""}
      </td>
      <td>${fmt(cat.total, moneda)}</td>
      <td>${cat.movimientos}</td>
      <td class="col-acciones">
        <button type="button" class="btn-icon btn-editar-cat" title="Renombrar categoría">✎</button>
      </td>
    `;
    tr.querySelector(".btn-editar-cat")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirRenombrarCategoria(cat.nombre);
    });
    tr.addEventListener("click", () => abrirDetalle(cat.nombre));
    tbody.appendChild(tr);
  }
}

function renderCategoriasProyectadas() {
  const tbody = document.querySelector("#tabla-gastos-proyectados tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const moneda = state.moneda;
  const filas = state.categoriasProyectadoDetalle.filter((c) => c.proyectado > 0);

  if (!filas.length) {
    tbody.innerHTML =
      "<tr><td colspan='5'>Sin gastos proyectados por categoría. Usa el formulario de arriba o lenguaje natural.</td></tr>";
    return;
  }

  for (const cat of filas) {
    const est = presupuestoEstado(cat.uso_proyectado_pct);
    const tr = document.createElement("tr");
    tr.dataset.categoria = cat.nombre;
    tr.className = "fila-activa fila-proyectado";
    tr.innerHTML = `
      <td>
        <span class="cat-nombre">${esc(cat.nombre)}</span>
        ${cat.sugerida ? '<span class="badge badge-egreso-proyectado">sugerida</span>' : ""}
      </td>
      <td>${fmt(cat.proyectado, moneda)}</td>
      <td>${cat.realizado > 0 ? fmt(cat.realizado, moneda) : "—"}</td>
      <td class="col-uso-meta ${est.clase}">${est.texto}</td>
      <td class="col-acciones">
        <button type="button" class="btn-icon btn-meta-cat" title="Editar monto proyectado">◎</button>
        <button type="button" class="btn-icon btn-editar-cat" title="Renombrar categoría">✎</button>
      </td>
    `;
    tr.querySelector(".btn-meta-cat")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirPresupuestoCategoria(cat.nombre, cat.proyectado);
    });
    tr.querySelector(".btn-editar-cat")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirRenombrarCategoria(cat.nombre);
    });
    tbody.appendChild(tr);
  }
}

function renderCategorias() {
  renderCategoriasRealizadas();
  renderCategoriasProyectadas();
  rellenarSelectProyectadoCategorias();
}

function abrirPresupuestoCategoria(nombre, presupuestoActual) {
  const modal = document.getElementById("modal-meta-cat");
  const input = document.getElementById("input-meta-cat");
  const label = document.getElementById("modal-meta-cat-nombre");
  if (!modal || !input) return;
  state._presupuestoCatNombre = nombre;
  if (label) label.textContent = nombre;
  input.value = presupuestoActual > 0 ? String(presupuestoActual) : "";
  document.getElementById("meta-cat-status")?.classList.add("hidden");
  modal.showModal();
}

async function guardarPresupuestoCategoria(clear = false) {
  const nombre = state._presupuestoCatNombre;
  const input = document.getElementById("input-meta-cat");
  const status = document.getElementById("meta-cat-status");
  const monto = clear ? null : parseFloat(input?.value || "0");

  if (!nombre) return;
  if (!clear && (!monto || monto <= 0)) {
    if (status) {
      status.textContent = "Indica un monto mayor a 0 o usa Quitar proyectado.";
      status.classList.remove("hidden");
    }
    return;
  }

  try {
    const finDb = window.getFinDb();
    if (clear) {
      await finDb.clearMetaCategoria(state.periodo, nombre);
    } else {
      const metas = presupuestosCategoriasDesdeEstado(null);
      metas[nombre] = monto;
      await finDb.syncMetasCategorias(state.periodo, metas);
    }
    document.getElementById("modal-meta-cat")?.close();
  } catch (err) {
    if (status) {
      status.textContent = err.message || String(err);
      status.classList.remove("hidden");
    }
  }
}

async function guardarProyectadoRapido(e) {
  e.preventDefault();
  const nombre = document.getElementById("eg-proyectado-categoria")?.value?.trim();
  const monto = parseFloat(document.getElementById("eg-proyectado-monto")?.value || "0");
  if (!nombre || !monto || monto <= 0) {
    window.setIngestStatus?.("Elige una categoría y un monto proyectado válido.", "error");
    return;
  }
  try {
    const metas = proyectadosDesdeEstado(null);
    metas[nombre] = monto;
    await window.getFinDb().syncMetasCategorias(state.periodo, metas);
    document.getElementById("eg-proyectado-monto").value = "";
    window.setIngestStatus?.(`Proyectado de «${nombre}» guardado.`, "ok");
    setTimeout(() => window.setIngestStatus?.("", null), 3000);
  } catch (err) {
    window.setIngestStatus?.(err.message || String(err), "error");
  }
}

function abrirRenombrarCategoria(nombreActual) {
  const modal = document.getElementById("modal-renombrar");
  const input = document.getElementById("input-renombrar-nueva");
  const label = document.getElementById("modal-renombrar-actual");
  if (!modal || !input) return;

  state._renombrarVieja = nombreActual;
  if (label) label.textContent = nombreActual;
  input.value = nombreActual;
  input.focus();
  input.select();
  modal.showModal();
}

async function guardarRenombrarCategoria() {
  const vieja = state._renombrarVieja;
  const nueva = document.getElementById("input-renombrar-nueva")?.value.trim();
  const status = document.getElementById("renombrar-status");
  const btn = document.getElementById("btn-renombrar-guardar");

  if (!vieja || !nueva) {
    if (status) {
      status.textContent = "Escribe el nuevo nombre.";
      status.classList.remove("hidden");
    }
    return;
  }
  if (vieja === nueva) {
    document.getElementById("modal-renombrar")?.close();
    return;
  }

  if (btn) btn.disabled = true;
  if (status) {
    status.textContent = "Renombrando…";
    status.classList.remove("hidden");
  }

  try {
    await window.getFinDb().renameCategoria(vieja, nueva);
    document.getElementById("modal-renombrar")?.close();
    if (status) status.classList.add("hidden");
  } catch (err) {
    if (status) {
      status.textContent = err.message || String(err);
      status.classList.remove("hidden");
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function abrirDetalle(nombreCategoria) {
  const modal = document.getElementById("modal-detalle");
  const cat = state.categoriasDetalle.find((c) => c.nombre === nombreCategoria);
  const gastos = state.gastos.filter((g) => g.categoria === nombreCategoria);

  document.getElementById("modal-detalle-titulo").textContent = nombreCategoria;
  const proj = state.categoriasProyectadoDetalle.find((c) => c.nombre === nombreCategoria);
  const est = presupuestoEstado(proj?.uso_proyectado_pct);
  const presTxt =
    proj?.proyectado > 0
      ? ` · proyectado ${fmt(proj.proyectado, state.moneda)} (${est.texto} ejecutado)`
      : "";
  document.getElementById("modal-detalle-resumen").textContent = cat
    ? `${cat.movimientos} movimiento(s) · ${fmt(cat.total, state.moneda)}${presTxt}`
    : "";

  const tbody = document.querySelector("#tabla-gastos tbody");
  tbody.innerHTML = "";
  const vacio = document.getElementById("modal-detalle-vacio");

  if (!gastos.length) {
    vacio.classList.remove("hidden");
    modal.showModal();
    return;
  }

  vacio.classList.add("hidden");
  for (const g of gastos) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(g.fecha)}</td>
      <td>${esc(g.descripcion || "—")}</td>
      <td>${fmtGasto(g)}</td>
      <td class="col-acciones">
        <button type="button" class="btn-icon btn-editar-gasto" title="Editar o mover gasto">✎</button>
      </td>
    `;
    tr.querySelector(".btn-editar-gasto")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirEditarGasto(g);
    });
    tbody.appendChild(tr);
  }
  modal.showModal();
}

function categoriasParaSelect(categoriaActual) {
  const nombres = new Set(state.categorias || []);
  if (categoriaActual) nombres.add(categoriaActual);
  for (const c of state.categoriasDetalle || []) {
    if (c.nombre) nombres.add(c.nombre);
  }
  return [...nombres].filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
}

function rellenarSelectCategorias(select, categoriaActual) {
  if (!select) return;
  const cats = categoriasParaSelect(categoriaActual);
  select.innerHTML = cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if (categoriaActual && cats.includes(categoriaActual)) {
    select.value = categoriaActual;
  }
}

function actualizarBotonMover() {
  const btn = document.getElementById("btn-mover-gasto");
  const sel = document.getElementById("edit-gasto-mover-categoria");
  const actual = state._editGastoCategoria || "";
  if (!btn || !sel) return;
  btn.disabled = !sel.value || sel.value === actual;
}

function abrirEditarGasto(gasto) {
  const modal = document.getElementById("modal-editar-gasto");
  const selMover = document.getElementById("edit-gasto-mover-categoria");
  const labelActual = document.getElementById("edit-gasto-categoria-actual");
  if (!modal || !gasto?.id) return;

  state._editGastoId = gasto.id;
  state._editGastoCategoria = gasto.categoria || "Otros";
  document.getElementById("edit-gasto-id").value = gasto.id;
  document.getElementById("edit-gasto-fecha").value = gasto.fecha?.slice(0, 10) || "";
  document.getElementById("edit-gasto-monto").value = String(gasto.monto ?? "");
  document.getElementById("edit-gasto-moneda").value = gasto.moneda || "PEN";
  document.getElementById("edit-gasto-descripcion").value = gasto.descripcion || "";

  if (labelActual) labelActual.textContent = state._editGastoCategoria;
  rellenarSelectCategorias(selMover, state._editGastoCategoria);
  actualizarBotonMover();

  document.getElementById("editar-gasto-status")?.classList.add("hidden");
  modal.showModal();
}

async function guardarEditarGasto() {
  const id = state._editGastoId;
  const status = document.getElementById("editar-gasto-status");
  const btn = document.getElementById("btn-guardar-gasto");
  const payload = {
    fecha: document.getElementById("edit-gasto-fecha")?.value,
    monto: parseFloat(document.getElementById("edit-gasto-monto")?.value || "0"),
    moneda: document.getElementById("edit-gasto-moneda")?.value,
    descripcion: document.getElementById("edit-gasto-descripcion")?.value ?? "",
  };

  if (!id || !payload.fecha || !payload.monto) {
    if (status) {
      status.textContent = "Completa fecha y monto.";
      status.classList.remove("hidden");
    }
    return;
  }

  if (btn) btn.disabled = true;
  try {
    await window.getFinDb().updateGasto(id, payload);
    document.getElementById("modal-editar-gasto")?.close();
    document.getElementById("modal-detalle")?.close();
  } catch (err) {
    if (status) {
      status.textContent = err.message || String(err);
      status.classList.remove("hidden");
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function moverGastoCategoria() {
  const id = state._editGastoId;
  const destino = document.getElementById("edit-gasto-mover-categoria")?.value?.trim();
  const actual = state._editGastoCategoria || "";
  const status = document.getElementById("editar-gasto-status");
  const btn = document.getElementById("btn-mover-gasto");

  if (!id || !destino) return;
  if (destino === actual) {
    if (status) {
      status.textContent = "Elige una categoría distinta a la actual.";
      status.classList.remove("hidden");
    }
    return;
  }

  if (btn) btn.disabled = true;
  if (status) {
    status.textContent = `Moviendo a «${destino}»…`;
    status.classList.remove("hidden", "ingest-ok", "ingest-error");
    status.classList.add("ingest-pending");
  }

  try {
    await window.getFinDb().updateGasto(id, { categoria: destino });
    document.getElementById("modal-editar-gasto")?.close();
    document.getElementById("modal-detalle")?.close();
  } catch (err) {
    if (status) {
      status.textContent = err.message || String(err);
      status.classList.remove("ingest-pending", "ingest-ok");
      status.classList.add("ingest-error");
      status.classList.remove("hidden");
    }
  } finally {
    actualizarBotonMover();
  }
}

async function eliminarGasto() {
  const id = state._editGastoId;
  const status = document.getElementById("editar-gasto-status");
  if (!id) return;
  if (!window.confirm("¿Eliminar este gasto? No se puede deshacer.")) return;

  try {
    await window.getFinDb().deleteGasto(id);
    document.getElementById("modal-editar-gasto")?.close();
    document.getElementById("modal-detalle")?.close();
  } catch (err) {
    if (status) {
      status.textContent = err.message || String(err);
      status.classList.remove("hidden");
    }
    window.setIngestStatus?.(err.message || String(err), "error");
  }
}

function categoriasVaciasPersonalizadas() {
  return window.getFinDb().listCategoriasVacias();
}

function abrirModalCategoria(modo) {
  const modal = document.getElementById("modal-categoria");
  const campos = document.getElementById("form-campos");
  const titulo = document.getElementById("modal-cat-titulo");
  const status = document.getElementById("modal-cat-status");

  campos.innerHTML = "";
  state._catModo = modo;
  status?.classList.add("hidden");

  if (modo === "nueva") {
    titulo.textContent = "Nueva categoría";
    campos.innerHTML = `
      <label>Nombre
        <input type="text" id="input-cat-nombre" placeholder="Ej. Mascotas" maxlength="40" required />
      </label>
    `;
  } else if (modo === "quitar") {
    titulo.textContent = "Quitar categoría";
    const vacias = categoriasVaciasPersonalizadas();
    const opts = vacias.length
      ? vacias.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")
      : '<option value="">—</option>';
    campos.innerHTML = `
      <label>Categoría personalizada sin gastos
        <select id="input-cat-quitar">${opts}</select>
      </label>
      <p class="hint">Las categorías sugeridas no se pueden quitar.</p>
    `;
  }

  modal.showModal();
}

async function guardarModalCategoria(e) {
  e.preventDefault();
  const status = document.getElementById("modal-cat-status");
  const btn = document.getElementById("btn-cat-guardar");
  const finDb = window.getFinDb();

  if (btn) btn.disabled = true;
  if (status) status.classList.add("hidden");

  try {
    if (state._catModo === "nueva") {
      const n = document.getElementById("input-cat-nombre")?.value.trim();
      await finDb.addCategoria(n);
    } else if (state._catModo === "quitar") {
      const q = document.getElementById("input-cat-quitar")?.value?.trim();
      if (!q) throw new Error("No hay categorías vacías para quitar.");
      await finDb.removeCategoria(q);
    }
    document.getElementById("modal-categoria")?.close();
  } catch (err) {
    if (status) {
      status.textContent = err.message || String(err);
      status.classList.remove("hidden");
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderEgresos(data) {
  const vista = data.periodo_vista || {};
  state.moneda = data.moneda || "PEN";
  state.periodo = vista.periodo || "";
  state.categorias = data.categorias || [];
  state.gastos = vista.gastos || [];
  state.mesTotal = vista.total_gastos || 0;
  state.presupuestoTotal = vista.presupuesto_total ?? null;
  state.usoPresupuestoMes = vista.uso_presupuesto_pct ?? null;
  state.categoriasDetalle = vista.categorias_gasto_detalle || [];
  state.categoriasProyectadoDetalle = vista.categorias_gasto_proyectado_detalle || [];

  document.getElementById("actualizado").textContent = data.actualizado
    ? `Actualizado: ${new Date(data.actualizado).toLocaleString("es-PE")}`
    : "Sin datos aún";

  renderPresupuestoMes();
  renderCategorias();
  window.refreshIngestCategorias?.(state.categorias);
}

function renderDashboard(data) {
  lastDashboardData = data;
  renderEgresos(data);
  window.renderIngresos?.(data);
  window.renderEstatus?.(data);
}

function startFirestoreSync() {
  const finDb = window.getFinDb();
  if (window._unsubFinDb) window._unsubFinDb();
  window._unsubFinDb = finDb.subscribe(renderDashboard);
}

let dashboardReady = false;

function initDashboard() {
  if (dashboardReady) return;
  dashboardReady = true;

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-close");
      document.getElementById(id)?.close();
    });
  });

  document.getElementById("btn-cat-nueva")?.addEventListener("click", () => abrirModalCategoria("nueva"));
  document.getElementById("btn-cat-quitar")?.addEventListener("click", () => abrirModalCategoria("quitar"));
  document.getElementById("form-categoria")?.addEventListener("submit", guardarModalCategoria);

  document.getElementById("form-renombrar")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await guardarRenombrarCategoria();
  });

  document.getElementById("eg-form-proyectado-rapido")?.addEventListener("submit", guardarProyectadoRapido);

  document.getElementById("form-meta-cat")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await guardarPresupuestoCategoria(false);
  });

  document.getElementById("btn-quitar-meta-cat")?.addEventListener("click", () =>
    guardarPresupuestoCategoria(true)
  );

  document.getElementById("form-editar-gasto")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await guardarEditarGasto();
  });

  document.getElementById("edit-gasto-mover-categoria")?.addEventListener("change", actualizarBotonMover);
  document.getElementById("btn-mover-gasto")?.addEventListener("click", () => moverGastoCategoria());
  document.getElementById("btn-eliminar-gasto")?.addEventListener("click", () => eliminarGasto());

  window.addEventListener("fin-period-changed", () => {
    if (lastDashboardData) renderDashboard(lastDashboardData);
    else window.getFinDb()?.refreshNotify?.();
  });

  if (typeof window.initPeriodNav === "function") window.initPeriodNav();
  if (typeof window.initIngresosApp === "function") window.initIngresosApp();
  if (typeof window.initEstatus === "function") window.initEstatus();

  startFirestoreSync();
  if (typeof window.initIngestNlForm === "function") window.initIngestNlForm();
  if (typeof window.initIngestForm === "function") window.initIngestForm();
  if (typeof window.initIngestIngresosNlForm === "function") window.initIngestIngresosNlForm();
  if (typeof window.initIngestIngresosForm === "function") window.initIngestIngresosForm();
  if (typeof window.initExcelExport === "function") window.initExcelExport();
}

window.initDashboard = initDashboard;
window.fmtFin = fmt;
