/**
 * Sub-dashboard de Ingresos: realizados vs esperados, tablas y modales.
 */
(function () {
  const state = {
    moneda: "PEN",
    periodo: "",
    categorias: [],
    ingresos: [],
    categoriasDetalle: [],
    categoriasEsperadoDetalle: [],
    mesTotal: 0,
    esperadoTotal: null,
    usoEsperadoMes: null,
  };

  function fmt(n, moneda) {
    return window.fmtFin ? window.fmtFin(n, moneda) : String(n);
  }

  function fmtIngreso(g) {
    const moneda = g.moneda || "PEN";
    if (moneda === "PEN") return fmt(g.monto_pen ?? g.monto, "PEN");
    const pen = g.monto_pen != null ? ` (${fmt(g.monto_pen, "PEN")})` : "";
    return `${fmt(g.monto, moneda)}${pen}`;
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s ?? "";
    return d.innerHTML;
  }

  function percibidoEstado(usoPct) {
    if (usoPct == null || Number.isNaN(usoPct)) {
      return { clase: "meta-sin", texto: "—", hint: "Sin ingreso esperado" };
    }
    const pct = Math.round(usoPct * 10) / 10;
    if (pct > 100) {
      return { clase: "meta-ok", texto: `${pct}%`, hint: `Superado (+${(pct - 100).toFixed(0)}%)` };
    }
    return {
      clase: "meta-sin",
      texto: `${pct}%`,
      hint: `Faltan ${(100 - pct).toFixed(0)}% por percibir`,
    };
  }

  function renderPanelEsperado() {
    const ingEl = document.getElementById("ing-presupuesto-gastado");
    const periodoEl = document.getElementById("ing-presupuesto-periodo");
    const esperadoSumaEl = document.getElementById("ing-esperado-suma-tipo");
    const pctEl = document.getElementById("ing-presupuesto-pct-mes");
    const hintEl = document.getElementById("ing-presupuesto-hint-mes");
    const fill = document.getElementById("ing-progress-fill-mes");
    const track = document.getElementById("ing-progress-track-mes");
    const periodoLabel = window.finPeriodoLegible?.(state.periodo) || state.periodo;

    if (ingEl) ingEl.textContent = fmt(state.mesTotal, state.moneda);
    if (periodoEl) {
      const mov = `${state.ingresos.length} movimiento(s) percibidos`;
      periodoEl.textContent = state.periodo ? `${periodoLabel} · ${mov}` : mov;
    }
    if (esperadoSumaEl) {
      esperadoSumaEl.textContent =
        state.esperadoTotal > 0 ? fmt(state.esperadoTotal, state.moneda) : "Sin definir";
    }

    const est = percibidoEstado(state.usoEsperadoMes);
    if (pctEl) {
      pctEl.textContent = state.esperadoTotal > 0 ? est.texto : "—";
      pctEl.className = `presupuesto-pct presupuesto-valor ${est.clase}`;
    }
    if (hintEl) {
      hintEl.textContent =
        state.esperadoTotal > 0
          ? est.hint
          : "Añade montos esperados por tipo en la tabla de abajo";
    }
    if (fill && track) {
      if (state.esperadoTotal > 0 && state.usoEsperadoMes != null) {
        fill.style.width = `${Math.min(state.usoEsperadoMes, 100)}%`;
        fill.className = "progress-fill progress-fill-ingreso";
        track.classList.remove("hidden");
      } else {
        fill.style.width = "0%";
        track.classList.add("hidden");
      }
    }
  }

  function categoriaConIngresos(c) {
    return (Number(c.movimientos) || 0) > 0 && (Number(c.total) || 0) > 0;
  }

  function esperadosDesdeEstado(excluir) {
    const out = {};
    for (const c of state.categoriasEsperadoDetalle) {
      if (excluir && c.nombre === excluir) continue;
      if (c.esperado > 0) out[c.nombre] = c.esperado;
    }
    return out;
  }

  function rellenarSelectEsperadoCategorias() {
    const sel = document.getElementById("ing-esperado-categoria");
    if (!sel) return;
    const prev = sel.value;
    const cats = [...(state.categorias || [])].sort((a, b) => a.localeCompare(b, "es"));
    sel.innerHTML = cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    if (prev && cats.includes(prev)) sel.value = prev;
  }

  function renderCategoriasRealizadas() {
    const tbody = document.querySelector("#ing-tabla-realizados tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const filas = state.categoriasDetalle.filter(categoriaConIngresos);
    if (!filas.length) {
      tbody.innerHTML =
        "<tr><td colspan='4'>Sin ingresos realizados en este mes. Regístralos arriba.</td></tr>";
      return;
    }
    for (const cat of filas) {
      const tr = document.createElement("tr");
      tr.dataset.categoria = cat.nombre;
      tr.className = "fila-activa";
      tr.innerHTML = `
        <td><span class="cat-nombre">${esc(cat.nombre)}</span>${cat.sugerida ? '<span class="badge badge-ingreso">sugerido</span>' : ""}</td>
        <td>${fmt(cat.total, state.moneda)}</td>
        <td>${cat.movimientos}</td>
        <td class="col-acciones">
          <button type="button" class="btn-icon btn-editar-cat" title="Renombrar tipo">✎</button>
        </td>`;
      tr.querySelector(".btn-editar-cat")?.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirRenombrar(cat.nombre);
      });
      tr.addEventListener("click", () => abrirDetalle(cat.nombre));
      tbody.appendChild(tr);
    }
  }

  function renderCategoriasEsperadas() {
    const tbody = document.querySelector("#ing-tabla-esperados tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const filas = state.categoriasEsperadoDetalle.filter((c) => c.esperado > 0);
    if (!filas.length) {
      tbody.innerHTML =
        "<tr><td colspan='5'>Sin ingresos esperados por tipo. Usa el formulario de arriba para proyectar.</td></tr>";
      return;
    }
    for (const cat of filas) {
      const est = percibidoEstado(cat.uso_esperado_pct);
      const tr = document.createElement("tr");
      tr.dataset.categoria = cat.nombre;
      tr.className = "fila-activa fila-esperado";
      tr.innerHTML = `
        <td><span class="cat-nombre">${esc(cat.nombre)}</span>${cat.sugerida ? '<span class="badge badge-ingreso-esperado">sugerido</span>' : ""}</td>
        <td>${fmt(cat.esperado, state.moneda)}</td>
        <td>${cat.realizado > 0 ? fmt(cat.realizado, state.moneda) : "—"}</td>
        <td class="col-uso-meta ${est.clase}">${est.texto}</td>
        <td class="col-acciones">
          <button type="button" class="btn-icon btn-meta-cat" title="Editar monto esperado">◎</button>
          <button type="button" class="btn-icon btn-editar-cat" title="Renombrar tipo">✎</button>
        </td>`;
      tr.querySelector(".btn-meta-cat")?.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirEsperadoCategoria(cat.nombre, cat.esperado);
      });
      tr.querySelector(".btn-editar-cat")?.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirRenombrar(cat.nombre);
      });
      tbody.appendChild(tr);
    }
  }

  function abrirEsperadoCategoria(nombre, actual) {
    state._esperadoCat = nombre;
    document.getElementById("ing-modal-meta-cat-nombre").textContent = nombre;
    document.getElementById("ing-input-meta-cat").value = actual > 0 ? String(actual) : "";
    document.getElementById("ing-meta-cat-status")?.classList.add("hidden");
    document.getElementById("ing-modal-meta-cat")?.showModal();
  }

  async function guardarEsperadoCategoria(clear) {
    const nombre = state._esperadoCat;
    const input = document.getElementById("ing-input-meta-cat");
    const status = document.getElementById("ing-meta-cat-status");
    const monto = clear ? null : parseFloat(input?.value || "0");
    if (!nombre) return;
    if (!clear && (!monto || monto <= 0)) {
      if (status) {
        status.textContent = "Indica un monto mayor a 0 o usa Quitar esperado.";
        status.classList.remove("hidden");
      }
      return;
    }
    try {
      const db = window.getFinDb();
      if (clear) {
        await db.clearPresupuestoIngresoCategoria(state.periodo, nombre);
      } else {
        const metas = esperadosDesdeEstado(null);
        metas[nombre] = monto;
        await db.syncPresupuestosIngresoCategorias(state.periodo, metas);
      }
      document.getElementById("ing-modal-meta-cat")?.close();
    } catch (err) {
      if (status) {
        status.textContent = err.message || String(err);
        status.classList.remove("hidden");
      }
    }
  }

  async function guardarEsperadoRapido(e) {
    e.preventDefault();
    const nombre = document.getElementById("ing-esperado-categoria")?.value?.trim();
    const monto = parseFloat(document.getElementById("ing-esperado-monto")?.value || "0");
    if (!nombre || !monto || monto <= 0) {
      window.setIngestIngresoStatus?.("Elige un tipo y un monto esperado válido.", "error");
      return;
    }
    try {
      const metas = esperadosDesdeEstado(null);
      metas[nombre] = monto;
      await window.getFinDb().syncPresupuestosIngresoCategorias(state.periodo, metas);
      document.getElementById("ing-esperado-monto").value = "";
      window.setIngestIngresoStatus?.(`Esperado de «${nombre}» guardado.`, "ok");
      setTimeout(() => window.setIngestIngresoStatus?.("", null), 3000);
    } catch (err) {
      window.setIngestIngresoStatus?.(err.message || String(err), "error");
    }
  }

  function abrirRenombrar(vieja) {
    state._renombrarVieja = vieja;
    document.getElementById("ing-modal-renombrar-actual").textContent = vieja;
    const input = document.getElementById("ing-input-renombrar-nueva");
    input.value = vieja;
    input.focus();
    document.getElementById("ing-modal-renombrar")?.showModal();
  }

  async function guardarRenombrar() {
    const vieja = state._renombrarVieja;
    const nueva = document.getElementById("ing-input-renombrar-nueva")?.value.trim();
    const status = document.getElementById("ing-renombrar-status");
    if (!vieja || !nueva) return;
    if (vieja === nueva) {
      document.getElementById("ing-modal-renombrar")?.close();
      return;
    }
    try {
      await window.getFinDb().renameCategoriaIngreso(vieja, nueva);
      document.getElementById("ing-modal-renombrar")?.close();
    } catch (err) {
      if (status) {
        status.textContent = err.message || String(err);
        status.classList.remove("hidden");
      }
    }
  }

  function abrirDetalle(nombre) {
    const cat = state.categoriasDetalle.find((c) => c.nombre === nombre);
    const esperado = state.categoriasEsperadoDetalle.find((c) => c.nombre === nombre);
    const items = state.ingresos.filter((g) => g.categoria === nombre);
    document.getElementById("ing-modal-detalle-titulo").textContent = `${nombre} · realizado`;
    const est = percibidoEstado(esperado?.uso_esperado_pct);
    const txtEsperado =
      esperado?.esperado > 0
        ? ` · esperado ${fmt(esperado.esperado, state.moneda)} (${est.texto} percibido)`
        : "";
    document.getElementById("ing-modal-detalle-resumen").textContent = cat
      ? `${cat.movimientos} movimiento(s) · ${fmt(cat.total, state.moneda)}${txtEsperado}`
      : items.length
        ? `${items.length} movimiento(s)`
        : "";
    const tbody = document.querySelector("#ing-tabla-ingresos tbody");
    const vacio = document.getElementById("ing-modal-detalle-vacio");
    tbody.innerHTML = "";
    if (!items.length) {
      vacio.classList.remove("hidden");
      document.getElementById("ing-modal-detalle")?.showModal();
      return;
    }
    vacio.classList.add("hidden");
    for (const g of items) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(g.fecha)}</td>
        <td>${esc(g.descripcion || "—")}</td>
        <td>${fmtIngreso(g)}</td>
        <td class="col-acciones"><button type="button" class="btn-icon btn-editar-gasto" title="Editar">✎</button></td>`;
      tr.querySelector(".btn-editar-gasto")?.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirEditar(g);
      });
      tbody.appendChild(tr);
    }
    document.getElementById("ing-modal-detalle")?.showModal();
  }

  function catsSelect(actual) {
    const s = new Set(state.categorias);
    if (actual) s.add(actual);
    return [...s].sort((a, b) => a.localeCompare(b, "es"));
  }

  function abrirEditar(ingreso) {
    state._editId = ingreso.id;
    state._editCat = ingreso.categoria || "Otros ingresos";
    document.getElementById("ing-edit-ingreso-id").value = ingreso.id;
    document.getElementById("ing-edit-ingreso-fecha").value = ingreso.fecha?.slice(0, 10) || "";
    document.getElementById("ing-edit-ingreso-monto").value = String(ingreso.monto ?? "");
    document.getElementById("ing-edit-ingreso-moneda").value = ingreso.moneda || "PEN";
    document.getElementById("ing-edit-ingreso-descripcion").value = ingreso.descripcion || "";
    document.getElementById("ing-edit-ingreso-categoria-actual").textContent = state._editCat;
    const sel = document.getElementById("ing-edit-ingreso-mover-categoria");
    sel.innerHTML = catsSelect(state._editCat)
      .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
      .join("");
    sel.value = state._editCat;
    document.getElementById("ing-btn-mover-ingreso").disabled = true;
    document.getElementById("ing-modal-editar-ingreso")?.showModal();
  }

  async function guardarEditar() {
    const id = state._editId;
    const payload = {
      fecha: document.getElementById("ing-edit-ingreso-fecha")?.value,
      monto: parseFloat(document.getElementById("ing-edit-ingreso-monto")?.value || "0"),
      moneda: document.getElementById("ing-edit-ingreso-moneda")?.value,
      descripcion: document.getElementById("ing-edit-ingreso-descripcion")?.value ?? "",
    };
    if (!id || !payload.fecha || !payload.monto) return;
    await window.getFinDb().updateIngreso(id, payload);
    document.getElementById("ing-modal-editar-ingreso")?.close();
    document.getElementById("ing-modal-detalle")?.close();
  }

  async function moverIngreso() {
    const id = state._editId;
    const dest = document.getElementById("ing-edit-ingreso-mover-categoria")?.value;
    if (!id || !dest || dest === state._editCat) return;
    await window.getFinDb().updateIngreso(id, { categoria: dest });
    document.getElementById("ing-modal-editar-ingreso")?.close();
    document.getElementById("ing-modal-detalle")?.close();
  }

  async function eliminarIngreso() {
    const id = state._editId;
    if (!id || !window.confirm("¿Eliminar este ingreso realizado?")) return;
    await window.getFinDb().deleteIngreso(id);
    document.getElementById("ing-modal-editar-ingreso")?.close();
    document.getElementById("ing-modal-detalle")?.close();
  }

  function abrirModalCat(modo) {
    const campos = document.getElementById("ing-form-campos");
    const titulo = document.getElementById("ing-modal-cat-titulo");
    state._catModo = modo;
    if (modo === "nueva") {
      titulo.textContent = "Nuevo tipo de ingreso";
      campos.innerHTML =
        '<label>Nombre<input type="text" id="ing-input-cat-nombre" maxlength="40" required placeholder="Ej. Dividendos extra" /></label>';
    } else {
      titulo.textContent = "Quitar tipo vacío";
      const vacias = window.getFinDb().listCategoriasIngresoVacias();
      const opts = vacias.length
        ? vacias.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")
        : '<option value="">—</option>';
      campos.innerHTML = `<label>Tipo sin ingresos ni esperado<select id="ing-input-cat-quitar">${opts}</select></label>`;
    }
    document.getElementById("ing-modal-categoria")?.showModal();
  }

  async function guardarModalCat(e) {
    e.preventDefault();
    const status = document.getElementById("ing-modal-cat-status");
    try {
      const db = window.getFinDb();
      if (state._catModo === "nueva") {
        await db.addCategoriaIngreso(document.getElementById("ing-input-cat-nombre")?.value.trim());
      } else {
        const q = document.getElementById("ing-input-cat-quitar")?.value.trim();
        if (!q) throw new Error("No hay tipos vacíos.");
        await db.removeCategoriaIngreso(q);
      }
      document.getElementById("ing-modal-categoria")?.close();
    } catch (err) {
      if (status) {
        status.textContent = err.message || String(err);
        status.classList.remove("hidden");
      }
    }
  }

  function renderIngresos(data) {
    const vista = data.periodo_vista || {};
    state.moneda = data.moneda || "PEN";
    state.periodo = vista.periodo || "";
    state.categorias = data.categorias_ingreso || [];
    state.ingresos = vista.ingresos || [];
    state.mesTotal = vista.total_ingresos || 0;
    state.esperadoTotal = vista.ingreso_esperado_total ?? null;
    state.usoEsperadoMes = vista.uso_ingreso_esperado_pct ?? null;
    state.categoriasDetalle = vista.categorias_ingreso_detalle || [];
    state.categoriasEsperadoDetalle = vista.categorias_ingreso_esperado_detalle || [];
    renderPanelEsperado();
    renderCategoriasRealizadas();
    renderCategoriasEsperadas();
    rellenarSelectEsperadoCategorias();
    window.refreshIngestIngresoCategorias?.(state.categorias);
  }

  function initIngresosApp() {
    document.getElementById("ing-form-esperado-rapido")?.addEventListener("submit", guardarEsperadoRapido);
    document.getElementById("ing-form-meta-cat")?.addEventListener("submit", (e) => {
      e.preventDefault();
      guardarEsperadoCategoria(false);
    });
    document.getElementById("ing-btn-quitar-meta-cat")?.addEventListener("click", () =>
      guardarEsperadoCategoria(true)
    );
    document.getElementById("ing-form-renombrar")?.addEventListener("submit", (e) => {
      e.preventDefault();
      guardarRenombrar();
    });
    document.getElementById("ing-form-editar-ingreso")?.addEventListener("submit", (e) => {
      e.preventDefault();
      guardarEditar();
    });
    document.getElementById("ing-edit-ingreso-mover-categoria")?.addEventListener("change", () => {
      const sel = document.getElementById("ing-edit-ingreso-mover-categoria");
      document.getElementById("ing-btn-mover-ingreso").disabled =
        !sel?.value || sel.value === state._editCat;
    });
    document.getElementById("ing-btn-mover-ingreso")?.addEventListener("click", moverIngreso);
    document.getElementById("ing-btn-eliminar-ingreso")?.addEventListener("click", eliminarIngreso);
    document.getElementById("ing-btn-cat-nueva")?.addEventListener("click", () => abrirModalCat("nueva"));
    document.getElementById("ing-btn-cat-quitar")?.addEventListener("click", () => abrirModalCat("quitar"));
    document.getElementById("ing-form-categoria")?.addEventListener("submit", guardarModalCat);
  }

  window.renderIngresos = renderIngresos;
  window.initIngresosApp = initIngresosApp;
})();
