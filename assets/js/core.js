/* ============================================================
   «Наладчик» — ядро приложения: состояние, роутер, общие элементы
   ============================================================ */
(function () {
  'use strict';

  const Store = window.Store;
  const GitHub = window.GitHubSync;
  const Charts = window.Charts;

  const UI_KEY = 'naladchik:ui:v1';
  const PREF_KEY = 'naladchik:pref:';
  const BACKUP_KEY = 'naladchik:backup:v1';

  const VIEW_TITLES = {
    dashboard: { title: 'Обзор', subtitle: 'Сводка по доходам, расходам и командировкам' },
    incomes: { title: 'Доходы', subtitle: 'Авансы, зарплата, отпускные и другие поступления' },
    expenses: { title: 'Расходы', subtitle: 'Ежедневные личные траты вне командировок' },
    debts: { title: 'Долги', subtitle: 'Кредиты, рассрочки и обязательные платежи' },
    trips: { title: 'Командировки', subtitle: 'Направления, сроки и суточные' },
    advance: { title: 'Авансовый отчёт', subtitle: 'Расходы командировки и расчёт с подотчётным лицом' },
    objects: { title: 'Объекты', subtitle: 'Заказчики, площадки и объёмы работ' },
    analysis: { title: 'Анализ', subtitle: 'Личный бюджет, рекомендации и динамика' },
    reports: { title: 'Отчёты', subtitle: 'Итоги за период и выгрузки' },
    settings: { title: 'Настройки', subtitle: 'Профиль, источники и синхронизация с GitHub' }
  };

  const PRIMARY_ACTIONS = {
    dashboard: { action: 'add-income', label: 'Доход', icon: 'plus' },
    incomes: { action: 'add-income', label: 'Доход', icon: 'plus' },
    expenses: { action: 'add-expense', label: 'Расход', icon: 'plus' },
    debts: { action: 'add-debt', label: 'Долг', icon: 'plus' },
    trips: { action: 'add-trip', label: 'Командировка', icon: 'plus' },
    advance: { action: 'print-advance', label: 'Печать', icon: 'printer' },
    objects: { action: 'add-object', label: 'Объект', icon: 'plus' },
    reports: { action: 'print-report', label: 'Печать', icon: 'printer' }
  };

  const PERIOD_VIEWS = ['dashboard', 'incomes', 'expenses', 'trips', 'analysis', 'reports'];

  const App = {
    view: 'dashboard',
    routeParam: '',
    period: 'month',
    customFrom: '',
    customTo: '',
    incomeFilters: { search: '', type: '', method: '', source: '', object: '' },
    expenseFilters: { search: '', category: '', method: '' },
    tripFilters: { search: '', object: '' },
    debtStatusFilter: 'all',
    sort: {
      incomes: { key: 'date', dir: 'desc' },
      expenses: { key: 'date', dir: 'desc' },
      trips: { key: 'startDate', dir: 'desc' }
    }
  };

  const views = {};
  const actionHandlers = new Map();
  const submitHandlers = new Map();
  const modalState = { onClose: null, lastFocus: null };

  /* ---------- DOM и форматирование ---------- */

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function icon(name, className) {
    return '<svg class="icon ' + (className || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function money(value) {
    return Store.formatMoney(value);
  }

  function fdate(value) {
    return Store.formatDate(value);
  }

  function fdateLong(value) {
    return Store.formatDateLong(value);
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function sum(list, selector) {
    return list.reduce(function (total, item) {
      const value = selector ? selector(item) : item && item.amount;
      return total + (Number(value) || 0);
    }, 0);
  }

  function unique(list) {
    return Array.from(new Set(list));
  }

  function parseAmount(value) {
    if (typeof value === 'number') return value;
    const cleaned = String(value === null || value === undefined ? '' : value)
      .replace(/[\s\u00A0]/g, '')
      .replace(',', '.')
      .replace(/[^\d.\-]/g, '');
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : NaN;
  }

  function plural(number, forms) {
    return Store.plural(number, forms);
  }

  function getRange() {
    return Store.periodRange(App.period, { from: App.customFrom, to: App.customTo });
  }

  function allSourceNames() {
    const set = new Set();
    Store.state.sources.forEach(function (source) {
      if (source.name) set.add(source.name);
    });
    Store.state.incomes.forEach(function (income) {
      if (income.sourceName) set.add(income.sourceName);
    });
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b, 'ru'); });
  }

  function hasData() {
    return Store.state.incomes.length > 0 || Store.state.trips.length > 0 || Store.state.objects.length > 0 ||
      Store.state.expenses.length > 0 || Store.state.debts.length > 0;
  }

  function objectOptions(selectedId, emptyLabel) {
    const options = ['<option value="">' + esc(emptyLabel || 'Без объекта') + '</option>'];
    Store.state.objects.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); }).forEach(function (object) {
      options.push('<option value="' + esc(object.id) + '"' + (object.id === selectedId ? ' selected' : '') + '>' + esc(object.name) + '</option>');
    });
    return options.join('');
  }

  function typeOptions(selected) {
    return Store.INCOME_TYPE_ORDER.map(function (type) {
      return '<option value="' + type + '"' + (type === selected ? ' selected' : '') + '>' + esc(Store.INCOME_TYPES[type].label) + '</option>';
    }).join('');
  }

  function objectLabel(id) {
    const object = Store.objectById(id);
    return object ? object.name : '';
  }

  function typeBadge(type) {
    const meta = Store.INCOME_TYPES[type] || Store.INCOME_TYPES.other;
    return '<span class="badge" style="color:' + meta.color + ';background:' + meta.color + '1f">' + esc(meta.label) + '</span>';
  }

  function methodBadge(method) {
    const cash = method === 'cash';
    return '<span class="badge method-badge ' + (cash ? 'method-cash' : 'method-bank') + '">' + (cash ? 'Наличные' : 'Безналичные') + '</span>';
  }

  function objectStatusBadge(status) {
    const label = Store.OBJECT_STATUSES[status] || Store.OBJECT_STATUSES.active;
    return '<span class="badge status-badge status-' + esc(status) + '">' + esc(label) + '</span>';
  }

  function tripStatusBadge(status) {
    const label = Store.TRIP_STATUSES[status] || Store.TRIP_STATUSES.done;
    return '<span class="badge trip-badge trip-' + esc(status) + '">' + esc(label) + '</span>';
  }

  function lifeCategoryBadge(key) {
    const meta = Store.LIFE_CATEGORIES[key] || Store.LIFE_CATEGORIES.other;
    return '<span class="badge" style="color:' + meta.color + ';background:' + meta.color + '1f">' + esc(meta.label) + '</span>';
  }

  function debtTypeBadge(type) {
    const meta = Store.DEBT_TYPES[type] || Store.DEBT_TYPES.other;
    return '<span class="badge" style="color:' + meta.color + ';background:' + meta.color + '1f">' + esc(meta.label) + '</span>';
  }

  function debtStatusBadge(debt) {
    const meta = Store.debtStatus(debt);
    return '<span class="badge debt-status debt-status-' + esc(meta.code) + '">' + esc(meta.label) + '</span>';
  }

  function syncStatusMeta(stateName) {
    switch (stateName) {
      case 'syncing': return { label: 'Синхронизация…', tone: 'info' };
      case 'synced': return { label: 'Синхронизировано', tone: 'ok' };
      case 'error': return { label: 'Ошибка GitHub', tone: 'error' };
      case 'dirty': return { label: 'Есть изменения', tone: 'warn' };
      case 'ready': return { label: 'GitHub подключён', tone: 'info' };
      default: return { label: 'Только локально', tone: 'muted' };
    }
  }

  /* ---------- тема ---------- */

  function applyTheme() {
    const theme = Store.state.settings.theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f7fb' : '#0a0f15');
    const button = $('#themeToggle');
    if (button) {
      button.innerHTML = icon(theme === 'light' ? 'moon' : 'sun');
      button.title = theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему';
      button.setAttribute('aria-label', button.title);
    }
  }

  function toggleTheme() {
    Store.saveSettings({ theme: Store.state.settings.theme === 'light' ? 'dark' : 'light' });
  }

  /* ---------- уведомления ---------- */

  function toast(message, options) {
    const opts = options || {};
    const root = $('#toastRoot');
    if (!root) return;
    const node = document.createElement('div');
    node.className = 'toast toast-' + (opts.type || 'success');
    node.innerHTML =
      '<span class="toast-icon">' + icon(opts.type === 'error' ? 'alert' : 'check') + '</span>' +
      '<div class="toast-message">' + esc(message) + '</div>' +
      (opts.actionLabel ? '<button type="button" class="toast-action">' + esc(opts.actionLabel) + '</button>' : '') +
      '<button type="button" class="toast-close" aria-label="Закрыть">' + icon('close') + '</button>';
    root.appendChild(node);
    window.requestAnimationFrame(function () { node.classList.add('is-visible'); });

    let timer = null;
    function close() {
      window.clearTimeout(timer);
      node.classList.remove('is-visible');
      window.setTimeout(function () { node.remove(); }, 220);
    }

    const closeButton = node.querySelector('.toast-close');
    if (closeButton) closeButton.addEventListener('click', close);
    if (opts.actionLabel && typeof opts.onAction === 'function') {
      const actionButton = node.querySelector('.toast-action');
      if (actionButton) {
        actionButton.addEventListener('click', function () {
          close();
          opts.onAction();
        });
      }
    }
    timer = window.setTimeout(close, opts.timeout || 6000);
  }

  /* ---------- модальные окна ---------- */

  function isModalOpen() {
    return Boolean($('#modalRoot .modal'));
  }

  function openModal(html, options) {
    const opts = options || {};
    const root = $('#modalRoot');
    if (!root) return;
    root.innerHTML = '';
    modalState.onClose = null;
    modalState.lastFocus = document.activeElement;
    root.innerHTML = '<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal modal-' + (opts.size || 'md') + '" role="dialog" aria-modal="true" tabindex="-1">' + html + '</div></div>';
    document.body.classList.add('modal-open');
    modalState.onClose = opts.onClose || null;
    const modal = $('.modal', root);
    if (modal) {
      const first = $('input:not([type="hidden"]),select,textarea,button', modal);
      window.setTimeout(function () {
        if (first && document.contains(first)) first.focus();
        else modal.focus();
      }, 40);
    }
  }

  function closeModal(silent) {
    const root = $('#modalRoot');
    if (!root || !root.firstChild) return;
    const callback = modalState.onClose;
    modalState.onClose = null;
    root.innerHTML = '';
    document.body.classList.remove('modal-open');
    const lastFocus = modalState.lastFocus;
    modalState.lastFocus = null;
    if (lastFocus && document.contains(lastFocus)) {
      try { lastFocus.focus(); } catch (error) { /* noop */ }
    }
    if (!silent && typeof callback === 'function') callback();
  }

  function confirmDialog(options) {
    const opts = options || {};
    return new Promise(function (resolve) {
      openModal(
        '<header class="modal-head"><div><h2> ' + esc(opts.title || 'Подтвердите действие') + '</h2>' +
        (opts.subtitle ? '<p>' + esc(opts.subtitle) + '</p>' : '') + '</div>' +
        '<button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">' + icon('close') + '</button></header>' +
        '<div class="modal-body"><p class="confirm-text">' + esc(opts.message || '') + '</p></div>' +
        '<footer class="modal-actions">' +
        '<button type="button" class="btn btn-ghost" data-confirm="no">' + esc(opts.cancelLabel || 'Отмена') + '</button>' +
        '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-confirm="yes">' + esc(opts.confirmLabel || 'Продолжить') + '</button>' +
        '</footer>',
        { size: 'sm', onClose: function () { resolve(false); } }
      );
      const modal = $('.modal');
      if (!modal) return;
      const yes = $('[data-confirm="yes"]', modal);
      const no = $('[data-confirm="no"]', modal);
      if (yes) {
        yes.addEventListener('click', function () {
          resolve(true);
          closeModal();
        });
      }
      if (no) {
        no.addEventListener('click', function () {
          resolve(false);
          closeModal();
        });
      }
    });
  }

  function openConflictModal(detail) {
    const localDate = formatDateTime(detail.localUpdatedAt);
    const remoteDate = formatDateTime(detail.remoteUpdatedAt);
    openModal(
      '<header class="modal-head"><div><h2>Конфликт версий</h2><p>Данные изменялись и в этом браузере, и на GitHub.</p></div>' +
      '<button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">' + icon('close') + '</button></header>' +
      '<div class="modal-body">' +
      '<div class="conflict-grid">' +
      '<div class="conflict-item"><span>В этом браузере</span><b>' + esc(localDate) + '</b><small>' + plural(Store.state.incomes.length, ['запись', 'записи', 'записей']) + ' о доходах</small></div>' +
      '<div class="conflict-item"><span>В GitHub</span><b>' + esc(remoteDate) + '</b><small>версия из Gist</small></div>' +
      '</div>' +
      '<p class="hint warn">' + icon('alert') + ' Локальная версия будет сохранена в резервную копию перед заменой.</p>' +
      '</div>' +
      '<footer class="modal-actions modal-actions-split">' +
      '<button type="button" class="btn btn-ghost" data-conflict="cancel">Отмена</button>' +
      '<div class="modal-actions-right">' +
      '<button type="button" class="btn" data-conflict="remote">Взять из GitHub</button>' +
      '<button type="button" class="btn btn-primary" data-conflict="local">Оставить мои данные</button>' +
      '</div></footer>',
      { size: 'md' }
    );
    const modal = $('.modal');
    if (!modal) return;
    $$('[data-conflict]', modal).forEach(function (button) {
      button.addEventListener('click', function () {
        const choice = button.getAttribute('data-conflict');
        closeModal();
        if (choice === 'cancel') return;
        if (choice === 'remote') {
          saveBackup(Store.state);
          GitHub.pull().then(function () {
            toast('Загружена версия из GitHub');
          }).catch(function (error) {
            toast(error.message, { type: 'error' });
          });
        } else {
          GitHub.push().then(function () {
            toast('Данные отправлены в GitHub');
          }).catch(function (error) {
            toast(error.message, { type: 'error' });
          });
        }
      });
    });
  }

  /* ---------- резервные копии, файлы, CSV ---------- */

  function saveBackup(state) {
    try {
      window.localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), state: state }));
    } catch (error) {
      console.warn('Не удалось сохранить резервную копию:', error);
    }
  }

  function loadBackup() {
    try {
      const raw = window.localStorage.getItem(BACKUP_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.state) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function downloadText(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function csvCell(value) {
    const text = String(value === null || value === undefined ? '' : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function toCsv(rows) {
    return '\uFEFF' + rows.map(function (row) {
      return row.map(csvCell).join(';');
    }).join('\r\n');
  }

  function fileSuffix() {
    const range = getRange();
    if (range.from && range.to) return '-' + range.from + '_' + range.to;
    return '-all';
  }

  /* ---------- навигация и шапка ---------- */

  function viewFromHash() {
    const match = /^#\/([a-z]+)(?:\/(.+))?/.exec(window.location.hash || '');
    let view = match ? match[1] : 'dashboard';
    App.routeParam = match && match[2] ? decodeURIComponent(match[2]) : '';
    if (view === 'advance' && !App.routeParam) view = 'trips';
    return views[view] ? view : 'dashboard';
  }

  function go(view, param) {
    if (!views[view]) return;
    const hash = '#/' + view + (param ? '/' + encodeURIComponent(param) : '');
    if (App.view === view && window.location.hash === hash) {
      renderAll();
      return;
    }
    window.location.hash = hash;
  }

  function openSyncSettings() {
    if (App.view !== 'settings') {
      go('settings');
      window.setTimeout(scrollToGithub, 120);
    } else {
      scrollToGithub();
    }
  }

  function scrollToGithub() {
    const card = $('#githubCard');
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.classList.add('pulse');
    window.setTimeout(function () { card.classList.remove('pulse'); }, 1600);
  }

  function buildPeriodOptions() {
    const select = $('#periodSelect');
    if (!select) return;
    select.innerHTML = Object.keys(Store.PERIODS).map(function (key) {
      return '<option value="' + key + '">' + esc(Store.PERIODS[key]) + '</option>';
    }).join('');
  }

  function updateHeader() {
    const meta = VIEW_TITLES[App.view] || VIEW_TITLES.dashboard;
    const range = getRange();
    const title = $('#pageTitle');
    const subtitle = $('#pageSubtitle');
    if (title) title.textContent = meta.title;
    if (subtitle) {
      if (App.view === 'advance') {
        const trip = Store.tripById(App.routeParam);
        subtitle.textContent = trip
          ? trip.destination + ' · ' + fdate(trip.startDate) + ' — ' + fdate(trip.endDate)
          : meta.subtitle;
      } else {
        subtitle.textContent = (App.view === 'dashboard' || App.view === 'reports' || App.view === 'expenses' || App.view === 'analysis')
          ? range.label + ' · ' + meta.subtitle.toLowerCase()
          : meta.subtitle;
      }
    }

    const periodBox = $('#periodBox');
    if (periodBox) periodBox.hidden = PERIOD_VIEWS.indexOf(App.view) === -1;

    const select = $('#periodSelect');
    if (select) select.value = App.period;

    const custom = $('#periodCustom');
    if (custom) custom.hidden = App.period !== 'custom';
    const customFrom = $('#customFrom');
    const customTo = $('#customTo');
    if (customFrom && customFrom.value !== App.customFrom) customFrom.value = App.customFrom;
    if (customTo && customTo.value !== App.customTo) customTo.value = App.customTo;

    const primary = $('#primaryAction');
    if (primary) {
      const action = PRIMARY_ACTIONS[App.view];
      primary.hidden = !action;
      if (action) {
        primary.setAttribute('data-action', action.action);
        primary.innerHTML = icon(action.icon) + '<span>' + esc(action.label) + '</span>';
      }
    }
    const trip = App.view === 'advance' ? Store.tripById(App.routeParam) : null;
    document.title = (trip ? 'Авансовый отчёт — ' + trip.destination : meta.title) + ' — Наладчик';
  }

  function renderNav() {
    $$('.nav-item').forEach(function (link) {
      const active = link.getAttribute('data-view') === App.view ||
        (App.view === 'advance' && link.getAttribute('data-view') === 'trips');
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const brandSub = $('#brandSub');
    if (brandSub) {
      brandSub.textContent = Store.state.settings.engineerName || 'кабинет инженера';
    }
    updateSidebarStorage();
  }

  function renderView() {
    const container = $('#view');
    if (!container) return;
    const renderer = views[App.view] || views.dashboard;
    if (!renderer) return;
    container.innerHTML = renderer();
    if (App.view === 'dashboard' && window.WC.mountDashboard) window.WC.mountDashboard();
    if (App.view === 'expenses' && window.WC.mountExpenses) window.WC.mountExpenses();
    if (App.view === 'analysis' && window.WC.mountAnalysis) window.WC.mountAnalysis();
    if (App.view === 'settings' && window.WC.updateSyncStatusBox) window.WC.updateSyncStatusBox();
  }

  function renderAll() {
    applyTheme();
    renderNav();
    updateHeader();
    renderView();
    updateSyncChip();
    updateSidebarStorage();
    updateSyncStatusBox();
  }

  function updateSyncChip() {
    const chip = $('#syncChip');
    if (!chip) return;
    const cfg = GitHub.getConfig();
    const state = GitHub.getStatus();
    const meta = syncStatusMeta(state.state);
    let label = 'Локально';
    let title = 'Данные хранятся в этом браузере. Подключите GitHub в настройках.';
    if (GitHub.isConfigured()) {
      label = 'GitHub';
      title = meta.label + (state.message ? ': ' + state.message : '');
      if (cfg.lastSyncAt) title += ' · ' + formatDateTime(cfg.lastSyncAt);
      if (state.state === 'error') label = 'GitHub: ошибка';
    }
    chip.className = 'sync-chip tone-' + meta.tone;
    chip.innerHTML = '<span class="sync-dot"></span><span class="sync-label">' + esc(label) + '</span>';
    chip.title = title;
    chip.setAttribute('aria-label', label + '. ' + title);
  }

  function updateSidebarStorage() {
    const title = $('#storageText');
    const sub = $('#storageSub');
    const dot = $('#storageDot');
    if (!title || !sub) return;
    const cfg = GitHub.getConfig();
    if (GitHub.isConfigured()) {
      title.textContent = 'GitHub подключён';
      sub.textContent = cfg.lastSyncAt ? 'Синхронизировано ' + formatDateTime(cfg.lastSyncAt) : 'Ожидает синхронизации';
      if (dot) dot.className = 'storage-dot tone-ok';
    } else {
      title.textContent = 'Локальное хранилище';
      sub.textContent = 'GitHub не подключён';
      if (dot) dot.className = 'storage-dot tone-muted';
    }
  }

  function updateSyncStatusBox() {
    const box = $('#syncStatusBox');
    const cfg = GitHub.getConfig();
    const state = GitHub.getStatus();
    const auto = $('#githubAutoSync');
    if (auto) auto.checked = Boolean(cfg.autoSync);
    const gistInput = $('#githubGist');
    if (gistInput && document.activeElement !== gistInput) gistInput.value = cfg.gistId;
    const tokenInput = $('#githubToken');
    if (tokenInput && document.activeElement !== tokenInput) tokenInput.value = cfg.token;
    const linkWrap = $('#gistLinkWrap');
    if (linkWrap) {
      linkWrap.innerHTML = cfg.gistUrl
        ? '<a href="' + esc(cfg.gistUrl) + '" target="_blank" rel="noopener noreferrer">Открыть Gist на GitHub ' + icon('arrow-up-right') + '</a>'
        : '<span class="muted">Gist ещё не создан</span>';
    }
    if (!box) return;
    const meta = syncStatusMeta(state.state);
    box.className = 'sync-status tone-' + meta.tone;
    box.innerHTML =
      '<span class="status-dot"></span>' +
      '<div class="status-text"><b>' + esc(meta.label) + '</b>' +
      '<span>' + esc(state.message || '') + '</span>' +
      (cfg.lastSyncAt ? '<small>Последняя синхронизация: ' + esc(formatDateTime(cfg.lastSyncAt)) + '</small>' : '') +
      '</div>';
  }

  /* ---------- события ---------- */

  function registerAction(name, handler) {
    actionHandlers.set(name, handler);
  }

  function registerSubmit(formId, handler) {
    submitHandlers.set(formId, handler);
  }

  function registerView(name, renderer) {
    views[name] = renderer;
  }

  function onDocumentClick(event) {
    const element = event.target.closest('[data-action]');
    if (!element) return;
    const action = element.getAttribute('data-action');
    if (action === 'modal-backdrop') {
      if (event.target === element) closeModal();
      return;
    }
    const handler = actionHandlers.get(action);
    if (!handler) return;
    event.preventDefault();
    try {
      const result = handler(element, event);
      if (result && typeof result.catch === 'function') {
        result.catch(function (error) {
          console.error(error);
          toast(error && error.message ? error.message : 'Не удалось выполнить действие', { type: 'error' });
        });
      }
    } catch (error) {
      console.error(error);
      toast(error && error.message ? error.message : 'Не удалось выполнить действие', { type: 'error' });
    }
  }

  function onDocumentSubmit(event) {
    const handler = submitHandlers.get(event.target.id);
    if (!handler) return;
    event.preventDefault();
    try {
      const result = handler(event.target);
      if (result && typeof result.catch === 'function') {
        result.catch(function (error) {
          console.error(error);
          toast(error && error.message ? error.message : 'Ошибка сохранения', { type: 'error' });
        });
      }
    } catch (error) {
      console.error(error);
      toast(error && error.message ? error.message : 'Ошибка сохранения', { type: 'error' });
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      if (isModalOpen()) closeModal();
      else document.body.classList.remove('nav-open');
      return;
    }
    if (event.key !== 'Tab' || !isModalOpen()) return;
    const modal = $('.modal');
    if (!modal) return;
    const focusable = $$('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', modal).filter(function (element) {
      return element.offsetParent !== null;
    });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function readUI() {
    try {
      const raw = window.localStorage.getItem(UI_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function writeUI() {
    try {
      window.localStorage.setItem(UI_KEY, JSON.stringify({ period: App.period, customFrom: App.customFrom, customTo: App.customTo }));
    } catch (error) { /* noop */ }
  }

  function initCustomRange() {
    const now = new Date();
    App.customFrom = Store.iso(new Date(now.getFullYear(), now.getMonth(), 1));
    App.customTo = Store.todayISO();
    const saved = readUI();
    if (saved.customFrom && Store.isValidISO(saved.customFrom)) App.customFrom = saved.customFrom;
    if (saved.customTo && Store.isValidISO(saved.customTo)) App.customTo = saved.customTo;
  }

  function bindHeader() {
    const select = $('#periodSelect');
    if (select) {
      select.addEventListener('change', function () {
        App.period = Store.PERIODS[select.value] ? select.value : 'month';
        writeUI();
        renderAll();
      });
    }
    const from = $('#customFrom');
    const to = $('#customTo');
    if (from) {
      from.addEventListener('change', function () {
        if (!Store.isValidISO(from.value)) return;
        App.customFrom = from.value;
        if (App.customTo && App.customFrom > App.customTo) {
          App.customTo = App.customFrom;
          if (to) to.value = App.customTo;
          toast('Дата окончания скорректирована', { type: 'info' });
        }
        writeUI();
        renderAll();
      });
    }
    if (to) {
      to.addEventListener('change', function () {
        if (!Store.isValidISO(to.value)) return;
        App.customTo = to.value;
        if (App.customFrom && App.customTo < App.customFrom) {
          App.customFrom = App.customTo;
          if (from) from.value = App.customFrom;
          toast('Дата начала скорректирована', { type: 'info' });
        }
        writeUI();
        renderAll();
      });
    }
  }

  function init() {
    const ui = readUI();
    if (ui.period && Store.PERIODS[ui.period]) App.period = ui.period;
    initCustomRange();
    buildPeriodOptions();
    App.view = viewFromHash();
    bindHeader();
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('submit', onDocumentSubmit);
    document.addEventListener('keydown', onKeyDown);

    Store.subscribe(function () { renderAll(); });

    document.addEventListener('github:status', function () {
      updateSyncChip();
      updateSidebarStorage();
      updateSyncStatusBox();
    });
    document.addEventListener('github:config', function () {
      updateSyncChip();
      updateSidebarStorage();
      updateSyncStatusBox();
    });
    document.addEventListener('github:conflict', function (event) {
      openConflictModal(event.detail);
    });

    window.addEventListener('hashchange', function () {
      const previousParam = App.routeParam;
      const next = viewFromHash();
      if (next === App.view && App.routeParam === previousParam) return;
      if (next !== App.view) {
        App.view = next;
        closeModal();
        document.body.classList.remove('nav-open');
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
      renderAll();
    });

    window.addEventListener('resize', function () {
      if (App.view === 'dashboard' && window.WC.mountDashboard) window.WC.mountDashboard();
      if (App.view === 'analysis' && window.WC.mountAnalysis) window.WC.mountAnalysis();
    });

    document.addEventListener('change', function (event) {
      if (event.target.id === 'githubAutoSync') {
        const enabled = event.target.checked;
        GitHub.saveConfig({ autoSync: enabled });
        toast(enabled ? 'Автосохранение в GitHub включено' : 'Автосохранение в GitHub выключено', { type: 'info' });
      }
      if (event.target.id === 'importFile') {
        const file = event.target.files && event.target.files[0];
        if (file && window.WC.handleImportFile) window.WC.handleImportFile(file);
        event.target.value = '';
      }
    });

    renderAll();
    registerServiceWorker();
    window.setTimeout(function () {
      if (window.WC.updateSyncStatusBox) window.WC.updateSyncStatusBox();
    }, 300);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return;
    navigator.serviceWorker.register('sw.js').catch(function (error) {
      console.warn('Service worker не зарегистрирован:', error);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  registerAction('close-modal', function () { closeModal(); });
  registerAction('toggle-sidebar', function () { document.body.classList.toggle('nav-open'); });
  registerAction('close-sidebar', function () { document.body.classList.remove('nav-open'); });
  registerAction('toggle-theme', function () { toggleTheme(); });
  registerAction('open-sync', function () { openSyncSettings(); });
  registerAction('set-period-all', function () {
    App.period = 'all';
    writeUI();
    renderAll();
  });

  window.WC = {
    App: App,
    views: views,
    Charts: Charts,
    GitHub: GitHub,
    registerAction: registerAction,
    registerSubmit: registerSubmit,
    registerView: registerView,
    $: $,
    $$: $$,
    esc: esc,
    icon: icon,
    money: money,
    fdate: fdate,
    fdateLong: fdateLong,
    formatDateTime: formatDateTime,
    sum: sum,
    unique: unique,
    parseAmount: parseAmount,
    plural: plural,
    getRange: getRange,
    allSourceNames: allSourceNames,
    hasData: hasData,
    objectOptions: objectOptions,
    typeOptions: typeOptions,
    objectLabel: objectLabel,
    typeBadge: typeBadge,
    methodBadge: methodBadge,
    objectStatusBadge: objectStatusBadge,
    tripStatusBadge: tripStatusBadge,
    lifeCategoryBadge: lifeCategoryBadge,
    debtTypeBadge: debtTypeBadge,
    debtStatusBadge: debtStatusBadge,
    syncStatusMeta: syncStatusMeta,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    toast: toast,
    isModalOpen: isModalOpen,
    openModal: openModal,
    closeModal: closeModal,
    confirmDialog: confirmDialog,
    openConflictModal: openConflictModal,
    saveBackup: saveBackup,
    loadBackup: loadBackup,
    BACKUP_KEY: BACKUP_KEY,
    downloadText: downloadText,
    toCsv: toCsv,
    fileSuffix: fileSuffix,
    go: go,
    openSyncSettings: openSyncSettings,
    renderAll: renderAll,
    renderView: renderView,
    updateHeader: updateHeader,
    updateSyncChip: updateSyncChip,
    updateSidebarStorage: updateSidebarStorage,
    updateSyncStatusBox: updateSyncStatusBox,
    getPref: function (key, fallback) {
      try {
        const value = window.localStorage.getItem(PREF_KEY + key);
        return value === null ? fallback : value;
      } catch (error) {
        return fallback;
      }
    },
    setPref: function (key, value) {
      try { window.localStorage.setItem(PREF_KEY + key, value); } catch (error) { /* noop */ }
    }
  };
})();
