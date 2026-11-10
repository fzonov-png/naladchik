/* ============================================================
   «Наладчик» — настройки, GitHub, импорт/экспорт и демо-данные
   ============================================================ */
(function () {
  'use strict';

  const Store = window.Store;
  const WC = window.WC;
  const GitHub = window.GitHubSync;
  const App = WC.App;
  const esc = WC.esc;
  const icon = WC.icon;
  const money = WC.money;
  const fdate = WC.fdate;

  /* ============================================================
     ЭКРАН НАСТРОЕК
     ============================================================ */

  function renderSettings() {
    const settings = Store.state.settings;
    const cfg = GitHub.getConfig();
    const backup = WC.loadBackup();
    const sources = Store.state.sources.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
    const incomeCount = Store.incomeRecords(Store.state.incomes).length;
    const tripCount = Store.state.trips.length;
    const objectCount = Store.state.objects.length;
    const expenseCount = Store.state.expenses.length;
    const debtCount = Store.state.debts.length;

    return '<div class="settings-layout">' +

      '<div class="settings-grid">' +
      '<form id="settingsForm" class="card settings-card">' +
      '<header class="card-head"><div><h2>Профиль и расчёты</h2><p>Основные параметры кабинета</p></div></header>' +
      '<div class="form-grid">' +
      '<label class="field span-2"><span>Имя инженера</span><input class="input" type="text" name="engineerName" maxlength="120" placeholder="Как подписывать данные" value="' + esc(settings.engineerName) + '"></label>' +
      '<label class="field span-2"><span>Организация</span><input class="input" type="text" name="organization" maxlength="200" placeholder="Например, ООО «ПромАвтоматика»" value="' + esc(settings.organization || '') + '"></label>' +
      '<label class="field span-2"><span>Должность</span><input class="input" type="text" name="position" maxlength="160" placeholder="Например, инженер по наладке КИПиА" value="' + esc(settings.position || '') + '"></label>' +
      '<label class="field"><span>Валюта</span><select class="input" name="currency">' +
      Object.keys(Store.CURRENCIES).map(function (code) {
        return '<option value="' + code + '"' + (settings.currency === code ? ' selected' : '') + '>' + esc(Store.CURRENCIES[code].label) + ' (' + esc(Store.CURRENCIES[code].symbol) + ')</option>';
      }).join('') +
      '</select></label>' +
      '<label class="field"><span>Ставка суточных по умолчанию</span><div class="input-with-suffix">' +
      '<input class="input" type="number" name="perDiemRate" min="0" step="1" inputmode="decimal" value="' + esc(settings.perDiemRate) + '">' +
      '<span class="input-suffix">' + esc(Store.currencySymbol()) + ' / сутки</span></div></label>' +
      '</div>' +
      '<p class="hint">' + icon('info') + ' Ставка применяется к новым командировкам. Организация и должность печатаются в шапке авансового отчёта.</p>' +
      '<footer class="settings-footer"><button type="submit" class="btn btn-primary">Сохранить настройки</button>' +
      '<span class="muted">Тема оформления переключается кнопкой в шапке</span></footer>' +
      '</form>' +

      '<section class="card settings-card">' +
      '<header class="card-head"><div><h2>Источники дохода</h2><p>Организации и заказчики, которые выплачивают доход</p></div></header>' +
      (sources.length
        ? '<div class="chips">' + sources.map(function (source) {
          return '<span class="chip"><i class="chip-dot"></i>' + esc(source.name) +
            '<button type="button" class="chip-remove" data-action="delete-source" data-id="' + esc(source.id) + '" title="Удалить источник">' + icon('close') + '</button></span>';
        }).join('') + '</div>'
        : '<p class="muted settings-empty">Источники добавляются автоматически при создании дохода. Можно добавить вручную:</p>') +
      '<form id="sourceForm" class="inline-form">' +
      '<input class="input" type="text" name="name" maxlength="160" placeholder="Название организации" autocomplete="off">' +
      '<button type="submit" class="btn btn-ghost">' + icon('plus') + 'Добавить</button>' +
      '</form>' +
      '<p class="hint">Удаление источника не меняет уже сохранённые доходы — название остаётся в записях.</p>' +
      '</section>' +
      '</div>' +

      '<section class="card settings-card settings-wide" id="githubCard">' +
      '<header class="card-head"><div><span class="eyebrow">Облачное хранилище</span><h2>' + icon('github', 'icon-github') + 'GitHub</h2>' +
      '<p>Личный приватный Gist как хранилище и резервная копия данных</p></div>' +
      '<a class="btn btn-ghost btn-sm" href="https://gist.github.com/" target="_blank" rel="noopener noreferrer">Мои Gist ' + icon('arrow-up-right') + '</a></header>' +
      '<form id="githubForm" novalidate>' +
      '<div class="form-grid">' +
      '<label class="field span-2"><span>Personal access token</span>' +
      '<div class="input-with-button">' +
      '<input class="input" id="githubToken" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_… или ghp_…" value="' + esc(cfg.token) + '">' +
      '<button type="button" class="icon-btn" data-action="toggle-token" title="Показать токен">' + icon('eye') + '</button>' +
      '</div>' +
      '<small class="hint">Нужен доступ к Gists. Токен хранится только в localStorage этого браузера и не попадает в Gist или репозиторий.</small>' +
      '</label>' +
      '<label class="field span-2"><span>ID Gist или ссылка</span>' +
      '<input class="input" id="githubGist" type="text" autocomplete="off" spellcheck="false" placeholder="Например, 1a2b3c… или https://gist.github.com/user/1a2b3c…" value="' + esc(cfg.gistId) + '">' +
      '<small class="hint">Оставьте пустым и нажмите «Создать Gist» — приватный Gist будет создан автоматически.</small>' +
      '</label>' +
      '</div>' +
      '<div class="settings-actions">' +
      '<button type="submit" class="btn btn-primary">' + icon('check') + 'Сохранить подключение</button>' +
      '<button type="button" class="btn btn-ghost" data-action="github-create">' + icon('plus') + 'Создать Gist</button>' +
      '<span class="settings-actions-divider"></span>' +
      '<button type="button" class="btn btn-ghost" data-action="github-pull">' + icon('download') + 'Скачать из GitHub</button>' +
      '<button type="button" class="btn btn-ghost" data-action="github-push">' + icon('upload') + 'Отправить в GitHub</button>' +
      '<button type="button" class="btn btn-primary" data-action="github-sync">' + icon('refresh') + 'Синхронизировать</button>' +
      '</div>' +
      '<div id="syncStatusBox" class="sync-status"></div>' +
      '<div class="settings-github-footer">' +
      '<label class="switch-row"><input type="checkbox" id="githubAutoSync"' + (cfg.autoSync ? ' checked' : '') + '><span class="switch"></span><span>Автосохранение изменений в GitHub</span></label>' +
      '<span id="gistLinkWrap" class="gist-link"></span>' +
      '</div>' +
      '<div class="callout callout-warn">' + icon('alert') +
      '<div><b>Безопасность</b><p>Создайте отдельный токен только для Gists. Не используйте основной токен с правами на репозитории. На общем компьютере удалите токен из настроек после работы. Ссылка на приватный Gist всё равно даёт доступ к данным всем, у кого она есть.</p></div>' +
      '</div>' +
      '<p class="hint">Создать токен: <a href="https://github.com/settings/tokens/new?scopes=gist&description=%D0%9D%D0%B0%D0%BB%D0%B0%D0%B4%D1%87%D0%B8%D0%BA" target="_blank" rel="noopener noreferrer">classic с правом gist</a> или <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">fine-grained с доступом к Gists</a>.</p>' +
      '</form>' +
      '</section>' +

      '<section class="card settings-card settings-wide">' +
      '<header class="card-head"><div><h2>Данные</h2><p>Резервные копии, обмен и очистка</p></div>' +
      '<span class="badge badge-muted">' + incomeCount + ' ' + WC.plural(incomeCount, ['доход', 'дохода', 'доходов']) + ' · ' + tripCount + ' ' + WC.plural(tripCount, ['командировка', 'командировки', 'командировок']) + ' · ' + objectCount + ' ' + WC.plural(objectCount, ['объект', 'объекта', 'объектов']) + ' · ' + expenseCount + ' ' + WC.plural(expenseCount, ['расход', 'расхода', 'расходов']) + ' · ' + debtCount + ' ' + WC.plural(debtCount, ['долг', 'долга', 'долгов']) + '</span></header>' +
      '<div class="data-list">' +
      '<div class="data-row"><div class="data-main">' + icon('download') + '<div><b>Скачать резервную копию</b><span>Все данные в JSON — для хранения и переноса</span></div></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="export-json">Скачать JSON</button></div>' +
      '<div class="data-row"><div class="data-main">' + icon('download') + '<div><b>Доходы в CSV</b><span>Все записи для Excel или бухгалтерии</span></div></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="export-incomes-csv" data-scope="all">Скачать CSV</button></div>' +
      '<div class="data-row"><div class="data-main">' + icon('download') + '<div><b>Командировки в CSV</b><span>Направления, сутки, суточные, авансы и баланс</span></div></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="export-trips-csv" data-scope="all">Скачать CSV</button></div>' +
      '<div class="data-row"><div class="data-main">' + icon('download') + '<div><b>Расходы командировок в CSV</b><span>Даты, категории, документы и суммы</span></div></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="export-expenses-csv" data-scope="all">Скачать CSV</button></div>' +
      '<div class="data-row"><div class="data-main">' + icon('download') + '<div><b>Ежедневные расходы в CSV</b><span>Личные траты по категориям и способу оплаты</span></div></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="export-daily-expenses-csv" data-scope="all">Скачать CSV</button></div>' +
      '<div class="data-row"><div class="data-main">' + icon('download') + '<div><b>Долги в CSV</b><span>Остатки, платежи и график по обязательствам</span></div></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="export-debts-csv">Скачать CSV</button></div>' +
      '<div class="data-row"><div class="data-main">' + icon('upload') + '<div><b>Импорт из JSON</b><span>Заменит текущие данные резервной копией</span></div></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="import-json">Выбрать файл</button></div>' +
      (backup
        ? '<div class="data-row"><div class="data-main">' + icon('refresh') + '<div><b>Резервная копия перед синхронизацией</b><span>Сохранена ' + esc(WC.formatDateTime(backup.at)) + '</span></div></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="restore-backup">Восстановить</button></div>'
        : '') +
      '<div class="data-row"><div class="data-main">' + icon('sparkles') + '<div><b>Демонстрационные данные</b><span>Посмотреть, как всё выглядит на примере</span></div></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="demo-data">Загрузить демо</button></div>' +
      '<div class="data-row data-row-danger"><div class="data-main">' + icon('trash') + '<div><b>Очистить данные</b><span>Удалить доходы, командировки и объекты из браузера</span></div></div>' +
      '<button type="button" class="btn btn-danger-ghost btn-sm" data-action="reset-data">Очистить</button></div>' +
      '</div>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      '</section>' +

      '<section class="card settings-card settings-wide">' +
      '<header class="card-head"><div><h2>О приложении</h2><p>Локальное приложение без сервера</p></div></header>' +
      '<div class="about-grid">' +
      '<div><span>Версия</span><b>1.3.0</b></div>' +
      '<div><span>Хранение</span><b>localStorage + GitHub Gist</b></div>' +
      '<div><span>Формат данных</span><b>JSON</b></div>' +
      '<div><span>Валюта</span><b>' + esc(Store.CURRENCIES[settings.currency].label) + '</b></div>' +
      '</div>' +
      '<p class="about-text">Приложение не отправляет данные на сторонние серверы. Синхронизация выполняется напрямую с api.github.com по вашему токену. Регулярно делайте резервную копию в JSON.</p>' +
      '<p class="hint">Сочетания клавиш: Esc — закрыть окно, Ctrl/Cmd + P — печать отчёта.</p>' +
      '</section>' +
      '</div>';
  }

  /* ============================================================
     НАСТРОЙКИ И ИСТОЧНИКИ
     ============================================================ */

  function readGithubFields() {
    const tokenInput = document.getElementById('githubToken');
    const gistInput = document.getElementById('githubGist');
    return {
      token: tokenInput ? tokenInput.value.trim() : '',
      gistId: gistInput ? gistInput.value.trim() : ''
    };
  }

  function saveGithubFields() {
    const fields = readGithubFields();
    GitHub.saveConfig(fields);
    WC.updateSyncChip();
    WC.updateSyncStatusBox();
    WC.updateSidebarStorage();
    return GitHub.getConfig();
  }

  function requireGithub(needGist) {
    const cfg = saveGithubFields();
    if (!cfg.token) {
      WC.toast('Сначала укажите токен GitHub', { type: 'error' });
      return null;
    }
    if (needGist && !cfg.gistId) {
      WC.toast('Укажите ID Gist или создайте новый', { type: 'error' });
      return null;
    }
    return cfg;
  }

  function handleSettingsSubmit(form) {
    const data = new FormData(form);
    const rate = WC.parseAmount(data.get('perDiemRate'));
    if (!Number.isFinite(rate) || rate < 0) {
      WC.toast('Ставка суточных должна быть неотрицательным числом', { type: 'error' });
      return;
    }
    Store.saveSettings({
      engineerName: String(data.get('engineerName') || '').trim(),
      organization: String(data.get('organization') || '').trim(),
      position: String(data.get('position') || '').trim(),
      currency: String(data.get('currency') || 'RUB'),
      perDiemRate: rate
    });
    WC.toast('Настройки сохранены');
  }

  function handleSourceSubmit(form) {
    const input = form.querySelector('[name="name"]');
    if (!input) return;
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    Store.addSource(name);
    WC.toast('Источник добавлен', { type: 'info' });
  }

  function deleteSource(id) {
    const source = Store.state.sources.find(function (item) { return item.id === id; });
    if (!source) return;
    const snapshot = JSON.stringify(Store.state);
    Store.deleteSource(id);
    WC.toast('Источник «' + source.name + '» удалён', {
      actionLabel: 'Отменить',
      timeout: 9000,
      onAction: function () {
        Store.replaceState(JSON.parse(snapshot), { source: 'local' });
        WC.toast('Источник восстановлен', { type: 'info' });
      }
    });
  }

  /* ============================================================
     GITHUB: ДЕЙСТВИЯ
     ============================================================ */

  async function createGist() {
    const cfg = requireGithub(false);
    if (!cfg) return;
    if (cfg.gistId) {
      const confirmed = await WC.confirmDialog({
        title: 'Создать новый Gist?',
        message: 'Текущий Gist останется на GitHub, но приложение переключится на новый. Данные будут отправлены в него.',
        confirmLabel: 'Создать новый'
      });
      if (!confirmed) return;
    }
    const id = await GitHub.createGist();
    const gistInput = document.getElementById('githubGist');
    if (gistInput) gistInput.value = id;
    WC.updateSyncStatusBox();
    WC.updateSyncChip();
    WC.toast('Приватный Gist создан. Данные сохранены на GitHub.');
  }

  async function pullGithub() {
    const cfg = requireGithub(true);
    if (!cfg) return;
    if (WC.hasData()) {
      const confirmed = await WC.confirmDialog({
        title: 'Заменить локальные данные?',
        message: 'Данные из Gist заменят всё, что сейчас сохранено в этом браузере. Перед заменой будет создана резервная копия.',
        confirmLabel: 'Загрузить из GitHub'
      });
      if (!confirmed) return;
    }
    WC.saveBackup(Store.state);
    await GitHub.pull();
    WC.toast('Данные загружены из GitHub');
  }

  async function pushGithub() {
    const cfg = requireGithub(true);
    if (!cfg) return;
    await GitHub.push();
    WC.toast('Данные отправлены в GitHub');
  }

  async function syncGithub() {
    const cfg = requireGithub(true);
    if (!cfg) return;
    const result = await GitHub.sync();
    if (!result || !result.ok) {
      if (result && result.reason === 'conflict') return;
      if (result && result.reason === 'busy') {
        WC.toast('Синхронизация уже выполняется', { type: 'info' });
        return;
      }
      return;
    }
    if (result.action === 'pull') WC.toast('Данные обновлены из GitHub');
    else if (result.action === 'push') WC.toast('Данные отправлены в GitHub');
    else WC.toast('Данные уже актуальны', { type: 'info' });
  }

  /* ============================================================
     ЭКСПОРТ / ИМПОРТ
     ============================================================ */

  function exportJson() {
    WC.downloadText('naladchik-backup-' + Store.todayISO() + '.json', JSON.stringify(Store.state, null, 2), 'application/json;charset=utf-8');
    WC.toast('Резервная копия сохранена');
  }

  function exportIncomesCsv(scope) {
    const range = scope === 'period' ? WC.getRange() : { from: null, to: null };
    const list = Store.incomeRecords(Store.incomesInRange(range.from, range.to)).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (!list.length) {
      WC.toast('Нет доходов для выгрузки. Суточные в доходы не входят.', { type: 'info' });
      return;
    }
    const rows = [['Дата', 'Тип дохода', 'Источник', 'Объект', 'Способ получения', 'Сумма', 'Комментарий']];
    list.forEach(function (item) {
      rows.push([
        fdate(item.date),
        Store.INCOME_TYPES[item.type].label,
        item.sourceName || '',
        WC.objectLabel(item.objectId) || '',
        item.method === 'cash' ? 'Наличные' : 'Безналичные',
        String(item.amount).replace('.', ','),
        item.note || ''
      ]);
    });
    const suffix = scope === 'period' ? WC.fileSuffix() : '-all';
    WC.downloadText('naladchik-dohody' + suffix + '.csv', WC.toCsv(rows), 'text/csv;charset=utf-8');
    WC.toast('CSV с доходами сохранён');
  }

  function exportTripsCsv(scope) {
    const range = scope === 'period' ? WC.getRange() : { from: null, to: null };
    const list = Store.tripsInRange(range.from, range.to).slice().sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
    if (!list.length) {
      WC.toast('Нет командировок для выгрузки', { type: 'info' });
      return;
    }
    const rows = [['Направление', 'Объект', 'Начало', 'Окончание', 'Суток', 'Ставка', 'Суточные', 'Аванс', 'Расходы', 'К отчёту', 'Баланс (аванс − отчёт)', 'Транспорт', 'Цель', 'Статус']];
    list.forEach(function (trip) {
      rows.push([
        trip.destination,
        WC.objectLabel(trip.objectId) || '',
        fdate(trip.startDate),
        fdate(trip.endDate),
        Store.tripDays(trip),
        String(trip.perDiemRate).replace('.', ','),
        String(Store.tripPerDiem(trip)).replace('.', ','),
        String(Store.tripAdvance(trip)).replace('.', ','),
        String(Store.tripExpensesTotal(trip)).replace('.', ','),
        String(Store.tripReportTotal(trip)).replace('.', ','),
        String(Store.tripBalance(trip)).replace('.', ','),
        trip.transport || '',
        trip.purpose || '',
        Store.TRIP_STATUSES[Store.tripStatus(trip)]
      ]);
    });
    const suffix = scope === 'period' ? WC.fileSuffix() : '-all';
    WC.downloadText('naladchik-komandirovki' + suffix + '.csv', WC.toCsv(rows), 'text/csv;charset=utf-8');
    WC.toast('CSV с командировками сохранён');
  }

  function exportExpensesCsv(scope) {
    const range = scope === 'period' ? WC.getRange() : { from: null, to: null };
    const list = Store.tripsInRange(range.from, range.to).slice().sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
    const rows = [['Командировка', 'Направление', 'Дата', 'Вид расхода', 'Документ', 'Способ оплаты', 'Сумма', 'Комментарий']];
    let count = 0;
    list.forEach(function (trip) {
      const expenses = scope === 'period'
        ? Store.tripExpensesInRange(trip, range.from, range.to)
        : Store.tripExpenses(trip);
      expenses.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (expense) {
        count += 1;
        rows.push([
          trip.destination,
          WC.objectLabel(trip.objectId) || '',
          fdate(expense.date),
          Store.EXPENSE_CATEGORIES[expense.category] || 'Прочие расходы',
          expense.document || '',
          expense.method === 'cash' ? 'Наличные' : 'Безналичные',
          String(expense.amount).replace('.', ','),
          expense.note || ''
        ]);
      });
    });
    if (!count) {
      WC.toast('Нет расходов командировок для выгрузки', { type: 'info' });
      return;
    }
    const suffix = scope === 'period' ? WC.fileSuffix() : '-all';
    WC.downloadText('naladchik-rashody' + suffix + '.csv', WC.toCsv(rows), 'text/csv;charset=utf-8');
    WC.toast('CSV с расходами сохранён');
  }

  function exportDailyExpensesCsv(scope) {
    const range = scope === 'period' ? WC.getRange() : { from: null, to: null };
    const list = Store.expensesInRange(range.from, range.to).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (!list.length) {
      WC.toast('Нет ежедневных расходов для выгрузки', { type: 'info' });
      return;
    }
    const rows = [['Дата', 'Категория', 'Способ оплаты', 'Сумма', 'Комментарий']];
    list.forEach(function (item) {
      rows.push([
        fdate(item.date),
        Store.lifeCategoryLabel(item.category),
        item.method === 'cash' ? 'Наличные' : 'Безналичные',
        String(item.amount).replace('.', ','),
        item.note || ''
      ]);
    });
    const suffix = scope === 'period' ? WC.fileSuffix() : '-all';
    WC.downloadText('naladchik-ezhednevnye-rashody' + suffix + '.csv', WC.toCsv(rows), 'text/csv;charset=utf-8');
    WC.toast('CSV с ежедневными расходами сохранён');
  }

  function exportDebtsCsv() {
    const list = Store.state.debts.slice().sort(function (a, b) { return Store.debtRemaining(b) - Store.debtRemaining(a); });
    if (!list.length) {
      WC.toast('Нет долгов для выгрузки', { type: 'info' });
      return;
    }
    const rows = [['Долг', 'Кредитор', 'Тип', 'Сумма долга', 'Выплачено', 'Остаток', 'Платёж в месяц', 'Ставка, %', 'Дата начала', 'Дата окончания', 'День платежа', 'Статус', 'Комментарий']];
    list.forEach(function (debt) {
      rows.push([
        debt.title,
        debt.lender || '',
        Store.DEBT_TYPES[debt.type].label,
        String(debt.principal).replace('.', ','),
        String(Store.debtPaid(debt)).replace('.', ','),
        String(Store.debtRemaining(debt)).replace('.', ','),
        String(debt.monthlyPayment).replace('.', ','),
        String(debt.rate).replace('.', ','),
        debt.startDate ? fdate(debt.startDate) : '',
        debt.endDate ? fdate(debt.endDate) : '',
        debt.dueDay || '',
        Store.debtStatus(debt).label,
        debt.note || ''
      ]);
    });
    WC.downloadText('naladchik-dolgi-all.csv', WC.toCsv(rows), 'text/csv;charset=utf-8');
    WC.toast('CSV с долгами сохранён');
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (error) {
        WC.toast('Файл не является корректным JSON', { type: 'error' });
        return;
      }
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.incomes) || !Array.isArray(parsed.trips)) {
        WC.toast('Это не файл резервной копии «Наладчик»', { type: 'error' });
        return;
      }
      WC.confirmDialog({
        title: 'Импортировать данные?',
        message: 'Текущие доходы, командировки и объекты будут заменены данными из файла. Перед заменой создаётся резервная копия.',
        confirmLabel: 'Импортировать'
      }).then(function (confirmed) {
        if (!confirmed) return;
        WC.saveBackup(Store.state);
        Store.replaceState(parsed, { source: 'local' });
        WC.toast('Данные импортированы');
        WC.go('dashboard');
      });
    };
    reader.onerror = function () {
      WC.toast('Не удалось прочитать файл', { type: 'error' });
    };
    reader.readAsText(file);
  }

  function restoreBackup() {
    const backup = WC.loadBackup();
    if (!backup) {
      WC.toast('Резервная копия не найдена', { type: 'error' });
      return;
    }
    WC.confirmDialog({
      title: 'Восстановить резервную копию?',
      message: 'Текущие данные будут заменены копией от ' + WC.formatDateTime(backup.at) + '.',
      confirmLabel: 'Восстановить'
    }).then(function (confirmed) {
      if (!confirmed) return;
      Store.replaceState(backup.state, { source: 'local' });
      WC.toast('Резервная копия восстановлена');
      WC.go('dashboard');
    });
  }

  /* ============================================================
     ДЕМО-ДАННЫЕ
     ============================================================ */

  function demoDate(monthOffset, day) {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0).getDate();
    return Store.iso(new Date(now.getFullYear(), now.getMonth() + monthOffset, Math.min(day, lastDay)));
  }

  function buildDemoState() {
    const now = new Date();
    const createdAt = Store.nowISO();
    const settings = Object.assign({}, Store.state.settings, {
      engineerName: Store.state.settings.engineerName || 'Алексей Смирнов',
      organization: Store.state.settings.organization || 'ООО «ПромАвтоматика»',
      position: Store.state.settings.position || 'Инженер по наладке КИПиА',
      perDiemRate: 700
    });

    const sources = [
      { id: 'demo-source-1', name: 'ООО «ПромАвтоматика»' },
      { id: 'demo-source-2', name: 'АО «Северный ГОК»' },
      { id: 'demo-source-3', name: 'ООО «ТехСервис»' }
    ];

    const objects = [
      { id: 'demo-object-1', name: 'ГОК «Северный» — обогатительная фабрика', customer: 'АО «Северный ГОК»', address: 'Норильск, цех № 2', status: 'active', startDate: demoDate(-5, 10), endDate: '', note: 'ПНР шкафов КИПиА и частотных приводов.', createdAt: createdAt, updatedAt: createdAt },
      { id: 'demo-object-2', name: 'Автозавод — окрасочная линия', customer: 'ООО «ПромАвтоматика»', address: 'Тольятти, корпус 4', status: 'done', startDate: demoDate(-4, 12), endDate: demoDate(-1, 20), note: 'Наладка линии окраски и сушильной камеры.', createdAt: createdAt, updatedAt: createdAt },
      { id: 'demo-object-3', name: 'Порт Лавна — конвейерная линия', customer: 'АО «Порт Лавна»', address: 'Мурманск, терминал 1', status: 'active', startDate: demoDate(-2, 3), endDate: '', note: 'Пусконаладка конвейера, 3 привода.', createdAt: createdAt, updatedAt: createdAt },
      { id: 'demo-object-4', name: 'НПЗ — узел подготовки газа', customer: 'ООО «ТехСервис»', address: 'Пермь, установка 12', status: 'active', startDate: demoDate(-1, 15), endDate: '', note: 'Проверка контуров регулирования.', createdAt: createdAt, updatedAt: createdAt }
    ];

    const trips = [
      {
        id: 'demo-trip-1', destination: 'Норильск', objectId: 'demo-object-1', startDate: demoDate(-2, 4), endDate: demoDate(-2, 11),
        perDiemRate: 700, advanceAmount: 60000, transport: 'Авиа', purpose: 'ПНР шкафов КИПиА', note: '',
        expenses: [
          { id: 'demo-trip-1-exp-1', date: demoDate(-2, 4), category: 'travel', amount: 18500, method: 'bank', document: 'Авиабилет № 4215', note: 'Москва — Норильск' },
          { id: 'demo-trip-1-exp-2', date: demoDate(-2, 4), category: 'lodging', amount: 32000, method: 'bank', document: 'Счёт гостиницы № 88', note: '8 суток' },
          { id: 'demo-trip-1-exp-3', date: demoDate(-2, 5), category: 'localTransport', amount: 2400, method: 'cash', document: 'Чек такси', note: 'Аэропорт — площадка' },
          { id: 'demo-trip-1-exp-4', date: demoDate(-2, 6), category: 'communication', amount: 900, method: 'cash', document: 'Чек оператора связи', note: '' }
        ],
        createdAt: createdAt, updatedAt: createdAt
      },
      {
        id: 'demo-trip-2', destination: 'Тольятти', objectId: 'demo-object-2', startDate: demoDate(-1, 8), endDate: demoDate(-1, 12),
        perDiemRate: 700, advanceAmount: 30000, transport: 'Поезд', purpose: 'Наладка окрасочной линии', note: '',
        expenses: [
          { id: 'demo-trip-2-exp-1', date: demoDate(-1, 8), category: 'travel', amount: 4200, method: 'bank', document: 'Билет РЖД № 1140', note: 'Москва — Тольятти' },
          { id: 'demo-trip-2-exp-2', date: demoDate(-1, 8), category: 'lodging', amount: 18000, method: 'bank', document: 'Счёт гостиницы № 51', note: '5 суток' },
          { id: 'demo-trip-2-exp-3', date: demoDate(-1, 9), category: 'localTransport', amount: 1500, method: 'cash', document: 'Чек такси', note: '' }
        ],
        createdAt: createdAt, updatedAt: createdAt
      },
      {
        id: 'demo-trip-3', destination: 'Мурманск', objectId: 'demo-object-3', startDate: demoDate(0, 3), endDate: demoDate(0, 10),
        perDiemRate: 700, advanceAmount: 55000, transport: 'Авиа', purpose: 'Пуск конвейерной линии', note: '',
        expenses: [
          { id: 'demo-trip-3-exp-1', date: demoDate(0, 3), category: 'travel', amount: 21000, method: 'bank', document: 'Авиабилет № 7781', note: 'Москва — Мурманск' },
          { id: 'demo-trip-3-exp-2', date: demoDate(0, 3), category: 'lodging', amount: 30000, method: 'bank', document: 'Счёт гостиницы № 143', note: '8 суток' },
          { id: 'demo-trip-3-exp-3', date: demoDate(0, 4), category: 'localTransport', amount: 2100, method: 'cash', document: 'Чек такси', note: '' },
          { id: 'demo-trip-3-exp-4', date: demoDate(0, 6), category: 'representation', amount: 3000, method: 'cash', document: 'Чек кафе', note: 'Переговоры с заказчиком' }
        ],
        createdAt: createdAt, updatedAt: createdAt
      },
      {
        id: 'demo-trip-4', destination: 'Пермь', objectId: 'demo-object-4', startDate: demoDate(0, 20), endDate: demoDate(0, 24),
        perDiemRate: 700, advanceAmount: 25000, transport: 'Авто', purpose: 'Проверка контуров регулирования', note: '',
        expenses: [
          { id: 'demo-trip-4-exp-1', date: demoDate(0, 20), category: 'travel', amount: 6000, method: 'bank', document: 'Чек АЗС № 331', note: 'Поездка на автомобиле' },
          { id: 'demo-trip-4-exp-2', date: demoDate(0, 20), category: 'lodging', amount: 15000, method: 'bank', document: 'Счёт гостиницы № 64', note: '5 суток' },
          { id: 'demo-trip-4-exp-3', date: demoDate(0, 21), category: 'communication', amount: 600, method: 'cash', document: 'Чек оператора связи', note: '' }
        ],
        createdAt: createdAt, updatedAt: createdAt
      }
    ];

    const incomes = [];
    let sequence = 1;
    function addIncome(date, type, amount, method, sourceName, objectId, note) {
      incomes.push({
        id: 'demo-income-' + sequence,
        date: date,
        type: type,
        amount: amount,
        method: method,
        sourceName: sourceName,
        objectId: objectId || null,
        note: note || '',
        createdAt: createdAt,
        updatedAt: createdAt
      });
      sequence += 1;
    }

    for (let offset = -4; offset <= -1; offset += 1) {
      const objectId = offset % 2 === 0 ? 'demo-object-1' : 'demo-object-2';
      addIncome(demoDate(offset, 10), 'advance', 45000, 'bank', 'ООО «ПромАвтоматика»', objectId, 'Аванс за месяц');
      addIncome(demoDate(offset, 25), 'salary', 82000, 'bank', 'ООО «ПромАвтоматика»', objectId, 'Окончательный расчёт за месяц');
    }

    addIncome(demoDate(0, Math.min(8, now.getDate())), 'advance', 45000, 'bank', 'ООО «ПромАвтоматика»', 'demo-object-3', 'Аванс за текущий месяц');
    addIncome(demoDate(-3, 12), 'vacation', 64000, 'bank', 'АО «Северный ГОК»', 'demo-object-1', 'Отпускные за 14 дней');
    addIncome(demoDate(-2, 20), 'bonus', 25000, 'bank', 'ООО «ПромАвтоматика»', 'demo-object-2', 'Премия за сдачу объекта');
    addIncome(demoDate(-1, 18), 'compensation', 12500, 'cash', 'ООО «ТехСервис»', 'demo-object-4', 'Компенсация расходов на проезд');
    addIncome(demoDate(-4, 15), 'other', 8000, 'cash', 'ООО «ТехСервис»', 'demo-object-1', 'Оплата консультации');

    trips.forEach(function (trip) {
      const sourceName = trip.objectId === 'demo-object-1' ? 'АО «Северный ГОК»'
        : trip.objectId === 'demo-object-3' ? 'ООО «ТехСервис»'
          : 'ООО «ПромАвтоматика»';
      addIncome(trip.startDate, 'perDiem', Store.tripDays(trip) * trip.perDiemRate, 'cash', sourceName, trip.objectId, 'Суточные: ' + trip.destination);
    });

    const expenses = [];
    let expenseSequence = 1;
    function addExpense(date, category, amount, method, note) {
      expenses.push({
        id: 'demo-expense-' + expenseSequence,
        date: date,
        category: category,
        amount: amount,
        method: method,
        note: note || '',
        createdAt: createdAt,
        updatedAt: createdAt
      });
      expenseSequence += 1;
    }

    for (let offset = -4; offset <= 0; offset += 1) {
      addExpense(demoDate(offset, 3), 'food', 6200 + (offset + 4) * 180, 'bank', 'Продукты на неделю');
      addExpense(demoDate(offset, 7), 'housing', 8400, 'bank', 'ЖКХ и интернет');
      addExpense(demoDate(offset, 9), 'transport', 3200, 'cash', 'Бензин и метро');
      addExpense(demoDate(offset, 12), 'cafe', 2400 + (offset + 4) * 120, 'cash', 'Кафе и доставка');
      addExpense(demoDate(offset, 16), 'health', 1800, 'bank', 'Аптека');
      addExpense(demoDate(offset, 18), 'shopping', 4600, 'bank', 'Одежда и бытовые товары');
      addExpense(demoDate(offset, 22), 'entertainment', 1500, 'cash', 'Кино и подписки');
      addExpense(demoDate(offset, 24), 'family', 3000, 'bank', 'Детский сад и секции');
    }

    const debts = [
      {
        id: 'demo-debt-1', title: 'Автокредит', lender: 'Банк «Восток»', type: 'credit',
        principal: 480000, monthlyPayment: 18500, rate: 16.9,
        startDate: demoDate(-12, 15), endDate: demoDate(24, 15), dueDay: 15,
        note: 'Досрочное погашение возможно без комиссии.',
        payments: [-4, -3, -2, -1, 0].map(function (offset, index) {
          return { id: 'demo-debt-1-pay-' + (index + 1), date: demoDate(offset, 15), amount: 18500, note: 'Ежемесячный платёж' };
        }),
        createdAt: createdAt, updatedAt: createdAt
      },
      {
        id: 'demo-debt-2', title: 'Рассрочка на технику', lender: 'Магазин электроники', type: 'installment',
        principal: 96000, monthlyPayment: 8000, rate: 0,
        startDate: demoDate(-6, 5), endDate: demoDate(6, 5), dueDay: 5,
        note: 'Ноутбук и монитор для работы.',
        payments: [-4, -3, -2, -1, 0].map(function (offset, index) {
          return { id: 'demo-debt-2-pay-' + (index + 1), date: demoDate(offset, 5), amount: 8000, note: 'Платёж по рассрочке' };
        }),
        createdAt: createdAt, updatedAt: createdAt
      },
      {
        id: 'demo-debt-3', title: 'Ипотека', lender: 'Банк «Дом»', type: 'mortgage',
        principal: 2400000, monthlyPayment: 32000, rate: 9.2,
        startDate: demoDate(-24, 10), endDate: demoDate(180, 10), dueDay: 10,
        note: 'Семейная ипотека.',
        payments: [-4, -3, -2, -1, 0].map(function (offset, index) {
          return { id: 'demo-debt-3-pay-' + (index + 1), date: demoDate(offset, 10), amount: 32000, note: 'Ипотечный платёж' };
        }),
        createdAt: createdAt, updatedAt: createdAt
      }
    ];

    return {
      version: Store.VERSION,
      updatedAt: createdAt,
      settings: settings,
      sources: sources,
      objects: objects,
      incomes: incomes,
      trips: trips,
      expenses: expenses,
      debts: debts
    };
  }

  function loadDemoData() {
    const proceed = WC.hasData()
      ? WC.confirmDialog({
        title: 'Загрузить демо-данные?',
        message: 'Текущие доходы, командировки и объекты будут заменены демонстрационным набором. Сначала будет создана резервная копия.',
        confirmLabel: 'Загрузить демо'
      })
      : Promise.resolve(true);

    proceed.then(function (confirmed) {
      if (!confirmed) return;
      if (WC.hasData()) WC.saveBackup(Store.state);
      Store.replaceState(buildDemoState(), { source: 'local' });
      App.period = 'year';
      const select = document.getElementById('periodSelect');
      if (select) {
        select.value = 'year';
        select.dispatchEvent(new Event('change'));
      }
      WC.go('dashboard');
      WC.toast('Демо-данные загружены. Это пример, его можно очистить в настройках.', { type: 'info', timeout: 8000 });
    });
  }

  function resetData() {
    WC.confirmDialog({
      title: 'Очистить все данные?',
      message: 'Доходы, командировки, объекты и источники будут удалены из этого браузера и из GitHub при следующей синхронизации. Настройки профиля сохранятся. Действие можно отменить только резервной копией.',
      confirmLabel: 'Удалить данные',
      danger: true
    }).then(function (confirmed) {
      if (!confirmed) return;
      WC.saveBackup(Store.state);
      Store.resetData();
      App.period = 'month';
      const select = document.getElementById('periodSelect');
      if (select) {
        select.value = 'month';
        select.dispatchEvent(new Event('change'));
      }
      WC.go('dashboard');
      WC.toast('Данные очищены', { type: 'info' });
    });
  }

  /* ============================================================
     РЕГИСТРАЦИЯ
     ============================================================ */

  WC.registerView('settings', renderSettings);

  WC.registerAction('toggle-token', function (button) {
    const input = document.getElementById('githubToken');
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.innerHTML = icon(show ? 'eye-off' : 'eye');
    button.title = show ? 'Скрыть токен' : 'Показать токен';
  });
  WC.registerAction('delete-source', function (element) { deleteSource(element.getAttribute('data-id')); });
  WC.registerAction('github-create', createGist);
  WC.registerAction('github-pull', pullGithub);
  WC.registerAction('github-push', pushGithub);
  WC.registerAction('github-sync', syncGithub);
  WC.registerAction('export-json', exportJson);
  WC.registerAction('export-incomes-csv', function (element) { exportIncomesCsv(element.getAttribute('data-scope') || 'all'); });
  WC.registerAction('export-trips-csv', function (element) { exportTripsCsv(element.getAttribute('data-scope') || 'all'); });
  WC.registerAction('export-expenses-csv', function (element) { exportExpensesCsv(element.getAttribute('data-scope') || 'all'); });
  WC.registerAction('export-daily-expenses-csv', function (element) { exportDailyExpensesCsv(element.getAttribute('data-scope') || 'all'); });
  WC.registerAction('export-debts-csv', function () { exportDebtsCsv(); });
  WC.registerAction('import-json', function () {
    const input = document.getElementById('importFile');
    if (input) input.click();
  });
  WC.registerAction('restore-backup', restoreBackup);
  WC.registerAction('demo-data', loadDemoData);
  WC.registerAction('reset-data', resetData);

  WC.registerSubmit('settingsForm', handleSettingsSubmit);
  WC.registerSubmit('sourceForm', handleSourceSubmit);
  WC.registerSubmit('githubForm', function () {
    const cfg = saveGithubFields();
    if (cfg.token && cfg.gistId) WC.toast('Подключение сохранено');
    else if (cfg.token) WC.toast('Токен сохранён. Создайте Gist или укажите его ID.', { type: 'info' });
    else WC.toast('Настройки GitHub сохранены', { type: 'info' });
  });

  WC.handleImportFile = handleImportFile;
})();
