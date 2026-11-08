/* ============================================================
   «Наладчик» — экраны: обзор, доходы, командировки, объекты, отчёты
   ============================================================ */
(function () {
  'use strict';

  const Store = window.Store;
  const WC = window.WC;
  const App = WC.App;
  const esc = WC.esc;
  const icon = WC.icon;
  const money = WC.money;
  const fdate = WC.fdate;
  const sum = WC.sum;
  const plural = WC.plural;
  const unique = WC.unique;
  const getRange = WC.getRange;
  const Charts = WC.Charts;

  /* ---------- общие фрагменты ---------- */

  function kpiCard(label, value, iconName, tone, foot) {
    return '<article class="kpi-card">' +
      '<div class="kpi-top"><span class="kpi-label">' + esc(label) + '</span>' +
      '<span class="kpi-icon tone-' + esc(tone) + '">' + icon(iconName) + '</span></div>' +
      '<div class="kpi-value">' + esc(value) + '</div>' +
      '<div class="kpi-foot">' + (foot || '') + '</div>' +
      '</article>';
  }

  function deltaMarkup(delta) {
    if (delta === null || !Number.isFinite(delta)) return '';
    const tone = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';
    const arrow = delta > 0.05 ? '↑' : delta < -0.05 ? '↓' : '→';
    return '<span class="delta delta-' + tone + '">' + arrow + ' ' + Math.abs(delta).toFixed(1).replace('.', ',') + '%</span>';
  }

  function share(part, total) {
    if (!total) return '0%';
    return (part / total * 100).toFixed(1).replace('.', ',') + '%';
  }

  function emptyState(options) {
    return '<div class="empty-state">' +
      '<span class="empty-icon">' + icon(options.icon || 'database') + '</span>' +
      '<h3>' + esc(options.title) + '</h3>' +
      '<p>' + esc(options.text || '') + '</p>' +
      (options.action ? '<button type="button" class="btn btn-primary" data-action="' + esc(options.action.action) + '">' + icon(options.action.icon || 'plus') + esc(options.action.label) + '</button>' : '') +
      '</div>';
  }

  function sortMark(table, key) {
    const sort = App.sort[table];
    if (!sort || sort.key !== key) return '<span class="sort-mark">↕</span>';
    return '<span class="sort-mark is-active">' + (sort.dir === 'asc' ? '↑' : '↓') + '</span>';
  }

  function ariaSort(table, key) {
    const sort = App.sort[table];
    if (!sort || sort.key !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  /* ============================================================
     ОБЗОР
     ============================================================ */

  function dashboardMonths(range) {
    let months = Store.monthsInRange(range.from, range.to);
    let truncated = false;
    if (!months.length) {
      const dates = [];
      Store.state.incomes.forEach(function (income) { dates.push(income.date); });
      Store.state.trips.forEach(function (trip) { dates.push(trip.startDate); });
      dates.sort();
      const endISO = range.to || (dates.length ? dates[dates.length - 1] : Store.todayISO());
      const endDate = Store.parseISO(endISO) || new Date();
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
      months = Store.monthsInRange(Store.iso(startDate), endISO);
    }
    if (months.length > 12) {
      months = months.slice(-12);
      truncated = true;
    }
    return { months: months, truncated: truncated };
  }

  function renderDashboard() {
    const range = getRange();
    const incomes = Store.incomesInRange(range.from, range.to);
    const incomeRecords = Store.incomeRecords(incomes);
    const trips = Store.tripsInRange(range.from, range.to);
    const cash = sum(incomeRecords.filter(function (item) { return item.method === 'cash'; }));
    const bank = sum(incomeRecords.filter(function (item) { return item.method === 'bank'; }));
    const incomeTotal = cash + bank;
    const tripDays = trips.reduce(function (total, trip) {
      return total + Store.tripDaysWithin(trip, range.from, range.to);
    }, 0);
    const perDiem = trips.reduce(function (total, trip) {
      return total + Store.tripPerDiem(trip, range.from, range.to);
    }, 0);

    if (!WC.hasData()) {
      return '<section class="card welcome">' +
        '<div class="welcome-top">' +
        '<span class="welcome-mark">Н</span>' +
        '<div><span class="eyebrow">Личный кабинет</span><h2>Учёт доходов и командировок инженера-наладчика</h2>' +
        '<p>Все выплаты, наличные и безналичные поступления, источники дохода, поездки и суточные — в одном месте. Данные хранятся локально и могут синхронизироваться с GitHub.</p></div>' +
        '</div>' +
        '<div class="welcome-grid">' +
        '<div class="welcome-item">' + icon('wallet') + '<div><b>Все доходы</b><span>Аванс, окончательная зарплата, отпускные, премии и прочие поступления. Суточные учитываются отдельно и не входят в доход.</span></div></div>' +
        '<div class="welcome-item">' + icon('cash') + '<div><b>Наличные и безналичные</b><span>Раздельный учёт способа получения и источника дохода.</span></div></div>' +
        '<div class="welcome-item">' + icon('plane') + '<div><b>Командировки</b><span>Направление, сроки, количество суток и расчёт суточных.</span></div></div>' +
        '<div class="welcome-item">' + icon('github') + '<div><b>Данные на GitHub</b><span>Приватный Gist как личное облако и резервная копия.</span></div></div>' +
        '</div>' +
        '<div class="welcome-actions">' +
        '<button type="button" class="btn btn-primary" data-action="add-income">' + icon('plus') + 'Добавить первый доход</button>' +
        '<button type="button" class="btn btn-ghost" data-action="add-trip">' + icon('plane') + 'Добавить командировку</button>' +
        '<button type="button" class="btn btn-ghost" data-action="demo-data">' + icon('sparkles') + 'Загрузить демо-данные</button>' +
        '<button type="button" class="btn btn-ghost" data-action="open-sync">' + icon('cloud') + 'Настроить GitHub</button>' +
        '</div>' +
        '</section>';
    }

    const previous = Store.previousRange(range.from, range.to);
    let delta = null;
    if (previous) {
      const prevTotal = sum(Store.incomeRecords(Store.incomesInRange(previous.from, previous.to)));
      if (prevTotal > 0) delta = (incomeTotal - prevTotal) / prevTotal * 100;
    }

    const monthInfo = dashboardMonths(range);
    const typeItems = incomeTypes().map(function (item) {
      return { label: item.label, value: item.value, color: item.color };
    }).filter(function (item) { return item.value > 0; });

    const destinations = new Map();
    trips.forEach(function (trip) {
      const days = Store.tripDaysWithin(trip, range.from, range.to);
      if (!days) return;
      const key = trip.destination.toLowerCase();
      const current = destinations.get(key) || { name: trip.destination, days: 0, perDiem: 0, count: 0 };
      current.days += days;
      current.perDiem += Store.tripPerDiem(trip, range.from, range.to);
      current.count += 1;
      destinations.set(key, current);
    });
    const topDestinations = Array.from(destinations.values()).sort(function (a, b) { return b.days - a.days; }).slice(0, 4);

    const recent = incomeRecords.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt));
    }).slice(0, 6);

    const perDiemRate = tripDays ? Math.round(perDiem / tripDays) : Store.state.settings.perDiemRate;

    return '<div class="dashboard">' +
      '<div class="kpi-grid">' +
      kpiCard('Доход за период', money(incomeTotal), 'wallet', 'blue',
        delta !== null
          ? deltaMarkup(delta) + ' <span class="muted">к прошлому периоду · без суточных</span>'
          : '<span class="muted">' + incomeRecords.length + ' ' + plural(incomeRecords.length, ['поступление', 'поступления', 'поступлений']) + ' · без суточных</span>') +
      kpiCard('Наличные', money(cash), 'cash', 'green', '<span class="muted">' + share(cash, incomeTotal) + ' от дохода</span>') +
      kpiCard('Безналичные', money(bank), 'card', 'cyan', '<span class="muted">' + share(bank, incomeTotal) + ' от дохода</span>') +
      kpiCard('Суток в командировках', String(tripDays), 'plane', 'violet',
        '<span class="muted">' + trips.length + ' ' + plural(trips.length, ['поездка', 'поездки', 'поездок']) + ' за период</span>') +
      kpiCard('Суточные', money(perDiem), 'calendar', 'amber',
        '<span class="muted">' + (tripDays ? money(perDiemRate) + ' / сутки' : 'нет поездок за период') + '</span>') +
      '</div>' +

      '<div class="dash-grid">' +
      '<section class="card span-2">' +
      '<header class="card-head"><div><h2>Динамика доходов</h2><p>Наличные и безналичные поступления по месяцам' + (monthInfo.truncated ? ' · последние 12 месяцев' : '') + '</p></div>' +
      '<div class="legend"><span class="legend-item"><i class="legend-dot cash"></i>Наличные</span><span class="legend-item"><i class="legend-dot bank"></i>Безналичные</span></div></header>' +
      '<div class="chart" id="chartMonths"></div>' +
      '</section>' +

      '<section class="card">' +
      '<header class="card-head"><div><h2>Структура доходов</h2><p>По типам выплат, без суточных</p></div></header>' +
      '<div class="donut-layout"><div class="chart donut-chart" id="chartTypes"></div><div class="legend legend-vertical" id="chartTypesLegend"></div></div>' +
      '</section>' +

      '<section class="card">' +
      '<header class="card-head"><div><h2>Источники дохода</h2><p>Кто и сколько выплатил</p></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="go-incomes">Все доходы' + icon('arrow-right') + '</button></header>' +
      '<div id="chartSources"></div>' +
      '</section>' +

      '<section class="card">' +
      '<header class="card-head"><div><h2>Командировки</h2><p>' + tripDays + ' ' + plural(tripDays, ['сутки', 'суток', 'суток']) + ' за период</p></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="go-trips">Подробнее' + icon('arrow-right') + '</button></header>' +
      (topDestinations.length
        ? '<div class="dest-list">' + topDestinations.map(function (item) {
          return '<div class="dest-row"><div class="dest-main"><span class="dest-name">' + esc(item.name) + '</span>' +
            '<span class="dest-sub">' + item.count + ' ' + plural(item.count, ['поездка', 'поездки', 'поездок']) + ' · ' + item.days + ' сут.</span></div>' +
            '<span class="dest-amount">' + money(item.perDiem) + '</span></div>';
        }).join('') + '</div>'
        : '<div class="mini-empty">' + icon('plane') + '<p>За период командировок нет</p><button type="button" class="btn btn-ghost btn-sm" data-action="add-trip">Добавить</button></div>') +
      '</section>' +

      '<section class="card span-2">' +
      '<header class="card-head"><div><h2>Последние поступления</h2><p>Свежие записи за выбранный период</p></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="go-incomes">Все доходы' + icon('arrow-right') + '</button></header>' +
      (recent.length
        ? '<div class="mini-list">' + recent.map(function (item) {
          const meta = Store.INCOME_TYPES[item.type];
          return '<div class="mini-row">' +
            '<span class="mini-icon" style="color:' + meta.color + ';background:' + meta.color + '1f">' + icon('wallet') + '</span>' +
            '<div class="mini-main"><span class="mini-title">' + esc(meta.label) + '</span>' +
            '<span class="mini-sub">' + esc(item.sourceName || 'Источник не указан') + (item.objectId ? ' · ' + esc(WC.objectLabel(item.objectId)) : '') + '</span></div>' +
            '<div class="mini-side"><b>' + money(item.amount) + '</b><span>' + fdate(item.date) + ' · ' + (item.method === 'cash' ? 'наличные' : 'безнал') + '</span></div>' +
            '</div>';
        }).join('') + '</div>'
        : '<div class="mini-empty">' + icon('wallet') + '<p>За период доходов нет</p><button type="button" class="btn btn-ghost btn-sm" data-action="add-income">Добавить доход</button></div>') +
      '</section>' +
      '</div>' +
      '</div>';
  }

  function incomeTypes(list) {
    const range = getRange();
    const incomes = Store.incomeRecords(list || Store.incomesInRange(range.from, range.to));
    return Store.INCOME_TYPE_ORDER.filter(function (type) { return type !== 'perDiem'; }).map(function (type) {
      const meta = Store.INCOME_TYPES[type];
      return {
        type: type,
        label: meta.label,
        color: meta.color,
        value: incomes.filter(function (item) { return item.type === type; }).reduce(function (total, item) { return total + item.amount; }, 0)
      };
    });
  }

  function mountDashboard() {
    const range = getRange();
    const incomes = Store.incomeRecords(Store.incomesInRange(range.from, range.to));
    const info = dashboardMonths(range);
    const byMonth = {};
    info.months.forEach(function (month) {
      byMonth[month.key] = { cash: 0, bank: 0 };
    });
    incomes.forEach(function (income) {
      const key = income.date.slice(0, 7);
      if (byMonth[key]) byMonth[key][income.method] += income.amount;
    });

    Charts.stackedBars(document.getElementById('chartMonths'), {
      months: info.months.map(function (month) {
        return { label: month.label, full: month.full, values: [byMonth[month.key].cash, byMonth[month.key].bank] };
      }),
      series: [
        { label: 'Наличные', className: 'chart-bar-cash' },
        { label: 'Безналичные', className: 'chart-bar-bank' }
      ],
      formatValue: function (value) { return Store.compact(value); }
    });

    const types = incomeTypes().filter(function (item) { return item.value > 0; });
    const total = types.reduce(function (accumulator, item) { return accumulator + item.value; }, 0);
    Charts.donut(document.getElementById('chartTypes'), {
      items: types,
      centerValue: money(total),
      centerLabel: 'за период',
      emptyText: 'Нет доходов за период'
    });
    const legend = document.getElementById('chartTypesLegend');
    if (legend) {
      legend.innerHTML = types.length
        ? types.map(function (item) {
          return '<div class="legend-item legend-row"><i class="legend-dot" style="background:' + item.color + '"></i>' +
            '<span class="legend-name">' + esc(item.label) + '</span>' +
            '<b>' + share(item.value, total) + '</b></div>';
        }).join('')
        : '<span class="muted">Нет данных</span>';
    }

    const sources = new Map();
    incomes.forEach(function (income) {
      const key = income.sourceName || 'Без источника';
      const current = sources.get(key) || { label: key, value: 0, count: 0 };
      current.value += income.amount;
      current.count += 1;
      sources.set(key, current);
    });
    const topSources = Array.from(sources.values()).sort(function (a, b) { return b.value - a.value; }).slice(0, 5);
    Charts.hbars(document.getElementById('chartSources'), {
      items: topSources.map(function (item) {
        return {
          label: item.label,
          value: item.value,
          hint: item.count + ' ' + plural(item.count, ['поступление', 'поступления', 'поступлений'])
        };
      }),
      formatValue: money,
      emptyText: 'Источники появятся после первого дохода'
    });
  }

  /* ============================================================
     ДОХОДЫ
     ============================================================ */

  function filteredIncomes() {
    const range = getRange();
    let list = Store.incomesInRange(range.from, range.to);
    const filters = App.incomeFilters;
    const search = filters.search.trim().toLowerCase();
    if (filters.type) list = list.filter(function (item) { return item.type === filters.type; });
    if (filters.method) list = list.filter(function (item) { return item.method === filters.method; });
    if (filters.source) list = list.filter(function (item) { return (item.sourceName || '') === filters.source; });
    if (filters.object) {
      list = list.filter(function (item) {
        return filters.object === '__none__' ? !item.objectId : item.objectId === filters.object;
      });
    }
    if (search) {
      list = list.filter(function (item) {
        const haystack = [
          item.sourceName,
          item.note,
          Store.objectName(item.objectId),
          Store.INCOME_TYPES[item.type] ? Store.INCOME_TYPES[item.type].label : '',
          item.method === 'cash' ? 'наличные' : 'безналичные',
          String(item.amount)
        ].join(' ').toLowerCase();
        return haystack.indexOf(search) !== -1;
      });
    }
    const sort = App.sort.incomes;
    const direction = sort.dir === 'asc' ? 1 : -1;
    return list.slice().sort(function (a, b) {
      let left;
      let right;
      if (sort.key === 'amount') {
        left = a.amount;
        right = b.amount;
      } else if (sort.key === 'type') {
        left = Store.INCOME_TYPES[a.type].label;
        right = Store.INCOME_TYPES[b.type].label;
      } else if (sort.key === 'source') {
        left = a.sourceName || '';
        right = b.sourceName || '';
      } else if (sort.key === 'object') {
        left = Store.objectName(a.objectId);
        right = Store.objectName(b.objectId);
      } else {
        left = a.date;
        right = b.date;
      }
      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * direction;
      }
      const result = String(left).localeCompare(String(right), 'ru');
      return (result || a.date.localeCompare(b.date)) * direction;
    });
  }

  function incomeTableHtml(list) {
    if (!list.length) {
      const filters = App.incomeFilters;
      const filtersActive = Boolean(filters.search || filters.type || filters.method || filters.source || filters.object);
      if (Store.state.incomes.length && !filtersActive) {
        return emptyState({
          icon: 'wallet',
          title: 'За выбранный период доходов нет',
          text: 'Измените период в шапке или посмотрите все записи за всё время.',
          action: { action: 'set-period-all', label: 'Показать всё время', icon: 'calendar' }
        });
      }
      return emptyState({
        icon: 'wallet',
        title: Store.state.incomes.length ? 'Ничего не найдено' : 'Пока нет доходов',
        text: Store.state.incomes.length ? 'Попробуйте изменить фильтры или период.' : 'Добавьте аванс, окончательную зарплату, отпускные или другой доход.',
        action: Store.state.incomes.length ? { action: 'reset-income-filters', label: 'Сбросить фильтры', icon: 'refresh' } : { action: 'add-income', label: 'Добавить доход', icon: 'plus' }
      });
    }

    const incomeOnly = Store.incomeRecords(list);
    const cash = sum(incomeOnly.filter(function (item) { return item.method === 'cash'; }));
    const bank = sum(incomeOnly.filter(function (item) { return item.method === 'bank'; }));
    const total = cash + bank;
    const perDiemPaid = sum(list.filter(function (item) { return item.type === 'perDiem'; }));

    return '<div class="summary-bar">' +
      '<div class="summary-chip"><span>' + list.length + ' ' + plural(list.length, ['запись', 'записи', 'записей']) + '</span></div>' +
      '<div class="summary-chip"><span class="muted">Доход без суточных</span><b>' + money(total) + '</b></div>' +
      '<div class="summary-chip"><i class="legend-dot cash"></i><span>Наличные</span><b>' + money(cash) + '</b></div>' +
      '<div class="summary-chip"><i class="legend-dot bank"></i><span>Безналичные</span><b>' + money(bank) + '</b></div>' +
      (perDiemPaid > 0 ? '<div class="summary-chip"><span class="muted">Суточные (справочно)</span><b>' + money(perDiemPaid) + '</b></div>' : '') +
      '</div>' +
      '<section class="card table-card"><div class="table-wrap"><table class="data-table" data-table="incomes">' +
      '<thead><tr>' +
      '<th class="sortable" data-sort="date" aria-sort="' + ariaSort('incomes', 'date') + '">Дата ' + sortMark('incomes', 'date') + '</th>' +
      '<th class="sortable" data-sort="type" aria-sort="' + ariaSort('incomes', 'type') + '">Тип ' + sortMark('incomes', 'type') + '</th>' +
      '<th class="sortable" data-sort="source" aria-sort="' + ariaSort('incomes', 'source') + '">Источник ' + sortMark('incomes', 'source') + '</th>' +
      '<th class="sortable" data-sort="object" aria-sort="' + ariaSort('incomes', 'object') + '">Объект ' + sortMark('incomes', 'object') + '</th>' +
      '<th>Способ</th>' +
      '<th class="sortable num" data-sort="amount" aria-sort="' + ariaSort('incomes', 'amount') + '">Сумма ' + sortMark('incomes', 'amount') + '</th>' +
      '<th class="actions-col"><span class="sr-only">Действия</span></th>' +
      '</tr></thead><tbody>' +
      list.map(function (item) {
        const objectName = Store.objectName(item.objectId);
        return '<tr>' +
          '<td class="nowrap">' + fdate(item.date) + '</td>' +
          '<td>' + WC.typeBadge(item.type) + '</td>' +
          '<td><div class="cell-main">' + esc(item.sourceName || 'Не указан') + '</div>' +
          (item.note ? '<div class="cell-sub cell-note" title="' + esc(item.note) + '">' + esc(item.note) + '</div>' : '') + '</td>' +
          '<td>' + (objectName ? '<div class="cell-main">' + esc(objectName) + '</div>' : '<span class="muted">—</span>') + '</td>' +
          '<td>' + WC.methodBadge(item.method) + '</td>' +
          '<td class="num"><b>' + money(item.amount) + '</b>' +
          (item.type === 'perDiem' ? '<div class="cell-sub">не входит в доход</div>' : '') + '</td>' +
          '<td class="actions-col"><div class="row-actions">' +
          '<button type="button" class="icon-btn icon-btn-sm" data-action="edit-income" data-id="' + esc(item.id) + '" title="Изменить">' + icon('edit') + '</button>' +
          '<button type="button" class="icon-btn icon-btn-sm danger" data-action="delete-income" data-id="' + esc(item.id) + '" title="Удалить">' + icon('trash') + '</button>' +
          '</div></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div></section>';
  }

  function renderIncomes() {
    const filters = App.incomeFilters;
    const sources = WC.allSourceNames();
    const objects = Store.state.objects.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
    const activeFilters = Boolean(filters.search || filters.type || filters.method || filters.source || filters.object);

    return '<div class="toolbar card">' +
      '<label class="search-field">' + icon('search') +
      '<input type="search" data-income-filter="search" id="incomeSearch" placeholder="Поиск по источнику, объекту, комментарию…" value="' + esc(filters.search) + '" autocomplete="off">' +
      '</label>' +
      '<select class="filter-select" data-income-filter="type" aria-label="Тип дохода">' +
      '<option value="">Все типы</option>' + Store.INCOME_TYPE_ORDER.map(function (type) {
        return '<option value="' + type + '"' + (filters.type === type ? ' selected' : '') + '>' + esc(Store.INCOME_TYPES[type].label) + '</option>';
      }).join('') + '</select>' +
      '<select class="filter-select" data-income-filter="method" aria-label="Способ получения">' +
      '<option value="">Любой способ</option>' +
      '<option value="cash"' + (filters.method === 'cash' ? ' selected' : '') + '>Наличные</option>' +
      '<option value="bank"' + (filters.method === 'bank' ? ' selected' : '') + '>Безналичные</option>' +
      '</select>' +
      '<select class="filter-select" data-income-filter="source" aria-label="Источник дохода">' +
      '<option value="">Все источники</option>' + sources.map(function (source) {
        return '<option value="' + esc(source) + '"' + (filters.source === source ? ' selected' : '') + '>' + esc(source) + '</option>';
      }).join('') + '</select>' +
      '<select class="filter-select" data-income-filter="object" aria-label="Объект">' +
      '<option value="">Все объекты</option>' +
      '<option value="__none__"' + (filters.object === '__none__' ? ' selected' : '') + '>Без объекта</option>' +
      objects.map(function (object) {
        return '<option value="' + esc(object.id) + '"' + (filters.object === object.id ? ' selected' : '') + '>' + esc(object.name) + '</option>';
      }).join('') + '</select>' +
      '<button type="button" class="btn btn-ghost btn-sm' + (activeFilters ? '' : ' is-muted') + '" data-action="reset-income-filters"' + (activeFilters ? '' : ' disabled') + '>' + icon('refresh') + 'Сбросить</button>' +
      '</div>' +
      '<div id="incomesResults">' + incomeTableHtml(filteredIncomes()) + '</div>';
  }

  function syncResetButton(action, active) {
    const button = document.querySelector('[data-action="' + action + '"]');
    if (!button) return;
    button.disabled = !active;
    button.classList.toggle('is-muted', !active);
  }

  function renderIncomesResults() {
    const container = document.getElementById('incomesResults');
    if (container) container.innerHTML = incomeTableHtml(filteredIncomes());
    const filters = App.incomeFilters;
    syncResetButton('reset-income-filters', Boolean(filters.search || filters.type || filters.method || filters.source || filters.object));
  }

  /* ============================================================
     КОМАНДИРОВКИ
     ============================================================ */

  function filteredTrips() {
    const range = getRange();
    let list = Store.tripsInRange(range.from, range.to);
    const filters = App.tripFilters;
    const search = filters.search.trim().toLowerCase();
    if (filters.object) {
      list = list.filter(function (trip) {
        return filters.object === '__none__' ? !trip.objectId : trip.objectId === filters.object;
      });
    }
    if (search) {
      list = list.filter(function (trip) {
        return [trip.destination, Store.objectName(trip.objectId), trip.transport, trip.purpose, trip.note]
          .join(' ').toLowerCase().indexOf(search) !== -1;
      });
    }
    const sort = App.sort.trips;
    const direction = sort.dir === 'asc' ? 1 : -1;
    return list.slice().sort(function (a, b) {
      let left;
      let right;
      if (sort.key === 'days') {
        left = Store.tripDays(a);
        right = Store.tripDays(b);
      } else if (sort.key === 'perDiem') {
        left = Store.tripPerDiem(a);
        right = Store.tripPerDiem(b);
      } else if (sort.key === 'expenses') {
        left = Store.tripExpensesTotal(a);
        right = Store.tripExpensesTotal(b);
      } else if (sort.key === 'balance') {
        left = Store.tripBalance(a);
        right = Store.tripBalance(b);
      } else if (sort.key === 'destination') {
        left = a.destination;
        right = b.destination;
      } else {
        left = a.startDate;
        right = b.startDate;
      }
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return (String(left).localeCompare(String(right), 'ru') || a.startDate.localeCompare(b.startDate)) * direction;
    });
  }

  function tripPeriod(trip) {
    if (trip.startDate === trip.endDate) return fdate(trip.startDate);
    return fdate(trip.startDate) + ' — ' + fdate(trip.endDate);
  }

  function tripTableHtml(list, range) {
    if (!list.length) {
      const filters = App.tripFilters;
      const filtersActive = Boolean(filters.search || filters.object);
      if (Store.state.trips.length && !filtersActive) {
        return emptyState({
          icon: 'plane',
          title: 'За выбранный период командировок нет',
          text: 'Измените период в шапке или посмотрите все поездки за всё время.',
          action: { action: 'set-period-all', label: 'Показать всё время', icon: 'calendar' }
        });
      }
      return emptyState({
        icon: 'plane',
        title: Store.state.trips.length ? 'Ничего не найдено' : 'Пока нет командировок',
        text: Store.state.trips.length ? 'Попробуйте изменить фильтры или период.' : 'Добавьте поездку: направление, даты и ставку суточных.',
        action: Store.state.trips.length ? { action: 'reset-trip-filters', label: 'Сбросить фильтры', icon: 'refresh' } : { action: 'add-trip', label: 'Добавить командировку', icon: 'plus' }
      });
    }

    const days = list.reduce(function (total, trip) { return total + Store.tripDaysWithin(trip, range.from, range.to); }, 0);
    const perDiem = list.reduce(function (total, trip) { return total + Store.tripPerDiem(trip, range.from, range.to); }, 0);
    const fullDays = list.reduce(function (total, trip) { return total + Store.tripDays(trip); }, 0);
    const expenses = list.reduce(function (total, trip) { return total + Store.tripExpensesTotal(trip); }, 0);
    const reportTotal = list.reduce(function (total, trip) { return total + Store.tripReportTotal(trip); }, 0);
    const advances = list.reduce(function (total, trip) { return total + Store.tripAdvance(trip); }, 0);
    const balance = advances - reportTotal;

    return '<div class="summary-bar">' +
      '<div class="summary-chip"><span>' + list.length + ' ' + plural(list.length, ['командировка', 'командировки', 'командировок']) + '</span></div>' +
      '<div class="summary-chip"><span class="muted">Суток в периоде</span><b>' + days + '</b></div>' +
      '<div class="summary-chip"><span class="muted">Суточные</span><b>' + money(perDiem) + '</b></div>' +
      '<div class="summary-chip"><span class="muted">Расходы</span><b>' + money(expenses) + '</b></div>' +
      '<div class="summary-chip"><span class="muted">К отчёту</span><b>' + money(reportTotal) + '</b></div>' +
      '<div class="summary-chip"><span class="muted">Авансы</span><b>' + money(advances) + '</b></div>' +
      '<div class="summary-chip"><span class="muted">' + (balance > 0 ? 'К возврату' : balance < 0 ? 'К возмещению' : 'Расчёт') + '</span><b class="' + (balance > 0 ? 'money-return' : balance < 0 ? 'money-due' : '') + '">' + money(Math.abs(balance)) + '</b></div>' +
      (fullDays !== days ? '<div class="summary-chip"><span class="muted">Всего суток по поездкам</span><b>' + fullDays + '</b></div>' : '') +
      '</div>' +
      '<section class="card table-card"><div class="table-wrap"><table class="data-table" data-table="trips">' +
      '<thead><tr>' +
      '<th class="sortable" data-sort="destination" aria-sort="' + ariaSort('trips', 'destination') + '">Направление ' + sortMark('trips', 'destination') + '</th>' +
      '<th class="sortable" data-sort="startDate" aria-sort="' + ariaSort('trips', 'startDate') + '">Период ' + sortMark('trips', 'startDate') + '</th>' +
      '<th class="sortable num" data-sort="days" aria-sort="' + ariaSort('trips', 'days') + '">Суток ' + sortMark('trips', 'days') + '</th>' +
      '<th class="sortable num" data-sort="perDiem" aria-sort="' + ariaSort('trips', 'perDiem') + '">Суточные ' + sortMark('trips', 'perDiem') + '</th>' +
      '<th class="sortable num" data-sort="expenses" aria-sort="' + ariaSort('trips', 'expenses') + '">Расходы ' + sortMark('trips', 'expenses') + '</th>' +
      '<th class="sortable num" data-sort="balance" aria-sort="' + ariaSort('trips', 'balance') + '">Баланс ' + sortMark('trips', 'balance') + '</th>' +
      '<th>Статус</th>' +
      '<th class="actions-col"><span class="sr-only">Действия</span></th>' +
      '</tr></thead><tbody>' +
      list.map(function (trip) {
        const objectName = Store.objectName(trip.objectId);
        const daysInRange = Store.tripDaysWithin(trip, range.from, range.to);
        const fullTripDays = Store.tripDays(trip);
        const perDiemInRange = Store.tripPerDiem(trip, range.from, range.to);
        const showPartial = daysInRange !== fullTripDays;
        const expensesTotal = Store.tripExpensesTotal(trip);
        const advance = Store.tripAdvance(trip);
        const balanceValue = Store.tripBalance(trip);
        const balanceText = balanceValue > 0 ? 'к возврату' : balanceValue < 0 ? 'к возмещению' : 'расчёт закрыт';
        const balanceClass = balanceValue > 0 ? 'money-return' : balanceValue < 0 ? 'money-due' : 'muted';
        return '<tr>' +
          '<td><div class="cell-main">' + esc(trip.destination) + '</div>' +
          '<div class="cell-sub">' + (objectName ? esc(objectName) : 'Без объекта') + (trip.transport ? ' · ' + esc(trip.transport) : '') + '</div></td>' +
          '<td class="nowrap">' + tripPeriod(trip) + '</td>' +
          '<td class="num"><b>' + fullTripDays + '</b>' + (showPartial ? '<div class="cell-sub">в периоде: ' + daysInRange + '</div>' : '') + '</td>' +
          '<td class="num"><b>' + money(Store.tripPerDiem(trip)) + '</b>' +
          '<div class="cell-sub">' + money(trip.perDiemRate) + ' / сутки' + (showPartial ? ' · в периоде ' + money(perDiemInRange) : '') + '</div></td>' +
          '<td class="num"><b>' + money(expensesTotal) + '</b>' +
          '<div class="cell-sub">аванс ' + money(advance) + '</div></td>' +
          '<td class="num"><b class="' + balanceClass + '">' + money(Math.abs(balanceValue)) + '</b>' +
          '<div class="cell-sub">' + balanceText + '</div></td>' +
          '<td>' + WC.tripStatusBadge(Store.tripStatus(trip)) + '</td>' +
          '<td class="actions-col"><div class="row-actions">' +
          '<button type="button" class="icon-btn icon-btn-sm" data-action="open-trip-expenses" data-id="' + esc(trip.id) + '" title="Расходы и аванс">' + icon('wallet') + '</button>' +
          '<button type="button" class="icon-btn icon-btn-sm" data-action="open-advance-report" data-id="' + esc(trip.id) + '" title="Авансовый отчёт">' + icon('printer') + '</button>' +
          '<button type="button" class="icon-btn icon-btn-sm" data-action="edit-trip" data-id="' + esc(trip.id) + '" title="Изменить">' + icon('edit') + '</button>' +
          '<button type="button" class="icon-btn icon-btn-sm danger" data-action="delete-trip" data-id="' + esc(trip.id) + '" title="Удалить">' + icon('trash') + '</button>' +
          '</div></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div></section>';
  }

  function renderTrips() {
    const range = getRange();
    const filters = App.tripFilters;
    const objects = Store.state.objects.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
    const activeFilters = Boolean(filters.search || filters.object);

    return '<div class="toolbar card">' +
      '<label class="search-field">' + icon('search') +
      '<input type="search" data-trip-filter="search" id="tripSearch" placeholder="Поиск по направлению, объекту, цели…" value="' + esc(filters.search) + '" autocomplete="off">' +
      '</label>' +
      '<select class="filter-select" data-trip-filter="object" aria-label="Объект">' +
      '<option value="">Все объекты</option>' +
      '<option value="__none__"' + (filters.object === '__none__' ? ' selected' : '') + '>Без объекта</option>' +
      objects.map(function (object) {
        return '<option value="' + esc(object.id) + '"' + (filters.object === object.id ? ' selected' : '') + '>' + esc(object.name) + '</option>';
      }).join('') + '</select>' +
      '<button type="button" class="btn btn-ghost btn-sm' + (activeFilters ? '' : ' is-muted') + '" data-action="reset-trip-filters"' + (activeFilters ? '' : ' disabled') + '>' + icon('refresh') + 'Сбросить</button>' +
      '</div>' +
      '<div id="tripsResults">' + tripTableHtml(filteredTrips(), range) + '</div>';
  }

  function renderTripsResults() {
    const container = document.getElementById('tripsResults');
    if (container) container.innerHTML = tripTableHtml(filteredTrips(), getRange());
    const filters = App.tripFilters;
    syncResetButton('reset-trip-filters', Boolean(filters.search || filters.object));
  }

  /* ============================================================
     ОБЪЕКТЫ
     ============================================================ */

  function renderObjects() {
    const objects = Store.state.objects.slice().sort(function (a, b) {
      const order = { active: 0, planned: 1, done: 2 };
      return (order[a.status] - order[b.status]) || a.name.localeCompare(b.name, 'ru');
    });

    if (!objects.length) {
      return emptyState({
        icon: 'building',
        title: 'Пока нет объектов',
        text: 'Добавьте площадку или заказчика, чтобы связывать с ними доходы и командировки.',
        action: { action: 'add-object', label: 'Добавить объект', icon: 'plus' }
      });
    }

    return '<div class="objects-grid">' + objects.map(function (object) {
      const objectIncomes = Store.incomeRecords(Store.state.incomes.filter(function (income) { return income.objectId === object.id; }));
      const objectTrips = Store.state.trips.filter(function (trip) { return trip.objectId === object.id; });
      const incomeTotal = sum(objectIncomes);
      const days = objectTrips.reduce(function (total, trip) { return total + Store.tripDays(trip); }, 0);
      const perDiem = objectTrips.reduce(function (total, trip) { return total + Store.tripPerDiem(trip); }, 0);
      const period = object.startDate || object.endDate
        ? (object.startDate ? fdate(object.startDate) : '—') + ' — ' + (object.endDate ? fdate(object.endDate) : 'по н. в.')
        : 'Период не указан';

      return '<article class="card object-card">' +
        '<header class="object-head"><div><h2>' + esc(object.name) + '</h2>' +
        '<p>' + esc(object.customer || 'Заказчик не указан') + (object.address ? ' · ' + esc(object.address) : '') + '</p></div>' +
        WC.objectStatusBadge(object.status) + '</header>' +
        '<div class="object-period">' + icon('calendar') + esc(period) + '</div>' +
        '<div class="object-stats">' +
        '<div><span>Доход</span><b>' + money(incomeTotal) + '</b></div>' +
        '<div><span>Суток</span><b>' + days + '</b></div>' +
        '<div><span>Суточные</span><b>' + money(perDiem) + '</b></div>' +
        '</div>' +
        (object.note ? '<p class="object-note">' + esc(object.note) + '</p>' : '') +
        '<footer class="object-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="show-object-incomes" data-id="' + esc(object.id) + '">' + icon('wallet') + 'Доходы</button>' +
        '<button type="button" class="icon-btn icon-btn-sm" data-action="edit-object" data-id="' + esc(object.id) + '" title="Изменить">' + icon('edit') + '</button>' +
        '<button type="button" class="icon-btn icon-btn-sm danger" data-action="delete-object" data-id="' + esc(object.id) + '" title="Удалить">' + icon('trash') + '</button>' +
        '</footer>' +
        '</article>';
    }).join('') + '</div>';
  }

  /* ============================================================
     ОТЧЁТЫ
     ============================================================ */

  function monthBounds(key) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    return {
      from: key + '-01',
      to: Store.iso(new Date(year, month, 0))
    };
  }

  function reportMonths(range, incomes, trips) {
    let months = Store.monthsInRange(range.from, range.to);
    if (!months.length) {
      const dates = [];
      incomes.forEach(function (income) { dates.push(income.date); });
      trips.forEach(function (trip) { dates.push(trip.startDate); });
      dates.sort();
      const start = range.from || dates[0] || Store.todayISO();
      const end = range.to || dates[dates.length - 1] || Store.todayISO();
      months = Store.monthsInRange(start, end);
    }
    return months;
  }

  function renderReports() {
    const range = getRange();
    const incomes = Store.incomesInRange(range.from, range.to);
    const incomeRecords = Store.incomeRecords(incomes);
    const trips = Store.tripsInRange(range.from, range.to);
    const cash = sum(incomeRecords.filter(function (item) { return item.method === 'cash'; }));
    const bank = sum(incomeRecords.filter(function (item) { return item.method === 'bank'; }));
    const incomeTotal = cash + bank;
    const days = trips.reduce(function (total, trip) { return total + Store.tripDaysWithin(trip, range.from, range.to); }, 0);
    const perDiem = trips.reduce(function (total, trip) { return total + Store.tripPerDiem(trip, range.from, range.to); }, 0);
    const months = reportMonths(range, incomes, trips);

    const monthRows = months.map(function (month) {
      const bounds = monthBounds(month.key);
      const monthIncomes = incomeRecords.filter(function (income) { return income.date.slice(0, 7) === month.key; });
      const monthTrips = trips.filter(function (trip) { return trip.startDate <= bounds.to && trip.endDate >= bounds.from; });
      const monthDays = monthTrips.reduce(function (total, trip) { return total + Store.tripDaysWithin(trip, bounds.from, bounds.to); }, 0);
      const monthPerDiem = monthTrips.reduce(function (total, trip) { return total + Store.tripPerDiem(trip, bounds.from, bounds.to); }, 0);
      return {
        label: month.full,
        income: sum(monthIncomes),
        cash: sum(monthIncomes.filter(function (item) { return item.method === 'cash'; })),
        bank: sum(monthIncomes.filter(function (item) { return item.method === 'bank'; })),
        days: monthDays,
        perDiem: monthPerDiem
      };
    });

    const typeRows = Store.INCOME_TYPE_ORDER.filter(function (type) { return type !== 'perDiem'; }).map(function (type) {
      const list = incomeRecords.filter(function (item) { return item.type === type; });
      return { label: Store.INCOME_TYPES[type].label, count: list.length, value: sum(list), color: Store.INCOME_TYPES[type].color };
    }).filter(function (row) { return row.value > 0; }).sort(function (a, b) { return b.value - a.value; });

    const sourceMap = new Map();
    incomeRecords.forEach(function (income) {
      const key = income.sourceName || 'Без источника';
      const current = sourceMap.get(key) || { label: key, value: 0, count: 0 };
      current.value += income.amount;
      current.count += 1;
      sourceMap.set(key, current);
    });
    const sourceRows = Array.from(sourceMap.values()).sort(function (a, b) { return b.value - a.value; });

    const objectMap = new Map();
    Store.state.objects.forEach(function (object) {
      objectMap.set(object.id, { label: object.name, income: 0, days: 0, perDiem: 0 });
    });
    incomeRecords.forEach(function (income) {
      if (!income.objectId) return;
      const row = objectMap.get(income.objectId);
      if (row) row.income += income.amount;
    });
    trips.forEach(function (trip) {
      if (!trip.objectId) return;
      const row = objectMap.get(trip.objectId);
      if (!row) return;
      row.days += Store.tripDaysWithin(trip, range.from, range.to);
      row.perDiem += Store.tripPerDiem(trip, range.from, range.to);
    });
    const noObject = {
      label: 'Без объекта',
      income: incomeRecords.filter(function (item) { return !item.objectId; }).reduce(function (total, item) { return total + item.amount; }, 0),
      days: trips.filter(function (item) { return !item.objectId; }).reduce(function (total, item) { return total + Store.tripDaysWithin(item, range.from, range.to); }, 0),
      perDiem: trips.filter(function (item) { return !item.objectId; }).reduce(function (total, item) { return total + Store.tripPerDiem(item, range.from, range.to); }, 0)
    };
    const objectRows = Array.from(objectMap.values()).filter(function (row) {
      return row.income > 0 || row.days > 0;
    });
    if (noObject.income > 0 || noObject.days > 0) objectRows.push(noObject);
    objectRows.sort(function (a, b) { return b.income - a.income; });

    const destinationMap = new Map();
    trips.forEach(function (trip) {
      const key = trip.destination.toLowerCase();
      const current = destinationMap.get(key) || { label: trip.destination, count: 0, days: 0, perDiem: 0 };
      const tripDays = Store.tripDaysWithin(trip, range.from, range.to);
      if (!tripDays) return;
      current.count += 1;
      current.days += tripDays;
      current.perDiem += Store.tripPerDiem(trip, range.from, range.to);
      destinationMap.set(key, current);
    });
    const destinationRows = Array.from(destinationMap.values()).sort(function (a, b) { return b.days - a.days; });

    function tableRows(rows, columns, totals) {
      return rows.map(function (row) {
        return '<tr>' + columns.map(function (column) {
          const value = row[column.key];
          if (column.type === 'money') return '<td class="num">' + money(value) + '</td>';
          if (column.type === 'share') return '<td class="num"><div class="share-cell"><span>' + share(value, incomeTotal) + '</span><i style="width:' + Math.min(100, value / (incomeTotal || 1) * 100) + '%"></i></div></td>';
          if (column.type === 'count') return '<td class="num">' + value + '</td>';
          if (column.type === 'days') return '<td class="num">' + value + '</td>';
          return '<td>' + esc(value) + '</td>';
        }).join('') + '</tr>';
      }).join('') + (totals ? '<tr class="total-row">' + totals.map(function (value, index) {
        return index === 0 ? '<td>Итого</td>' : '<td class="num">' + value + '</td>';
      }).join('') + '</tr>' : '');
    }

    return '<div class="report-actions">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="export-incomes-csv" data-scope="period">' + icon('download') + 'CSV доходов</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="export-trips-csv" data-scope="period">' + icon('download') + 'CSV командировок</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="export-expenses-csv" data-scope="period">' + icon('download') + 'CSV расходов</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="print-report">' + icon('printer') + 'Печать</button>' +
      '</div>' +

      '<div class="kpi-grid report-kpi">' +
      kpiCard('Доход', money(incomeTotal), 'wallet', 'blue', '<span class="muted">' + incomeRecords.length + ' ' + plural(incomeRecords.length, ['поступление', 'поступления', 'поступлений']) + ' · без суточных</span>') +
      kpiCard('Наличные', money(cash), 'cash', 'green', '<span class="muted">' + share(cash, incomeTotal) + '</span>') +
      kpiCard('Безналичные', money(bank), 'card', 'cyan', '<span class="muted">' + share(bank, incomeTotal) + '</span>') +
      kpiCard('Суток', String(days), 'plane', 'violet', '<span class="muted">' + trips.length + ' ' + plural(trips.length, ['поездка', 'поездки', 'поездок']) + '</span>') +
      kpiCard('Суточные', money(perDiem), 'calendar', 'amber', '<span class="muted">за период</span>') +
      '</div>' +

      '<section class="card report-card">' +
      '<header class="card-head"><div><h2>Доходы и командировки по месяцам</h2><p>' + esc(range.label) + ' · доход без суточных</p></div>' +
      '<span class="report-stamp">Сформировано ' + fdate(Store.todayISO()) + '</span></header>' +
      '<div class="table-wrap"><table class="data-table report-table">' +
      '<thead><tr><th>Месяц</th><th class="num">Доход</th><th class="num">Наличные</th><th class="num">Безналичные</th><th class="num">Суток</th><th class="num">Суточные</th></tr></thead>' +
      '<tbody>' +
      (monthRows.length ? monthRows.map(function (row) {
        return '<tr><td>' + esc(row.label) + '</td><td class="num">' + money(row.income) + '</td><td class="num">' + money(row.cash) + '</td><td class="num">' + money(row.bank) + '</td><td class="num">' + row.days + '</td><td class="num">' + money(row.perDiem) + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted">Нет данных за период</td></tr>') +
      '<tr class="total-row"><td>Итого</td><td class="num">' + money(incomeTotal) + '</td><td class="num">' + money(cash) + '</td><td class="num">' + money(bank) + '</td><td class="num">' + days + '</td><td class="num">' + money(perDiem) + '</td></tr>' +
      '</tbody></table></div>' +
      '</section>' +

      '<div class="report-grid">' +
      '<section class="card report-card">' +
      '<header class="card-head"><div><h2>По типам доходов</h2><p>Структура выплат без суточных</p></div></header>' +
      '<div class="table-wrap"><table class="data-table report-table"><thead><tr><th>Тип</th><th class="num">Записей</th><th class="num">Сумма</th><th class="num">Доля</th></tr></thead><tbody>' +
      (typeRows.length ? tableRows(typeRows, [{ key: 'label' }, { key: 'count', type: 'count' }, { key: 'value', type: 'money' }, { key: 'value', type: 'share' }]) : '<tr><td colspan="4" class="muted">Нет данных</td></tr>') +
      '</tbody></table></div>' +
      '</section>' +
      '<section class="card report-card">' +
      '<header class="card-head"><div><h2>По источникам</h2><p>Кто выплачивал</p></div></header>' +
      '<div class="table-wrap"><table class="data-table report-table"><thead><tr><th>Источник</th><th class="num">Записей</th><th class="num">Сумма</th><th class="num">Доля</th></tr></thead><tbody>' +
      (sourceRows.length ? tableRows(sourceRows, [{ key: 'label' }, { key: 'count', type: 'count' }, { key: 'value', type: 'money' }, { key: 'value', type: 'share' }]) : '<tr><td colspan="4" class="muted">Нет данных</td></tr>') +
      '</tbody></table></div>' +
      '</section>' +
      '<section class="card report-card">' +
      '<header class="card-head"><div><h2>По объектам</h2><p>Доходы и поездки</p></div></header>' +
      '<div class="table-wrap"><table class="data-table report-table"><thead><tr><th>Объект</th><th class="num">Доход</th><th class="num">Суток</th><th class="num">Суточные</th></tr></thead><tbody>' +
      (objectRows.length ? objectRows.map(function (row) {
        return '<tr><td>' + esc(row.label) + '</td><td class="num">' + money(row.income) + '</td><td class="num">' + row.days + '</td><td class="num">' + money(row.perDiem) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">Нет данных</td></tr>') +
      '</tbody></table></div>' +
      '</section>' +
      '<section class="card report-card">' +
      '<header class="card-head"><div><h2>По направлениям</h2><p>Командировки и суточные</p></div></header>' +
      '<div class="table-wrap"><table class="data-table report-table"><thead><tr><th>Направление</th><th class="num">Поездок</th><th class="num">Суток</th><th class="num">Суточные</th></tr></thead><tbody>' +
      (destinationRows.length ? destinationRows.map(function (row) {
        return '<tr><td>' + esc(row.label) + '</td><td class="num">' + row.count + '</td><td class="num">' + row.days + '</td><td class="num">' + money(row.perDiem) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">Нет данных</td></tr>') +
      '</tbody></table></div>' +
      '</section>' +
      '</div>' +

      '<section class="card report-card advance-list-card">' +
      '<header class="card-head"><div><h2>Авансовые отчёты</h2><p>Расходы, суточные и расчёт с подотчётным лицом по каждой командировке</p></div>' +
      '<span class="report-stamp">' + trips.length + ' ' + plural(trips.length, ['поездка', 'поездки', 'поездок']) + '</span></header>' +
      (trips.length
        ? '<div class="table-wrap"><table class="data-table report-table"><thead><tr>' +
          '<th>Командировка</th><th>Период</th><th class="num">Суток</th><th class="num">Расходы</th><th class="num">Суточные</th><th class="num">Аванс</th><th class="num">Баланс</th><th class="actions-col"><span class="sr-only">Отчёт</span></th>' +
          '</tr></thead><tbody>' +
          trips.slice().sort(function (a, b) { return b.startDate.localeCompare(a.startDate); }).map(function (trip) {
            const expenses = Store.tripExpensesTotal(trip);
            const advance = Store.tripAdvance(trip);
            const balanceValue = Store.tripBalance(trip);
            const balanceClass = balanceValue > 0 ? 'money-return' : balanceValue < 0 ? 'money-due' : 'muted';
            const balanceLabel = balanceValue > 0 ? 'к возврату' : balanceValue < 0 ? 'к возмещению' : 'закрыт';
            return '<tr>' +
              '<td><div class="cell-main">' + esc(trip.destination) + '</div><div class="cell-sub">' + esc(Store.objectName(trip.objectId) || 'Без объекта') + '</div></td>' +
              '<td class="nowrap">' + tripPeriod(trip) + '</td>' +
              '<td class="num">' + Store.tripDays(trip) + '</td>' +
              '<td class="num">' + money(expenses) + '</td>' +
              '<td class="num">' + money(Store.tripPerDiem(trip)) + '</td>' +
              '<td class="num">' + money(advance) + '</td>' +
              '<td class="num"><b class="' + balanceClass + '">' + money(Math.abs(balanceValue)) + '</b><div class="cell-sub">' + balanceLabel + '</div></td>' +
              '<td class="actions-col"><button type="button" class="icon-btn icon-btn-sm" data-action="open-advance-report" data-id="' + esc(trip.id) + '" title="Открыть авансовый отчёт">' + icon('printer') + '</button></td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div>'
        : '<p class="advance-empty">За выбранный период командировок нет. Смените период или добавьте поездку.</p>') +
      '</section>';
  }

  /* ============================================================
     АВАНСОВЫЙ ОТЧЁТ
     ============================================================ */

  function advanceReportNumber(trip) {
    const year = (trip.startDate || '').slice(0, 4) || String(new Date().getFullYear());
    const suffix = String(trip.id || '').replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase() || '0001';
    return 'АО-' + year + '-' + suffix;
  }

  function renderAdvanceReport() {
    const trip = Store.tripById(App.routeParam);
    if (!trip) {
      return emptyState({
        icon: 'wallet',
        title: 'Командировка не найдена',
        text: 'Возможно, запись была удалена. Вернитесь к списку командировок.',
        action: { action: 'go-trips', label: 'К командировкам', icon: 'plane' }
      });
    }

    const settings = Store.state.settings;
    const days = Store.tripDays(trip);
    const perDiem = Store.tripPerDiem(trip);
    const expenses = Store.tripExpenses(trip).slice().sort(function (a, b) {
      return (a.date || '').localeCompare(b.date || '');
    });
    const reportTotal = Store.tripReportTotal(trip);
    const advance = Store.tripAdvance(trip);
    const balance = advance - reportTotal;
    const balanceLabel = balance > 0 ? 'Остаток к возврату' : balance < 0 ? 'Перерасход к возмещению' : 'Расчёт закрыт';
    const balanceTone = balance > 0 ? 'money-return' : balance < 0 ? 'money-due' : 'muted';
    const objectName = Store.objectName(trip.objectId);
    const employee = settings.engineerName || '____________________________';
    const organization = settings.organization || '';
    const position = settings.position || '';
    const todayText = Store.formatDate(Store.todayISO());
    const tripLabel = trip.startDate === trip.endDate
      ? Store.formatDate(trip.startDate)
      : Store.formatDate(trip.startDate) + ' — ' + Store.formatDate(trip.endDate);

    const expenseRows = expenses.map(function (expense, index) {
      return '<tr>' +
        '<td class="num">' + (index + 1) + '</td>' +
        '<td class="nowrap">' + Store.formatDate(expense.date) + '</td>' +
        '<td>' + esc(Store.EXPENSE_CATEGORIES[expense.category] || 'Прочие расходы') +
        (expense.note ? '<div class="advance-note">' + esc(expense.note) + '</div>' : '') + '</td>' +
        '<td>' + esc(expense.document || '—') + '</td>' +
        '<td class="num">' + money(expense.amount) + '</td>' +
        '</tr>';
    }).join('');

    const perDiemRow = perDiem > 0
      ? '<tr>' +
        '<td class="num">' + (expenses.length + 1) + '</td>' +
        '<td>' + tripLabel + '</td>' +
        '<td>Суточные за ' + days + ' ' + plural(days, ['сутки', 'суток', 'суток']) +
        '<div class="advance-note">' + money(trip.perDiemRate) + ' за сутки · не входит в доходы</div></td>' +
        '<td>Расчёт суточных</td>' +
        '<td class="num">' + money(perDiem) + '</td>' +
        '</tr>'
      : '';

    const emptyRows = !expenseRows && !perDiemRow
      ? '<tr><td colspan="5" class="advance-empty-cell">Расходы не внесены</td></tr>'
      : '';

    return '<div class="advance-view">' +
      '<div class="advance-toolbar">' +
      '<div class="advance-toolbar-left">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="go-trips">' + icon('plane') + 'К командировкам</button>' +
      '</div>' +
      '<div class="advance-toolbar-right">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="open-trip-expenses" data-id="' + esc(trip.id) + '">' + icon('wallet') + 'Расходы и аванс</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-action="print-advance">' + icon('printer') + 'Печать отчёта</button>' +
      '</div>' +
      '</div>' +

      '<article class="advance-sheet" aria-label="Авансовый отчёт">' +
      '<header class="advance-head">' +
      '<div class="advance-brand">' +
      '<b>' + esc(organization || 'Организация') + '</b>' +
      '<span>' + esc(position || 'Подотчётное лицо') + '</span>' +
      '</div>' +
      '<div class="advance-heading"><h1>Авансовый отчёт</h1>' +
      '<p>№ ' + esc(advanceReportNumber(trip)) + ' от ' + todayText + '</p></div>' +
      '</header>' +

      '<table class="advance-meta"><tbody>' +
      '<tr><th>Подотчётное лицо</th><td>' + esc(employee) + '</td><th>Должность</th><td>' + esc(position || '—') + '</td></tr>' +
      '<tr><th>Организация</th><td colspan="3">' + esc(organization || '—') + '</td></tr>' +
      '<tr><th>Направление</th><td>' + esc(trip.destination) + '</td><th>Объект</th><td>' + esc(objectName || '—') + '</td></tr>' +
      '<tr><th>Период командировки</th><td>' + tripLabel + ' · ' + days + ' ' + plural(days, ['сутки', 'суток', 'суток']) + '</td><th>Транспорт</th><td>' + esc(trip.transport || '—') + '</td></tr>' +
      (trip.purpose ? '<tr><th>Назначение</th><td colspan="3">' + esc(trip.purpose) + '</td></tr>' : '') +
      '</tbody></table>' +

      '<h2 class="advance-section-title">Расходы, произведённые в командировке</h2>' +
      '<table class="advance-table">' +
      '<thead><tr><th class="num">№</th><th>Дата</th><th>Вид расхода</th><th>Документ</th><th class="num">Сумма</th></tr></thead>' +
      '<tbody>' + expenseRows + perDiemRow + emptyRows +
      '<tr class="advance-total"><td colspan="4">Итого расходов</td><td class="num">' + money(reportTotal) + '</td></tr>' +
      '</tbody></table>' +

      '<div class="advance-summary">' +
      '<div class="advance-summary-item"><span>Получено под отчёт (аванс)</span><b>' + money(advance) + '</b></div>' +
      '<div class="advance-summary-item"><span>Израсходовано</span><b>' + money(reportTotal) + '</b></div>' +
      '<div class="advance-summary-item advance-summary-total"><span>' + balanceLabel + '</span><b class="' + balanceTone + '">' + money(Math.abs(balance)) + '</b></div>' +
      '</div>' +

      '<p class="advance-note-line">Приложений: ' + expenses.length + ' ' + plural(expenses.length, ['документ', 'документа', 'документов']) + '. Суточные начислены за ' + days + ' ' + plural(days, ['сутки', 'суток', 'суток']) + ' и включены в итог отчёта; в доходы они не входят.</p>' +

      '<footer class="advance-signatures">' +
      '<div class="advance-sign"><span>Подотчётное лицо</span><div class="advance-sign-line"><b>' + esc(employee) + '</b></div></div>' +
      '<div class="advance-sign"><span>Бухгалтер</span><div class="advance-sign-line"><b>&nbsp;</b></div></div>' +
      '<div class="advance-sign"><span>Руководитель</span><div class="advance-sign-line"><b>&nbsp;</b></div></div>' +
      '<div class="advance-sign advance-sign-date"><span>Дата</span><div class="advance-sign-line"><b>' + todayText + '</b></div></div>' +
      '</footer>' +
      '</article>' +
      '</div>';
  }

  /* ============================================================
     ФИЛЬТРЫ, СОРТИРОВКА И РЕГИСТРАЦИЯ ЭКРАНОВ
     ============================================================ */

  document.addEventListener('input', function (event) {
    if (event.target.matches('[data-income-filter="search"]')) {
      App.incomeFilters.search = event.target.value;
      renderIncomesResults();
    }
    if (event.target.matches('[data-trip-filter="search"]')) {
      App.tripFilters.search = event.target.value;
      renderTripsResults();
    }
  });

  document.addEventListener('change', function (event) {
    const incomeFilter = event.target.getAttribute('data-income-filter');
    if (incomeFilter && incomeFilter !== 'search') {
      App.incomeFilters[incomeFilter] = event.target.value;
      renderIncomesResults();
    }
    const tripFilter = event.target.getAttribute('data-trip-filter');
    if (tripFilter && tripFilter !== 'search') {
      App.tripFilters[tripFilter] = event.target.value;
      renderTripsResults();
    }
  });

  document.addEventListener('click', function (event) {
    const header = event.target.closest('th[data-sort]');
    if (!header) return;
    const table = header.closest('[data-table]');
    if (!table) return;
    const tableName = table.getAttribute('data-table');
    const key = header.getAttribute('data-sort');
    const sort = App.sort[tableName];
    if (!sort) return;
    if (sort.key === key) {
      sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sort.key = key;
      sort.dir = key === 'date' || key === 'startDate' ? 'desc' : 'asc';
    }
    if (tableName === 'incomes') renderIncomesResults();
    if (tableName === 'trips') renderTripsResults();
  });

  WC.registerAction('reset-income-filters', function () {
    App.incomeFilters = { search: '', type: '', method: '', source: '', object: '' };
    WC.renderView();
  });

  WC.registerAction('reset-trip-filters', function () {
    App.tripFilters = { search: '', object: '' };
    WC.renderView();
  });

  WC.registerAction('show-object-incomes', function (element) {
    const id = element.getAttribute('data-id');
    App.period = 'all';
    App.incomeFilters = { search: '', type: '', method: '', source: '', object: id };
    WC.toast('Показаны все доходы по объекту', { type: 'info' });
    WC.go('incomes');
  });

  WC.registerAction('go-incomes', function () { WC.go('incomes'); });
  WC.registerAction('go-trips', function () { WC.go('trips'); });
  WC.registerAction('print-report', function () { window.print(); });
  WC.registerAction('open-trip-expenses', function (element) {
    if (typeof WC.openTripExpensesModal === 'function') {
      WC.openTripExpensesModal(element.getAttribute('data-id'));
    }
  });
  WC.registerAction('open-advance-report', function (element) {
    if (WC.isModalOpen()) WC.closeModal();
    WC.go('advance', element.getAttribute('data-id'));
  });
  WC.registerAction('print-advance', function () { window.print(); });

  WC.registerView('dashboard', renderDashboard);
  WC.registerView('incomes', renderIncomes);
  WC.registerView('trips', renderTrips);
  WC.registerView('advance', renderAdvanceReport);
  WC.registerView('objects', renderObjects);
  WC.registerView('reports', renderReports);

  WC.mountDashboard = mountDashboard;
  WC.renderIncomesResults = renderIncomesResults;
  WC.renderTripsResults = renderTripsResults;
})();
