/**
 * Exportar reporte a Excel (.xlsx) con filtros, datos y gráficas (paleta Google).
 */
(function () {
  const EXPORT_TEMPLATE_VERSION = "5";
  const INTEGER_FMT = "#,##0";

  const GOOGLE_COLORS = [
    "#4285F4",
    "#EA4335",
    "#FBBC04",
    "#34A853",
    "#FF6D01",
    "#46BDC6",
    "#7B1FA2",
    "#185ABC",
    "#C5221F",
    "#137333",
  ];

  const EXCEL_HEADER_FILL = "FFE8F0FE";
  const EXCEL_HEADER_TEXT = "FF202124";
  const EXCEL_SURFACE = "FFF8F9FA";
  const EXCEL_BORDER = "FFDADCE0";
  const EXCEL_TEXT_SECONDARY = "FF5F6368";
  const EXCEL_WHITE = "FFFFFFFF";
  const EXCEL_GREEN_LIGHT = "FFE6F4EA";
  const EXCEL_GREEN = "FF34A853";
  const EXCEL_RED_LIGHT = "FFFCE8E6";
  const EXCEL_RED = "FFEA4335";
  const EXCEL_YELLOW_LIGHT = "FFFEF7E0";
  const EXCEL_BLUE = "FF1A73E8";

  let datalabelsRegistered = false;

  const thinBorder = {
    top: { style: "thin", color: { argb: EXCEL_BORDER } },
    left: { style: "thin", color: { argb: EXCEL_BORDER } },
    bottom: { style: "thin", color: { argb: EXCEL_BORDER } },
    right: { style: "thin", color: { argb: EXCEL_BORDER } },
  };

  const accentLeftBorder = (colorArgb) => ({
    ...thinBorder,
    left: { style: "medium", color: { argb: colorArgb } },
  });

  function hideGridlines(ws) {
    ws.views = [{ showGridLines: false }];
    ws.pageSetup = { ...ws.pageSetup, showGridLines: false };
  }

  function stampTemplateVersion(ws, row) {
    const cell = ws.getCell(row, 1);
    cell.value = `Plantilla Google v${EXPORT_TEMPLATE_VERSION}`;
    cell.font = { size: 9, italic: true, color: { argb: EXCEL_TEXT_SECONDARY } };
  }

  function fillRange(ws, r1, c1, r2, c2, argb) {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        ws.getCell(r, c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb },
        };
      }
    }
  }

  function headerStyle(row) {
    row.font = { bold: true, color: { argb: EXCEL_HEADER_TEXT }, size: 11 };
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: EXCEL_HEADER_FILL },
    };
    row.alignment = { vertical: "middle", horizontal: "center" };
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
    });
  }

  function styleTitleCell(cell, text) {
    cell.value = text;
    cell.font = { bold: true, size: 14, color: { argb: EXCEL_BLUE } };
    cell.alignment = { vertical: "middle" };
  }

  function styleKpiCard(ws, startRow, startCol, endCol, label, value, options = {}) {
    const {
      accent = EXCEL_BLUE,
      bg = EXCEL_SURFACE,
      valueFmt = null,
      valueColor = EXCEL_HEADER_TEXT,
    } = options;

    ws.mergeCells(startRow, startCol, startRow, endCol);
    ws.mergeCells(startRow + 1, startCol, startRow + 2, endCol);

    const labelCell = ws.getCell(startRow, startCol);
    labelCell.value = String(label).toUpperCase();
    labelCell.font = { size: 9, bold: true, color: { argb: EXCEL_TEXT_SECONDARY } };
    labelCell.alignment = { horizontal: "left", vertical: "bottom" };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };

    const valueCell = ws.getCell(startRow + 1, startCol);
    valueCell.value = value;
    valueCell.font = { size: 20, bold: true, color: { argb: valueColor } };
    valueCell.alignment = { horizontal: "left", vertical: "top" };
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    if (valueFmt) valueCell.numFmt = valueFmt;

    for (let r = startRow; r <= startRow + 2; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = ws.getCell(r, c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.border = accentLeftBorder(accent);
      }
    }
    ws.getRow(startRow + 1).height = 28;
    ws.getRow(startRow + 2).height = 18;

    const minWidth = kpiMergedMinWidth(value, valueFmt, label);
    setMergedMinWidth(ws, startCol, endCol, minWidth);
  }

  function styleDataRow(row, isEven, numericCols = []) {
    const bg = isEven ? EXCEL_WHITE : EXCEL_SURFACE;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.border = {
        bottom: { style: "hair", color: { argb: EXCEL_BORDER } },
      };
      cell.alignment = { vertical: "middle" };
      if (numericCols.includes(colNumber)) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
      }
    });
  }

  function stylePercentCell(cell, pctFraction) {
    if (pctFraction === "" || pctFraction == null) return;
    const pct = Number(pctFraction);
    if (Number.isNaN(pct)) return;
    if (pct > 1) {
      cell.font = { color: { argb: EXCEL_RED }, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_RED_LIGHT } };
    } else if (pct >= 0.85) {
      cell.font = { color: { argb: "FF7C4A00" }, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_YELLOW_LIGHT } };
    } else {
      cell.font = { color: { argb: EXCEL_GREEN }, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_GREEN_LIGHT } };
    }
  }

  function styleTotalRow(row, labelCol = 1) {
    row.font = { bold: true, color: { argb: EXCEL_HEADER_TEXT } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_HEADER_FILL } };
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = thinBorder;
      if (col > labelCol) cell.alignment = { horizontal: "right", vertical: "middle" };
    });
  }

  function currencyFmt(moneda) {
    const sym = moneda === "USD" ? "$" : moneda === "EUR" ? "€" : "S/";
    return `"${sym}"#,##0.00`;
  }

  function formatSampleNumber(value, valueFmt) {
    const n = Number(value);
    if (valueFmt && !Number.isNaN(n)) {
      if (valueFmt.includes("S/")) {
        return `S/${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (valueFmt.includes("$")) {
        return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (valueFmt.includes("€")) {
        return `€${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (valueFmt.includes("%")) {
        return `${(n * 100).toFixed(1)}%`;
      }
    }
    return String(value ?? "");
  }

  /** Ancho mínimo del bloque fusionado para KPI (fuente grande + etiqueta). */
  function kpiMergedMinWidth(value, valueFmt, label) {
    const valueText = formatSampleNumber(value, valueFmt);
    const labelText = String(label).toUpperCase();
    const valueUnits = Math.ceil(valueText.length * 1.85) + 3;
    const labelUnits = Math.ceil(labelText.length * 0.9) + 2;
    return Math.max(valueUnits, labelUnits, 14);
  }

  function setMergedMinWidth(ws, startCol, endCol, minTotalWidth) {
    const span = endCol - startCol + 1;
    const each = Math.ceil(minTotalWidth / span);
    for (let c = startCol; c <= endCol; c++) {
      const col = ws.getColumn(c);
      col.width = Math.max(col.width || 8, each);
    }
  }

  function setColumnWidthAtLeast(ws, col, width) {
    const column = ws.getColumn(col);
    column.width = Math.max(column.width || 8, width);
  }

  function applyColumnWidthMap(ws, widthMap) {
    for (const [col, width] of Object.entries(widthMap)) {
      setColumnWidthAtLeast(ws, Number(col), width);
    }
  }

  function descriptionColumnWidth(movimientos, min = 42, max = 72) {
    const longest = movimientos.reduce(
      (maxLen, g) => Math.max(maxLen, String(g.descripcion || "").length),
      0
    );
    return Math.min(max, Math.max(min, Math.ceil(longest * 1.15) + 2));
  }

  function gastosMultimoneda(gastos, monedaBase) {
    return gastos.some((g) => String(g.moneda || monedaBase).toUpperCase() !== monedaBase);
  }

  /** Reaplica formato de celda KPI tras asignar numFmt a columnas enteras. */
  function fixKpiCellFormat(ws, row, col, numFmt) {
    ws.getCell(row, col).numFmt = numFmt;
  }

  function setExportStatus(msg, type) {
    const el = document.getElementById("export-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.remove("hidden", "export-ok", "export-error", "export-pending");
    if (!msg) {
      el.classList.add("hidden");
      return;
    }
    if (type === "ok") el.classList.add("export-ok");
    else if (type === "error") el.classList.add("export-error");
    else el.classList.add("export-pending");
  }

  function setModalStatus(msg, type) {
    const el = document.getElementById("export-modal-status");
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

  function exportFilename(view) {
    const suffix =
      view.periodo || (view.filter === "todo" ? "todo" : view.filter);
    return `registro-financiero-${suffix}.xlsx`;
  }

  function ensureChartPlugins() {
    if (datalabelsRegistered) return;
    if (window.Chart && window.ChartDataLabels) {
      window.Chart.register(window.ChartDataLabels);
      datalabelsRegistered = true;
    }
  }

  async function renderChart(config) {
    const canvas = document.getElementById("export-chart-canvas");
    if (!canvas || !window.Chart) throw new Error("Chart.js no cargó.");
    ensureChartPlugins();

    const existing = window.Chart.getChart(canvas);
    if (existing) existing.destroy();

    const chart = new window.Chart(canvas.getContext("2d"), {
      ...config,
      plugins: [
        {
          id: "canvasWhiteBackground",
          beforeDraw: (ch) => {
            const { ctx, width, height } = ch;
            ctx.save();
            ctx.globalCompositeOperation = "destination-over";
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
          },
        },
        ...(config.plugins || []),
      ],
      options: {
        responsive: false,
        animation: false,
        maintainAspectRatio: false,
        layout: { padding: { top: 16, bottom: 16, left: 16, right: 16 } },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              boxWidth: 14,
              padding: 12,
              font: { size: 11, family: "Arial" },
              color: "#5f6368",
            },
          },
          datalabels: {
            color: "#202124",
            font: { weight: "bold", size: 11, family: "Arial" },
          },
          ...(config.options?.plugins || {}),
        },
        ...(config.options || {}),
      },
    });

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const dataUrl = canvas.toDataURL("image/png");
    chart.destroy();
    return dataUrl;
  }

  async function chartCategorias(categorias, periodoLabel) {
    const labels = categorias.map((c) => c.nombre);
    const values = categorias.map((c) => c.total);
    const total = values.reduce((a, b) => a + b, 0);

    return renderChart({
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            label: "Gastado",
            data: values,
            backgroundColor: GOOGLE_COLORS.slice(0, labels.length),
            borderColor: "#ffffff",
            borderWidth: 2,
          },
        ],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: `Proporción por categoría · ${periodoLabel}`,
            font: { size: 16, weight: "bold", family: "Arial" },
            color: "#202124",
            padding: { bottom: 12 },
          },
          legend: {
            position: "right",
            labels: { font: { size: 11, family: "Arial" }, color: "#5f6368", padding: 14 },
          },
          datalabels: {
            color: "#ffffff",
            textStrokeColor: "#202124",
            textStrokeWidth: 2,
            formatter: (value) => {
              if (!total || value / total < 0.04) return "";
              const pct = ((value / total) * 100).toFixed(1);
              return `${pct}%\n${value.toFixed(0)}`;
            },
          },
        },
      },
    });
  }

  async function chartPresupuestos(categorias, periodoLabel) {
    const conPres = categorias.filter((c) => c.presupuesto > 0);
    const labels = conPres.map((c) => c.nombre);
    const values = conPres.map((c) =>
      c.uso_meta_pct != null ? Math.min(c.uso_meta_pct, 150) : 0
    );

    return renderChart({
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "% del presupuesto usado",
            data: values,
            backgroundColor: values.map((v) => (v > 100 ? "#EA4335" : "#4285F4")),
            borderRadius: 6,
          },
        ],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: Math.max(100, ...values, 10),
            ticks: { callback: (v) => `${v}%`, color: "#5f6368", font: { size: 10 } },
            grid: { color: "#f1f3f4", drawBorder: false },
            border: { display: false },
          },
          x: {
            grid: { display: false },
            ticks: { color: "#5f6368", font: { size: 10 } },
            border: { display: false },
          },
        },
        plugins: {
          title: {
            display: true,
            text: `Cumplimiento de presupuesto · ${periodoLabel}`,
            font: { size: 16, weight: "bold", family: "Arial" },
            color: "#202124",
            padding: { bottom: 12 },
          },
          legend: { display: true, position: "bottom" },
          datalabels: {
            anchor: "end",
            align: "top",
            offset: 2,
            formatter: (v) => `${v.toFixed(1)}%`,
            color: "#202124",
          },
        },
      },
    });
  }

  function sheetGastos(wb, gastos, moneda, periodoLabel) {
    const ws = wb.addWorksheet("Gastos");
    hideGridlines(ws);
    fillRange(ws, 1, 1, 80, 8, EXCEL_WHITE);

    styleTitleCell(ws.getCell("A1"), `Detalle de gastos · ${periodoLabel}`);

    const totalPen = gastos.reduce((s, g) => s + (Number(g.monto_pen ?? g.monto) || 0), 0);
    const fmt = currencyFmt(moneda);
    const multiMoneda = gastosMultimoneda(gastos, moneda);
    const descWidth = descriptionColumnWidth(gastos);
    const montoCol = multiMoneda ? 7 : 5;

    styleKpiCard(ws, 3, 1, 2, "Total del periodo", totalPen, {
      accent: EXCEL_BLUE,
      bg: "FFE8F0FE",
      valueFmt: fmt,
      valueColor: EXCEL_BLUE,
    });
    styleKpiCard(ws, 3, 3, 4, "Movimientos", gastos.length, {
      accent: "FF34A853",
      bg: EXCEL_GREEN_LIGHT,
      valueColor: EXCEL_GREEN,
      valueFmt: INTEGER_FMT,
    });
    styleKpiCard(ws, 3, 5, 6, "Moneda base", moneda, {
      accent: "FF5F6368",
      bg: EXCEL_SURFACE,
      valueColor: EXCEL_HEADER_TEXT,
    });

    const headerRowNum = 8;
    const header = ws.getRow(headerRowNum);
    header.values = multiMoneda
      ? [
          null,
          "ID",
          "Fecha",
          "Categoría",
          "Descripción",
          "Monto original",
          "Moneda",
          `Monto (${moneda})`,
        ]
      : [null, "ID", "Fecha", "Categoría", "Descripción", "Monto"];

    headerStyle(header);

    const sorted = [...gastos].sort((a, b) => {
      const fa = String(a.fecha || "").slice(0, 10);
      const fb = String(b.fecha || "").slice(0, 10);
      return fb.localeCompare(fa) || String(b.creado || "").localeCompare(String(a.creado || ""));
    });

    let rowNum = headerRowNum;
    sorted.forEach((g, i) => {
      rowNum += 1;
      const row = ws.getRow(rowNum);
      const montoBase = Number(g.monto_pen ?? g.monto) || 0;
      row.values = multiMoneda
        ? [
            null,
            g.id || "",
            String(g.fecha || "").slice(0, 10),
            g.categoria || "Otros",
            g.descripcion || "",
            Number(g.monto) || 0,
            g.moneda || moneda,
            montoBase,
          ]
        : [
            null,
            g.id || "",
            String(g.fecha || "").slice(0, 10),
            g.categoria || "Otros",
            g.descripcion || "",
            montoBase,
          ];
      styleDataRow(row, i % 2 === 0, multiMoneda ? [6, 8] : [montoCol]);
    });

    if (sorted.length) {
      rowNum += 1;
      const totalRow = ws.getRow(rowNum);
      totalRow.values = multiMoneda
        ? [null, "TOTAL", "", "", "", "", "", totalPen]
        : [null, "TOTAL", "", "", "", totalPen];
      styleTotalRow(totalRow);
      ws.getCell(rowNum, montoCol).numFmt = fmt;
    }

    if (multiMoneda) {
      ws.getColumn(6).numFmt = "#,##0.00";
      ws.getColumn(8).numFmt = fmt;
      applyColumnWidthMap(ws, {
        1: 12,
        2: 12,
        3: 18,
        4: descWidth,
        5: 14,
        6: 10,
        7: 18,
        8: 18,
      });
    } else {
      ws.getColumn(montoCol).numFmt = fmt;
      applyColumnWidthMap(ws, {
        1: 12,
        2: 12,
        3: 18,
        4: descWidth,
        5: 16,
      });
    }

    fixKpiCellFormat(ws, 4, 3, INTEGER_FMT);
    fixKpiCellFormat(ws, 4, 1, fmt);

    ws.views = [{ state: "frozen", ySplit: headerRowNum, showGridLines: false }];
    stampTemplateVersion(ws, rowNum + 2);
    return ws;
  }

  function sheetResumenCategorias(wb, view) {
    const ws = wb.addWorksheet("Resumen categorías");
    const moneda = view.moneda;
    const fmt = currencyFmt(moneda);

    hideGridlines(ws);
    fillRange(ws, 1, 1, 60, 8, EXCEL_WHITE);

    styleTitleCell(ws.getCell("A1"), `Resumen por categoría · ${view.periodoLabel}`);

    styleKpiCard(ws, 3, 1, 2, "Total gastado", view.total, {
      accent: EXCEL_BLUE,
      bg: "FFE8F0FE",
      valueFmt: fmt,
      valueColor: EXCEL_BLUE,
    });
    styleKpiCard(ws, 3, 3, 4, "Movimientos", view.movimientos, {
      accent: EXCEL_GREEN,
      bg: EXCEL_GREEN_LIGHT,
      valueColor: EXCEL_GREEN,
      valueFmt: INTEGER_FMT,
    });

    if (view.uso_meta_pct != null) {
      const metaPct = view.uso_meta_pct / 100;
      const overMeta = metaPct > 1;
      styleKpiCard(ws, 3, 5, 6, "% presupuesto del mes", metaPct, {
        accent: overMeta ? EXCEL_RED : EXCEL_BLUE,
        bg: overMeta ? EXCEL_RED_LIGHT : "FFE8F0FE",
        valueFmt: "0.0%",
        valueColor: overMeta ? EXCEL_RED : EXCEL_BLUE,
      });
    }

    const headerRowNum = 8;
    const header = ws.getRow(headerRowNum);
    header.values = [
      null,
      "Categoría",
      "Gastado",
      "Moneda",
      "Presupuesto",
      "% presupuesto",
      "Movimientos",
      "% del total",
    ];
    headerStyle(header);

    const cats = (view.categorias_detalle || []).filter((c) => c.movimientos > 0);
    let rowNum = headerRowNum;
    cats.forEach((c, i) => {
      rowNum += 1;
      const pctMeta =
        c.presupuesto > 0 && c.uso_meta_pct != null ? c.uso_meta_pct / 100 : "";
      const row = ws.getRow(rowNum);
      row.values = [
        null,
        c.nombre,
        c.total,
        moneda,
        c.presupuesto > 0 ? c.presupuesto : "",
        pctMeta,
        c.movimientos,
        c.porcentaje != null ? c.porcentaje / 100 : "",
      ];
      styleDataRow(row, i % 2 === 0, [3, 5, 7, 8]);
      if (pctMeta !== "") stylePercentCell(ws.getCell(rowNum, 6), pctMeta);
    });

    rowNum += 2;
    const totalRow = ws.getRow(rowNum);
    totalRow.values = [null, "Total periodo", view.total, moneda, "", "", view.movimientos, ""];
    styleTotalRow(totalRow);
    ws.getCell(rowNum, 3).numFmt = fmt;

    if (view.filter === "todo" && view.metas_agregadas) {
      const noteRow = rowNum + 2;
      const note = ws.getCell(noteRow, 2);
      note.value =
        "Presupuestos y % presupuesto: suma de presupuestos mensuales en los meses con gastos del historial.";
      note.font = { italic: true, color: { argb: EXCEL_TEXT_SECONDARY }, size: 10 };
    } else if (view.filter === "todo") {
      const noteRow = rowNum + 2;
      const note = ws.getCell(noteRow, 2);
      note.value = "Sin presupuestos configurados en los meses con gastos de este historial.";
      note.font = { italic: true, color: { argb: EXCEL_TEXT_SECONDARY }, size: 10 };
    }

    ws.getColumn(3).numFmt = fmt;
    ws.getColumn(5).numFmt = fmt;
    ws.getColumn(6).numFmt = "0.0%";
    ws.getColumn(7).numFmt = INTEGER_FMT;
    ws.getColumn(8).numFmt = "0.0%";
    applyColumnWidthMap(ws, {
      1: 12,
      2: 22,
      3: 16,
      4: 10,
      5: 14,
      6: 12,
      7: 12,
      8: 12,
    });

    fixKpiCellFormat(ws, 4, 1, fmt);
    fixKpiCellFormat(ws, 4, 3, INTEGER_FMT);
    if (view.uso_meta_pct != null) {
      fixKpiCellFormat(ws, 4, 5, "0.0%");
    }
    ws.views = [{ state: "frozen", ySplit: headerRowNum, showGridLines: false }];
    stampTemplateVersion(ws, rowNum + 2);
    return ws;
  }

  function sheetPresupuestoMes(wb, view) {
    const ws = wb.addWorksheet("Presupuesto del mes");
    const moneda = view.moneda;
    const fmt = currencyFmt(moneda);

    hideGridlines(ws);
    fillRange(ws, 1, 1, 40, 6, EXCEL_WHITE);

    styleTitleCell(ws.getCell("A1"), `Presupuesto del mes · ${view.periodoLabel}`);

    if (view.filter === "todo") {
      ws.getCell("B3").value =
        "Los presupuestos mensuales no se muestran para «todo el historial». Elige un mes específico.";
      ws.getCell("B3").font = { color: { argb: EXCEL_TEXT_SECONDARY }, size: 11 };
      return ws;
    }

    const presPct = view.uso_meta_pct != null ? view.uso_meta_pct / 100 : null;
    const overPres = presPct != null && presPct > 1;

    styleKpiCard(ws, 3, 1, 2, "Gastado", view.total, {
      accent: EXCEL_BLUE,
      bg: "FFE8F0FE",
      valueFmt: fmt,
      valueColor: EXCEL_BLUE,
    });
    styleKpiCard(ws, 3, 3, 4, "Presupuesto del mes", view.presupuesto_total ?? 0, {
      accent: "FF5F6368",
      bg: EXCEL_SURFACE,
      valueFmt: fmt,
      valueColor: EXCEL_HEADER_TEXT,
    });
    styleKpiCard(ws, 3, 5, 6, "% cumplimiento", presPct ?? "", {
      accent: overPres ? EXCEL_RED : EXCEL_GREEN,
      bg: overPres ? EXCEL_RED_LIGHT : EXCEL_GREEN_LIGHT,
      valueFmt: presPct != null ? "0.0%" : null,
      valueColor: overPres ? EXCEL_RED : EXCEL_GREEN,
    });

    const headerRowNum = 8;
    const h = ws.getRow(headerRowNum);
    h.values = [null, "Categoría", "Presupuesto", "Gastado", "% presupuesto"];
    headerStyle(h);

    let rowNum = headerRowNum;
    const withPres = (view.categorias_detalle || []).filter((c) => c.presupuesto > 0);
    withPres.forEach((c, i) => {
      rowNum += 1;
      const pct = c.uso_meta_pct != null ? c.uso_meta_pct / 100 : "";
      const row = ws.getRow(rowNum);
      row.values = [null, c.nombre, c.presupuesto, c.total, pct];
      styleDataRow(row, i % 2 === 0, [3, 4, 5]);
      if (pct !== "") stylePercentCell(ws.getCell(rowNum, 5), pct);
    });

    ws.getColumn(3).numFmt = fmt;
    ws.getColumn(4).numFmt = fmt;
    ws.getColumn(5).numFmt = "0.0%";
    applyColumnWidthMap(ws, {
      1: 12,
      2: 24,
      3: 16,
      4: 16,
      5: 14,
      6: 12,
    });
    ws.views = [{ state: "frozen", ySplit: headerRowNum, showGridLines: false }];
    stampTemplateVersion(ws, rowNum + 2);
    return ws;
  }

  function sheetIngresos(wb, ingresos, moneda, periodoLabel) {
    const ws = wb.addWorksheet("Ingresos");
    hideGridlines(ws);
    fillRange(ws, 1, 1, 80, 8, EXCEL_WHITE);

    styleTitleCell(ws.getCell("A1"), `Detalle de ingresos · ${periodoLabel}`);

    const totalPen = ingresos.reduce((s, g) => s + (Number(g.monto_pen ?? g.monto) || 0), 0);
    const fmt = currencyFmt(moneda);
    const multiMoneda = gastosMultimoneda(ingresos, moneda);
    const descWidth = descriptionColumnWidth(ingresos);
    const montoCol = multiMoneda ? 7 : 5;

    styleKpiCard(ws, 3, 1, 2, "Total del periodo", totalPen, {
      accent: EXCEL_BLUE,
      bg: "FFE8F0FE",
      valueFmt: fmt,
      valueColor: EXCEL_BLUE,
    });
    styleKpiCard(ws, 3, 3, 4, "Movimientos", ingresos.length, {
      accent: EXCEL_GREEN,
      bg: EXCEL_GREEN_LIGHT,
      valueColor: EXCEL_GREEN,
      valueFmt: INTEGER_FMT,
    });
    styleKpiCard(ws, 3, 5, 6, "Moneda base", moneda, {
      accent: "FF5F6368",
      bg: EXCEL_SURFACE,
      valueColor: EXCEL_HEADER_TEXT,
    });

    const headerRowNum = 8;
    const header = ws.getRow(headerRowNum);
    header.values = multiMoneda
      ? [
          null,
          "ID",
          "Fecha",
          "Tipo de ingreso",
          "Descripción",
          "Monto original",
          "Moneda",
          `Monto (${moneda})`,
        ]
      : [null, "ID", "Fecha", "Tipo de ingreso", "Descripción", "Monto"];

    headerStyle(header);

    const sorted = [...ingresos].sort((a, b) => {
      const fa = String(a.fecha || "").slice(0, 10);
      const fb = String(b.fecha || "").slice(0, 10);
      return fb.localeCompare(fa) || String(b.creado || "").localeCompare(String(a.creado || ""));
    });

    let rowNum = headerRowNum;
    sorted.forEach((g, i) => {
      rowNum += 1;
      const row = ws.getRow(rowNum);
      const montoBase = Number(g.monto_pen ?? g.monto) || 0;
      row.values = multiMoneda
        ? [
            null,
            g.id || "",
            String(g.fecha || "").slice(0, 10),
            g.categoria || "Otros ingresos",
            g.descripcion || "",
            Number(g.monto) || 0,
            g.moneda || moneda,
            montoBase,
          ]
        : [
            null,
            g.id || "",
            String(g.fecha || "").slice(0, 10),
            g.categoria || "Otros ingresos",
            g.descripcion || "",
            montoBase,
          ];
      styleDataRow(row, i % 2 === 0, multiMoneda ? [6, 8] : [montoCol]);
    });

    if (sorted.length) {
      rowNum += 1;
      const totalRow = ws.getRow(rowNum);
      totalRow.values = multiMoneda
        ? [null, "TOTAL", "", "", "", "", "", totalPen]
        : [null, "TOTAL", "", "", "", totalPen];
      styleTotalRow(totalRow);
      ws.getCell(rowNum, montoCol).numFmt = fmt;
    }

    if (multiMoneda) {
      ws.getColumn(6).numFmt = "#,##0.00";
      ws.getColumn(8).numFmt = fmt;
      applyColumnWidthMap(ws, { 1: 12, 2: 12, 3: 18, 4: 22, 5: descWidth, 6: 14, 7: 10, 8: 18 });
    } else {
      ws.getColumn(montoCol).numFmt = fmt;
      applyColumnWidthMap(ws, { 1: 12, 2: 12, 3: 22, 4: descWidth, 5: 16 });
    }

    fixKpiCellFormat(ws, 4, 3, INTEGER_FMT);
    fixKpiCellFormat(ws, 4, 1, fmt);
    ws.views = [{ state: "frozen", ySplit: headerRowNum, showGridLines: false }];
    stampTemplateVersion(ws, rowNum + 2);
    return ws;
  }

  function sheetResumenIngresos(wb, view) {
    const ws = wb.addWorksheet("Resumen ingresos");
    const moneda = view.moneda;
    const fmt = currencyFmt(moneda);

    hideGridlines(ws);
    fillRange(ws, 1, 1, 60, 8, EXCEL_WHITE);
    styleTitleCell(ws.getCell("A1"), `Resumen por tipo de ingreso · ${view.periodoLabel}`);

    styleKpiCard(ws, 3, 1, 2, "Total ingresado", view.total, {
      accent: EXCEL_BLUE,
      bg: "FFE8F0FE",
      valueFmt: fmt,
      valueColor: EXCEL_BLUE,
    });
    styleKpiCard(ws, 3, 3, 4, "Movimientos", view.movimientos, {
      accent: EXCEL_GREEN,
      bg: EXCEL_GREEN_LIGHT,
      valueColor: EXCEL_GREEN,
      valueFmt: INTEGER_FMT,
    });

    if (view.uso_esperado_pct != null) {
      const espPct = view.uso_esperado_pct / 100;
      styleKpiCard(ws, 3, 5, 6, "% del ingreso esperado", espPct, {
        accent: espPct >= 1 ? EXCEL_GREEN : EXCEL_BLUE,
        bg: espPct >= 1 ? EXCEL_GREEN_LIGHT : "FFE8F0FE",
        valueFmt: "0.0%",
        valueColor: espPct >= 1 ? EXCEL_GREEN : EXCEL_BLUE,
      });
    }

    const headerRowNum = 8;
    const header = ws.getRow(headerRowNum);
    header.values = [
      null,
      "Tipo",
      "Ingresado",
      "Moneda",
      "Ingreso esperado",
      "% esperado",
      "Movimientos",
      "% del total",
    ];
    headerStyle(header);

    const cats = (view.categorias_detalle || []).filter((c) => c.movimientos > 0);
    let rowNum = headerRowNum;
    cats.forEach((c, i) => {
      rowNum += 1;
      const pctEsp =
        c.presupuesto > 0 && c.uso_meta_pct != null ? c.uso_meta_pct / 100 : "";
      const row = ws.getRow(rowNum);
      row.values = [
        null,
        c.nombre,
        c.total,
        moneda,
        c.presupuesto > 0 ? c.presupuesto : "",
        pctEsp,
        c.movimientos,
        c.porcentaje != null ? c.porcentaje / 100 : "",
      ];
      styleDataRow(row, i % 2 === 0, [3, 5, 7, 8]);
    });

    rowNum += 2;
    const totalRow = ws.getRow(rowNum);
    totalRow.values = [null, "Total periodo", view.total, moneda, "", "", view.movimientos, ""];
    styleTotalRow(totalRow);
    ws.getCell(rowNum, 3).numFmt = fmt;

    if (view.filter === "todo" && view.esperados_agregados) {
      const note = ws.getCell(rowNum + 2, 2);
      note.value =
        "Ingresos esperados y % esperado: suma mensual en los meses con ingresos del historial.";
      note.font = { italic: true, color: { argb: EXCEL_TEXT_SECONDARY }, size: 10 };
    }

    ws.getColumn(3).numFmt = fmt;
    ws.getColumn(5).numFmt = fmt;
    ws.getColumn(6).numFmt = "0.0%";
    ws.getColumn(7).numFmt = INTEGER_FMT;
    ws.getColumn(8).numFmt = "0.0%";
    applyColumnWidthMap(ws, { 1: 12, 2: 22, 3: 16, 4: 10, 5: 16, 6: 12, 7: 12, 8: 12 });
    fixKpiCellFormat(ws, 4, 1, fmt);
    fixKpiCellFormat(ws, 4, 3, INTEGER_FMT);
    ws.views = [{ state: "frozen", ySplit: headerRowNum, showGridLines: false }];
    stampTemplateVersion(ws, rowNum + 2);
    return ws;
  }

  function sheetIngresoEsperadoMes(wb, view) {
    const ws = wb.addWorksheet("Ingreso esperado");
    const moneda = view.moneda;
    const fmt = currencyFmt(moneda);

    hideGridlines(ws);
    fillRange(ws, 1, 1, 40, 6, EXCEL_WHITE);
    styleTitleCell(ws.getCell("A1"), `Ingreso esperado del mes · ${view.periodoLabel}`);

    if (view.filter === "todo") {
      ws.getCell("B3").value =
        "El ingreso esperado mensual no se muestra para «todo el historial». Elige un mes específico.";
      ws.getCell("B3").font = { color: { argb: EXCEL_TEXT_SECONDARY }, size: 11 };
      return ws;
    }

    const espPct = view.uso_esperado_pct != null ? view.uso_esperado_pct / 100 : null;

    styleKpiCard(ws, 3, 1, 2, "Ingresado", view.total, {
      accent: EXCEL_BLUE,
      bg: "FFE8F0FE",
      valueFmt: fmt,
      valueColor: EXCEL_BLUE,
    });
    styleKpiCard(ws, 3, 3, 4, "Ingreso esperado", view.ingreso_esperado_total ?? 0, {
      accent: "FF5F6368",
      bg: EXCEL_SURFACE,
      valueFmt: fmt,
      valueColor: EXCEL_HEADER_TEXT,
    });
    styleKpiCard(ws, 3, 5, 6, "% percibido", espPct ?? "", {
      accent: espPct != null && espPct >= 1 ? EXCEL_GREEN : EXCEL_BLUE,
      bg: espPct != null && espPct >= 1 ? EXCEL_GREEN_LIGHT : "FFE8F0FE",
      valueFmt: espPct != null ? "0.0%" : null,
      valueColor: espPct != null && espPct >= 1 ? EXCEL_GREEN : EXCEL_BLUE,
    });

    const headerRowNum = 8;
    const h = ws.getRow(headerRowNum);
    h.values = [null, "Tipo", "Esperado", "Ingresado", "% esperado"];
    headerStyle(h);

    let rowNum = headerRowNum;
    const withEsp = (view.categorias_detalle || []).filter((c) => c.presupuesto > 0);
    withEsp.forEach((c, i) => {
      rowNum += 1;
      const pct = c.uso_meta_pct != null ? c.uso_meta_pct / 100 : "";
      const row = ws.getRow(rowNum);
      row.values = [null, c.nombre, c.presupuesto, c.total, pct];
      styleDataRow(row, i % 2 === 0, [3, 4, 5]);
    });

    ws.getColumn(3).numFmt = fmt;
    ws.getColumn(4).numFmt = fmt;
    ws.getColumn(5).numFmt = "0.0%";
    applyColumnWidthMap(ws, { 1: 12, 2: 24, 3: 16, 4: 16, 5: 14 });
    ws.views = [{ state: "frozen", ySplit: headerRowNum, showGridLines: false }];
    stampTemplateVersion(ws, rowNum + 2);
    return ws;
  }

  function sheetBalance(wb, viewEgresos, viewIngresos) {
    const ws = wb.addWorksheet("Balance");
    const moneda = viewEgresos.moneda;
    const fmt = currencyFmt(moneda);
    const ingresos = viewIngresos.total || 0;
    const egresos = viewEgresos.total || 0;
    const balance = Math.round((ingresos - egresos) * 100) / 100;
    const ahorro = Math.max(0, balance);

    hideGridlines(ws);
    fillRange(ws, 1, 1, 20, 6, EXCEL_WHITE);
    styleTitleCell(ws.getCell("A1"), `Balance · ${viewEgresos.periodoLabel}`);

    styleKpiCard(ws, 3, 1, 2, "Ingresos", ingresos, {
      accent: EXCEL_BLUE,
      bg: "FFE8F0FE",
      valueFmt: fmt,
      valueColor: EXCEL_BLUE,
    });
    styleKpiCard(ws, 3, 3, 4, "Egresos", egresos, {
      accent: EXCEL_RED,
      bg: EXCEL_RED_LIGHT,
      valueFmt: fmt,
      valueColor: EXCEL_RED,
    });
    styleKpiCard(ws, 3, 5, 6, "Balance / ahorro", balance, {
      accent: balance >= 0 ? EXCEL_GREEN : EXCEL_RED,
      bg: balance >= 0 ? EXCEL_GREEN_LIGHT : EXCEL_RED_LIGHT,
      valueFmt: fmt,
      valueColor: balance >= 0 ? EXCEL_GREEN : EXCEL_RED,
    });

    const row = 8;
    ws.getCell(row, 2).value = "Ahorro potencial (ingresos − egresos, si positivo)";
    ws.getCell(row, 4).value = ahorro;
    ws.getCell(row, 4).numFmt = fmt;
    ws.getCell(row, 4).font = { bold: true, color: { argb: EXCEL_GREEN } };

    if (viewEgresos.uso_meta_pct != null && viewEgresos.filter !== "todo") {
      ws.getCell(row + 2, 2).value = "% presupuesto de egresos usado";
      ws.getCell(row + 2, 4).value = viewEgresos.uso_meta_pct / 100;
      ws.getCell(row + 2, 4).numFmt = "0.0%";
    }
    if (viewIngresos.uso_esperado_pct != null && viewIngresos.filter !== "todo") {
      ws.getCell(row + 3, 2).value = "% ingreso esperado percibido";
      ws.getCell(row + 3, 4).value = viewIngresos.uso_esperado_pct / 100;
      ws.getCell(row + 3, 4).numFmt = "0.0%";
    }

    applyColumnWidthMap(ws, { 2: 36, 4: 18 });
    stampTemplateVersion(ws, row + 6);
    return ws;
  }

  async function chartIngresosCategorias(categorias, periodoLabel) {
    const labels = categorias.map((c) => c.nombre);
    const values = categorias.map((c) => c.total);
    const total = values.reduce((a, b) => a + b, 0);
    if (!total) return null;

    return renderChart({
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            label: "Ingresado",
            data: values,
            backgroundColor: GOOGLE_COLORS.slice(0, labels.length),
            borderColor: "#ffffff",
            borderWidth: 2,
          },
        ],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: `Proporción de ingresos · ${periodoLabel}`,
            font: { size: 16, weight: "bold", family: "Arial" },
            color: "#202124",
            padding: { bottom: 12 },
          },
          legend: {
            position: "right",
            labels: { font: { size: 11, family: "Arial" }, color: "#5f6368", padding: 14 },
          },
          datalabels: {
            color: "#ffffff",
            textStrokeColor: "#202124",
            textStrokeWidth: 2,
            formatter: (value) => {
              if (!total || value / total < 0.04) return "";
              return `${((value / total) * 100).toFixed(1)}%\n${value.toFixed(0)}`;
            },
          },
        },
      },
    });
  }

  function styleChartFrame(ws, startRow, endRow, startCol, endCol) {
    fillRange(ws, startRow, startCol, endRow, endCol, EXCEL_WHITE);
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        ws.getCell(r, c).border = {
          top: { style: "thin", color: { argb: EXCEL_BORDER } },
          left: { style: "thin", color: { argb: EXCEL_BORDER } },
          bottom: { style: "thin", color: { argb: EXCEL_BORDER } },
          right: { style: "thin", color: { argb: EXCEL_BORDER } },
        };
      }
    }
  }

  async function sheetGraficos(wb, view, viewIngresos) {
    const ws = wb.addWorksheet("Gráficos");
    hideGridlines(ws);
    fillRange(ws, 1, 1, 90, 10, EXCEL_WHITE);

    const cats = (view.categorias_detalle || []).filter(
      (c) => c.movimientos > 0 && c.total > 0
    );
    const ingCats = (viewIngresos?.categorias_detalle || []).filter(
      (c) => c.movimientos > 0 && c.total > 0
    );

    if (!cats.length && !ingCats.length) {
      ws.getCell("B2").value =
        "Sin gastos ni ingresos en el periodo elegido para generar gráficas.";
      ws.getCell("B2").font = { color: { argb: EXCEL_TEXT_SECONDARY }, size: 12 };
      return ws;
    }

    styleTitleCell(ws.getCell("B2"), `Visualización · ${view.periodoLabel}`);
    ws.getRow(2).height = 24;

    let nextRow = 4;
    if (cats.length) {
      styleChartFrame(ws, nextRow, nextRow + 24, 2, 9);
      const pieUrl = await chartCategorias(cats, view.periodoLabel);
      const pieId = wb.addImage({ base64: pieUrl.split(",")[1], extension: "png" });
      ws.addImage(pieId, {
        tl: { col: 1.2, row: nextRow - 0.7 },
        ext: { width: 640, height: 380 },
      });
      nextRow += 28;
    }

    const conPres = cats.filter((c) => c.presupuesto > 0);
    if (view.filter !== "todo" && conPres.length) {
      styleChartFrame(ws, nextRow, nextRow + 24, 2, 9);
      const barUrl = await chartPresupuestos(cats, view.periodoLabel);
      const barId = wb.addImage({ base64: barUrl.split(",")[1], extension: "png" });
      ws.addImage(barId, {
        tl: { col: 1.2, row: nextRow - 0.7 },
        ext: { width: 640, height: 380 },
      });
      nextRow += 28;
    } else if (view.filter !== "todo" && cats.length) {
      ws.getCell(`B${nextRow}`).value =
        "Sin presupuesto por categoría en este periodo (solo gráfica de egresos).";
      ws.getCell(`B${nextRow}`).font = {
        italic: true,
        color: { argb: EXCEL_TEXT_SECONDARY },
        size: 11,
      };
      nextRow += 3;
    }

    if (ingCats.length && viewIngresos) {
      const ingPieUrl = await chartIngresosCategorias(ingCats, viewIngresos.periodoLabel);
      if (ingPieUrl) {
        styleChartFrame(ws, nextRow, nextRow + 24, 2, 9);
        const ingId = wb.addImage({ base64: ingPieUrl.split(",")[1], extension: "png" });
        ws.addImage(ingId, {
          tl: { col: 1.2, row: nextRow - 0.7 },
          ext: { width: 640, height: 380 },
        });
      }
    }

    ws.columns = [
      { width: 2 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 2 },
    ];
    stampTemplateVersion(ws, nextRow + 28);
    return ws;
  }

  async function saveWorkbook(buffer, filename) {
    const mime =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "Libro de Excel", accept: { [mime]: [".xlsx"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(buffer);
        await writable.close();
        return { mode: "picker" };
      } catch (err) {
        if (err?.name === "AbortError") return { mode: "cancelled" };
      }
    }

    const blob = new Blob([buffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { mode: "download" };
  }

  async function exportExcelReport(filter) {
    if (!window.ExcelJS) throw new Error("ExcelJS no cargó.");
    const snap = window.getFinDb().getExportSnapshot();
    const view = window.finBuildExportView(
      snap.gastos,
      snap.presupuestos,
      snap.config,
      filter
    );
    const viewIngresos = window.finBuildExportViewIngresos(
      snap.ingresos || [],
      snap.presupuestos_ingreso || {},
      snap.config,
      filter
    );

    const wb = new window.ExcelJS.Workbook();
    wb.creator = "Registro financiero";
    wb.created = new Date();

    sheetBalance(wb, view, viewIngresos);
    sheetGastos(wb, view.gastos, view.moneda, view.periodoLabel);
    sheetResumenCategorias(wb, view);
    sheetPresupuestoMes(wb, view);
    sheetIngresos(wb, viewIngresos.ingresos, viewIngresos.moneda, viewIngresos.periodoLabel);
    sheetResumenIngresos(wb, viewIngresos);
    sheetIngresoEsperadoMes(wb, viewIngresos);
    await sheetGraficos(wb, view, viewIngresos);

    const buffer = await wb.xlsx.writeBuffer();
    return saveWorkbook(buffer, exportFilename(view));
  }

  function fillPeriodSelect() {
    const sel = document.getElementById("export-period");
    if (!sel) return;

    const snap = window.getFinDb().getExportSnapshot();
    const otros = window.finListPeriodosConMovimientos
      ? window.finListPeriodosConMovimientos(snap.gastos, snap.ingresos || [])
      : window.finListPeriodosConGastos(snap.gastos);

    sel.innerHTML = `
      <option value="actual">Mes actual</option>
      <option value="anterior">Mes anterior</option>
      <option value="todo">Todo el historial</option>
    `;

    if (otros.length) {
      const group = document.createElement("optgroup");
      group.label = "Otros meses";
      for (const p of otros) {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        group.appendChild(opt);
      }
      sel.appendChild(group);
    }
  }

  function initExcelExport() {
    const btn = document.getElementById("btn-export-excel");
    const modal = document.getElementById("modal-export");
    const form = document.getElementById("form-export");
    const confirmBtn = document.getElementById("btn-export-confirm");
    if (!btn || !modal || !form) return;

    btn.addEventListener("click", () => {
      try {
        fillPeriodSelect();
        setModalStatus("", null);
        modal.showModal();
      } catch (err) {
        setExportStatus(err.message || String(err), "error");
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const filter = document.getElementById("export-period")?.value || "actual";
      if (confirmBtn) confirmBtn.disabled = true;
      setModalStatus("Generando Excel…", "pending");
      setExportStatus("Generando Excel…", "pending");

      try {
        const result = await exportExcelReport(filter);
        if (result.mode === "cancelled") {
          setModalStatus("Cancelado.", null);
          setExportStatus("", null);
          return;
        }
        modal.close();
        if (result.mode === "picker") {
          setExportStatus("Reporte guardado en la ubicación elegida.", "ok");
        } else {
          setExportStatus(
            "Reporte descargado. En el celular usa «Compartir» o «Guardar en Archivos».",
            "ok"
          );
        }
        setTimeout(() => setExportStatus("", null), 5000);
      } catch (err) {
        setModalStatus(err.message || String(err), "error");
        setExportStatus(err.message || String(err), "error");
      } finally {
        if (confirmBtn) confirmBtn.disabled = false;
      }
    });
  }

  window.initExcelExport = initExcelExport;
})();
