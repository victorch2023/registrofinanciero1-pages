/**
 * Registro de ingresos → Firestore.
 */
function setIngestIngresoStatus(msg, type) {
  const el = document.getElementById("ing-ingest-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("hidden", "ingest-ok", "ingest-error", "ingest-pending");
  if (!msg) {
    el.classList.add("hidden");
    return;
  }
  if (type === "ok") el.classList.add("ingest-ok");
  else if (type === "error") el.classList.add("ingest-error");
  else el.classList.add("ingest-pending");
}

function todayIsoIngreso() {
  return window.finHoyLocal?.() || new Date().toISOString().slice(0, 10);
}

function refreshIngestIngresoCategorias(categorias) {
  const sel = document.getElementById("ing-ingest-categoria");
  if (!sel) return;
  const sugeridas = window.finCategoriasIngresoSugeridas || [];
  const cats = categorias?.length ? categorias : sugeridas;
  const prev = sel.value;
  sel.innerHTML = cats
    .map((c) => `<option value="${c.replace(/"/g, "&quot;")}">${c}</option>`)
    .join("");
  if (prev && cats.includes(prev)) sel.value = prev;
}

function initIngestIngresosNlForm() {
  const form = document.getElementById("ing-ingest-nl-form");
  const input = document.getElementById("ing-ingest-text");
  const btn = document.getElementById("ing-btn-ingest-nl");
  if (!form || !input || !btn) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) {
      setIngestIngresoStatus("Escribe un ingreso en lenguaje natural.", "error");
      return;
    }
    const finDb = window.getFinDb?.();
    if (!finDb) {
      setIngestIngresoStatus("Sesión no lista. Recarga la página e inicia sesión de nuevo.", "error");
      return;
    }
    const hoy = todayIsoIngreso();
    btn.disabled = true;
    input.disabled = true;
    setIngestIngresoStatus("Gemini interpretando…", "pending");
    try {
      const categorias = finDb.getCategoriasIngreso();
      const parsed = await window.GeminiParse.interpretarIngreso(text, categorias);
      const periodo = window.getSelectedPeriodo?.() || todayIsoIngreso().slice(0, 7);

      if (parsed.accion === "registrar_ingreso_esperado") {
        const esp = window.GeminiParse.ingresoEsperadoDesdeParsed(parsed);
        const pres = finDb.getPresupuestoIngresoPeriodo(periodo);
        const metas = { ...pres.categorias, [esp.categoria]: esp.monto };
        await finDb.syncPresupuestosIngresoCategorias(periodo, metas);
        setIngestIngresoStatus(
          `Esperado guardado en tabla de esperados: ${esp.categoria} · ${esp.monto} ${esp.moneda}`,
          "ok"
        );
      } else {
        const payload = window.GeminiParse.ingresoDesdeParsed(parsed, hoy);
        await finDb.addIngreso(payload);
        const periodoIngreso = payload.fecha.slice(0, 7);
        const resumen = `${payload.categoria} · ${payload.monto} ${payload.moneda}${
          payload.descripcion ? ` · ${payload.descripcion}` : ""
        }`;
        const avisoPeriodo =
          periodoIngreso !== periodo
            ? ` (fecha ${payload.fecha}; visible en ${periodoIngreso})`
            : "";
        setIngestIngresoStatus(`Percibido registrado: ${resumen}${avisoPeriodo}`, "ok");
      }
      input.value = "";
      setTimeout(() => setIngestIngresoStatus("", null), 3500);
    } catch (err) {
      setIngestIngresoStatus(err.message || String(err), "error");
    } finally {
      btn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  });
}

function initIngestIngresosForm() {
  const form = document.getElementById("ing-ingest-form");
  const fecha = document.getElementById("ing-ingest-fecha");
  const monto = document.getElementById("ing-ingest-monto");
  const btn = document.getElementById("ing-btn-ingest");
  if (!form || !fecha || !monto || !btn) return;

  if (!fecha.value) fecha.value = todayIsoIngreso();
  refreshIngestIngresoCategorias(window.finCategoriasIngresoSugeridas);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const finDb = window.getFinDb();
    const payload = {
      fecha: fecha.value,
      monto: parseFloat(monto.value || "0"),
      moneda: document.getElementById("ing-ingest-moneda")?.value || "PEN",
      categoria: document.getElementById("ing-ingest-categoria")?.value || "Otros ingresos",
      descripcion: document.getElementById("ing-ingest-descripcion")?.value?.trim() || "",
    };
    if (!payload.fecha || !payload.monto || payload.monto <= 0) {
      setIngestIngresoStatus("Indica fecha y monto válidos.", "error");
      return;
    }
    btn.disabled = true;
    setIngestIngresoStatus("Guardando…", "pending");
    try {
      await finDb.addIngreso(payload);
      monto.value = "";
      document.getElementById("ing-ingest-descripcion").value = "";
      fecha.value = todayIsoIngreso();
      setIngestIngresoStatus("Ingreso realizado registrado.", "ok");
      setTimeout(() => setIngestIngresoStatus("", null), 2500);
    } catch (err) {
      setIngestIngresoStatus(err.message || String(err), "error");
    } finally {
      btn.disabled = false;
      monto.focus();
    }
  });
}

window.initIngestIngresosNlForm = initIngestIngresosNlForm;
window.initIngestIngresosForm = initIngestIngresosForm;
window.refreshIngestIngresoCategorias = refreshIngestIngresoCategorias;
window.setIngestIngresoStatus = setIngestIngresoStatus;
