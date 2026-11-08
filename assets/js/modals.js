/* ============================================================
   «Наладчик» — формы доходов, командировок и объектов
   ============================================================ */
(function () {
  'use strict';

  const Store = window.Store;
  const WC = window.WC;
  const App = WC.App;
  const esc = WC.esc;
  const icon = WC.icon;
  const money = WC.money;
  const today = Store.todayISO();

  /* ---------- ошибки полей ---------- */

  function clearErrors(form) {
    WC.$$('.field.has-error', form).forEach(function (field) {
      field.classList.remove('has-error');
      const message = field.querySelector('.field-error');
      if (message) message.remove();
    });
  }

  function setError(form, name, message) {
    const input = form.querySelector('[name="' + name + '"]');
    if (!input) return;
    const field = input.closest('.field');
    if (!field) return;
    field.classList.add('has-error');
    let node = field.querySelector('.field-error');
    if (!node) {
      node = document.createElement('p');
      node.className = 'field-error';
      field.appendChild(node);
    }
    node.textContent = message;
    input.focus();
  }

  document.addEventListener('input', function (event) {
    const field = event.target.closest('.field.has-error');
    if (!field) return;
    field.classList.remove('has-error');
    const message = field.querySelector('.field-error');
    if (message) message.remove();
  });

  /* ---------- доход ---------- */

  function openIncomeModal(id) {
    const record = id ? Store.state.incomes.find(function (item) { return item.id === id; }) : null;
    const sourceNames = WC.allSourceNames();
    const objects = Store.state.objects.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
    const defaultType = record ? record.type : (WC.getPref('incomeType', 'advance') || 'advance');
    const defaultMethod = record ? record.method : (WC.getPref('incomeMethod', 'bank') || 'bank');

    WC.openModal(
      '<form id="incomeForm" data-id="' + esc(record ? record.id : '') + '" novalidate>' +
      '<header class="modal-head"><div><h2>' + (record ? 'Редактировать доход' : 'Новый доход') + '</h2>' +
      '<p>' + (record ? 'Измените данные поступления' : 'Аванс, зарплата, отпускные или другой доход') + '</p></div>' +
      '<button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">' + icon('close') + '</button></header>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<label class="field"><span>Дата</span><input class="input" type="date" name="date" required value="' + esc(record ? record.date : today) + '"></label>' +
      '<label class="field"><span>Тип дохода</span><select class="input" name="type">' + WC.typeOptions(defaultType) + '</select></label>' +
      '<p class="hint span-2" id="incomePerDiemHint" hidden>' + icon('info') + ' Суточные — возмещение расходов: запись сохраняется, но не входит в сумму доходов.</p>' +
      '<label class="field span-2"><span>Источник дохода <em>*</em></span>' +
      '<input class="input" type="text" name="source" list="sourceOptions" maxlength="160" autocomplete="off" placeholder="Например, ООО «ПромАвтоматика»" value="' + esc(record ? record.sourceName : '') + '">' +
      '<datalist id="sourceOptions">' + sourceNames.map(function (source) { return '<option value="' + esc(source) + '"></option>'; }).join('') + '</datalist>' +
      '</label>' +
      '<label class="field"><span>Сумма <em>*</em></span><div class="input-with-suffix">' +
      '<input class="input" type="number" name="amount" min="0.01" step="0.01" inputmode="decimal" placeholder="0" value="' + esc(record ? record.amount : '') + '">' +
      '<span class="input-suffix">' + esc(Store.currencySymbol()) + '</span></div></label>' +
      '<label class="field"><span>Объект</span><select class="input" name="objectId">' + WC.objectOptions(record ? record.objectId : '', 'Без объекта') + '</select></label>' +
      '<div class="field span-2"><span>Способ получения</span><div class="segmented">' +
      '<label class="seg"><input type="radio" name="method" value="cash"' + (defaultMethod === 'cash' ? ' checked' : '') + '><span>' + icon('cash') + 'Наличные</span></label>' +
      '<label class="seg"><input type="radio" name="method" value="bank"' + (defaultMethod === 'bank' ? ' checked' : '') + '><span>' + icon('card') + 'Безналичные</span></label>' +
      '</div></div>' +
      '<label class="field span-2"><span>Комментарий</span><textarea class="input" name="note" rows="2" maxlength="2000" placeholder="Например, аванс за октябрь">' + esc(record ? record.note : '') + '</textarea></label>' +
      '</div></div>' +
      '<footer class="modal-actions modal-actions-split">' +
      '<div class="modal-actions-left">' +
      (record ? '<button type="button" class="btn btn-danger-ghost btn-sm" data-action="delete-income" data-id="' + esc(record.id) + '">' + icon('trash') + 'Удалить</button>' : '') +
      '</div>' +
      '<div class="modal-actions-right">' +
      '<button type="button" class="btn btn-ghost" data-action="close-modal">Отмена</button>' +
      '<button type="submit" class="btn btn-primary">' + (record ? 'Сохранить изменения' : 'Добавить доход') + '</button>' +
      '</div></footer>' +
      '</form>',
      { size: 'lg' }
    );

    const form = document.getElementById('incomeForm');
    if (form) {
      const amount = form.querySelector('[name="amount"]');
      if (amount) {
        window.setTimeout(function () {
          if (document.activeElement && document.activeElement.tagName === 'BUTTON') amount.focus();
        }, 80);
      }
      const typeSelect = form.querySelector('[name="type"]');
      const perDiemHint = form.querySelector('#incomePerDiemHint');
      const syncTypeHint = function () {
        if (typeSelect && perDiemHint) perDiemHint.hidden = typeSelect.value !== 'perDiem';
      };
      if (typeSelect) {
        typeSelect.addEventListener('change', syncTypeHint);
        syncTypeHint();
      }
      if (objects.length === 0) {
        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.innerHTML = 'Объектов пока нет — создайте их в разделе «Объекты», чтобы связывать доходы и командировки.';
        const field = form.querySelector('[name="objectId"]');
        if (field && field.closest('.field')) field.closest('.field').appendChild(hint);
      }
    }
  }

  function handleIncomeSubmit(form) {
    clearErrors(form);
    const data = new FormData(form);
    const source = String(data.get('source') || '').trim();
    const amount = WC.parseAmount(data.get('amount'));
    const date = String(data.get('date') || '');
    const type = String(data.get('type') || 'other');

    if (!Store.isValidISO(date)) {
      setError(form, 'date', 'Укажите корректную дату');
      return;
    }
    if (!source) {
      setError(form, 'source', 'Укажите источник дохода');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(form, 'amount', 'Сумма должна быть больше нуля');
      return;
    }

    const id = form.getAttribute('data-id');
    const existing = id ? Store.state.incomes.find(function (item) { return item.id === id; }) : null;
    Store.saveIncome({
      id: existing ? existing.id : undefined,
      createdAt: existing ? existing.createdAt : undefined,
      date: date,
      type: type,
      amount: amount,
      method: String(data.get('method') || 'bank'),
      sourceName: source,
      objectId: String(data.get('objectId') || '') || null,
      note: String(data.get('note') || '')
    });

    WC.setPref('incomeType', type);
    WC.setPref('incomeMethod', String(data.get('method') || 'bank'));
    WC.closeModal();
    WC.toast(existing ? 'Доход обновлён' : 'Доход добавлен');
  }

  function deleteIncome(id) {
    const record = Store.state.incomes.find(function (item) { return item.id === id; });
    if (!record) return;
    const snapshot = JSON.stringify(Store.state);
    if (WC.isModalOpen()) WC.closeModal();
    Store.deleteRecord('incomes', id);
    WC.toast('Доход удалён', {
      actionLabel: 'Отменить',
      timeout: 9000,
      onAction: function () {
        Store.replaceState(JSON.parse(snapshot), { source: 'local' });
        WC.toast('Доход восстановлен', { type: 'info' });
      }
    });
  }

  /* ---------- командировка ---------- */

  function tripPreview(form) {
    const preview = document.getElementById('tripPreview');
    if (!preview) return;
    const daysField = document.getElementById('tripDays');
    const start = form.querySelector('[name="startDate"]').value;
    const end = form.querySelector('[name="endDate"]').value;
    const rate = WC.parseAmount(form.querySelector('[name="perDiemRate"]').value);
    if (!Store.isValidISO(start)) {
      if (daysField) daysField.value = '—';
      preview.innerHTML = '<span class="muted">Укажите даты поездки</span>';
      return;
    }
    const finish = Store.isValidISO(end) ? end : start;
    const days = Store.daysBetween(start, finish) + 1;
    const amount = days * (Number.isFinite(rate) ? rate : 0);
    if (finish < start) {
      if (daysField) daysField.value = '—';
      preview.innerHTML = '<span class="preview-warning">' + icon('alert') + 'Дата окончания раньше даты начала</span>';
      return;
    }
    if (daysField) daysField.value = days + ' ' + WC.plural(days, ['сутки', 'суток', 'суток']);
    preview.innerHTML =
      '<span class="preview-days">' + days + ' ' + WC.plural(days, ['сутки', 'суток', 'суток']) + '</span>' +
      '<span class="preview-amount">' + money(amount) + '</span>' +
      '<span class="preview-hint">суточные по ' + money(rate || 0) + ' в сутки · не входят в доход</span>';
  }

  function openTripModal(id) {
    const record = id ? Store.state.trips.find(function (item) { return item.id === id; }) : null;
    const destinations = WC.unique(Store.state.trips.map(function (trip) { return trip.destination; })).sort(function (a, b) { return a.localeCompare(b, 'ru'); });

    WC.openModal(
      '<form id="tripForm" data-id="' + esc(record ? record.id : '') + '" novalidate>' +
      '<header class="modal-head"><div><h2>' + (record ? 'Редактировать командировку' : 'Новая командировка') + '</h2>' +
      '<p>Направление, сроки и расчёт суточных</p></div>' +
      '<button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">' + icon('close') + '</button></header>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<label class="field span-2"><span>Направление <em>*</em></span>' +
      '<input class="input" type="text" name="destination" list="destinationOptions" maxlength="200" autocomplete="off" placeholder="Город, площадка или объект" value="' + esc(record ? record.destination : '') + '">' +
      '<datalist id="destinationOptions">' + destinations.map(function (destination) { return '<option value="' + esc(destination) + '"></option>'; }).join('') + '</datalist>' +
      '</label>' +
      '<label class="field span-2"><span>Объект</span><select class="input" name="objectId">' + WC.objectOptions(record ? record.objectId : '', 'Без объекта') + '</select></label>' +
      '<label class="field"><span>Дата начала <em>*</em></span><input class="input" type="date" name="startDate" value="' + esc(record ? record.startDate : today) + '"></label>' +
      '<label class="field"><span>Дата окончания</span><input class="input" type="date" name="endDate" value="' + esc(record ? record.endDate : today) + '"></label>' +
      '<label class="field"><span>Количество суток</span><input class="input" type="text" id="tripDays" value="—" readonly aria-live="polite" title="Рассчитывается автоматически по датам начала и окончания"></label>' +
      '<label class="field"><span>Ставка суточных</span><div class="input-with-suffix">' +
      '<input class="input" type="number" name="perDiemRate" min="0" step="1" inputmode="decimal" value="' + esc(record ? record.perDiemRate : Store.state.settings.perDiemRate) + '">' +
      '<span class="input-suffix">' + esc(Store.currencySymbol()) + ' / сутки</span></div></label>' +
      '<label class="field span-2"><span>Аванс на командировку</span><div class="input-with-suffix">' +
      '<input class="input" type="number" name="advanceAmount" min="0" step="0.01" inputmode="decimal" placeholder="0" value="' + esc(record ? record.advanceAmount || 0 : 0) + '">' +
      '<span class="input-suffix">' + esc(Store.currencySymbol()) + '</span></div>' +
      '<small class="hint">Сумма, полученная под отчёт. Используется в авансовом отчёте и расчёте баланса.</small></label>' +
      '<label class="field span-2"><span>Транспорт</span><input class="input" type="text" name="transport" maxlength="200" placeholder="Авиа, поезд, авто" value="' + esc(record ? record.transport : '') + '"></label>' +
      '<label class="field span-2"><span>Цель командировки</span><textarea class="input" name="purpose" rows="2" maxlength="2000" placeholder="Например, пусконаладка шкафов КИПиА">' + esc(record ? record.purpose : '') + '</textarea></label>' +
      '</div>' +
      '<div class="trip-preview" id="tripPreview"></div>' +
      '<p class="hint">' + icon('info') + ' Количество суток считается автоматически включительно по датам начала и окончания. Суточные — возмещение расходов, в сумму доходов они не входят.</p>' +
      '</div>' +
      '<footer class="modal-actions modal-actions-split">' +
      '<div class="modal-actions-left">' +
      (record ? '<button type="button" class="btn btn-danger-ghost btn-sm" data-action="delete-trip" data-id="' + esc(record.id) + '">' + icon('trash') + 'Удалить</button>' : '') +
      '</div>' +
      '<div class="modal-actions-right">' +
      '<button type="button" class="btn btn-ghost" data-action="close-modal">Отмена</button>' +
      '<button type="submit" class="btn btn-primary">' + (record ? 'Сохранить изменения' : 'Добавить командировку') + '</button>' +
      '</div></footer>' +
      '</form>',
      { size: 'lg' }
    );

    const form = document.getElementById('tripForm');
    if (form) {
      form.addEventListener('input', function () { tripPreview(form); });
      form.addEventListener('change', function () { tripPreview(form); });
      tripPreview(form);
    }
  }

  function handleTripSubmit(form) {
    clearErrors(form);
    const data = new FormData(form);
    const destination = String(data.get('destination') || '').trim();
    const startDate = String(data.get('startDate') || '');
    const endDate = String(data.get('endDate') || '') || startDate;
    const rate = WC.parseAmount(data.get('perDiemRate'));
    const advanceAmount = WC.parseAmount(data.get('advanceAmount'));

    if (!destination) {
      setError(form, 'destination', 'Укажите направление');
      return;
    }
    if (!Store.isValidISO(startDate)) {
      setError(form, 'startDate', 'Укажите дату начала');
      return;
    }
    if (!Store.isValidISO(endDate)) {
      setError(form, 'endDate', 'Укажите дату окончания');
      return;
    }
    if (endDate < startDate) {
      setError(form, 'endDate', 'Дата окончания раньше начала');
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setError(form, 'perDiemRate', 'Ставка не может быть отрицательной');
      return;
    }
    if (!Number.isFinite(advanceAmount) || advanceAmount < 0) {
      setError(form, 'advanceAmount', 'Аванс не может быть отрицательным');
      return;
    }

    const id = form.getAttribute('data-id');
    const existing = id ? Store.state.trips.find(function (item) { return item.id === id; }) : null;
    Store.saveTrip({
      id: existing ? existing.id : undefined,
      createdAt: existing ? existing.createdAt : undefined,
      destination: destination,
      objectId: String(data.get('objectId') || '') || null,
      startDate: startDate,
      endDate: endDate,
      perDiemRate: rate,
      advanceAmount: advanceAmount || 0,
      transport: String(data.get('transport') || ''),
      purpose: String(data.get('purpose') || '')
    });
    WC.closeModal();
    WC.toast(existing ? 'Командировка обновлена' : 'Командировка добавлена');
  }

  function deleteTrip(id) {
    const record = Store.state.trips.find(function (item) { return item.id === id; });
    if (!record) return;
    const snapshot = JSON.stringify(Store.state);
    if (WC.isModalOpen()) WC.closeModal();
    Store.deleteRecord('trips', id);
    WC.toast('Командировка удалена', {
      actionLabel: 'Отменить',
      timeout: 9000,
      onAction: function () {
        Store.replaceState(JSON.parse(snapshot), { source: 'local' });
        WC.toast('Командировка восстановлена', { type: 'info' });
      }
    });
  }

  /* ---------- объект ---------- */

  function openObjectModal(id) {
    const record = id ? Store.state.objects.find(function (item) { return item.id === id; }) : null;

    WC.openModal(
      '<form id="objectForm" data-id="' + esc(record ? record.id : '') + '" novalidate>' +
      '<header class="modal-head"><div><h2>' + (record ? 'Редактировать объект' : 'Новый объект') + '</h2>' +
      '<p>Заказчик, площадка и статус работ</p></div>' +
      '<button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">' + icon('close') + '</button></header>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<label class="field span-2"><span>Название объекта <em>*</em></span>' +
      '<input class="input" type="text" name="name" maxlength="200" placeholder="Например, ГОК «Северный» — обогатительная фабрика" value="' + esc(record ? record.name : '') + '"></label>' +
      '<label class="field"><span>Заказчик</span><input class="input" type="text" name="customer" maxlength="200" placeholder="ООО «ПромАвтоматика»" value="' + esc(record ? record.customer : '') + '"></label>' +
      '<label class="field"><span>Статус</span><select class="input" name="status">' +
      Object.keys(Store.OBJECT_STATUSES).map(function (status) {
        return '<option value="' + status + '"' + (record && record.status === status ? ' selected' : '') + '>' + esc(Store.OBJECT_STATUSES[status]) + '</option>';
      }).join('') +
      '</select></label>' +
      '<label class="field span-2"><span>Адрес / площадка</span><input class="input" type="text" name="address" maxlength="300" placeholder="Город, цех, участок" value="' + esc(record ? record.address : '') + '"></label>' +
      '<label class="field"><span>Начало работ</span><input class="input" type="date" name="startDate" value="' + esc(record ? record.startDate : '') + '"></label>' +
      '<label class="field"><span>Окончание работ</span><input class="input" type="date" name="endDate" value="' + esc(record ? record.endDate : '') + '"></label>' +
      '<label class="field span-2"><span>Примечание</span><textarea class="input" name="note" rows="2" maxlength="2000" placeholder="Оборудование, объём работ, контакты">' + esc(record ? record.note : '') + '</textarea></label>' +
      '</div></div>' +
      '<footer class="modal-actions modal-actions-split">' +
      '<div class="modal-actions-left">' +
      (record ? '<button type="button" class="btn btn-danger-ghost btn-sm" data-action="delete-object" data-id="' + esc(record.id) + '">' + icon('trash') + 'Удалить</button>' : '') +
      '</div>' +
      '<div class="modal-actions-right">' +
      '<button type="button" class="btn btn-ghost" data-action="close-modal">Отмена</button>' +
      '<button type="submit" class="btn btn-primary">' + (record ? 'Сохранить изменения' : 'Добавить объект') + '</button>' +
      '</div></footer>' +
      '</form>',
      { size: 'lg' }
    );
  }

  function handleObjectSubmit(form) {
    clearErrors(form);
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const startDate = String(data.get('startDate') || '');
    const endDate = String(data.get('endDate') || '');
    if (!name) {
      setError(form, 'name', 'Укажите название объекта');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError(form, 'endDate', 'Дата окончания раньше начала');
      return;
    }

    const id = form.getAttribute('data-id');
    const existing = id ? Store.state.objects.find(function (item) { return item.id === id; }) : null;
    Store.saveObject({
      id: existing ? existing.id : undefined,
      createdAt: existing ? existing.createdAt : undefined,
      name: name,
      customer: String(data.get('customer') || ''),
      address: String(data.get('address') || ''),
      status: String(data.get('status') || 'active'),
      startDate: startDate,
      endDate: endDate,
      note: String(data.get('note') || '')
    });
    WC.closeModal();
    WC.toast(existing ? 'Объект обновлён' : 'Объект добавлен');
  }

  function deleteObject(id) {
    const record = Store.state.objects.find(function (item) { return item.id === id; });
    if (!record) return;
    if (WC.isModalOpen()) WC.closeModal();
    const snapshot = JSON.stringify(Store.state);
    WC.confirmDialog({
      title: 'Удалить объект?',
      message: '«' + record.name + '» будет удалён. Доходы и командировки останутся, но потеряют привязку к объекту.',
      confirmLabel: 'Удалить',
      danger: true
    }).then(function (confirmed) {
      if (!confirmed) return;
      Store.deleteRecord('objects', id);
      WC.toast('Объект удалён', {
        actionLabel: 'Отменить',
        timeout: 9000,
        onAction: function () {
          Store.replaceState(JSON.parse(snapshot), { source: 'local' });
          WC.toast('Объект восстановлен', { type: 'info' });
        }
      });
    });
  }

  /* ---------- расходы командировки ---------- */

  function expenseRowsHtml(trip) {
    const expenses = Store.tripExpenses(trip).slice().sort(function (a, b) {
      return (a.date || '').localeCompare(b.date || '');
    });
    if (!expenses.length) {
      return '<tr><td colspan="6"><div class="expense-empty">' + icon('wallet') +
        '<span>Расходы пока не внесены. Добавьте проезд, проживание и другие затраты — суточные рассчитаются автоматически.</span></div></td></tr>';
    }
    return expenses.map(function (expense) {
      return '<tr>' +
        '<td class="nowrap">' + Store.formatDate(expense.date) + '</td>' +
        '<td><div class="cell-main">' + esc(Store.EXPENSE_CATEGORIES[expense.category] || 'Прочие расходы') + '</div>' +
        (expense.note ? '<div class="cell-sub cell-note" title="' + esc(expense.note) + '">' + esc(expense.note) + '</div>' : '') + '</td>' +
        '<td>' + (expense.document ? esc(expense.document) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + WC.methodBadge(expense.method) + '</td>' +
        '<td class="num"><b>' + money(expense.amount) + '</b></td>' +
        '<td class="actions-col"><div class="row-actions">' +
        '<button type="button" class="icon-btn icon-btn-sm" data-action="edit-trip-expense" data-trip="' + esc(trip.id) + '" data-id="' + esc(expense.id) + '" title="Изменить">' + icon('edit') + '</button>' +
        '<button type="button" class="icon-btn icon-btn-sm danger" data-action="delete-trip-expense" data-trip="' + esc(trip.id) + '" data-id="' + esc(expense.id) + '" title="Удалить">' + icon('trash') + '</button>' +
        '</div></td>' +
        '</tr>';
    }).join('');
  }

  function openTripExpensesModal(tripId) {
    const trip = Store.tripById(tripId);
    if (!trip) {
      WC.toast('Командировка не найдена', { type: 'error' });
      return;
    }
    const days = Store.tripDays(trip);
    const perDiem = Store.tripPerDiem(trip);
    const expenses = Store.tripExpensesTotal(trip);
    const reportTotal = Store.tripReportTotal(trip);
    const advance = Store.tripAdvance(trip);
    const balance = advance - reportTotal;
    const balanceLabel = balance > 0 ? 'к возврату' : balance < 0 ? 'к возмещению' : 'закрыт';
    const balanceTone = balance > 0 ? 'money-return' : balance < 0 ? 'money-due' : 'muted';

    WC.openModal(
      '<header class="modal-head"><div><h2>Расходы командировки</h2>' +
      '<p>' + esc(trip.destination) + ' · ' + Store.formatDate(trip.startDate) + ' — ' + Store.formatDate(trip.endDate) + ' · ' + days + ' ' + WC.plural(days, ['сутки', 'суток', 'суток']) + '</p></div>' +
      '<button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">' + icon('close') + '</button></header>' +
      '<div class="modal-body">' +
      '<form id="tripAdvanceForm" class="expense-advance-form" data-id="' + esc(trip.id) + '" novalidate>' +
      '<label class="field"><span>Аванс на командировку</span><div class="input-with-suffix">' +
      '<input class="input" type="number" name="advanceAmount" min="0" step="0.01" inputmode="decimal" value="' + esc(advance) + '">' +
      '<span class="input-suffix">' + esc(Store.currencySymbol()) + '</span></div></label>' +
      '<button type="submit" class="btn btn-ghost">' + icon('check') + 'Сохранить аванс</button>' +
      '</form>' +
      '<div class="expense-summary">' +
      '<div class="expense-stat"><span>Аванс</span><b>' + money(advance) + '</b></div>' +
      '<div class="expense-stat"><span>Расходы</span><b>' + money(expenses) + '</b></div>' +
      '<div class="expense-stat"><span>Суточные</span><b>' + money(perDiem) + '</b></div>' +
      '<div class="expense-stat"><span>Итого к отчёту</span><b>' + money(reportTotal) + '</b></div>' +
      '<div class="expense-stat"><span>Баланс · ' + balanceLabel + '</span><b class="' + balanceTone + '">' + money(Math.abs(balance)) + '</b></div>' +
      '</div>' +
      '<div class="modal-table-head"><h3>Расходы</h3>' +
      '<button type="button" class="btn btn-primary btn-sm" data-action="add-trip-expense" data-trip="' + esc(trip.id) + '">' + icon('plus') + 'Добавить расход</button></div>' +
      '<div class="table-wrap"><table class="data-table expense-table">' +
      '<thead><tr><th>Дата</th><th>Вид расхода</th><th>Документ</th><th>Способ</th><th class="num">Сумма</th><th class="actions-col"><span class="sr-only">Действия</span></th></tr></thead>' +
      '<tbody>' + expenseRowsHtml(trip) + '</tbody>' +
      '</table></div>' +
      '<p class="hint">' + icon('info') + ' Суточные добавляются в отчёт автоматически: ' + days + ' ' + WC.plural(days, ['сутки', 'суток', 'суток']) + ' × ' + money(trip.perDiemRate) + ' = ' + money(perDiem) + '. В доходы они не входят.</p>' +
      '</div>' +
      '<footer class="modal-actions modal-actions-split">' +
      '<div class="modal-actions-left">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="open-advance-report" data-id="' + esc(trip.id) + '">' + icon('printer') + 'Авансовый отчёт</button>' +
      '</div>' +
      '<div class="modal-actions-right">' +
      '<button type="button" class="btn btn-primary" data-action="close-modal">Готово</button>' +
      '</div></footer>',
      { size: 'xl' }
    );
  }

  function openTripExpenseModal(tripId, expenseId) {
    const trip = Store.tripById(tripId);
    if (!trip) return;
    const record = expenseId
      ? Store.tripExpenses(trip).find(function (item) { return item.id === expenseId; }) || null
      : null;
    const defaultDate = record ? record.date : (trip.startDate || today);
    const defaultMethod = record ? record.method : 'cash';
    const category = record ? record.category : 'travel';

    WC.openModal(
      '<form id="tripExpenseForm" data-id="' + esc(record ? record.id : '') + '" data-trip="' + esc(trip.id) + '" novalidate>' +
      '<header class="modal-head"><div><h2>' + (record ? 'Редактировать расход' : 'Новый расход') + '</h2>' +
      '<p>' + esc(trip.destination) + ' · ' + Store.formatDate(trip.startDate) + ' — ' + Store.formatDate(trip.endDate) + '</p></div>' +
      '<button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">' + icon('close') + '</button></header>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<label class="field"><span>Дата расхода</span><input class="input" type="date" name="date" value="' + esc(defaultDate) + '"></label>' +
      '<label class="field"><span>Сумма <em>*</em></span><div class="input-with-suffix">' +
      '<input class="input" type="number" name="amount" min="0.01" step="0.01" inputmode="decimal" placeholder="0" value="' + esc(record ? record.amount : '') + '">' +
      '<span class="input-suffix">' + esc(Store.currencySymbol()) + '</span></div></label>' +
      '<label class="field span-2"><span>Вид расхода</span><select class="input" name="category">' +
      Store.EXPENSE_CATEGORY_ORDER.map(function (key) {
        return '<option value="' + key + '"' + (category === key ? ' selected' : '') + '>' + esc(Store.EXPENSE_CATEGORIES[key]) + '</option>';
      }).join('') +
      '</select></label>' +
      '<div class="field span-2"><span>Способ оплаты</span><div class="segmented">' +
      '<label class="seg"><input type="radio" name="method" value="cash"' + (defaultMethod === 'cash' ? ' checked' : '') + '><span>' + icon('cash') + 'Наличные</span></label>' +
      '<label class="seg"><input type="radio" name="method" value="bank"' + (defaultMethod === 'bank' ? ' checked' : '') + '><span>' + icon('card') + 'Безналичные</span></label>' +
      '</div></div>' +
      '<label class="field span-2"><span>Документ</span><input class="input" type="text" name="document" maxlength="160" placeholder="Чек, билет, счёт, акт" value="' + esc(record ? record.document : '') + '"></label>' +
      '<label class="field span-2"><span>Комментарий</span><textarea class="input" name="note" rows="2" maxlength="1000" placeholder="Например, такси до площадки">' + esc(record ? record.note : '') + '</textarea></label>' +
      '</div></div>' +
      '<footer class="modal-actions modal-actions-split">' +
      '<div class="modal-actions-left">' +
      (record ? '<button type="button" class="btn btn-danger-ghost btn-sm" data-action="delete-trip-expense" data-trip="' + esc(trip.id) + '" data-id="' + esc(record.id) + '">' + icon('trash') + 'Удалить</button>' : '') +
      '</div>' +
      '<div class="modal-actions-right">' +
      '<button type="button" class="btn btn-ghost" data-action="close-modal">Отмена</button>' +
      '<button type="submit" class="btn btn-primary">' + (record ? 'Сохранить' : 'Добавить расход') + '</button>' +
      '</div></footer>' +
      '</form>',
      {
        size: 'md',
        onClose: function () { openTripExpensesModal(trip.id); }
      }
    );
  }

  function handleTripExpenseSubmit(form) {
    clearErrors(form);
    const data = new FormData(form);
    const tripId = form.getAttribute('data-trip');
    const amount = WC.parseAmount(data.get('amount'));
    const date = String(data.get('date') || '');
    if (!Store.isValidISO(date)) {
      setError(form, 'date', 'Укажите корректную дату');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(form, 'amount', 'Сумма должна быть больше нуля');
      return;
    }
    const id = form.getAttribute('data-id');
    const saved = Store.saveTripExpense(tripId, {
      id: id || undefined,
      date: date,
      category: String(data.get('category') || 'other'),
      amount: amount,
      method: String(data.get('method') || 'cash'),
      document: String(data.get('document') || ''),
      note: String(data.get('note') || '')
    });
    if (!saved) {
      WC.toast('Не удалось сохранить расход', { type: 'error' });
      return;
    }
    WC.closeModal();
    WC.toast(id ? 'Расход обновлён' : 'Расход добавлен');
  }

  function handleTripAdvanceSubmit(form) {
    const tripId = form.getAttribute('data-id');
    const amount = WC.parseAmount(new FormData(form).get('advanceAmount'));
    if (!Number.isFinite(amount) || amount < 0) {
      WC.toast('Аванс не может быть отрицательным', { type: 'error' });
      return;
    }
    Store.saveTripAdvance(tripId, amount);
    openTripExpensesModal(tripId);
    WC.toast('Аванс обновлён');
  }

  function deleteTripExpense(tripId, expenseId) {
    const trip = Store.tripById(tripId);
    if (!trip) return;
    const snapshot = JSON.stringify(Store.state);
    if (WC.isModalOpen()) WC.closeModal(true);
    Store.deleteTripExpense(tripId, expenseId);
    WC.toast('Расход удалён', {
      actionLabel: 'Отменить',
      timeout: 9000,
      onAction: function () {
        Store.replaceState(JSON.parse(snapshot), { source: 'local' });
        if (WC.isModalOpen()) openTripExpensesModal(tripId);
        WC.toast('Расход восстановлен', { type: 'info' });
      }
    });
    openTripExpensesModal(tripId);
  }

  /* ---------- регистрация ---------- */

  WC.openIncomeModal = openIncomeModal;
  WC.openTripModal = openTripModal;
  WC.openObjectModal = openObjectModal;
  WC.openTripExpensesModal = openTripExpensesModal;
  WC.openTripExpenseModal = openTripExpenseModal;

  WC.registerAction('add-income', function () { openIncomeModal(); });
  WC.registerAction('add-trip', function () { openTripModal(); });
  WC.registerAction('add-object', function () { openObjectModal(); });
  WC.registerAction('edit-income', function (element) { openIncomeModal(element.getAttribute('data-id')); });
  WC.registerAction('edit-trip', function (element) { openTripModal(element.getAttribute('data-id')); });
  WC.registerAction('edit-object', function (element) { openObjectModal(element.getAttribute('data-id')); });
  WC.registerAction('delete-income', function (element) { deleteIncome(element.getAttribute('data-id')); });
  WC.registerAction('delete-trip', function (element) { deleteTrip(element.getAttribute('data-id')); });
  WC.registerAction('delete-object', function (element) { deleteObject(element.getAttribute('data-id')); });
  WC.registerAction('add-trip-expense', function (element) {
    openTripExpenseModal(element.getAttribute('data-trip') || element.getAttribute('data-id'));
  });
  WC.registerAction('edit-trip-expense', function (element) {
    openTripExpenseModal(element.getAttribute('data-trip'), element.getAttribute('data-id'));
  });
  WC.registerAction('delete-trip-expense', function (element) {
    deleteTripExpense(element.getAttribute('data-trip'), element.getAttribute('data-id'));
  });

  WC.registerSubmit('incomeForm', handleIncomeSubmit);
  WC.registerSubmit('tripForm', handleTripSubmit);
  WC.registerSubmit('objectForm', handleObjectSubmit);
  WC.registerSubmit('tripExpenseForm', handleTripExpenseSubmit);
  WC.registerSubmit('tripAdvanceForm', handleTripAdvanceSubmit);
})();
