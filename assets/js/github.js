/* ============================================================
   «Наладчик» — синхронизация данных с GitHub через приватный Gist
   Токен хранится только в localStorage браузера и никогда не
   попадает в данные Gist или в репозиторий.
   ============================================================ */
(function () {
  'use strict';

  const CONFIG_KEY = 'naladchik:github:v1';
  const DATA_FILE = 'naladchik-data.json';
  const DESCRIPTION = 'Наладчик — данные инженера (личное хранилище)';
  const API_ROOT = 'https://api.github.com';

  function SyncError(message, code) {
    const error = new Error(message);
    error.name = 'SyncError';
    error.code = code || 'sync';
    return error;
  }

  function defaultConfig() {
    return {
      token: '',
      gistId: '',
      lastSyncAt: '',
      syncedAt: '',
      autoSync: true
    };
  }

  function loadConfig() {
    try {
      const raw = window.localStorage.getItem(CONFIG_KEY);
      if (!raw) return defaultConfig();
      const parsed = JSON.parse(raw);
      return {
        token: typeof parsed.token === 'string' ? parsed.token : '',
        gistId: typeof parsed.gistId === 'string' ? parsed.gistId : '',
        lastSyncAt: typeof parsed.lastSyncAt === 'string' ? parsed.lastSyncAt : '',
        syncedAt: typeof parsed.syncedAt === 'string' ? parsed.syncedAt : '',
        autoSync: parsed.autoSync !== false
      };
    } catch (error) {
      return defaultConfig();
    }
  }

  let config = loadConfig();
  let status = { state: 'local', message: 'GitHub не подключён', at: '' };
  let syncInFlight = false;
  let pushTimer = null;
  let suppressAutoSync = false;

  function persistConfig() {
    try {
      window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Не удалось сохранить настройки GitHub:', error);
    }
  }

  function emitStatus(state, message) {
    status = { state: state, message: message, at: new Date().toISOString() };
    document.dispatchEvent(new CustomEvent('github:status', { detail: getStatus() }));
  }

  function emitConfig() {
    document.dispatchEvent(new CustomEvent('github:config', { detail: getConfig() }));
  }

  function getStatus() {
    return Object.assign({}, status);
  }

  function getConfig() {
    return {
      token: config.token,
      gistId: config.gistId,
      lastSyncAt: config.lastSyncAt,
      syncedAt: config.syncedAt,
      autoSync: config.autoSync,
      gistUrl: config.gistId ? 'https://gist.github.com/' + config.gistId : ''
    };
  }

  function isConfigured() {
    return Boolean(config.token && config.gistId);
  }

  function parseGistId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.indexOf('://') !== -1) {
      try {
        const url = new URL(raw);
        const parts = url.pathname.split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : '';
      } catch (error) {
        return '';
      }
    }
    return raw.replace(/\s+/g, '');
  }

  function saveConfig(patch) {
    const next = Object.assign({}, config, patch || {});
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'gistId')) {
      next.gistId = parseGistId(next.gistId);
    }
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'token')) {
      next.token = String(next.token || '').trim();
    }
    config = next;
    persistConfig();
    if (isConfigured()) {
      if (status.state === 'local' || status.state === 'error') {
        emitStatus('ready', config.syncedAt ? 'Готово к синхронизации' : 'Подключено, требуется первая синхронизация');
      }
    } else {
      emitStatus('local', 'GitHub не подключён');
    }
    emitConfig();
    return getConfig();
  }

  function clearSyncBase() {
    config.syncedAt = '';
    config.lastSyncAt = '';
    persistConfig();
  }

  function hasMeaningfulData(state) {
    if (!state) return false;
    return (state.incomes || []).length > 0 || (state.trips || []).length > 0 || (state.objects || []).length > 0;
  }

  async function api(path, options) {
    if (!config.token) throw new SyncError('Не указан токен GitHub.', 'no-token');
    const opts = options || {};
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + config.token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (opts.body) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetch(API_ROOT + path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body || undefined,
        cache: 'no-store'
      });
    } catch (error) {
      throw new SyncError('Нет связи с GitHub. Проверьте интернет и попробуйте ещё раз.', 'network');
    }

    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json();
        detail = payload && payload.message ? String(payload.message) : '';
      } catch (error) { /* noop */ }
      let message = 'Ошибка GitHub (' + response.status + ').';
      if (response.status === 401) message = 'GitHub отклонил токен (401). Проверьте срок действия и права токена.';
      else if (response.status === 403) message = 'Недостаточно прав (403). Токену нужен доступ к Gists (чтение и запись).';
      else if (response.status === 404) message = 'Gist не найден (404). Проверьте ID и права токена.';
      else if (response.status === 422) message = 'GitHub отклонил данные (422). ' + detail;
      else if (response.status === 429) message = 'Слишком много запросов к GitHub (429). Попробуйте позже.';
      else if (detail) message += ' ' + detail;
      throw new SyncError(message, 'http-' + response.status);
    }
    return response.json();
  }

  function snapshotPayload() {
    return JSON.stringify(window.Store.state, null, 2);
  }

  async function readGist() {
    if (!config.gistId) throw new SyncError('Не указан Gist.', 'no-gist');
    const gist = await api('/gists/' + encodeURIComponent(config.gistId));
    const files = gist && gist.files ? gist.files : {};
    const file = files[DATA_FILE] || files[Object.keys(files)[0]];
    if (!file) throw new SyncError('В Gist нет файла с данными.', 'no-file');
    if (file.truncated) throw new SyncError('Файл данных больше 1 МБ и не может быть прочитан через Gist.', 'truncated');
    let data;
    try {
      data = JSON.parse(file.content);
    } catch (error) {
      throw new SyncError('Не удалось прочитать данные из Gist: файл повреждён.', 'bad-json');
    }
    if (!data || typeof data !== 'object') throw new SyncError('Данные в Gist имеют неверный формат.', 'bad-data');
    return data;
  }

  async function applyRemote(data) {
    suppressAutoSync = true;
    try {
      window.Store.replaceState(data, { keepUpdatedAt: true, source: 'remote' });
    } finally {
      window.setTimeout(function () { suppressAutoSync = false; }, 500);
    }
    config.syncedAt = data.updatedAt || window.Store.state.updatedAt;
    config.lastSyncAt = new Date().toISOString();
    persistConfig();
  }

  async function pushNow() {
    if (!isConfigured()) throw new SyncError('GitHub не подключён.', 'not-configured');
    const version = window.Store.state.updatedAt;
    const payload = {
      description: DESCRIPTION,
      files: {}
    };
    payload.files[DATA_FILE] = { content: snapshotPayload() };
    await api('/gists/' + encodeURIComponent(config.gistId), { method: 'PATCH', body: JSON.stringify(payload) });
    config.syncedAt = version;
    config.lastSyncAt = new Date().toISOString();
    persistConfig();
    emitConfig();
    return version;
  }

  async function push(options) {
    if (!isConfigured()) {
      emitStatus('local', 'GitHub не подключён');
      throw new SyncError('Сначала подключите GitHub в настройках.', 'not-configured');
    }
    if (syncInFlight) throw new SyncError('Синхронизация уже выполняется.', 'busy');
    syncInFlight = true;
    emitStatus('syncing', 'Отправка в GitHub…');
    try {
      await pushNow();
      emitStatus('synced', 'Данные отправлены в GitHub');
      document.dispatchEvent(new CustomEvent('github:pushed', { detail: { at: config.lastSyncAt } }));
      return true;
    } catch (error) {
      emitStatus('error', error.message);
      throw error;
    } finally {
      syncInFlight = false;
    }
  }

  async function pull() {
    if (!isConfigured()) {
      emitStatus('local', 'GitHub не подключён');
      throw new SyncError('Сначала подключите GitHub в настройках.', 'not-configured');
    }
    if (syncInFlight) throw new SyncError('Синхронизация уже выполняется.', 'busy');
    syncInFlight = true;
    emitStatus('syncing', 'Загрузка из GitHub…');
    try {
      const data = await readGist();
      await applyRemote(data);
      emitStatus('synced', 'Данные загружены из GitHub');
      document.dispatchEvent(new CustomEvent('github:pulled', { detail: { at: config.lastSyncAt } }));
      return true;
    } catch (error) {
      emitStatus('error', error.message);
      throw error;
    } finally {
      syncInFlight = false;
    }
  }

  async function createGist() {
    if (!config.token) throw new SyncError('Сначала укажите токен GitHub.', 'no-token');
    if (syncInFlight) throw new SyncError('Синхронизация уже выполняется.', 'busy');
    syncInFlight = true;
    emitStatus('syncing', 'Создание Gist…');
    try {
      const payload = {
        description: DESCRIPTION,
        public: false,
        files: {}
      };
      payload.files[DATA_FILE] = { content: snapshotPayload() };
      const gist = await api('/gists', { method: 'POST', body: JSON.stringify(payload) });
      if (!gist || !gist.id) throw new SyncError('GitHub не вернул ID созданного Gist.', 'bad-gist');
      config.gistId = gist.id;
      config.syncedAt = window.Store.state.updatedAt;
      config.lastSyncAt = new Date().toISOString();
      persistConfig();
      emitConfig();
      emitStatus('synced', 'Приватный Gist создан');
      document.dispatchEvent(new CustomEvent('github:created', { detail: { gistId: gist.id } }));
      return gist.id;
    } catch (error) {
      emitStatus('error', error.message);
      throw error;
    } finally {
      syncInFlight = false;
    }
  }

  async function sync(options) {
    const opts = options || {};
    if (!isConfigured()) {
      emitStatus('local', 'GitHub не подключён');
      if (!opts.quiet) throw new SyncError('Сначала подключите GitHub в настройках.', 'not-configured');
      return { ok: false, reason: 'not-configured' };
    }
    if (syncInFlight) return { ok: false, reason: 'busy' };
    syncInFlight = true;
    emitStatus('syncing', 'Синхронизация…');
    try {
      const remote = await readGist();
      const localVersion = Date.parse(window.Store.state.updatedAt) || 0;
      const remoteVersion = Date.parse(remote.updatedAt) || 0;
      const baseVersion = Date.parse(config.syncedAt) || 0;
      const localHasData = hasMeaningfulData(window.Store.state);
      const remoteHasData = hasMeaningfulData(remote);

      if (!localHasData && remoteHasData) {
        await applyRemote(remote);
        emitStatus('synced', 'Данные загружены из GitHub');
        document.dispatchEvent(new CustomEvent('github:pulled', { detail: { at: config.lastSyncAt } }));
        return { ok: true, action: 'pull' };
      }
      if (localHasData && !remoteHasData) {
        await pushNow();
        emitStatus('synced', 'Данные отправлены в GitHub');
        document.dispatchEvent(new CustomEvent('github:pushed', { detail: { at: config.lastSyncAt } }));
        return { ok: true, action: 'push' };
      }

      const localDirty = !baseVersion || localVersion > baseVersion + 1500;
      const remoteDirty = !baseVersion || remoteVersion > baseVersion + 1500;

      if (localDirty && remoteDirty && Math.abs(localVersion - remoteVersion) > 1500) {
        emitStatus('dirty', 'Нужно выбрать версию данных');
        document.dispatchEvent(new CustomEvent('github:conflict', {
          detail: {
            localUpdatedAt: window.Store.state.updatedAt,
            remoteUpdatedAt: remote.updatedAt,
            baseUpdatedAt: config.syncedAt
          }
        }));
        return { ok: false, reason: 'conflict' };
      }

      if (remoteDirty && !localDirty) {
        await applyRemote(remote);
        emitStatus('synced', 'Данные загружены из GitHub');
        document.dispatchEvent(new CustomEvent('github:pulled', { detail: { at: config.lastSyncAt } }));
        return { ok: true, action: 'pull' };
      }

      if (localDirty || localVersion > remoteVersion) {
        await pushNow();
        emitStatus('synced', 'Данные отправлены в GitHub');
        document.dispatchEvent(new CustomEvent('github:pushed', { detail: { at: config.lastSyncAt } }));
        return { ok: true, action: 'push' };
      }

      config.lastSyncAt = new Date().toISOString();
      config.syncedAt = window.Store.state.updatedAt;
      persistConfig();
      emitConfig();
      emitStatus('synced', 'Всё актуально');
      return { ok: true, action: 'none' };
    } catch (error) {
      emitStatus('error', error.message);
      if (!opts.quiet) throw error;
      return { ok: false, reason: 'error', error: error };
    } finally {
      syncInFlight = false;
    }
  }

  function schedulePush() {
    if (!config.autoSync || !isConfigured() || !config.syncedAt) return;
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(function () {
      if (suppressAutoSync) return;
      emitStatus('dirty', 'Есть несохранённые изменения в GitHub');
      push().catch(function (error) {
        console.warn('Автосинхронизация не удалась:', error.message);
      });
    }, 2500);
  }

  // Изменения локальных данных → отложенная отправка в GitHub
  document.addEventListener('store:change', function (event) {
    if (suppressAutoSync) return;
    if (event.detail && event.detail.source === 'remote') return;
    if (!isConfigured() || !config.syncedAt) return;
    schedulePush();
  });

  window.addEventListener('offline', function () {
    if (isConfigured()) emitStatus('error', 'Нет подключения к интернету');
  });

  window.addEventListener('online', function () {
    if (isConfigured() && config.autoSync && config.syncedAt) {
      window.setTimeout(function () {
        sync({ quiet: true });
      }, 1200);
    }
  });

  // Первичная синхронизация при запуске приложения
  window.addEventListener('load', function () {
    if (isConfigured() && config.syncedAt && config.autoSync) {
      window.setTimeout(function () {
        sync({ quiet: true });
      }, 2200);
    }
  });

  if (isConfigured()) {
    if (config.syncedAt) emitStatus('ready', 'Готово к синхронизации');
    else emitStatus('ready', 'Подключено, требуется первичная синхронизация');
  } else {
    emitStatus('local', 'GitHub не подключён');
  }

  window.GitHubSync = {
    DATA_FILE: DATA_FILE,
    getConfig: getConfig,
    saveConfig: saveConfig,
    clearSyncBase: clearSyncBase,
    getStatus: getStatus,
    isConfigured: isConfigured,
    parseGistId: parseGistId,
    createGist: createGist,
    push: push,
    pull: pull,
    sync: sync,
    hasMeaningfulData: hasMeaningfulData
  };
})();
