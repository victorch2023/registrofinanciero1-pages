/**
 * Interpretación NL vía Cloud Functions (Gemini en servidor, sin API key en el cliente).
 */
(function () {
  const GEMINI_BUILD = "11";

  function getFunctionsInstance() {
    if (typeof firebase === "undefined" || !firebase.app) {
      throw new Error("Firebase no está cargado. Recarga la página.");
    }
    const region = window._firebaseConfig?.functionsRegion || "us-central1";
    if (!window._firebaseFunctions) {
      window._firebaseFunctions = firebase.app().functions(region);
    }
    return window._firebaseFunctions;
  }

  function callableErrorMessage(err) {
    const code = err?.code || "";
    if (code === "functions/unauthenticated") {
      return "Inicia sesión para usar lenguaje natural.";
    }
    if (code === "functions/unavailable" || code === "functions/internal") {
      return (
        err.message ||
        "El servicio de interpretación no está disponible. ¿Desplegaste las Cloud Functions?"
      );
    }
    return err?.message || String(err);
  }

  async function loadConfig() {
    try {
      const res = await fetch("data/firebase.json?" + Date.now());
      if (!res.ok) return {};
      return await res.json();
    } catch {
      return {};
    }
  }

  async function callInterpretar(nombreFn, mensaje, categorias, monedaDefault) {
    const user = firebase.auth?.().currentUser;
    if (!user) {
      throw new Error("Inicia sesión para usar lenguaje natural.");
    }
    const cfg = await loadConfig();
    const fn = getFunctionsInstance().httpsCallable(nombreFn);
    try {
      const res = await fn({
        mensaje,
        categorias,
        monedaDefault,
        geminiModel: cfg.geminiModel || null,
      });
      return res.data;
    } catch (err) {
      throw new Error(callableErrorMessage(err));
    }
  }

  async function interpretar(mensaje, categorias, monedaDefault = "PEN") {
    return callInterpretar("interpretarGasto", mensaje, categorias, monedaDefault);
  }

  async function interpretarIngreso(mensaje, categorias, monedaDefault = "PEN") {
    return callInterpretar("interpretarIngreso", mensaje, categorias, monedaDefault);
  }

  function gastoProyectadoDesdeParsed(parsed) {
    if (parsed.accion !== "registrar_gasto_proyectado") {
      throw new Error(
        parsed.mensaje_usuario ||
          "No entendí si es gasto realizado o proyectado. Ej.: «el viernes pagaré 800 de alquiler»."
      );
    }
    const monto = Number(parsed.monto);
    if (!monto || monto <= 0) {
      throw new Error("No pude extraer un monto válido del mensaje.");
    }
    return {
      monto,
      moneda: String(parsed.moneda || "PEN").toUpperCase(),
      categoria: String(parsed.categoria || "Otros").trim() || "Otros",
    };
  }

  function gastoDesdeParsed(parsed, hoy) {
    if (parsed.accion === "registrar_gasto_proyectado") {
      throw new Error(
        "Ese mensaje parece un gasto proyectado (aún no realizado). Si ya pagaste, escribe por ejemplo: «ayer pagué 800 de alquiler»."
      );
    }
    if (parsed.accion !== "registrar_gasto") {
      if (parsed.accion === "reporte_pdf" || parsed.accion === "resumen_texto") {
        throw new Error(
          "Los reportes PDF no están disponibles en el dashboard web. Usa Exportar Excel o el resumen en pantalla."
        );
      }
      throw new Error(
        parsed.mensaje_usuario ||
          "No entendí el mensaje. Ej.: «ayer cené en Wong 45 soles comida»."
      );
    }

    const monto = Number(parsed.monto);
    if (!monto || monto <= 0) {
      throw new Error("No pude extraer un monto válido del mensaje.");
    }

    return {
      fecha: String(parsed.fecha || hoy).slice(0, 10),
      monto,
      moneda: String(parsed.moneda || "PEN").toUpperCase(),
      categoria: String(parsed.categoria || "Otros").trim() || "Otros",
      descripcion: String(parsed.descripcion || "").trim(),
    };
  }

  function ingresoEsperadoDesdeParsed(parsed) {
    if (parsed.accion !== "registrar_ingreso_esperado") {
      throw new Error(
        parsed.mensaje_usuario ||
          "No entendí si es ingreso realizado o esperado. Ej.: «me van a pagar 600 de regalías a fin de mes»."
      );
    }
    const monto = Number(parsed.monto);
    if (!monto || monto <= 0) {
      throw new Error("No pude extraer un monto válido del mensaje.");
    }
    return {
      monto,
      moneda: String(parsed.moneda || "PEN").toUpperCase(),
      categoria: String(parsed.categoria || "Otros ingresos").trim() || "Otros ingresos",
    };
  }

  function ingresoDesdeParsed(parsed, hoy) {
    if (parsed.accion === "registrar_ingreso_esperado") {
      throw new Error(
        "Ese mensaje parece un ingreso esperado (aún no percibido). Si ya cobraste, escribe por ejemplo: «me pagaron 3500 de sueldo hoy»."
      );
    }
    if (parsed.accion !== "registrar_ingreso") {
      throw new Error(
        parsed.mensaje_usuario ||
          "No entendí el mensaje. Ej.: «me pagaron 3500 de sueldo hoy»."
      );
    }
    const monto = Number(parsed.monto);
    if (!monto || monto <= 0) {
      throw new Error("No pude extraer un monto válido del mensaje.");
    }
    return {
      fecha: String(parsed.fecha || hoy).slice(0, 10),
      monto,
      moneda: String(parsed.moneda || "PEN").toUpperCase(),
      categoria: String(parsed.categoria || "Otros ingresos").trim() || "Otros ingresos",
      descripcion: String(parsed.descripcion || "").trim(),
    };
  }

  window.GeminiParse = {
    interpretar,
    interpretarIngreso,
    gastoDesdeParsed,
    gastoProyectadoDesdeParsed,
    ingresoDesdeParsed,
    ingresoEsperadoDesdeParsed,
    build: GEMINI_BUILD,
  };
})();
