/* ============================================================
   «Наладчик» — лёгкие SVG-графики без зависимостей
   ============================================================ */
(function () {
  'use strict';

  function escapeXml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function niceMax(value) {
    if (!(value > 0)) return 1;
    const exponent = Math.pow(10, Math.floor(Math.log10(value)));
    const fraction = value / exponent;
    let nice;
    if (fraction <= 1) nice = 1;
    else if (fraction <= 2) nice = 2;
    else if (fraction <= 2.5) nice = 2.5;
    else if (fraction <= 5) nice = 5;
    else nice = 10;
    return nice * exponent;
  }

  function compact(value) {
    if (window.Store) return window.Store.compact(value);
    return String(Math.round(value));
  }

  function empty(container, text) {
    container.innerHTML = '<div class="chart-empty">' + escapeXml(text || 'Нет данных за период') + '</div>';
  }

  /**
   * Сгруппированные столбцы с накоплением.
   * months: [{ label, full, values: [cash, bank] }]
   * series: [{ label, className }]
   */
  function stackedBars(container, options) {
    if (!container) return;
    const months = options && Array.isArray(options.months) ? options.months : [];
    const series = options && Array.isArray(options.series) ? options.series : [];
    const format = options && options.formatValue ? options.formatValue : compact;
    if (!months.length) {
      empty(container, 'Пока нет доходов за выбранный период');
      return;
    }

    const width = 760;
    const height = 290;
    const padding = { left: 58, right: 14, top: 18, bottom: 42 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxTotal = months.reduce(function (max, month) {
      const total = (month.values || []).reduce(function (sum, value) { return sum + (Number(value) || 0); }, 0);
      return Math.max(max, total);
    }, 0);
    if (maxTotal <= 0) {
      empty(container, 'Пока нет доходов за выбранный период');
      return;
    }
    const max = niceMax(maxTotal);
    const groupWidth = innerWidth / months.length;
    const barWidth = Math.max(8, Math.min(34, groupWidth * 0.5));
    const yFor = function (value) {
      return padding.top + innerHeight - (value / max) * innerHeight;
    };

    const parts = [];
    parts.push('<svg class="chart-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Доходы по месяцам" preserveAspectRatio="xMidYMid meet">');

    // сетка и подписи оси Y
    for (let step = 0; step <= 4; step += 1) {
      const value = (max / 4) * step;
      const y = yFor(value);
      parts.push('<line class="chart-grid" x1="' + padding.left + '" y1="' + y.toFixed(1) + '" x2="' + (width - padding.right) + '" y2="' + y.toFixed(1) + '"></line>');
      parts.push('<text class="chart-axis" x="' + (padding.left - 10) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + escapeXml(format(value)) + '</text>');
    }

    // столбцы
    months.forEach(function (month, monthIndex) {
      const center = padding.left + groupWidth * monthIndex + groupWidth / 2;
      let current = 0;
      const totals = (month.values || []).map(function (value) { return Number(value) || 0; });
      const tooltip = [month.full || month.label];
      series.forEach(function (item, seriesIndex) {
        tooltip.push(item.label + ': ' + format(totals[seriesIndex] || 0));
      });

      parts.push('<g>');
      parts.push('<rect class="chart-hit" x="' + (center - groupWidth / 2) + '" y="' + padding.top + '" width="' + groupWidth + '" height="' + innerHeight + '"><title>' + escapeXml(tooltip.join('\n')) + '</title></rect>');
      totals.forEach(function (value, seriesIndex) {
        if (!value) return;
        const barHeight = (value / max) * innerHeight;
        const y = padding.top + innerHeight - ((current + value) / max) * innerHeight;
        const className = (series[seriesIndex] && series[seriesIndex].className) || 'chart-bar-primary';
        parts.push('<rect class="' + className + '" x="' + (center - barWidth / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + Math.max(1, barHeight - 1).toFixed(1) + '" rx="3"><title>' + escapeXml((series[seriesIndex] ? series[seriesIndex].label : '') + ': ' + format(value)) + '</title></rect>');
        current += value;
      });
      parts.push('</g>');

      const showLabel = months.length <= 8 || monthIndex % 2 === 0 || monthIndex === months.length - 1;
      if (showLabel) {
        parts.push('<text class="chart-label" x="' + center.toFixed(1) + '" y="' + (height - 16) + '" text-anchor="middle">' + escapeXml(month.label) + '</text>');
      }
    });

    parts.push('</svg>');
    container.innerHTML = parts.join('');
  }

  /**
   * Кольцевая диаграмма структуры.
   * items: [{ label, value, color }]
   */
  function donut(container, options) {
    if (!container) return;
    const items = (options && options.items ? options.items : []).filter(function (item) {
      return Number(item.value) > 0;
    });
    const centerValue = options && options.centerValue ? options.centerValue : '';
    const centerLabel = options && options.centerLabel ? options.centerLabel : '';
    const total = items.reduce(function (sum, item) { return sum + Number(item.value); }, 0);

    if (!total) {
      empty(container, options && options.emptyText ? options.emptyText : 'Нет данных за период');
      return;
    }

    const size = 220;
    const center = size / 2;
    const radius = 80;
    const stroke = 22;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const parts = [];

    parts.push('<svg class="donut-svg" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Структура доходов">');
    parts.push('<circle class="donut-track" cx="' + center + '" cy="' + center + '" r="' + radius + '" fill="none" stroke-width="' + stroke + '"></circle>');

    items.forEach(function (item) {
      const share = Number(item.value) / total;
      const length = Math.max(0, circumference * share - (items.length > 1 ? 2.4 : 0));
      const dash = length.toFixed(2) + ' ' + (circumference - length).toFixed(2);
      parts.push('<circle cx="' + center + '" cy="' + center + '" r="' + radius + '" fill="none" stroke="' + escapeXml(item.color || '#60a5fa') + '" stroke-width="' + stroke + '" stroke-dasharray="' + dash + '" stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 ' + center + ' ' + center + ')" stroke-linecap="butt"><title>' + escapeXml(item.label + ': ' + (share * 100).toFixed(1) + '%') + '</title></circle>');
      offset += circumference * share;
    });

    const percent = options && options.centerPercent ? options.centerPercent : '';
    parts.push('<text class="donut-value" x="' + center + '" y="' + (center - 4) + '" text-anchor="middle" dominant-baseline="middle">' + escapeXml(centerValue) + '</text>');
    parts.push('<text class="donut-caption" x="' + center + '" y="' + (center + 22) + '" text-anchor="middle" dominant-baseline="middle">' + escapeXml(centerLabel) + '</text>');
    if (percent) {
      parts.push('<text class="donut-percent" x="' + center + '" y="' + (center + 42) + '" text-anchor="middle" dominant-baseline="middle">' + escapeXml(percent) + '</text>');
    }
    parts.push('</svg>');
    container.innerHTML = parts.join('');
  }

  /**
   * Горизонтальные полосы.
   * items: [{ label, value, color, hint }]
   */
  function hbars(container, options) {
    if (!container) return;
    const items = (options && options.items ? options.items : []).filter(function (item) {
      return Number(item.value) > 0;
    });
    const format = options && options.formatValue ? options.formatValue : compact;
    if (!items.length) {
      empty(container, options && options.emptyText ? options.emptyText : 'Нет данных за период');
      return;
    }
    const max = items.reduce(function (maxValue, item) {
      return Math.max(maxValue, Number(item.value) || 0);
    }, 0);

    container.innerHTML = '<div class="hbar-list">' + items.map(function (item, index) {
      const width = max > 0 ? Math.max(2, (Number(item.value) / max) * 100) : 0;
      const color = item.color || ['#60a5fa', '#34d399', '#a78bfa', '#fbbf24', '#22d3ee'][index % 5];
      return '<div class="hbar-row">' +
        '<div class="hbar-top"><span class="hbar-label" title="' + escapeXml(item.label) + '">' + escapeXml(item.label) + '</span>' +
        '<span class="hbar-value">' + escapeXml(format(item.value)) + '</span></div>' +
        '<div class="hbar-track"><div class="hbar-fill" style="width:' + width.toFixed(1) + '%;background:' + escapeXml(color) + '"></div></div>' +
        (item.hint ? '<div class="hbar-hint">' + escapeXml(item.hint) + '</div>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  window.Charts = {
    stackedBars: stackedBars,
    donut: donut,
    hbars: hbars
  };
})();
