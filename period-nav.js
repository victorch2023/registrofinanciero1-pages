/**
 * Navegación entre sub-dashboards y selector de mes global.
 */
(function () {
  const STORAGE_VIEW = "rf_dash_view";
  const STORAGE_PERIOD = "rf_dash_period";

  let vistaActiva = "egresos";
  let periodoSeleccionado = null;

  function periodoMes() {
    return window.finPeriodoMes ? window.finPeriodoMes() : new Date().toISOString().slice(0, 7);
  }

  function periodoLegible(periodo) {
    const [y, m] = String(periodo || "").split("-").map(Number);
    if (!y || !m) return periodo || "";
    const dt = new Date(y, m - 1, 1);
    return dt.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  }

  function setView(view) {
    vistaActiva = view;
    try {
      sessionStorage.setItem(STORAGE_VIEW, view);
    } catch (_) {}
    document.querySelectorAll(".dash-nav-btn").forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".view-panel").forEach((panel) => {
      const show = panel.id === `view-${view}`;
      panel.classList.toggle("hidden", !show);
      panel.hidden = !show;
    });
    document.body.dataset.activeView = view;
    window.dispatchEvent(new CustomEvent("fin-view-changed", { detail: view }));
  }

  function setPeriodo(periodo) {
    periodoSeleccionado = periodo;
    try {
      sessionStorage.setItem(STORAGE_PERIOD, periodo);
    } catch (_) {}
    const picker = document.getElementById("period-picker");
    const label = document.getElementById("period-label");
    if (picker && picker.value !== periodo) picker.value = periodo;
    if (label) label.textContent = periodoLegible(periodo);
    window.getFinDb?.()?.refreshNotify?.();
    window.dispatchEvent(new CustomEvent("fin-period-changed", { detail: periodo }));
  }

  function initPeriodNav() {
    try {
      const savedView = sessionStorage.getItem(STORAGE_VIEW);
      if (savedView === "ingresos" || savedView === "egresos" || savedView === "estatus") {
        vistaActiva = savedView;
      }
    } catch (_) {}

    const actual = periodoMes();
    try {
      const savedPeriod = sessionStorage.getItem(STORAGE_PERIOD);
      if (savedPeriod && savedPeriod <= actual) {
        periodoSeleccionado = savedPeriod;
      }
    } catch (_) {}
    if (!periodoSeleccionado) periodoSeleccionado = actual;

    document.querySelectorAll(".dash-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        if (view) setView(view);
      });
    });

    const picker = document.getElementById("period-picker");
    if (picker) {
      picker.max = actual;
      picker.value = periodoSeleccionado;
      picker.addEventListener("change", () => {
        const val = picker.value || actual;
        setPeriodo(val > actual ? actual : val);
      });
    }

    setView(vistaActiva);
    setPeriodo(periodoSeleccionado);

    window.addEventListener("fin-period-changed", () => {
      window.renderEstatus?.();
    });
    window.addEventListener("fin-view-changed", (e) => {
      if (e.detail === "estatus") window.renderEstatus?.();
    });
  }

  window.getSelectedPeriodo = function () {
    return periodoSeleccionado || periodoMes();
  };

  window.getActiveView = function () {
    return vistaActiva;
  };

  window.initPeriodNav = initPeriodNav;
  window.finPeriodoLegible = periodoLegible;
})();
