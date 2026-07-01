/**
 * Sub-dashboard Estatus: KPIs y gráficas Chart.js del mes seleccionado.
 */
(function () {
  const COLORS = {
    ingreso: "#1a73e8",
    ingresoLight: "#4285f4",
    ingresoBg: "rgba(26, 115, 232, 0.75)",
    egreso: "#c5221f",
    egresoLight: "#ea4335",
    egresoBg: "rgba(197, 34, 31, 0.75)",
    egresoBrown: "#8d6e63",
    ahorro: "#34a853",
    ahorroBg: "rgba(52, 168, 83, 0.8)",
    alerta: "#fbbc04",
    alertaBg: "rgba(251, 188, 4, 0.85)",
    presupuesto: "#b06000",
    presupuestoBg: "rgba(176, 96, 0, 0.7)",
    pie: [
      "#ea4335",
      "#fbbc04",
      "#34a853",
      "#4285f4",
      "#8d6e63",
      "#ab47bc",
      "#00acc1",
      "#ff7043",
      "#78909c",
      "#5c6bc0",
    ],
  };

  let charts = {};
  let lastData = null;

  function fmt(n, moneda) {
    return window.fmtFin ? window.fmtFin(n, moneda) : String(n);
  }

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function chartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { font: { size: 14, family: "'Google Sans', Roboto, sans-serif" } },
        },
      },
    };
  }

  function renderKpis(vista, moneda) {
    const ing = vista.total_ingresos || 0;
    const egr = vista.total_gastos || 0;
    const balance = vista.balance ?? ing - egr;
    const usoPres = vista.uso_presupuesto_pct;

    const elIng = document.getElementById("est-kpi-ingresos");
    const elEgr = document.getElementById("est-kpi-egresos");
    const elBal = document.getElementById("est-kpi-balance");
    const elPres = document.getElementById("est-kpi-presupuesto");
    const cardBal = document.getElementById("est-kpi-balance-card");
    const hint = document.getElementById("est-ahorro-hint");

    if (elIng) elIng.textContent = fmt(ing, moneda);
    if (elEgr) elEgr.textContent = fmt(egr, moneda);
    if (elBal) {
      elBal.textContent = fmt(balance, moneda);
      elBal.classList.remove("kpi-positivo", "kpi-alerta", "kpi-negativo");
      if (balance > 0) elBal.classList.add("kpi-positivo");
      else if (balance === 0) elBal.classList.add("kpi-alerta");
      else elBal.classList.add("kpi-negativo");
    }
    if (cardBal) {
      cardBal.classList.toggle("estatus-kpi-positivo", balance > 0);
      cardBal.classList.toggle("estatus-kpi-alerta", balance === 0);
      cardBal.classList.toggle("estatus-kpi-negativo", balance < 0);
    }
    if (elPres) {
      elPres.textContent =
        usoPres != null ? `${usoPres}%` : vista.presupuesto_total > 0 ? "—" : "Sin presupuesto";
    }
    if (hint) {
      if (balance > 0) {
        hint.textContent = `¡Bien! Llevas ${fmt(balance, moneda)} que podrían quedar como ahorro este mes.`;
      } else if (balance < 0) {
        hint.textContent = `Atención: gastaste ${fmt(Math.abs(balance), moneda)} más de lo que ingresaste.`;
      } else {
        hint.textContent = "Tus ingresos y egresos están equilibrados este mes.";
      }
    }
  }

  function chartIngresosVsEgresos(vista) {
    const canvas = document.getElementById("chart-ingresos-vs-egresos");
    if (!canvas || typeof Chart === "undefined") return;
    destroyChart("vs");
    charts.vs = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["Mes seleccionado"],
        datasets: [
          {
            label: "Ingresos",
            data: [vista.total_ingresos || 0],
            backgroundColor: COLORS.ingresoBg,
            borderColor: COLORS.ingreso,
            borderWidth: 2,
            borderRadius: 8,
          },
          {
            label: "Egresos",
            data: [vista.total_gastos || 0],
            backgroundColor: COLORS.egresoBg,
            borderColor: COLORS.egreso,
            borderWidth: 2,
            borderRadius: 8,
          },
        ],
      },
      options: {
        ...chartDefaults(),
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { size: 13 } },
          },
          x: { ticks: { font: { size: 14 } } },
        },
      },
    });
  }

  function chartEgresosPastel(vista) {
    const canvas = document.getElementById("chart-egresos-pastel");
    if (!canvas || typeof Chart === "undefined") return;
    destroyChart("pie");
    const cats = vista.categorias_gasto_detalle || [];
    if (!cats.length) {
      destroyChart("pie");
      return;
    }
    charts.pie = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: cats.map((c) => c.nombre),
        datasets: [
          {
            data: cats.map((c) => c.total),
            backgroundColor: cats.map((_, i) => COLORS.pie[i % COLORS.pie.length]),
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        ...chartDefaults(),
        plugins: {
          legend: {
            position: "right",
            labels: { font: { size: 13 }, padding: 14 },
          },
        },
      },
    });
  }

  function chartPresupuestoReal(vista) {
    const canvas = document.getElementById("chart-presupuesto-real");
    if (!canvas || typeof Chart === "undefined") return;
    destroyChart("pres");
    const conPres = (vista.categorias_gasto_detalle || []).filter((c) => c.presupuesto > 0);
    if (!conPres.length) return;
    charts.pres = new Chart(canvas, {
      type: "bar",
      data: {
        labels: conPres.map((c) => c.nombre),
        datasets: [
          {
            label: "Presupuesto",
            data: conPres.map((c) => c.presupuesto),
            backgroundColor: COLORS.presupuestoBg,
            borderColor: COLORS.presupuesto,
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: "Gastado",
            data: conPres.map((c) => c.total),
            backgroundColor: COLORS.egresoBg,
            borderColor: COLORS.egreso,
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        ...chartDefaults(),
        scales: {
          y: { beginAtZero: true, ticks: { font: { size: 12 } } },
          x: { ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 0 } },
        },
      },
    });
  }

  function chartAhorro(vista) {
    const canvas = document.getElementById("chart-ahorro");
    if (!canvas || typeof Chart === "undefined") return;
    destroyChart("ahorro");
    const ing = vista.total_ingresos || 0;
    const egr = vista.total_gastos || 0;
    const ahorro = Math.max(0, ing - egr);
    const deficit = Math.max(0, egr - ing);
    const labels = [];
    const values = [];
    const colors = [];
    const borders = [];

    if (ahorro > 0) {
      labels.push("Ahorro potencial");
      values.push(ahorro);
      colors.push(COLORS.ahorroBg);
      borders.push(COLORS.ahorro);
    }
    if (deficit > 0) {
      labels.push("Déficit");
      values.push(deficit);
      colors.push(COLORS.egresoBg);
      borders.push(COLORS.egreso);
    }
    if (egr > 0 && ahorro > 0) {
      labels.splice(1, 0, "Gastado");
      values.splice(1, 0, egr);
      colors.splice(1, 0, COLORS.egresoBg);
      borders.splice(1, 0, COLORS.egresoLight);
    }
    if (!labels.length) {
      labels.push("Sin movimientos");
      values.push(0);
      colors.push("#e0e0e0");
      borders.push("#bdbdbd");
    }

    charts.ahorro = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Montos (PEN)",
            data: values,
            backgroundColor: colors,
            borderColor: borders,
            borderWidth: 2,
            borderRadius: 10,
          },
        ],
      },
      options: {
        indexAxis: "y",
        ...chartDefaults(),
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 13 } } },
          y: { ticks: { font: { size: 14, weight: "600" } } },
        },
      },
    });
  }

  function renderEstatus(data) {
    if (data) lastData = data;
    if (!lastData) return;
    if (window.getActiveView?.() !== "estatus") return;

    const vista = lastData.periodo_vista || {};
    const moneda = lastData.moneda || "PEN";
    renderKpis(vista, moneda);
    chartIngresosVsEgresos(vista);
    chartEgresosPastel(vista);
    chartPresupuestoReal(vista);
    chartAhorro(vista);
  }

  function initEstatus() {
    window.addEventListener("fin-view-changed", (e) => {
      if (e.detail === "estatus" && lastData) renderEstatus(lastData);
    });
  }

  window.renderEstatus = renderEstatus;
  window.initEstatus = initEstatus;
})();
