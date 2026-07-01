/**
 * Registro rápido de gastos → Firestore (sin GitHub Actions).
 */
function setIngestStatus(msg, type) {
  const el = document.getElementById("ingest-status");
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

function todayIso() {
  return window.finHoyLocal?.() || new Date().toISOString().slice(0, 10);
}

function refreshIngestCategorias(categorias) {
  const sel = document.getElementById("ingest-categoria");
  if (!sel) return;
  const sugeridas = window.finCategoriasSugeridas || [];
  const cats = categorias?.length ? categorias : sugeridas;
  const prev = sel.value;
  sel.innerHTML = cats
    .map((c) => `<option value="${c.replace(/"/g, "&quot;")}">${c}</option>`)
    .join("");
  if (prev && cats.includes(prev)) sel.value = prev;
}

function initIngestNlForm() {
  const form = document.getElementById("ingest-nl-form");
  const input = document.getElementById("ingest-text");
  const btn = document.getElementById("btn-ingest-nl");
  if (!form || !input || !btn) return;

  const EXPECTED_GEMINI_BUILD = "11";
  const APP_CACHE_VERSION = "18";

  const buildEl = document.getElementById("app-build");
  if (buildEl) {
    buildEl.hidden = false;
    buildEl.textContent = `Build v${APP_CACHE_VERSION}`;
  }

  if (window.GeminiParse?.build !== EXPECTED_GEMINI_BUILD) {
    setIngestStatus(
      "Versión antigua en caché. Cierra la pestaña, borra datos del sitio en Safari o abre: " +
        window.location.origin + window.location.pathname + `?v=${APP_CACHE_VERSION}`,
      "error"
    );
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) {
      setIngestStatus("Escribe un gasto en lenguaje natural.", "error");
      return;
    }

    const finDb = window.getFinDb?.();
    if (!finDb) {
      setIngestStatus("Sesión no lista. Recarga la página e inicia sesión de nuevo.", "error");
      return;
    }
    const hoy = todayIso();
    btn.disabled = true;
    input.disabled = true;
    setIngestStatus("Gemini interpretando…", "pending");

    try {
      const categorias = finDb.getCategorias();
      const parsed = await window.GeminiParse.interpretar(text, categorias);
      const periodo = window.getSelectedPeriodo?.() || todayIso().slice(0, 7);

      if (parsed.accion === "registrar_gasto_proyectado") {
        const proj = window.GeminiParse.gastoProyectadoDesdeParsed(parsed);
        const pres = finDb.getPresupuestoGastoPeriodo(periodo);
        const metas = { ...pres.categorias, [proj.categoria]: proj.monto };
        await finDb.syncMetasCategorias(periodo, metas);
        setIngestStatus(
          `Proyectado guardado: ${proj.categoria} · ${proj.monto} ${proj.moneda}`,
          "ok"
        );
      } else {
        const payload = window.GeminiParse.gastoDesdeParsed(parsed, hoy);
        await finDb.addGasto(payload);
        const periodoGasto = payload.fecha.slice(0, 7);
        const resumen = `${payload.categoria} · ${payload.monto} ${payload.moneda}${
          payload.descripcion ? ` · ${payload.descripcion}` : ""
        }`;
        const avisoPeriodo =
          periodoGasto !== periodo ? ` (fecha ${payload.fecha}; visible en ${periodoGasto})` : "";
        setIngestStatus(`Gasto realizado registrado: ${resumen}${avisoPeriodo}`, "ok");
      }
      input.value = "";
      setTimeout(() => setIngestStatus("", null), 3500);
    } catch (err) {
      setIngestStatus(err.message || String(err), "error");
    } finally {
      btn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  });
}

function initIngestForm() {
  const form = document.getElementById("ingest-form");
  const fecha = document.getElementById("ingest-fecha");
  const monto = document.getElementById("ingest-monto");
  const btn = document.getElementById("btn-ingest");
  if (!form || !fecha || !monto || !btn) return;

  if (!fecha.value) fecha.value = todayIso();
  refreshIngestCategorias(window.finCategoriasSugeridas);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const finDb = window.getFinDb();
    const payload = {
      fecha: fecha.value,
      monto: parseFloat(monto.value || "0"),
      moneda: document.getElementById("ingest-moneda")?.value || "PEN",
      categoria: document.getElementById("ingest-categoria")?.value || "Otros",
      descripcion: document.getElementById("ingest-descripcion")?.value?.trim() || "",
    };

    if (!payload.fecha || !payload.monto || payload.monto <= 0) {
      setIngestStatus("Indica fecha y monto válidos.", "error");
      return;
    }

    btn.disabled = true;
    setIngestStatus("Guardando…", "pending");
    try {
      await finDb.addGasto(payload);
      monto.value = "";
      document.getElementById("ingest-descripcion").value = "";
      fecha.value = todayIso();
      setIngestStatus("Gasto registrado.", "ok");
      setTimeout(() => setIngestStatus("", null), 2500);
    } catch (err) {
      setIngestStatus(err.message || String(err), "error");
    } finally {
      btn.disabled = false;
      monto.focus();
    }
  });
}

window.initIngestForm = initIngestForm;
window.initIngestNlForm = initIngestNlForm;
window.refreshIngestCategorias = refreshIngestCategorias;
window.setIngestStatus = setIngestStatus;
