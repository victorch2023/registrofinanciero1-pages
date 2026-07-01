/**
 * Capa Firestore: lectura en tiempo real y escritura directa (sin GitHub Actions).
 */
(function () {
  const CATEGORIAS_SUGERIDAS = [
    "Comida",
    "Transporte",
    "Vivienda",
    "Servicios",
    "Salud",
    "Entretenimiento",
    "Suscripciones",
    "Educación",
    "Ropa",
    "Mascotas",
    "Hogar",
    "Personal",
    "Regalos",
    "Otros",
  ];

  const CATEGORIAS_INGRESO_SUGERIDAS = [
    "Sueldo",
    "Honorarios",
    "Consultoría",
    "Alquileres",
    "Regalías",
    "Dividendos",
    "Ventas",
    "Bonos",
    "Freelance",
    "Reembolsos",
    "Otros ingresos",
  ];

  const CONFIG_DOC = "main";

  function periodoMes(d) {
    const dt = d || new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function periodoLabel(offset) {
    const dt = new Date();
    dt.setDate(1);
    dt.setMonth(dt.getMonth() + offset);
    return periodoMes(dt);
  }

  function hoyLocalIso(d) {
    const dt = d || new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseFecha(fecha) {
    return String(fecha || "").slice(0, 10);
  }

  function movimientoEnPeriodo(fecha, periodo) {
    return parseFecha(fecha).startsWith(periodo);
  }

  function filtrarPorPeriodo(lista, periodo) {
    return lista.filter((g) => movimientoEnPeriodo(g.fecha, periodo));
  }

  function totalMovimientos(lista) {
    return lista.reduce((acc, g) => acc + (Number(g.monto_pen ?? g.monto) || 0), 0);
  }

  function resumenPorCategoria(movimientos, defaultCat) {
    const fallback = defaultCat || "Otros";
    const out = {};
    for (const g of movimientos) {
      const cat = g.categoria || fallback;
      out[cat] = (out[cat] || 0) + (Number(g.monto_pen ?? g.monto) || 0);
    }
    return out;
  }

  function unionCategorias(sugeridas, custom) {
    const out = [];
    const seen = new Set();
    for (const nombre of [...sugeridas, ...(custom || [])]) {
      const k = String(nombre || "").trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }

  function unionCategoriasGasto(custom) {
    return unionCategorias(CATEGORIAS_SUGERIDAS, custom);
  }

  function unionCategoriasIngreso(custom) {
    return unionCategorias(CATEGORIAS_INGRESO_SUGERIDAS, custom);
  }

  function categoriaTieneMovimientos(mov, total) {
    return (Number(mov) || 0) > 0 && (Number(total) || 0) > 0;
  }

  function ordenarMovimientos(lista) {
    return [...lista].sort((a, b) => {
      const fa = parseFecha(a.fecha);
      const fb = parseFecha(b.fecha);
      if (fa !== fb) return fb.localeCompare(fa);
      return String(b.creado || "").localeCompare(String(a.creado || ""));
    });
  }

  function buildCategoriasDetalle(movimientos, presCats, sugeridasSet, defaultCat) {
    const porMonto = resumenPorCategoria(movimientos, defaultCat);
    const conteo = {};
    for (const g of movimientos) {
      const cat = g.categoria || defaultCat;
      conteo[cat] = (conteo[cat] || 0) + 1;
    }
    const total = totalMovimientos(movimientos) || 0;
    const nombres = Object.keys(conteo)
      .filter((cat) => categoriaTieneMovimientos(conteo[cat], porMonto[cat] || 0))
      .sort((a, b) => (porMonto[b] || 0) - (porMonto[a] || 0) || a.localeCompare(b, "es"));

    return nombres.map((nombre) => {
      const monto = Math.round((porMonto[nombre] || 0) * 100) / 100;
      const mov = conteo[nombre] || 0;
      const pres = presCats?.[nombre];
      return {
        nombre,
        total: monto,
        movimientos: mov,
        porcentaje: total && monto ? Math.round((monto / total) * 1000) / 10 : 0,
        sugerida: sugeridasSet.has(nombre),
        presupuesto: pres > 0 ? pres : null,
        uso_meta_pct: pres > 0 ? Math.round((monto / pres) * 1000) / 10 : null,
      };
    });
  }

  function buildCategoriasDetalleGasto(gastosMes, metaCats) {
    return buildCategoriasDetalle(
      gastosMes,
      metaCats,
      new Set(CATEGORIAS_SUGERIDAS),
      "Otros"
    );
  }

  function buildCategoriasDetalleIngreso(ingresosMes, esperadoCats) {
    return buildCategoriasDetalle(
      ingresosMes,
      esperadoCats,
      new Set(CATEGORIAS_INGRESO_SUGERIDAS),
      "Otros ingresos"
    );
  }

  function sumPresupuestoCategorias(categorias) {
    let sum = 0;
    for (const val of Object.values(categorias || {})) {
      const n = Number(val);
      if (n > 0) sum += n;
    }
    return sum > 0 ? Math.round(sum * 100) / 100 : null;
  }

  function ingresoEsperadoTotalDesdePresupuesto(pres) {
    const porCategorias = sumPresupuestoCategorias(pres?.categorias);
    if (porCategorias != null) return porCategorias;
    return pres?.total > 0 ? pres.total : null;
  }

  function gastoProyectadoTotalDesdePresupuesto(pres) {
    return ingresoEsperadoTotalDesdePresupuesto(pres);
  }

  function buildCategoriasProyectadoGasto(gastosMes, proyectadoCats) {
    const porRealizado = resumenPorCategoria(gastosMes, "Otros");
    const sugeridas = new Set(CATEGORIAS_SUGERIDAS);
    const cats = proyectadoCats || {};
    const nombres = Object.keys(cats)
      .filter((nombre) => Number(cats[nombre]) > 0)
      .sort(
        (a, b) =>
          (Number(cats[b]) || 0) - (Number(cats[a]) || 0) || a.localeCompare(b, "es")
      );

    return nombres.map((nombre) => {
      const proyectado = Math.round(Number(cats[nombre]) * 100) / 100;
      const realizado = Math.round((porRealizado[nombre] || 0) * 100) / 100;
      return {
        nombre,
        proyectado,
        realizado,
        sugerida: sugeridas.has(nombre),
        uso_proyectado_pct:
          proyectado > 0 ? Math.round((realizado / proyectado) * 1000) / 10 : null,
      };
    });
  }

  function buildCategoriasEsperadoIngreso(ingresosMes, esperadoCats) {
    const porRealizado = resumenPorCategoria(ingresosMes, "Otros ingresos");
    const sugeridas = new Set(CATEGORIAS_INGRESO_SUGERIDAS);
    const cats = esperadoCats || {};
    const nombres = Object.keys(cats)
      .filter((nombre) => Number(cats[nombre]) > 0)
      .sort(
        (a, b) =>
          (Number(cats[b]) || 0) - (Number(cats[a]) || 0) || a.localeCompare(b, "es")
      );

    return nombres.map((nombre) => {
      const esperado = Math.round(Number(cats[nombre]) * 100) / 100;
      const realizado = Math.round((porRealizado[nombre] || 0) * 100) / 100;
      return {
        nombre,
        esperado,
        realizado,
        sugerida: sugeridas.has(nombre),
        uso_esperado_pct:
          esperado > 0 ? Math.round((realizado / esperado) * 1000) / 10 : null,
      };
    });
  }

  function buildPeriodView(gastos, ingresos, presGastoMap, presIngresoMap, config, periodo) {
    const presGasto = presGastoMap[periodo] || {};
    const presIngreso = presIngresoMap[periodo] || {};
    const gastosMes = ordenarMovimientos(filtrarPorPeriodo(gastos, periodo));
    const ingresosMes = ordenarMovimientos(filtrarPorPeriodo(ingresos, periodo));
    const totalGastosMes = totalMovimientos(gastosMes);
    const totalIngresosMes = totalMovimientos(ingresosMes);
    const presupuestoTotal = gastoProyectadoTotalDesdePresupuesto(presGasto);
    const ingresoEsperadoTotal = ingresoEsperadoTotalDesdePresupuesto(presIngreso);
    const balance = Math.round((totalIngresosMes - totalGastosMes) * 100) / 100;

    return {
      periodo,
      gastos: gastosMes,
      ingresos: ingresosMes,
      total_gastos: totalGastosMes,
      total_ingresos: totalIngresosMes,
      movimientos_gastos: gastosMes.length,
      movimientos_ingresos: ingresosMes.length,
      balance,
      ahorro: Math.max(0, balance),
      deficit: balance < 0 ? Math.abs(balance) : 0,
      presupuesto_total: presupuestoTotal,
      uso_presupuesto_pct:
        presupuestoTotal > 0
          ? Math.round((totalGastosMes / presupuestoTotal) * 1000) / 10
          : null,
      ingreso_esperado_total: ingresoEsperadoTotal,
      uso_ingreso_esperado_pct:
        ingresoEsperadoTotal > 0
          ? Math.round((totalIngresosMes / ingresoEsperadoTotal) * 1000) / 10
          : null,
      categorias_gasto_detalle: buildCategoriasDetalleGasto(gastosMes, presGasto.categorias || {}),
      categorias_gasto_proyectado_detalle: buildCategoriasProyectadoGasto(
        gastosMes,
        presGasto.categorias || {}
      ),
      categorias_ingreso_detalle: buildCategoriasDetalleIngreso(
        ingresosMes,
        presIngreso.categorias || {}
      ),
      categorias_ingreso_esperado_detalle: buildCategoriasEsperadoIngreso(
        ingresosMes,
        presIngreso.categorias || {}
      ),
      por_categoria_gastos: resumenPorCategoria(gastosMes, "Otros"),
      por_categoria_ingresos: resumenPorCategoria(ingresosMes, "Otros ingresos"),
    };
  }

  function buildSummary(gastos, presupuestosMap, config) {
    const moneda = config?.moneda_default || "PEN";
    const categorias = unionCategoriasGasto(config?.categorias || []);
    const periodoActual = periodoMes();
    const periodoAnterior = periodoLabel(-1);
    const mesActual = filtrarPorPeriodo(gastos, periodoActual);
    const mesAnterior = filtrarPorPeriodo(gastos, periodoAnterior);
    const pres = presupuestosMap[periodoActual] || {};
    const metaTotal = gastoProyectadoTotalDesdePresupuesto(pres);
    const totalActual = totalMovimientos(mesActual);
    const gastosMes = ordenarMovimientos(mesActual);

    return {
      actualizado: new Date().toISOString(),
      moneda,
      telegram_bot: null,
      categorias,
      mes_actual: {
        periodo: periodoActual,
        total: totalActual,
        movimientos: mesActual.length,
        presupuesto_total: metaTotal,
        uso_meta_pct:
          metaTotal > 0 ? Math.round((totalActual / metaTotal) * 1000) / 10 : null,
        por_categoria: resumenPorCategoria(mesActual, "Otros"),
        categorias_detalle: buildCategoriasDetalleGasto(mesActual, pres.categorias || {}),
        gastos: gastosMes,
      },
      mes_anterior: {
        periodo: periodoAnterior,
        total: totalMovimientos(mesAnterior),
        movimientos: mesAnterior.length,
        por_categoria: resumenPorCategoria(mesAnterior, "Otros"),
      },
      historial_total: totalMovimientos(gastos),
      total_movimientos: gastos.length,
    };
  }

  function buildDashboardPayload(cache, periodo) {
    const p = periodo || periodoMes();
    const summary = buildSummary(cache.gastos, cache.presupuestos, cache.config);
    return {
      ...summary,
      categorias_ingreso: unionCategoriasIngreso(cache.config?.categorias_ingreso || []),
      periodo_vista: buildPeriodView(
        cache.gastos,
        cache.ingresos,
        cache.presupuestos,
        cache.presupuestos_ingreso,
        cache.config,
        p
      ),
      historial: {
        total_gastos: totalMovimientos(cache.gastos),
        total_ingresos: totalMovimientos(cache.ingresos),
        movimientos_gastos: cache.gastos.length,
        movimientos_ingresos: cache.ingresos.length,
      },
    };
  }

  function aggregateMetasPorPeriodos(presupuestosMap, gastos) {
    const periodos = new Set();
    for (const g of gastos) {
      const f = parseFecha(g.fecha);
      if (f.length >= 7) periodos.add(f.slice(0, 7));
    }
    const categorias = {};
    let total = 0;
    for (const p of periodos) {
      const pres = presupuestosMap[p] || {};
      if (pres.total > 0) total += pres.total;
      for (const [cat, val] of Object.entries(pres.categorias || {})) {
        const n = Number(val);
        if (n > 0) categorias[cat] = (categorias[cat] || 0) + n;
      }
    }
    return { categorias, total: total > 0 ? total : null };
  }

  function buildExportView(gastos, presupuestosMap, config, filter) {
    const moneda = config?.moneda_default || "PEN";
    let periodo = filter;
    if (filter === "actual") periodo = periodoMes();
    else if (filter === "anterior") periodo = periodoLabel(-1);

    let gastosFiltrados;
    let pres;
    if (filter === "todo") {
      gastosFiltrados = [...gastos];
      pres = aggregateMetasPorPeriodos(presupuestosMap, gastosFiltrados);
    } else {
      gastosFiltrados = filtrarPorPeriodo(gastos, periodo);
      pres = presupuestosMap[periodo] || {};
    }

    const metaTotal = gastoProyectadoTotalDesdePresupuesto(pres);
    const total = totalMovimientos(gastosFiltrados);

    return {
      filter,
      periodoLabel: filter === "todo" ? "Todo el historial" : periodo,
      periodo: filter === "todo" ? null : periodo,
      moneda,
      gastos: gastosFiltrados,
      total,
      movimientos: gastosFiltrados.length,
      presupuesto_total: metaTotal,
      uso_meta_pct:
        metaTotal > 0 ? Math.round((total / metaTotal) * 1000) / 10 : null,
      categorias_detalle: buildCategoriasDetalleGasto(gastosFiltrados, pres.categorias || {}),
      metas_agregadas: filter === "todo",
      historial_total: totalMovimientos(gastos),
      total_movimientos_historial: gastos.length,
    };
  }

  function listPeriodosConGastos(gastos) {
    const set = new Set();
    for (const g of gastos) {
      const f = parseFecha(g.fecha);
      if (f.length >= 7) set.add(f.slice(0, 7));
    }
    const actual = periodoMes();
    const anterior = periodoLabel(-1);
    return [...set]
      .filter((p) => p !== actual && p !== anterior)
      .sort()
      .reverse();
  }

  function listPeriodosConMovimientos(gastos, ingresos) {
    const set = new Set();
    for (const g of [...gastos, ...ingresos]) {
      const f = parseFecha(g.fecha);
      if (f.length >= 7) set.add(f.slice(0, 7));
    }
    const actual = periodoMes();
    const anterior = periodoLabel(-1);
    return [...set]
      .filter((p) => p !== actual && p !== anterior)
      .sort()
      .reverse();
  }

  function buildExportViewIngresos(ingresos, presupuestosIngresoMap, config, filter) {
    const moneda = config?.moneda_default || "PEN";
    let periodo = filter;
    if (filter === "actual") periodo = periodoMes();
    else if (filter === "anterior") periodo = periodoLabel(-1);

    let ingresosFiltrados;
    let pres;
    if (filter === "todo") {
      ingresosFiltrados = [...ingresos];
      pres = aggregateMetasPorPeriodos(presupuestosIngresoMap, ingresosFiltrados);
    } else {
      ingresosFiltrados = filtrarPorPeriodo(ingresos, periodo);
      pres = presupuestosIngresoMap[periodo] || {};
    }

    const esperadoTotal = ingresoEsperadoTotalDesdePresupuesto(pres);
    const total = totalMovimientos(ingresosFiltrados);

    return {
      filter,
      periodoLabel: filter === "todo" ? "Todo el historial" : periodo,
      periodo: filter === "todo" ? null : periodo,
      moneda,
      ingresos: ingresosFiltrados,
      total,
      movimientos: ingresosFiltrados.length,
      ingreso_esperado_total: esperadoTotal,
      uso_esperado_pct:
        esperadoTotal > 0 ? Math.round((total / esperadoTotal) * 1000) / 10 : null,
      categorias_detalle: buildCategoriasDetalleIngreso(
        ingresosFiltrados,
        pres.categorias || {}
      ),
      esperados_agregados: filter === "todo",
      historial_total: totalMovimientos(ingresos),
      total_movimientos_historial: ingresos.length,
    };
  }

  function newMovimientoId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID().slice(0, 8);
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function FinDatabase(firebase) {
    this.db = firebase.firestore();
    this._unsubs = [];
    this._cache = {
      gastos: [],
      ingresos: [],
      presupuestos: {},
      presupuestos_ingreso: {},
      config: { moneda_default: "PEN", categorias: [], categorias_ingreso: [] },
    };
    this._listeners = new Set();
  }

  FinDatabase.prototype.ref = function (collection, id) {
    return this.db.collection(collection).doc(id);
  };

  FinDatabase.prototype.configRef = function () {
    return this.db.collection("config").doc(CONFIG_DOC);
  };

  FinDatabase.prototype._getPeriodo = function () {
    return typeof window.getSelectedPeriodo === "function"
      ? window.getSelectedPeriodo()
      : periodoMes();
  };

  FinDatabase.prototype._notify = function () {
    const payload = buildDashboardPayload(this._cache, this._getPeriodo());
    for (const fn of this._listeners) {
      try {
        fn(payload);
      } catch (e) {
        console.error(e);
      }
    }
  };

  FinDatabase.prototype.subscribe = function (callback) {
    this._listeners.add(callback);
    callback(buildDashboardPayload(this._cache, this._getPeriodo()));
    return () => this._listeners.delete(callback);
  };

  FinDatabase.prototype.refreshNotify = function () {
    this._notify();
  };

  FinDatabase.prototype.startSync = function () {
    this.stopSync();
    this._unsubs.push(
      this.db.collection("gastos").onSnapshot(
        (snap) => {
          this._cache.gastos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          this._notify();
        },
        (err) => console.error("gastos listener", err)
      )
    );
    this._unsubs.push(
      this.db.collection("ingresos").onSnapshot(
        (snap) => {
          this._cache.ingresos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          this._notify();
        },
        (err) => console.error("ingresos listener", err)
      )
    );
    this._unsubs.push(
      this.db.collection("presupuestos").onSnapshot(
        (snap) => {
          const map = {};
          snap.docs.forEach((d) => {
            map[d.id] = d.data();
          });
          this._cache.presupuestos = map;
          this._notify();
        },
        (err) => console.error("presupuestos listener", err)
      )
    );
    this._unsubs.push(
      this.db.collection("presupuestos_ingreso").onSnapshot(
        (snap) => {
          const map = {};
          snap.docs.forEach((d) => {
            map[d.id] = d.data();
          });
          this._cache.presupuestos_ingreso = map;
          this._notify();
        },
        (err) => console.error("presupuestos_ingreso listener", err)
      )
    );
    this._unsubs.push(
      this.configRef().onSnapshot(
        (doc) => {
          this._cache.config = doc.exists
            ? doc.data()
            : { moneda_default: "PEN", categorias: [], categorias_ingreso: [] };
          this._notify();
        },
        (err) => console.error("config listener", err)
      )
    );
  };

  FinDatabase.prototype.stopSync = function () {
    for (const u of this._unsubs) u();
    this._unsubs = [];
  };

  FinDatabase.prototype._ensureConfig = async function () {
    const ref = this.configRef();
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({
        moneda_default: "PEN",
        categorias: [],
        categorias_ingreso: [],
        version: 3,
      });
    }
  };

  FinDatabase.prototype._addMovimiento = async function (collection, payload, opts) {
    await this._ensureConfig();
    const id = newMovimientoId();
    const moneda = (payload.moneda || "PEN").toUpperCase();
    const monto = Math.round(Number(payload.monto) * 100) / 100;
    const item = {
      id,
      fecha: parseFecha(payload.fecha || new Date().toISOString()),
      monto,
      moneda,
      categoria: String(payload.categoria || opts.defaultCat).trim() || opts.defaultCat,
      descripcion: String(payload.descripcion || "").trim(),
      creado: new Date().toISOString(),
      monto_pen: moneda === "PEN" ? monto : payload.monto_pen ?? null,
    };
    const config = this._cache.config;
    const customKey = opts.configKey;
    const unionFn = opts.unionFn;
    const cats = unionFn(config[customKey] || []);
    if (!cats.includes(item.categoria)) {
      await this.configRef().set(
        { [customKey]: [...(config[customKey] || []), item.categoria] },
        { merge: true }
      );
    }
    await this.db.collection(collection).doc(id).set(item);
    return item;
  };

  FinDatabase.prototype.addGasto = async function (payload) {
    return this._addMovimiento("gastos", payload, {
      defaultCat: "Otros",
      configKey: "categorias",
      unionFn: unionCategoriasGasto,
    });
  };

  FinDatabase.prototype.addIngreso = async function (payload) {
    return this._addMovimiento("ingresos", payload, {
      defaultCat: "Otros ingresos",
      configKey: "categorias_ingreso",
      unionFn: unionCategoriasIngreso,
    });
  };

  FinDatabase.prototype._updateMovimiento = async function (collection, movId, patch, opts) {
    const ref = this.db.collection(collection).doc(movId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error(`No se encontró el registro «${movId}».`);
    const data = { ...doc.data(), ...patch };
    if (patch.monto != null) {
      data.monto = Math.round(Number(patch.monto) * 100) / 100;
    }
    if (patch.fecha != null) data.fecha = parseFecha(patch.fecha);
    if (patch.categoria != null) {
      data.categoria = String(patch.categoria).trim() || opts.defaultCat;
    }
    if (patch.descripcion != null) data.descripcion = String(patch.descripcion).trim();
    if (patch.moneda != null) data.moneda = String(patch.moneda).toUpperCase();
    if (data.moneda === "PEN") {
      data.monto_pen = data.monto;
    }
    const config = this._cache.config;
    if (data.categoria && !(config[opts.configKey] || []).includes(data.categoria)) {
      const sugeridas = new Set(opts.sugeridas);
      if (!sugeridas.has(data.categoria)) {
        await this.configRef().set(
          { [opts.configKey]: [...(config[opts.configKey] || []), data.categoria] },
          { merge: true }
        );
      }
    }
    await ref.set(data, { merge: true });
    return data;
  };

  FinDatabase.prototype.updateGasto = async function (gastoId, patch) {
    return this._updateMovimiento("gastos", gastoId, patch, {
      defaultCat: "Otros",
      configKey: "categorias",
      sugeridas: CATEGORIAS_SUGERIDAS,
    });
  };

  FinDatabase.prototype.updateIngreso = async function (ingresoId, patch) {
    return this._updateMovimiento("ingresos", ingresoId, patch, {
      defaultCat: "Otros ingresos",
      configKey: "categorias_ingreso",
      sugeridas: CATEGORIAS_INGRESO_SUGERIDAS,
    });
  };

  FinDatabase.prototype.deleteGasto = async function (gastoId) {
    await this.db.collection("gastos").doc(gastoId).delete();
  };

  FinDatabase.prototype.deleteIngreso = async function (ingresoId) {
    await this.db.collection("ingresos").doc(ingresoId).delete();
  };

  FinDatabase.prototype._getPresupuestoDoc = async function (collection, periodo) {
    const ref = this.db.collection(collection).doc(periodo);
    const doc = await ref.get();
    if (!doc.exists) return { total: null, categorias: {} };
    const d = doc.data();
    return {
      total: d.total > 0 ? d.total : null,
      categorias: { ...(d.categorias || {}) },
    };
  };

  FinDatabase.prototype._setPresupuestoMes = async function (collection, periodo, total) {
    const ref = this.db.collection(collection).doc(periodo);
    const pres = await this._getPresupuestoDoc(collection, periodo);
    if (total == null || total <= 0) {
      delete pres.total;
    } else {
      pres.total = Math.round(Number(total) * 100) / 100;
    }
    if (!pres.total && Object.keys(pres.categorias).length === 0) {
      await ref.delete();
    } else {
      await ref.set(pres, { merge: true });
    }
  };

  FinDatabase.prototype.setPresupuestoMes = async function (periodo, total) {
    return this._setPresupuestoMes("presupuestos", periodo, total);
  };

  FinDatabase.prototype.setPresupuestoIngresoMes = async function (periodo, total) {
    return this._setPresupuestoMes("presupuestos_ingreso", periodo, total);
  };

  FinDatabase.prototype._syncPresupuestoCategorias = async function (collection, periodo, metas) {
    const ref = this.db.collection(collection).doc(periodo);
    const pres = await this._getPresupuestoDoc(collection, periodo);
    const cats = { ...pres.categorias };
    for (const [nombre, monto] of Object.entries(metas || {})) {
      const val = Number(monto);
      if (val > 0) cats[nombre] = Math.round(val * 100) / 100;
    }
    pres.categorias = cats;
    if (!pres.total && Object.keys(cats).length === 0) {
      await ref.delete();
    } else {
      await ref.set(pres, { merge: true });
    }
  };

  FinDatabase.prototype.syncMetasCategorias = async function (periodo, metas) {
    return this._syncPresupuestoCategorias("presupuestos", periodo, metas);
  };

  FinDatabase.prototype.syncPresupuestosIngresoCategorias = async function (periodo, metas) {
    return this._syncPresupuestoCategorias("presupuestos_ingreso", periodo, metas);
  };

  FinDatabase.prototype._clearPresupuestoCategoria = async function (collection, periodo, categoria) {
    const ref = this.db.collection(collection).doc(periodo);
    const pres = await this._getPresupuestoDoc(collection, periodo);
    delete pres.categorias[categoria];
    if (!pres.total && Object.keys(pres.categorias).length === 0) {
      await ref.delete();
    } else {
      await ref.set(pres, { merge: true });
    }
  };

  FinDatabase.prototype.clearMetaCategoria = async function (periodo, categoria) {
    return this._clearPresupuestoCategoria("presupuestos", periodo, categoria);
  };

  FinDatabase.prototype.clearPresupuestoIngresoCategoria = async function (periodo, categoria) {
    return this._clearPresupuestoCategoria("presupuestos_ingreso", periodo, categoria);
  };

  FinDatabase.prototype._renameCategoria = async function (opts) {
    const vieja = opts.vieja.trim();
    const nueva = opts.nueva.trim();
    if (!vieja || !nueva || vieja === nueva) return;

    const batch = this.db.batch();
    const movs = this._cache[opts.cacheKey].filter((g) => g.categoria === vieja);
    for (const g of movs) {
      batch.update(this.db.collection(opts.collection).doc(g.id), { categoria: nueva });
    }

    const config = { ...(this._cache.config || {}) };
    const cats = [...(config[opts.configKey] || [])];
    const idx = cats.indexOf(vieja);
    if (idx >= 0) cats[idx] = nueva;
    else if (!opts.sugeridas.includes(nueva)) cats.push(nueva);
    batch.set(this.configRef(), { [opts.configKey]: cats }, { merge: true });

    for (const [periodo, pres] of Object.entries(this._cache[opts.presupuestosKey])) {
      const pc = pres.categorias || {};
      if (vieja in pc) {
        const updated = { ...pc, [nueva]: pc[vieja] };
        delete updated[vieja];
        batch.set(
          this.db.collection(opts.presupuestosCollection).doc(periodo),
          { categorias: updated },
          { merge: true }
        );
      }
    }

    await batch.commit();
  };

  FinDatabase.prototype.renameCategoria = async function (vieja, nueva) {
    return this._renameCategoria({
      vieja,
      nueva,
      collection: "gastos",
      cacheKey: "gastos",
      configKey: "categorias",
      sugeridas: CATEGORIAS_SUGERIDAS,
      presupuestosKey: "presupuestos",
      presupuestosCollection: "presupuestos",
    });
  };

  FinDatabase.prototype.renameCategoriaIngreso = async function (vieja, nueva) {
    return this._renameCategoria({
      vieja,
      nueva,
      collection: "ingresos",
      cacheKey: "ingresos",
      configKey: "categorias_ingreso",
      sugeridas: CATEGORIAS_INGRESO_SUGERIDAS,
      presupuestosKey: "presupuestos_ingreso",
      presupuestosCollection: "presupuestos_ingreso",
    });
  };

  FinDatabase.prototype._addCategoria = async function (nombre, opts) {
    nombre = nombre.trim();
    if (!nombre) throw new Error("Indica un nombre.");
    if (nombre.length > 40) throw new Error("Máximo 40 caracteres.");
    const all = opts.unionFn(this._cache.config?.[opts.configKey] || []);
    if (all.includes(nombre)) throw new Error(`«${nombre}» ya existe.`);
    await this.configRef().set(
      { [opts.configKey]: [...(this._cache.config?.[opts.configKey] || []), nombre] },
      { merge: true }
    );
  };

  FinDatabase.prototype.addCategoria = async function (nombre) {
    return this._addCategoria(nombre, {
      configKey: "categorias",
      unionFn: unionCategoriasGasto,
    });
  };

  FinDatabase.prototype.addCategoriaIngreso = async function (nombre) {
    return this._addCategoria(nombre, {
      configKey: "categorias_ingreso",
      unionFn: unionCategoriasIngreso,
    });
  };

  FinDatabase.prototype.getCategorias = function () {
    return unionCategoriasGasto(this._cache.config?.categorias || []);
  };

  FinDatabase.prototype.getPresupuestoGastoPeriodo = function (periodo) {
    const p = this._cache.presupuestos[periodo] || {};
    return {
      total: p.total > 0 ? p.total : null,
      categorias: { ...(p.categorias || {}) },
    };
  };

  FinDatabase.prototype.getPresupuestoIngresoPeriodo = function (periodo) {
    const p = this._cache.presupuestos_ingreso[periodo] || {};
    return {
      total: p.total > 0 ? p.total : null,
      categorias: { ...(p.categorias || {}) },
    };
  };

  FinDatabase.prototype.getCategoriasIngreso = function () {
    return unionCategoriasIngreso(this._cache.config?.categorias_ingreso || []);
  };

  FinDatabase.prototype.getExportSnapshot = function () {
    return {
      gastos: [...this._cache.gastos],
      ingresos: [...this._cache.ingresos],
      presupuestos: { ...this._cache.presupuestos },
      presupuestos_ingreso: { ...this._cache.presupuestos_ingreso },
      config: { ...(this._cache.config || {}) },
      summary: buildSummary(
        this._cache.gastos,
        this._cache.presupuestos,
        this._cache.config
      ),
    };
  };

  FinDatabase.prototype._listCategoriasVacias = function (opts) {
    const sugeridas = new Set(opts.sugeridas);
    const custom = (this._cache.config?.[opts.configKey] || []).filter((c) => !sugeridas.has(c));
    return custom.filter(
      (c) =>
        c !== opts.otrosNombre &&
        !this._cache[opts.cacheKey].some((g) => g.categoria === c)
    );
  };

  FinDatabase.prototype.listCategoriasVacias = function () {
    return this._listCategoriasVacias({
      sugeridas: CATEGORIAS_SUGERIDAS,
      configKey: "categorias",
      cacheKey: "gastos",
      otrosNombre: "Otros",
    });
  };

  FinDatabase.prototype.listCategoriasIngresoVacias = function () {
    return this._listCategoriasVacias({
      sugeridas: CATEGORIAS_INGRESO_SUGERIDAS,
      configKey: "categorias_ingreso",
      cacheKey: "ingresos",
      otrosNombre: "Otros ingresos",
    });
  };

  FinDatabase.prototype._removeCategoria = async function (nombre, opts) {
    nombre = nombre.trim();
    if (opts.sugeridas.includes(nombre)) {
      throw new Error(`«${nombre}» es categoría sugerida; no se puede quitar.`);
    }
    if (nombre === opts.otrosNombre) throw new Error(`No se puede quitar «${opts.otrosNombre}».`);
    const enUso = this._cache[opts.cacheKey].some((g) => g.categoria === nombre);
    if (enUso) throw new Error(`Hay registros en «${nombre}».`);
    const cats = (this._cache.config?.[opts.configKey] || []).filter((c) => c !== nombre);
    await this.configRef().set({ [opts.configKey]: cats }, { merge: true });
  };

  FinDatabase.prototype.removeCategoria = async function (nombre) {
    return this._removeCategoria(nombre, {
      sugeridas: CATEGORIAS_SUGERIDAS,
      configKey: "categorias",
      cacheKey: "gastos",
      otrosNombre: "Otros",
    });
  };

  FinDatabase.prototype.removeCategoriaIngreso = async function (nombre) {
    return this._removeCategoria(nombre, {
      sugeridas: CATEGORIAS_INGRESO_SUGERIDAS,
      configKey: "categorias_ingreso",
      cacheKey: "ingresos",
      otrosNombre: "Otros ingresos",
    });
  };

  window.FinDatabase = FinDatabase;
  window.finCategoriasSugeridas = CATEGORIAS_SUGERIDAS;
  window.finCategoriasIngresoSugeridas = CATEGORIAS_INGRESO_SUGERIDAS;
  window.finBuildExportView = buildExportView;
  window.finBuildExportViewIngresos = buildExportViewIngresos;
  window.finBuildPeriodView = buildPeriodView;
  window.finListPeriodosConGastos = listPeriodosConGastos;
  window.finListPeriodosConMovimientos = listPeriodosConMovimientos;
  window.finPeriodoMes = periodoMes;
  window.finHoyLocal = hoyLocalIso;
})();
