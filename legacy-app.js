(() => {
  'use strict';

  const STORAGE_KEY = 'emelwash_data_v1';
  const BUILD = '2026.09.07-emelwash-1';

  const defaultState = {
    settings: {
      businessName: 'EMEL WASH',
      currency: 'USD',
      defaultCommission: 30
    },
    clients: [],
    employees: [],
    washes: []
  };

  let state = loadState();
  let pendingConfirm = null;

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(defaultState));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaultState();
      const parsed = JSON.parse(raw);
      return {
        settings: { ...defaultState.settings, ...(parsed.settings || {}) },
        clients: Array.isArray(parsed.clients) ? parsed.clients : [],
        employees: Array.isArray(parsed.employees) ? parsed.employees : [],
        washes: Array.isArray(parsed.washes) ? parsed.washes : []
      };
    } catch (error) {
      console.warn('No se pudieron cargar los datos de EMEL WASH', error);
      return cloneDefaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoney(value) {
    const currency = state.settings.currency || 'USD';
    try {
      return new Intl.NumberFormat('es-VE', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(toNumber(value));
    } catch {
      return `${currency} ${toNumber(value).toFixed(2)}`;
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '—';
    const d = new Date(`${dateString}T12:00:00`);
    return Number.isNaN(d.getTime())
      ? dateString
      : new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  }

  function localDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function localTimeString(date = new Date()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function getClient(id) {
    return state.clients.find((client) => client.id === id);
  }

  function getEmployee(id) {
    return state.employees.find((employee) => employee.id === id);
  }

  function washCommission(wash) {
    if (Number.isFinite(Number(wash.commissionAmount))) return toNumber(wash.commissionAmount);
    return toNumber(wash.amount) * (toNumber(wash.commissionRate) / 100);
  }

  function isCommissionDue(wash) {
    return wash.paymentStatus === 'paid' && !wash.commissionPaid && washCommission(wash) > 0;
  }

  function totals() {
    const paidWashes = state.washes.filter((wash) => wash.paymentStatus === 'paid');
    const pendingWashes = state.washes.filter((wash) => wash.paymentStatus === 'pending');
    const totalPaid = paidWashes.reduce((sum, wash) => sum + toNumber(wash.amount), 0);
    const totalPending = pendingWashes.reduce((sum, wash) => sum + toNumber(wash.amount), 0);
    const totalCommission = paidWashes.reduce((sum, wash) => sum + washCommission(wash), 0);
    const commissionDue = state.washes.filter(isCommissionDue).reduce((sum, wash) => sum + washCommission(wash), 0);
    const commissionPaid = state.washes
      .filter((wash) => wash.commissionPaid)
      .reduce((sum, wash) => sum + washCommission(wash), 0);
    return { totalPaid, totalPending, totalCommission, commissionDue, commissionPaid };
  }

  function toast(message, type = 'success') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    $('toastRoot').append(node);
    setTimeout(() => node.remove(), 3200);
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function confirmAction(title, text, action, confirmText = 'Confirmar') {
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    $('confirmActionButton').textContent = confirmText;
    pendingConfirm = action;
    openDialog($('confirmDialog'));
  }

  const viewMeta = {
    dashboard: ['PANEL GENERAL', 'Resumen'],
    newWash: ['OPERACIÓN', 'Nuevo lavado'],
    washes: ['OPERACIÓN', 'Lavados'],
    clients: ['BASE DE DATOS', 'Clientes'],
    employees: ['ADMINISTRACIÓN', 'Empleados'],
    commissions: ['ADMINISTRACIÓN', 'Comisiones'],
    settings: ['SISTEMA', 'Ajustes']
  };

  function openView(viewName) {
    const safeView = viewMeta[viewName] ? viewName : 'dashboard';
    $$('.view').forEach((view) => view.classList.remove('active'));
    $(`${safeView}View`)?.classList.add('active');

    $$('.nav-btn[data-view], .mobile-nav-btn[data-view]').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === safeView);
    });

    const [eyebrow, title] = viewMeta[safeView];
    $('viewEyebrow').textContent = eyebrow;
    $('viewTitle').textContent = title;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (safeView === 'newWash' && !$('washId').value) prepareNewWashForm();
  }

  function prepareNewWashForm() {
    $('washForm').reset();
    $('washId').value = '';
    $('washFormTitle').textContent = 'Registrar nuevo lavado';
    $('washDate').value = localDateString();
    $('washTime').value = localTimeString();
    $('washPaymentStatus').value = 'paid';
    $('cancelWashEdit').classList.add('hidden');
    refreshSelects();
    updateCommissionPreview();
  }

  function refreshSelects() {
    const clientSelect = $('washClient');
    const employeeSelect = $('washEmployee');
    const selectedClient = clientSelect.value;
    const selectedEmployee = employeeSelect.value;

    clientSelect.innerHTML = `<option value="">${state.clients.length ? 'Seleccionar cliente' : 'Primero registra un cliente'}</option>` +
      state.clients
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)}${client.plate ? ` · ${escapeHtml(client.plate)}` : ''}</option>`)
        .join('');

    const activeEmployees = state.employees.filter((employee) => employee.active !== false);
    employeeSelect.innerHTML = `<option value="">${activeEmployees.length ? 'Seleccionar empleado' : 'Primero registra un empleado activo'}</option>` +
      activeEmployees
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((employee) => `<option value="${escapeHtml(employee.id)}">${escapeHtml(employee.name)} · ${toNumber(employee.commission)}%</option>`)
        .join('');

    if (state.clients.some((c) => c.id === selectedClient)) clientSelect.value = selectedClient;
    if (activeEmployees.some((e) => e.id === selectedEmployee)) employeeSelect.value = selectedEmployee;

    updateCommissionPreview();
  }

  function updateCommissionPreview() {
    const employee = getEmployee($('washEmployee').value);
    const amount = toNumber($('washAmount').value);
    const rate = employee ? toNumber(employee.commission) : 0;
    $('employeeCommissionHint').textContent = employee ? `Comisión configurada: ${rate}%` : '';
    $('commissionPreview').textContent = formatMoney(amount * rate / 100);
  }

  function renderDashboard() {
    const today = localDateString();
    const todayWashes = state.washes.filter((wash) => wash.date === today);
    const todayPaid = todayWashes.filter((wash) => wash.paymentStatus === 'paid').reduce((sum, wash) => sum + toNumber(wash.amount), 0);
    const all = totals();

    $('heroTodayCount').textContent = todayWashes.length;
    $('statTodayWashes').textContent = todayWashes.length;
    $('statTodayIncome').textContent = formatMoney(todayPaid);
    $('statPendingIncome').textContent = formatMoney(all.totalPending);
    $('statCommissionDue').textContent = formatMoney(all.commissionDue);
    $('cashPaidTotal').textContent = formatMoney(all.totalPaid);
    $('cashPendingTotal').textContent = formatMoney(all.totalPending);
    $('cashCommissionTotal').textContent = formatMoney(all.commissionDue);
    $('cashNetTotal').textContent = formatMoney(all.totalPaid - all.commissionPaid - all.commissionDue);

    const recent = state.washes
      .slice()
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
      .slice(0, 6);

    $('recentWashes').innerHTML = recent.length ? `
      <table>
        <thead><tr><th>Cliente</th><th>Moto</th><th>Empleado</th><th>Monto</th><th>Pago</th></tr></thead>
        <tbody>${recent.map((wash) => {
          const client = getClient(wash.clientId);
          const employee = getEmployee(wash.employeeId);
          return `<tr>
            <td class="name-cell"><strong>${escapeHtml(client?.name || 'Cliente eliminado')}</strong><small>${formatDate(wash.date)} · ${escapeHtml(wash.time || '')}</small></td>
            <td>${escapeHtml(wash.bikeModel || wash.bikeType || '—')}</td>
            <td>${escapeHtml(employee?.name || 'Empleado eliminado')}</td>
            <td><strong>${formatMoney(wash.amount)}</strong></td>
            <td>${paymentBadge(wash.paymentStatus)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>` : emptyState('Aún no hay lavados', 'Registra el primer servicio para comenzar.');

    const employeeDue = state.employees
      .map((employee) => ({
        employee,
        due: state.washes.filter((wash) => wash.employeeId === employee.id && isCommissionDue(wash))
          .reduce((sum, wash) => sum + washCommission(wash), 0)
      }))
      .filter((item) => item.due > 0)
      .sort((a, b) => b.due - a.due);

    $('dashboardCommissionList').innerHTML = employeeDue.length
      ? employeeDue.map(({ employee, due }) => `
        <div class="stack-item">
          <div><strong>${escapeHtml(employee.name)}</strong><small>${toNumber(employee.commission)}% configurado</small></div>
          <strong>${formatMoney(due)}</strong>
        </div>`).join('')
      : emptyState('Sin comisiones pendientes', 'Todo está al día.');
  }

  function paymentBadge(status) {
    return status === 'paid'
      ? '<span class="badge paid">● Pagado</span>'
      : '<span class="badge pending">● Pendiente</span>';
  }

  function emptyState(title, text) {
    return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
  }

  function renderWashes() {
    const query = $('washSearch').value.trim().toLowerCase();
    const payment = $('washPaymentFilter').value;
    const date = $('washDateFilter').value;

    let washes = state.washes.slice().sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

    if (query) {
      washes = washes.filter((wash) => {
        const client = getClient(wash.clientId);
        const employee = getEmployee(wash.employeeId);
        const haystack = [
          client?.name, client?.phone, wash.plate, wash.bikeType, wash.bikeModel,
          wash.serviceType, employee?.name
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }
    if (payment !== 'all') washes = washes.filter((wash) => wash.paymentStatus === payment);
    if (date) washes = washes.filter((wash) => wash.date === date);

    $('washTable').innerHTML = washes.length ? `
      <table>
        <thead>
          <tr><th>Fecha / hora</th><th>Cliente</th><th>Moto</th><th>Lavado</th><th>Empleado</th><th>Monto</th><th>Comisión</th><th>Pago</th><th>Acciones</th></tr>
        </thead>
        <tbody>${washes.map((wash) => {
          const client = getClient(wash.clientId);
          const employee = getEmployee(wash.employeeId);
          return `<tr>
            <td class="name-cell"><strong>${formatDate(wash.date)}</strong><small>${escapeHtml(wash.time || '')}</small></td>
            <td class="name-cell"><strong>${escapeHtml(client?.name || 'Cliente eliminado')}</strong><small>${escapeHtml(client?.phone || '')}</small></td>
            <td class="name-cell"><strong>${escapeHtml(wash.bikeModel || wash.bikeType || '—')}</strong><small>${escapeHtml(wash.plate || wash.bikeType || '')}</small></td>
            <td>${escapeHtml(wash.serviceType || '—')}</td>
            <td>${escapeHtml(employee?.name || 'Empleado eliminado')}</td>
            <td><strong>${formatMoney(wash.amount)}</strong></td>
            <td class="name-cell"><strong>${formatMoney(washCommission(wash))}</strong><small>${toNumber(wash.commissionRate)}%</small></td>
            <td>${paymentBadge(wash.paymentStatus)}</td>
            <td><div class="table-actions">
              ${wash.paymentStatus === 'pending' ? `<button class="icon-action" data-wash-action="mark-paid" data-id="${wash.id}">Cobrar</button>` : ''}
              <button class="icon-action" data-wash-action="edit" data-id="${wash.id}">Editar</button>
              <button class="icon-action danger" data-wash-action="delete" data-id="${wash.id}">Eliminar</button>
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>` : emptyState('No hay resultados', 'Prueba otros filtros o registra un nuevo lavado.');
  }

  function renderClients() {
    const query = $('clientSearch').value.trim().toLowerCase();
    const filtered = state.clients
      .filter((client) => [client.name, client.phone, client.plate, client.bike].join(' ').toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));

    $('clientTable').innerHTML = filtered.length ? `
      <table>
        <thead><tr><th>Cliente</th><th>Teléfono</th><th>Moto / placa</th><th>Visitas</th><th>Facturado</th><th>Acciones</th></tr></thead>
        <tbody>${filtered.map((client) => {
          const washes = state.washes.filter((wash) => wash.clientId === client.id);
          const billed = washes.reduce((sum, wash) => sum + toNumber(wash.amount), 0);
          return `<tr>
            <td class="name-cell"><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml(client.notes || '')}</small></td>
            <td>${escapeHtml(client.phone || '—')}</td>
            <td class="name-cell"><strong>${escapeHtml(client.bike || '—')}</strong><small>${escapeHtml(client.plate || '')}</small></td>
            <td>${washes.length}</td>
            <td><strong>${formatMoney(billed)}</strong></td>
            <td><div class="table-actions">
              <button class="icon-action" data-client-action="new-wash" data-id="${client.id}">Lavado</button>
              <button class="icon-action" data-client-action="edit" data-id="${client.id}">Editar</button>
              <button class="icon-action danger" data-client-action="delete" data-id="${client.id}">Eliminar</button>
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>` : emptyState('Sin clientes', 'Agrega clientes para asociarlos a cada lavado.');

    $('clientTotalCount').textContent = state.clients.length;
    $('clientVisitCount').textContent = state.washes.length;
    $('clientBilledTotal').textContent = formatMoney(state.washes.reduce((sum, wash) => sum + toNumber(wash.amount), 0));
  }

  function employeeStats(employeeId) {
    const washes = state.washes.filter((wash) => wash.employeeId === employeeId);
    const paidWashes = washes.filter((wash) => wash.paymentStatus === 'paid');
    const generated = paidWashes.reduce((sum, wash) => sum + washCommission(wash), 0);
    const due = washes.filter(isCommissionDue).reduce((sum, wash) => sum + washCommission(wash), 0);
    const paid = washes.filter((wash) => wash.commissionPaid).reduce((sum, wash) => sum + washCommission(wash), 0);
    return { washes: washes.length, generated, due, paid };
  }

  function renderEmployees() {
    const employees = state.employees.slice().sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name));
    $('employeeCards').innerHTML = employees.length
      ? employees.map((employee) => {
        const stats = employeeStats(employee.id);
        return `<article class="employee-card">
          <div class="employee-card-top">
            <div>
              <h4>${escapeHtml(employee.name)}</h4>
              <p>${escapeHtml(employee.phone || 'Sin teléfono')} · ${employee.active !== false ? '<span class="badge active">Activo</span>' : '<span class="badge inactive">Inactivo</span>'}</p>
            </div>
            <div class="rate">${toNumber(employee.commission)}%</div>
          </div>
          <div class="employee-card-stats">
            <div><small>Lavados</small><strong>${stats.washes}</strong></div>
            <div><small>Por pagar</small><strong>${formatMoney(stats.due)}</strong></div>
          </div>
          <div class="employee-card-actions">
            <button class="icon-action" data-employee-action="edit" data-id="${employee.id}">Editar</button>
            ${employee.active !== false
              ? `<button class="icon-action" data-employee-action="toggle" data-id="${employee.id}">Desactivar</button>`
              : `<button class="icon-action" data-employee-action="toggle" data-id="${employee.id}">Activar</button>`}
            <button class="icon-action danger" data-employee-action="delete" data-id="${employee.id}">Eliminar</button>
          </div>
        </article>`;
      }).join('')
      : emptyState('Aún no hay empleados', 'Crea un empleado y define su porcentaje de comisión.');

    const all = totals();
    $('activeEmployeeCount').textContent = state.employees.filter((e) => e.active !== false).length;
    $('employeeCommissionGenerated').textContent = formatMoney(all.totalCommission);
    $('employeeCommissionDue').textContent = formatMoney(all.commissionDue);
  }

  function renderCommissions() {
    const all = totals();
    $('commissionGeneratedTotal').textContent = formatMoney(all.totalCommission);
    $('commissionOutstandingTotal').textContent = formatMoney(all.commissionDue);
    $('commissionPaidTotal').textContent = formatMoney(all.commissionPaid);
    $('markAllCommissionsPaid').disabled = all.commissionDue <= 0;

    const rows = state.employees
      .map((employee) => ({ employee, ...employeeStats(employee.id) }))
      .filter((row) => row.washes > 0 || row.due > 0)
      .sort((a, b) => b.due - a.due);

    $('commissionTable').innerHTML = rows.length ? `
      <table>
        <thead><tr><th>Empleado</th><th>% actual</th><th>Lavados</th><th>Generado</th><th>Pagado</th><th>Por pagar</th><th>Acción</th></tr></thead>
        <tbody>${rows.map((row) => `<tr>
          <td><strong>${escapeHtml(row.employee.name)}</strong></td>
          <td>${toNumber(row.employee.commission)}%</td>
          <td>${row.washes}</td>
          <td>${formatMoney(row.generated)}</td>
          <td>${formatMoney(row.paid)}</td>
          <td><strong>${formatMoney(row.due)}</strong></td>
          <td>${row.due > 0
            ? `<button class="icon-action" data-commission-action="pay-employee" data-id="${row.employee.id}">Marcar pagada</button>`
            : '<span class="badge paid">Al día</span>'}</td>
        </tr>`).join('')}</tbody>
      </table>` : emptyState('Sin comisiones', 'Las comisiones aparecerán cuando registres lavados pagados.');
  }

  function renderSettings() {
    $('businessNameInput').value = state.settings.businessName || 'EMEL WASH';
    $('currencyInput').value = state.settings.currency || 'USD';
    $('defaultCommissionInput').value = toNumber(state.settings.defaultCommission);
  }

  function renderBrand() {
    const name = state.settings.businessName || 'EMEL WASH';
    $('sidebarBusinessName').textContent = name;
    document.title = `${name} · Administración`;
  }

  function renderAll() {
    renderBrand();
    refreshSelects();
    renderDashboard();
    renderWashes();
    renderClients();
    renderEmployees();
    renderCommissions();
    renderSettings();
  }

  function openClientForm(client = null) {
    $('clientForm').reset();
    $('clientId').value = client?.id || '';
    $('clientDialogTitle').textContent = client ? 'Editar cliente' : 'Nuevo cliente';
    $('clientName').value = client?.name || '';
    $('clientPhone').value = client?.phone || '';
    $('clientPlate').value = client?.plate || '';
    $('clientBike').value = client?.bike || '';
    $('clientNotes').value = client?.notes || '';
    openDialog($('clientDialog'));
  }

  function openEmployeeForm(employee = null) {
    $('employeeForm').reset();
    $('employeeId').value = employee?.id || '';
    $('employeeDialogTitle').textContent = employee ? 'Editar empleado' : 'Nuevo empleado';
    $('employeeName').value = employee?.name || '';
    $('employeePhone').value = employee?.phone || '';
    $('employeeCommission').value = employee ? toNumber(employee.commission) : toNumber(state.settings.defaultCommission);
    $('employeeActive').value = employee?.active === false ? 'false' : 'true';
    openDialog($('employeeDialog'));
  }

  function editWash(wash) {
    if (!wash) return;
    openView('newWash');
    $('washId').value = wash.id;
    $('washFormTitle').textContent = 'Editar lavado';
    refreshSelects();
    $('washClient').value = wash.clientId;
    $('washEmployee').value = wash.employeeId;
    $('washDate').value = wash.date || localDateString();
    $('washTime').value = wash.time || localTimeString();
    $('washBikeType').value = wash.bikeType || '';
    $('washBikeModel').value = wash.bikeModel || '';
    $('washPlate').value = wash.plate || '';
    $('washServiceType').value = wash.serviceType || '';
    $('washAmount').value = wash.amount ?? '';
    $('washPaymentStatus').value = wash.paymentStatus || 'paid';
    $('washNotes').value = wash.notes || '';
    $('cancelWashEdit').classList.remove('hidden');
    updateCommissionPreview();
  }

  function bindNavigation() {
    $$('[data-view]').forEach((button) => button.addEventListener('click', () => openView(button.dataset.view)));
    $$('[data-go]').forEach((button) => button.addEventListener('click', () => openView(button.dataset.go)));
    $('quickWashButton').addEventListener('click', () => { prepareNewWashForm(); openView('newWash'); });
    $('quickClientButton').addEventListener('click', () => openClientForm());
  }

  function bindDialogs() {
    $$('[data-close]').forEach((button) => button.addEventListener('click', () => closeDialog($(button.dataset.close))));
    $('confirmActionButton').addEventListener('click', () => {
      const action = pendingConfirm;
      pendingConfirm = null;
      closeDialog($('confirmDialog'));
      if (typeof action === 'function') action();
    });
    ['clientDialog', 'employeeDialog', 'confirmDialog'].forEach((id) => {
      $(id).addEventListener('click', (event) => {
        if (event.target === $(id)) closeDialog($(id));
      });
    });
  }

  function bindClientEvents() {
    $('newClientButton').addEventListener('click', () => openClientForm());
    $('washNewClientButton').addEventListener('click', () => openClientForm());

    $('clientForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const id = $('clientId').value;
      const payload = {
        name: $('clientName').value.trim(),
        phone: $('clientPhone').value.trim(),
        plate: $('clientPlate').value.trim().toUpperCase(),
        bike: $('clientBike').value.trim(),
        notes: $('clientNotes').value.trim()
      };
      if (!payload.name) return;

      if (id) {
        const client = getClient(id);
        if (client) Object.assign(client, payload, { updatedAt: new Date().toISOString() });
        toast('Cliente actualizado.');
      } else {
        const newClient = { id: uid('cli'), ...payload, createdAt: new Date().toISOString() };
        state.clients.push(newClient);
        toast('Cliente registrado.');
        setTimeout(() => { $('washClient').value = newClient.id; }, 0);
      }
      closeDialog($('clientDialog'));
      saveState();
    });

    $('clientSearch').addEventListener('input', renderClients);

    $('clientTable').addEventListener('click', (event) => {
      const button = event.target.closest('[data-client-action]');
      if (!button) return;
      const client = getClient(button.dataset.id);
      if (!client) return;

      if (button.dataset.clientAction === 'edit') openClientForm(client);
      if (button.dataset.clientAction === 'new-wash') {
        prepareNewWashForm();
        openView('newWash');
        $('washClient').value = client.id;
        $('washPlate').value = client.plate || '';
        $('washBikeModel').value = client.bike || '';
      }
      if (button.dataset.clientAction === 'delete') {
        const visits = state.washes.filter((wash) => wash.clientId === client.id).length;
        confirmAction(
          'Eliminar cliente',
          visits ? `${client.name} tiene ${visits} lavado(s) asociados. El historial conservará los servicios, pero mostrará “Cliente eliminado”.` : `Se eliminará a ${client.name}.`,
          () => {
            state.clients = state.clients.filter((item) => item.id !== client.id);
            saveState();
            toast('Cliente eliminado.');
          },
          'Eliminar'
        );
      }
    });
  }

  function bindEmployeeEvents() {
    $('newEmployeeButton').addEventListener('click', () => openEmployeeForm());

    $('employeeForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const id = $('employeeId').value;
      const payload = {
        name: $('employeeName').value.trim(),
        phone: $('employeePhone').value.trim(),
        commission: Math.max(0, Math.min(100, toNumber($('employeeCommission').value))),
        active: $('employeeActive').value === 'true'
      };
      if (!payload.name) return;

      if (id) {
        const employee = getEmployee(id);
        if (employee) Object.assign(employee, payload, { updatedAt: new Date().toISOString() });
        toast('Empleado actualizado.');
      } else {
        state.employees.push({ id: uid('emp'), ...payload, createdAt: new Date().toISOString() });
        toast('Empleado registrado.');
      }
      closeDialog($('employeeDialog'));
      saveState();
    });

    $('employeeCards').addEventListener('click', (event) => {
      const button = event.target.closest('[data-employee-action]');
      if (!button) return;
      const employee = getEmployee(button.dataset.id);
      if (!employee) return;

      if (button.dataset.employeeAction === 'edit') openEmployeeForm(employee);

      if (button.dataset.employeeAction === 'toggle') {
        employee.active = employee.active === false;
        saveState();
        toast(employee.active ? 'Empleado activado.' : 'Empleado desactivado.');
      }

      if (button.dataset.employeeAction === 'delete') {
        const services = state.washes.filter((wash) => wash.employeeId === employee.id).length;
        confirmAction(
          'Eliminar empleado',
          services ? `${employee.name} tiene ${services} lavado(s) en el historial. Para conservar los reportes, es preferible desactivarlo. Si lo eliminas, los servicios seguirán guardados.` : `Se eliminará a ${employee.name}.`,
          () => {
            state.employees = state.employees.filter((item) => item.id !== employee.id);
            saveState();
            toast('Empleado eliminado.');
          },
          'Eliminar'
        );
      }
    });
  }

  function bindWashEvents() {
    $('washEmployee').addEventListener('change', updateCommissionPreview);
    $('washAmount').addEventListener('input', updateCommissionPreview);

    $('washClient').addEventListener('change', () => {
      const client = getClient($('washClient').value);
      if (!client) return;
      if (!$('washPlate').value) $('washPlate').value = client.plate || '';
      if (!$('washBikeModel').value) $('washBikeModel').value = client.bike || '';
    });

    $('washForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const client = getClient($('washClient').value);
      const employee = getEmployee($('washEmployee').value);
      if (!client) return toast('Selecciona un cliente válido.', 'error');
      if (!employee) return toast('Selecciona un empleado activo.', 'error');

      const amount = toNumber($('washAmount').value);
      const rate = toNumber(employee.commission);
      const id = $('washId').value;
      const existing = state.washes.find((wash) => wash.id === id);

      const payload = {
        clientId: client.id,
        employeeId: employee.id,
        date: $('washDate').value,
        time: $('washTime').value,
        bikeType: $('washBikeType').value,
        bikeModel: $('washBikeModel').value.trim(),
        plate: $('washPlate').value.trim().toUpperCase(),
        serviceType: $('washServiceType').value,
        amount,
        paymentStatus: $('washPaymentStatus').value,
        notes: $('washNotes').value.trim(),
        commissionRate: rate,
        commissionAmount: amount * rate / 100
      };

      if (existing) {
        const paymentChangedBackToPending = existing.paymentStatus === 'paid' && payload.paymentStatus === 'pending';
        Object.assign(existing, payload, { updatedAt: new Date().toISOString() });
        if (paymentChangedBackToPending) {
          existing.commissionPaid = false;
          existing.commissionPaidAt = null;
        }
        toast('Lavado actualizado.');
      } else {
        state.washes.push({
          id: uid('wash'),
          ...payload,
          commissionPaid: false,
          commissionPaidAt: null,
          createdAt: new Date().toISOString()
        });
        toast('Lavado registrado correctamente.');
      }

      if (!client.plate && payload.plate) client.plate = payload.plate;
      if (!client.bike && payload.bikeModel) client.bike = payload.bikeModel;

      saveState();
      prepareNewWashForm();
      openView('washes');
    });

    $('cancelWashEdit').addEventListener('click', () => {
      prepareNewWashForm();
      openView('washes');
    });

    ['washSearch', 'washPaymentFilter', 'washDateFilter'].forEach((id) => {
      $(id).addEventListener(id === 'washSearch' ? 'input' : 'change', renderWashes);
    });

    $('clearWashFilters').addEventListener('click', () => {
      $('washSearch').value = '';
      $('washPaymentFilter').value = 'all';
      $('washDateFilter').value = '';
      renderWashes();
    });

    $('washTable').addEventListener('click', (event) => {
      const button = event.target.closest('[data-wash-action]');
      if (!button) return;
      const wash = state.washes.find((item) => item.id === button.dataset.id);
      if (!wash) return;

      if (button.dataset.washAction === 'edit') editWash(wash);

      if (button.dataset.washAction === 'mark-paid') {
        wash.paymentStatus = 'paid';
        wash.paidAt = new Date().toISOString();
        saveState();
        toast('Pago del cliente registrado.');
      }

      if (button.dataset.washAction === 'delete') {
        confirmAction(
          'Eliminar lavado',
          'Se eliminará este servicio y sus cálculos de ingreso y comisión.',
          () => {
            state.washes = state.washes.filter((item) => item.id !== wash.id);
            saveState();
            toast('Lavado eliminado.');
          },
          'Eliminar'
        );
      }
    });
  }

  function payEmployeeCommissions(employeeId) {
    const pending = state.washes.filter((wash) => wash.employeeId === employeeId && isCommissionDue(wash));
    pending.forEach((wash) => {
      wash.commissionPaid = true;
      wash.commissionPaidAt = new Date().toISOString();
    });
    saveState();
    toast(`${pending.length} comisión(es) marcada(s) como pagadas.`);
  }

  function bindCommissionEvents() {
    $('commissionTable').addEventListener('click', (event) => {
      const button = event.target.closest('[data-commission-action="pay-employee"]');
      if (!button) return;
      const employee = getEmployee(button.dataset.id);
      if (!employee) return;
      const due = employeeStats(employee.id).due;
      confirmAction(
        'Pagar comisión',
        `Se marcarán como pagadas las comisiones pendientes de ${employee.name} por ${formatMoney(due)}.`,
        () => payEmployeeCommissions(employee.id),
        'Marcar pagadas'
      );
    });

    $('markAllCommissionsPaid').addEventListener('click', () => {
      const due = totals().commissionDue;
      if (due <= 0) return;
      confirmAction(
        'Pagar todas las comisiones',
        `Se marcarán como pagadas todas las comisiones pendientes por ${formatMoney(due)}.`,
        () => {
          state.washes.filter(isCommissionDue).forEach((wash) => {
            wash.commissionPaid = true;
            wash.commissionPaidAt = new Date().toISOString();
          });
          saveState();
          toast('Todas las comisiones quedaron al día.');
        },
        'Marcar pagadas'
      );
    });
  }

  function bindSettingsEvents() {
    $('settingsForm').addEventListener('submit', (event) => {
      event.preventDefault();
      state.settings.businessName = $('businessNameInput').value.trim() || 'EMEL WASH';
      state.settings.currency = $('currencyInput').value;
      state.settings.defaultCommission = Math.max(0, Math.min(100, toNumber($('defaultCommissionInput').value)));
      saveState();
      toast('Ajustes guardados.');
    });

    $('exportDataButton').addEventListener('click', () => {
      const payload = {
        app: 'EMEL WASH',
        build: BUILD,
        exportedAt: new Date().toISOString(),
        data: state
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emel-wash-respaldo-${localDateString()}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Respaldo exportado.');
    });

    $('importDataInput').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const imported = parsed.data || parsed;
        if (!Array.isArray(imported.clients) || !Array.isArray(imported.employees) || !Array.isArray(imported.washes)) {
          throw new Error('Formato inválido');
        }
        state = {
          settings: { ...defaultState.settings, ...(imported.settings || {}) },
          clients: imported.clients,
          employees: imported.employees,
          washes: imported.washes
        };
        saveState();
        toast('Respaldo importado correctamente.');
      } catch (error) {
        console.error(error);
        toast('No se pudo importar ese archivo.', 'error');
      } finally {
        event.target.value = '';
      }
    });

    $('resetDataButton').addEventListener('click', () => {
      confirmAction(
        'Borrar todos los datos',
        'Esta acción eliminará clientes, empleados, lavados, pagos y comisiones de este dispositivo. Exporta un respaldo antes si necesitas conservarlos.',
        () => {
          state = cloneDefaultState();
          localStorage.removeItem(STORAGE_KEY);
          saveState();
          prepareNewWashForm();
          toast('Sistema reiniciado.');
        },
        'Borrar todo'
      );
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`/sw.js?build=${encodeURIComponent(BUILD)}`).catch((error) => {
        console.warn('Service Worker no disponible', error);
      });
    });
  }

  function boot() {
    bindNavigation();
    bindDialogs();
    bindClientEvents();
    bindEmployeeEvents();
    bindWashEvents();
    bindCommissionEvents();
    bindSettingsEvents();
    prepareNewWashForm();
    renderAll();
    registerServiceWorker();
  }

  boot();
})();
