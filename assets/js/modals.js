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

  /* ---------- регистрация ---------- */

  WC.openIncomeModal = openIncomeModal;
  WC.openTripModal = openTripModal;
  WC.openObjectModal = openObjectModal;

  WC.registerAction('add-income', function () { openIncomeModal(); });
  WC.registerAction('add-trip', function () { openTripModal(); });
  WC.registerAction('add-object', function () { openObjectModal(); });
  WC.registerAction('edit-income', function (element) { openIncomeModal(element.getAttribute('data-id')); });
  WC.registerAction('edit-trip', function (element) { openTripModal(element.getAttribute('data-id')); });
  WC.registerAction('edit-object', function (element) { openObjectModal(element.getAttribute('data-id')); });
  WC.registerAction('delete-income', function (element) { deleteIncome(element.getAttribute('data-id')); });
  WC.registerAction('delete-trip', function (element) { deleteTrip(element.getAttribute('data-id')); });
  WC.registerAction('delete-object', function (element) { deleteObject(element.getAttribute('data-id')); });

  WC.registerSubmit('incomeForm', handleIncomeSubmit);
  WC.registerSubmit('tripForm', handleTripSubmit);
  WC.registerSubmit('objectForm', handleObjectSubmit);
})();
