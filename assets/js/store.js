/* ============================================================
   «Наладчик» — слой данных
   Справочники, вычисления, хранение в localStorage.
   ============================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'naladchik:data:v1';
  const VERSION = 1;

  const CURRENCIES = {
    RUB: { label: 'Российский рубль', symbol: '₽' },
    USD: { label: 'Доллар США', symbol: '$' },
    EUR: { label: 'Евро', symbol: '€' },
    KZT: { label: 'Казахстанский тенге', symbol: '₸' },
    BYN: { label: 'Белорусский рубль', symbol: 'Br' }
  };

  const INCOME_TYPES = {
    advance:      { label: 'Аванс',                  color: '#60a5fa' },
    salary:       { label: 'Окончательная зарплата', color: '#34d399' },
    vacation:     { label: 'Отпускные',              color: '#fbbf24' },
    bonus:        { label: 'Премия',                 color: '#a78bfa' },
    perDiem:      { label: 'Суточные',               color: '#22d3ee' },
    compensation: { label: 'Компенсация',            color: '#fb923c' },
    other:        { label: 'Прочие доходы',          color: '#94a3b8' }
  };
  const INCOME_TYPE_ORDER = ['advance', 'salary', 'vacation', 'bonus', 'perDiem', 'compensation', 'other'];

  const PAYMENT_METHODS = { cash: 'Наличные', bank: 'Безналичные' };

  const OBJECT_STATUSES = { active: 'В работе', planned: 'Планируется', done: 'Завершён' };

  const TRIP_STATUSES = { planned: 'Запланирована', active: 'В процессе', done: 'Завершена' };

  const PERIODS = {
    month: 'Этот месяц',
    prevMonth: 'Прошлый месяц',
    quarter: 'Текущий квартал',
    year: 'Текущий год',
    all: 'Всё время',
    custom: 'Свой период'
  };

  const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONTHS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  /* ---------- утилиты ---------- */

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function iso(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function todayISO() {
    return iso(new Date());
  }

  function parseISO(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
      return null;
    }
    return date;
  }

  function isValidISO(value) {
    return parseISO(value) !== null;
  }

  function ordinal(date) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function daysBetween(startISO, endISO) {
    const start = parseISO(startISO);
    const end = parseISO(endISO);
    if (!start || !end) return 0;
    return Math.max(0, ordinal(end) - ordinal(start));
  }

  function str(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function plural(number, forms) {
    const abs = Math.abs(number) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function formatDate(value) {
    const date = parseISO(value);
    if (!date) return '—';
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  function formatDateLong(value) {
    const date = parseISO(value);
    if (!date) return '—';
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  function formatDateShort(value) {
    const date = parseISO(value);
    if (!date) return '—';
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(date);
  }

  function money(value) {
    const number = Number(value) || 0;
    const hasFraction = Math.abs(number % 1) > 0.004;
    try {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: state.settings.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: hasFraction ? 2 : 0
      }).format(number);
    } catch (error) {
      return Math.round(number).toLocaleString('ru-RU') + ' ' + currencySymbol();
    }
  }

  function compact(value) {
    const number = Number(value) || 0;
    const abs = Math.abs(number);
    if (abs >= 1000000) return (number / 1000000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн';
    if (abs >= 1000) return Math.round(number / 1000).toLocaleString('ru-RU') + ' тыс.';
    return String(Math.round(number));
  }

  function currencySymbol() {
    return (CURRENCIES[state.settings.currency] || CURRENCIES.RUB).symbol;
  }

  function monthKey(value) {
    return value ? value.slice(0, 7) : '';
  }

  function monthLabel(key, short) {
    if (!key) return '';
    const parts = key.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!month || month < 1 || month > 12) return key;
    return (short ? MONTHS_SHORT[month - 1] : MONTHS_FULL[month - 1]) + ' ' + year;
  }

  function monthsInRange(from, to) {
    if (!from || !to) return [];
    const start = parseISO(from);
    const end = parseISO(to);
    if (!start || !end || start > end) return [];
    const result = [];
    let year = start.getFullYear();
    let month = start.getMonth();
    let guard = 0;
    while ((year < end.getFullYear() || (year === end.getFullYear() && month <= end.getMonth())) && guard < 240) {
      const key = year + '-' + pad2(month + 1);
      result.push({
        key: key,
        label: MONTHS_SHORT[month],
        full: MONTHS_FULL[month] + ' ' + year,
        year: year,
        month: month
      });
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      guard += 1;
    }
    return result;
  }

  function periodRange(preset, custom, now) {
    const reference = now || new Date();
    const year = reference.getFullYear();
    const month = reference.getMonth();
    let from = null;
    let to = null;
    let label = '';

    if (preset === 'prevMonth') {
      from = new Date(year, month - 1, 1);
      to = new Date(year, month, 0);
      label = MONTHS_FULL[from.getMonth()] + ' ' + from.getFullYear();
    } else if (preset === 'quarter') {
      const quarter = Math.floor(month / 3);
      from = new Date(year, quarter * 3, 1);
      to = new Date(year, quarter * 3 + 3, 0);
      label = ['I', 'II', 'III', 'IV'][quarter] + ' квартал ' + year;
    } else if (preset === 'year') {
      from = new Date(year, 0, 1);
      to = new Date(year, 11, 31);
      label = year + ' год';
    } else if (preset === 'all') {
      return { from: null, to: null, label: 'Всё время' };
    } else if (preset === 'custom') {
      const customFrom = custom && parseISO(custom.from);
      const customTo = custom && parseISO(custom.to);
      if (customFrom && customTo) {
        if (customFrom > customTo) {
          const temp = customFrom.getTime();
          from = customTo;
          to = new Date(temp);
        } else {
          from = customFrom;
          to = customTo;
        }
        label = formatDate(iso(from)) + ' — ' + formatDate(iso(to));
      } else {
        from = new Date(year, month, 1);
        to = new Date(year, month + 1, 0);
        label = MONTHS_FULL[month] + ' ' + year;
      }
    } else {
      from = new Date(year, month, 1);
      to = new Date(year, month + 1, 0);
      label = MONTHS_FULL[month] + ' ' + year;
    }

    return { from: iso(from), to: iso(to), label: label };
  }

  function previousRange(from, to) {
    if (!from || !to) return null;
    const length = daysBetween(from, to) + 1;
    const previousTo = parseISO(from);
    if (!previousTo) return null;
    previousTo.setDate(previousTo.getDate() - 1);
    const previousFrom = new Date(previousTo.getTime());
    previousFrom.setDate(previousFrom.getDate() - (length - 1));
    return { from: iso(previousFrom), to: iso(previousTo) };
  }

  function withinRange(value, from, to) {
    if (!value) return false;
    if (from && value < from) return false;
    if (to && value > to) return false;
    return true;
  }

  /* ---------- начальное состояние ---------- */

  function defaultState() {
    return {
      version: VERSION,
      updatedAt: nowISO(),
      settings: {
        engineerName: '',
        currency: 'RUB',
        perDiemRate: 700,
        theme: 'dark',
        createdAt: nowISO()
      },
      sources: [],
      objects: [],
      incomes: [],
      trips: []
    };
  }

  /* ---------- нормализация ---------- */

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;

    const settingsRaw = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    const settings = {
      engineerName: str(settingsRaw.engineerName).trim().slice(0, 120),
      currency: CURRENCIES[settingsRaw.currency] ? settingsRaw.currency : 'RUB',
      perDiemRate: clampNumber(settingsRaw.perDiemRate, 0, 10000000, 700),
      theme: settingsRaw.theme === 'light' ? 'light' : 'dark',
      createdAt: isValidISO(String(settingsRaw.createdAt || '').slice(0, 10)) ? String(settingsRaw.createdAt) : base.settings.createdAt
    };

    const seenIds = new Set();
    function uniqueRecordId(value) {
      let id = str(value).trim();
      if (!id || seenIds.has(id)) id = uid();
      seenIds.add(id);
      return id;
    }

    const sourcesRaw = Array.isArray(raw.sources) ? raw.sources : [];
    const sources = [];
    const seenNames = new Set();
    sourcesRaw.forEach(function (source) {
      if (!source || typeof source !== 'object') return;
      const name = str(source.name).trim().slice(0, 160);
      if (!name) return;
      const key = name.toLowerCase();
      if (seenNames.has(key)) return;
      seenNames.add(key);
      sources.push({ id: uniqueRecordId(source.id), name: name });
    });

    const objectsRaw = Array.isArray(raw.objects) ? raw.objects : [];
    const objects = objectsRaw.filter(function (item) {
      return item && typeof item === 'object';
    }).map(function (item) {
      const startDate = isValidISO(item.startDate) ? item.startDate : '';
      let endDate = isValidISO(item.endDate) ? item.endDate : '';
      if (startDate && endDate && endDate < startDate) endDate = startDate;
      return {
        id: uniqueRecordId(item.id),
        name: str(item.name).trim().slice(0, 200) || 'Без названия',
        customer: str(item.customer).trim().slice(0, 200),
        address: str(item.address).trim().slice(0, 300),
        status: OBJECT_STATUSES[item.status] ? item.status : 'active',
        startDate: startDate,
        endDate: endDate,
        note: str(item.note).slice(0, 2000),
        createdAt: str(item.createdAt) || nowISO(),
        updatedAt: str(item.updatedAt) || nowISO()
      };
    });

    const objectIds = new Set(objects.map(function (object) { return object.id; }));

    const incomesRaw = Array.isArray(raw.incomes) ? raw.incomes : [];
    const incomes = incomesRaw.filter(function (item) {
      return item && typeof item === 'object';
    }).map(function (item) {
      const amount = clampNumber(item.amount, 0, 100000000000, 0);
      return {
        id: uniqueRecordId(item.id),
        date: isValidISO(item.date) ? item.date : todayISO(),
        type: INCOME_TYPES[item.type] ? item.type : 'other',
        amount: round2(amount),
        method: item.method === 'cash' ? 'cash' : 'bank',
        sourceId: item.sourceId ? String(item.sourceId) : null,
        sourceName: str(item.sourceName).trim().slice(0, 160),
        objectId: objectIds.has(item.objectId) ? item.objectId : null,
        note: str(item.note).slice(0, 2000),
        createdAt: str(item.createdAt) || nowISO(),
        updatedAt: str(item.updatedAt) || nowISO()
      };
    });

    const tripsRaw = Array.isArray(raw.trips) ? raw.trips : [];
    const trips = tripsRaw.filter(function (item) {
      return item && typeof item === 'object';
    }).map(function (item) {
      const startDate = isValidISO(item.startDate) ? item.startDate : todayISO();
      let endDate = isValidISO(item.endDate) ? item.endDate : startDate;
      if (endDate < startDate) endDate = startDate;
      return {
        id: uniqueRecordId(item.id),
        destination: str(item.destination).trim().slice(0, 200) || 'Направление не указано',
        objectId: objectIds.has(item.objectId) ? item.objectId : null,
        startDate: startDate,
        endDate: endDate,
        perDiemRate: clampNumber(item.perDiemRate, 0, 10000000, settings.perDiemRate),
        transport: str(item.transport).trim().slice(0, 200),
        purpose: str(item.purpose).slice(0, 2000),
        note: str(item.note).slice(0, 2000),
        createdAt: str(item.createdAt) || nowISO(),
        updatedAt: str(item.updatedAt) || nowISO()
      };
    });

    return {
      version: VERSION,
      updatedAt: isValidISO(String(raw.updatedAt || '').slice(0, 10)) ? String(raw.updatedAt) : nowISO(),
      settings: settings,
      sources: sources,
      objects: objects,
      incomes: incomes,
      trips: trips
    };
  }

  /* ---------- загрузка / сохранение ---------- */

  let state = loadState();
  const subscribers = new Set();

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.error('Не удалось прочитать локальные данные:', error);
      try {
        const broken = window.localStorage.getItem(STORAGE_KEY);
        if (broken) window.localStorage.setItem(STORAGE_KEY + ':broken', broken);
      } catch (ignored) { /* noop */ }
      return defaultState();
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Не удалось сохранить данные в браузере:', error);
    }
  }

  function notify(source) {
    subscribers.forEach(function (listener) {
      try {
        listener(state);
      } catch (error) {
        console.error(error);
      }
    });
    document.dispatchEvent(new CustomEvent('store:change', { detail: { source: source || 'local' } }));
  }

  function commit(mutator) {
    mutator();
    state.updatedAt = nowISO();
    persist();
    notify('local');
  }

  function subscribe(listener) {
    subscribers.add(listener);
    return function () {
      subscribers.delete(listener);
    };
  }

  function replaceState(next, options) {
    const opts = options || {};
    state = normalizeState(next);
    if (!opts.keepUpdatedAt) {
      state.updatedAt = nowISO();
    }
    persist();
    notify(opts.source || 'remote');
    return state;
  }

  /* ---------- операции ---------- */

  function saveIncome(data) {
    let saved = null;
    commit(function () {
      const sourceName = str(data.sourceName).trim().slice(0, 160);
      let source = null;
      if (sourceName) {
        source = state.sources.find(function (item) {
          return item.name.toLowerCase() === sourceName.toLowerCase();
        }) || null;
        if (!source) {
          source = { id: uid(), name: sourceName };
          state.sources.push(source);
        }
      }
      const now = nowISO();
      const record = {
        id: data.id || uid(),
        date: isValidISO(data.date) ? data.date : todayISO(),
        type: INCOME_TYPES[data.type] ? data.type : 'other',
        amount: round2(clampNumber(data.amount, 0, 100000000000, 0)),
        method: data.method === 'cash' ? 'cash' : 'bank',
        sourceId: source ? source.id : null,
        sourceName: sourceName,
        objectId: state.objects.some(function (object) { return object.id === data.objectId; }) ? data.objectId : null,
        note: str(data.note).trim().slice(0, 2000),
        createdAt: data.createdAt || now,
        updatedAt: now
      };
      const index = state.incomes.findIndex(function (item) { return item.id === record.id; });
      if (index >= 0) state.incomes[index] = record;
      else state.incomes.push(record);
      saved = record;
    });
    return saved;
  }

  function saveTrip(data) {
    let saved = null;
    commit(function () {
      const startDate = isValidISO(data.startDate) ? data.startDate : todayISO();
      let endDate = isValidISO(data.endDate) ? data.endDate : startDate;
      if (endDate < startDate) endDate = startDate;
      const now = nowISO();
      const record = {
        id: data.id || uid(),
        destination: str(data.destination).trim().slice(0, 200) || 'Направление не указано',
        objectId: state.objects.some(function (object) { return object.id === data.objectId; }) ? data.objectId : null,
        startDate: startDate,
        endDate: endDate,
        perDiemRate: round2(clampNumber(data.perDiemRate, 0, 10000000, state.settings.perDiemRate)),
        transport: str(data.transport).trim().slice(0, 200),
        purpose: str(data.purpose).trim().slice(0, 2000),
        note: str(data.note).trim().slice(0, 2000),
        createdAt: data.createdAt || now,
        updatedAt: now
      };
      const index = state.trips.findIndex(function (item) { return item.id === record.id; });
      if (index >= 0) state.trips[index] = record;
      else state.trips.push(record);
      saved = record;
    });
    return saved;
  }

  function saveObject(data) {
    let saved = null;
    commit(function () {
      const now = nowISO();
      const startDate = isValidISO(data.startDate) ? data.startDate : '';
      let endDate = isValidISO(data.endDate) ? data.endDate : '';
      if (startDate && endDate && endDate < startDate) endDate = startDate;
      const record = {
        id: data.id || uid(),
        name: str(data.name).trim().slice(0, 200) || 'Без названия',
        customer: str(data.customer).trim().slice(0, 200),
        address: str(data.address).trim().slice(0, 300),
        status: OBJECT_STATUSES[data.status] ? data.status : 'active',
        startDate: startDate,
        endDate: endDate,
        note: str(data.note).trim().slice(0, 2000),
        createdAt: data.createdAt || now,
        updatedAt: now
      };
      const index = state.objects.findIndex(function (item) { return item.id === record.id; });
      if (index >= 0) state.objects[index] = record;
      else state.objects.push(record);
      saved = record;
    });
    return saved;
  }

  function addSource(name) {
    const clean = str(name).trim().slice(0, 160);
    if (!clean) return null;
    const existing = state.sources.find(function (source) {
      return source.name.toLowerCase() === clean.toLowerCase();
    });
    if (existing) return existing;
    const source = { id: uid(), name: clean };
    commit(function () {
      state.sources.push(source);
    });
    return source;
  }

  function deleteSource(id) {
    commit(function () {
      const index = state.sources.findIndex(function (source) { return source.id === id; });
      if (index >= 0) state.sources.splice(index, 1);
    });
  }

  function deleteRecord(collection, id) {
    if (!['objects', 'incomes', 'trips'].includes(collection)) return;
    commit(function () {
      const list = state[collection];
      const index = list.findIndex(function (item) { return item.id === id; });
      if (index < 0) return;
      list.splice(index, 1);
      if (collection === 'objects') {
        state.incomes.forEach(function (income) {
          if (income.objectId === id) income.objectId = null;
        });
        state.trips.forEach(function (trip) {
          if (trip.objectId === id) trip.objectId = null;
        });
      }
    });
  }

  function saveSettings(patch) {
    commit(function () {
      Object.assign(state.settings, patch);
    });
  }

  function resetData() {
    const settings = Object.assign({}, state.settings);
    state = defaultState();
    state.settings = settings;
    state.updatedAt = nowISO();
    persist();
    notify('local');
  }

  /* ---------- выборки и вычисления ---------- */

  function incomesInRange(from, to) {
    return state.incomes.filter(function (income) {
      return withinRange(income.date, from, to);
    });
  }

  function tripsInRange(from, to) {
    return state.trips.filter(function (trip) {
      if (from && trip.endDate < from) return false;
      if (to && trip.startDate > to) return false;
      return true;
    });
  }

  function objectById(id) {
    return state.objects.find(function (object) { return object.id === id; }) || null;
  }

  function objectName(id) {
    const object = objectById(id);
    return object ? object.name : '';
  }

  function tripDays(trip) {
    if (!trip) return 0;
    return Math.max(1, daysBetween(trip.startDate, trip.endDate) + 1);
  }

  function tripDaysWithin(trip, from, to) {
    if (!trip) return 0;
    const start = from && trip.startDate < from ? from : trip.startDate;
    const end = to && trip.endDate > to ? to : trip.endDate;
    if (end < start) return 0;
    return daysBetween(start, end) + 1;
  }

  function tripPerDiem(trip, from, to) {
    const days = from || to ? tripDaysWithin(trip, from, to) : tripDays(trip);
    return round2(days * (Number(trip.perDiemRate) || 0));
  }

  function tripStatus(trip) {
    const today = todayISO();
    if (trip.startDate > today) return 'planned';
    if (trip.endDate < today) return 'done';
    return 'active';
  }

  function total(list, selector) {
    return list.reduce(function (sum, item) {
      return sum + (selector ? Number(selector(item)) || 0 : Number(item.amount) || 0);
    }, 0);
  }

  // Суточные — возмещение расходов, а не доход: не входят в сумму доходов.
  function isIncome(record) {
    return Boolean(record) && record.type !== 'perDiem';
  }

  function incomeRecords(list) {
    return (list || []).filter(isIncome);
  }

  /* ---------- публичный API ---------- */

  window.Store = {
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    CURRENCIES: CURRENCIES,
    INCOME_TYPES: INCOME_TYPES,
    INCOME_TYPE_ORDER: INCOME_TYPE_ORDER,
    PAYMENT_METHODS: PAYMENT_METHODS,
    OBJECT_STATUSES: OBJECT_STATUSES,
    TRIP_STATUSES: TRIP_STATUSES,
    PERIODS: PERIODS,
    MONTHS_SHORT: MONTHS_SHORT,
    MONTHS_FULL: MONTHS_FULL,
    get state() { return state; },
    subscribe: subscribe,
    replaceState: replaceState,
    resetData: resetData,
    saveIncome: saveIncome,
    saveTrip: saveTrip,
    saveObject: saveObject,
    saveSettings: saveSettings,
    addSource: addSource,
    deleteSource: deleteSource,
    deleteRecord: deleteRecord,
    incomesInRange: incomesInRange,
    tripsInRange: tripsInRange,
    objectById: objectById,
    objectName: objectName,
    tripDays: tripDays,
    tripDaysWithin: tripDaysWithin,
    tripPerDiem: tripPerDiem,
    tripStatus: tripStatus,
    total: total,
    isIncome: isIncome,
    incomeRecords: incomeRecords,
    uid: uid,
    nowISO: nowISO,
    todayISO: todayISO,
    iso: iso,
    parseISO: parseISO,
    isValidISO: isValidISO,
    daysBetween: daysBetween,
    periodRange: periodRange,
    previousRange: previousRange,
    monthsInRange: monthsInRange,
    monthKey: monthKey,
    monthLabel: monthLabel,
    formatDate: formatDate,
    formatDateLong: formatDateLong,
    formatDateShort: formatDateShort,
    formatMoney: money,
    compact: compact,
    currencySymbol: currencySymbol,
    plural: plural,
    round2: round2,
    normalizeState: normalizeState
  };
})();
