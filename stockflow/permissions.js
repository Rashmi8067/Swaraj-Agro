/* Server-backed staff access controls for StockFlow. */
(function () {
  function staffProfile() { return data.staffUsers?.[currentUser]; }
  function permissions() {
    if (isAdmin()) return { viewAmounts: true, recordSales: true, recordPurchases: true };
    return staffProfile()?.permissions || { viewAmounts: false, recordSales: false, recordPurchases: false };
  }
  function can(permission) { return Boolean(permissions()[permission]); }
  function mask(element, value = 'Private') { if (element) element.textContent = value; }
  function setLabelText(input, text) { const label = input?.closest('label'); if (label?.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.textContent = text; }

  function makeStaffAccessPanel() {
    const existing = document.getElementById('staffAccessPanel'); if (existing) return existing;
    const former = document.querySelector('.permissions-panel'); if (former) former.remove();
    const securityPanel = document.querySelector('.security-panel'); if (!securityPanel) return null;
    securityPanel.insertAdjacentHTML('afterend', `
      <article id="staffAccessPanel" class="panel staff-access-panel">
        <div class="staff-access-head"><div><p class="eyebrow">TEAM ACCESS</p><h2>Staff permissions</h2><p>Choose who can record movements and who is allowed to see financial amounts.</p></div><div class="staff-access-actions"><span class="staff-access-note">Changes save instantly</span><button id="addStaffAccess" class="button button-primary staff-add-button" type="button">+ Add staff access</button></div></div>
        <div class="access-explainer"><span>✦</span> <strong>View financial amounts</strong> masks inventory value, sales totals, unit prices, transaction amounts and ledger balances for that staff login.</div>
        <div id="staffAccessList" class="staff-access-list"></div>
      </article>`);
    return document.getElementById('staffAccessPanel');
  }

  function renderStaffAccess() {
    if (!isAdmin()) return;
    const panel = makeStaffAccessPanel(); const list = document.getElementById('staffAccessList');
    if (!panel || !list) return;
    list.innerHTML = Object.entries(data.staffUsers || {}).map(([id, person]) => {
      const p = person.permissions || {};
      return `<article class="staff-access-row"><div class="staff-person"><span class="avatar staff-avatar">${escapeHtml(person.initials || 'ST')}</span><span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.loginId || person.email)} · ${escapeHtml(person.role)}</small></span><b class="visibility-status ${p.viewAmounts ? 'visible' : 'private'}">${p.viewAmounts ? 'Amounts visible' : 'Amounts private'}</b></div><div class="staff-controls"><div class="permission-switches"><label class="permission-toggle"><input class="staff-permission-toggle" data-user="${escapeHtml(id)}" data-permission="recordSales" type="checkbox" ${p.recordSales ? 'checked' : ''}><span>Record sales</span></label><label class="permission-toggle"><input class="staff-permission-toggle" data-user="${escapeHtml(id)}" data-permission="recordPurchases" type="checkbox" ${p.recordPurchases ? 'checked' : ''}><span>Record purchases</span></label><label class="permission-toggle prominent"><input class="staff-permission-toggle" data-user="${escapeHtml(id)}" data-permission="viewAmounts" type="checkbox" ${p.viewAmounts ? 'checked' : ''}><span>View financial amounts</span></label></div><button class="button button-secondary staff-edit-button" type="button" data-edit-staff="${escapeHtml(id)}">Edit access</button></div></article>`;
    }).join('') || '<p class="empty-state">No staff access accounts yet.</p>';
  }

  function makeStaffModal() {
    let modal = document.getElementById('staffAccessModal'); if (modal) return modal;
    document.body.insertAdjacentHTML('beforeend', `<div id="staffAccessModal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="staffModalTitle"><div class="modal staff-modal"><div class="modal-header"><div><p class="eyebrow">STAFF ACCESS</p><h2 id="staffModalTitle">Add staff access</h2></div><button class="modal-close" type="button" data-close-staff-modal aria-label="Close">×</button></div><form id="staffAccessForm"><div class="modal-grid"><label>Staff name<input id="staffName" required placeholder="e.g. Riya Shah" /></label><label>Role<input id="staffRole" required placeholder="e.g. Shop associate" /></label><label class="full-span">Access ID (email)<input id="staffLoginId" type="email" required placeholder="e.g. riya@company.com" /></label><label class="full-span">Password<input id="staffPassword" type="password" minlength="6" placeholder="At least 6 characters" /></label></div><p id="staffPasswordHelp" class="input-help"></p><div class="modal-permissions"><strong>Access permissions</strong><label class="permission-toggle"><input id="staffRecordSales" type="checkbox" checked><span>Record sales</span></label><label class="permission-toggle"><input id="staffRecordPurchases" type="checkbox" checked><span>Record purchases</span></label><label class="permission-toggle prominent"><input id="staffViewAmounts" type="checkbox"><span>View financial amounts</span></label></div><div id="staffAccessError" class="form-error" role="alert"></div><div class="modal-actions"><button class="button button-secondary" type="button" data-close-staff-modal>Cancel</button><button class="button button-primary" type="submit">Save staff access</button></div></form></div></div>`);
    return document.getElementById('staffAccessModal');
  }

  function openStaffModal(id) {
    const modal = makeStaffModal(); const form = document.getElementById('staffAccessForm'); const person = id ? data.staffUsers?.[id] : null;
    form.reset(); modal.dataset.editId = id || '';
    document.getElementById('staffModalTitle').textContent = person ? 'Edit staff access' : 'Add staff access';
    document.getElementById('staffName').value = person?.name || '';
    document.getElementById('staffRole').value = person?.role || '';
    document.getElementById('staffLoginId').value = person?.loginId || person?.email || '';
    document.getElementById('staffPassword').required = !person;
    document.getElementById('staffPasswordHelp').textContent = person ? 'Leave password blank to keep the current sign-in password.' : 'Set a sign-in password with at least 6 characters.';
    document.getElementById('staffRecordSales').checked = person?.permissions?.recordSales ?? true;
    document.getElementById('staffRecordPurchases').checked = person?.permissions?.recordPurchases ?? true;
    document.getElementById('staffViewAmounts').checked = person?.permissions?.viewAmounts ?? false;
    document.getElementById('staffAccessError').textContent = '';
    modal.classList.remove('hidden'); setTimeout(() => document.getElementById('staffName').focus(), 20);
  }
  function closeStaffModal() { document.getElementById('staffAccessModal')?.classList.add('hidden'); }

  function applyStaffAccess() {
    if (!currentUser) return;
    const p = permissions(); const restricted = !isAdmin() && !p.viewAmounts;
    document.body.classList.toggle('amounts-private', restricted); document.body.classList.toggle('staff-session', !isAdmin());
    if (!isAdmin()) {
      const person = staffProfile(); if (person) {
        document.getElementById('sidebarAvatar').textContent = person.initials || 'ST'; document.getElementById('sidebarUserName').textContent = person.name; document.getElementById('sidebarUserRole').textContent = person.role; document.getElementById('greetingName').textContent = person.name.split(' ')[0];
      }
    }
    document.querySelectorAll('.nav-item[data-page="ledger"], [data-action="view-ledger"]').forEach(item => item.classList.toggle('hidden', restricted));
    document.querySelector('.sales-panel')?.classList.toggle('hidden', restricted);
    document.querySelector('#dashboardLedger')?.closest('.panel')?.classList.toggle('hidden', restricted);
    document.querySelector('#ledgerPage .page-heading')?.classList.toggle('hidden', restricted);
    document.querySelector('#ledgerPage .table-panel')?.classList.toggle('hidden', restricted);
    document.querySelectorAll('#dashboardPage .metric-value, #dashboardPage .metric-label, #inventoryValue, #stockAlerts .stock-pill, #productTable td:nth-child(5), #transactionTable td:nth-child(6)').forEach(value => { if (restricted) mask(value); });
    if (restricted) {
      document.querySelectorAll('#ledgerCards .ledger-card strong, #ledgerTable td:nth-child(5), #ledgerTable td:nth-child(6), #ledgerTable td:nth-child(7)').forEach(value => mask(value));
    }
    const priceInput = document.getElementById('entryPrice');
    if (priceInput) { priceInput.type = restricted ? 'password' : 'number'; priceInput.setAttribute('aria-label', restricted ? 'Unit price hidden' : 'Unit price in rupees'); setLabelText(priceInput, restricted ? 'Unit price (hidden) ' : 'Unit price (₹)'); }
    const saleTab = document.querySelector('.entry-tab[data-entry-type="sale"]'); const purchaseTab = document.querySelector('.entry-tab[data-entry-type="purchase"]');
    if (saleTab) saleTab.classList.toggle('hidden', !isAdmin() && !p.recordSales); if (purchaseTab) purchaseTab.classList.toggle('hidden', !isAdmin() && !p.recordPurchases);
  }

  const standardSwitchPage = switchPage;
  switchPage = function (page) { if (!isAdmin() && page === 'ledger' && !can('viewAmounts')) { showToast('Ledger balances are private for this staff account.'); return; } standardSwitchPage(page); applyStaffAccess(); if (page === 'settings') renderStaffAccess(); };
  const standardRenderAll = renderAll;
  renderAll = function () { standardRenderAll(); applyStaffAccess(); if (currentPage === 'settings') renderStaffAccess(); };
  const standardRenderTransactions = renderTransactions;
  renderTransactions = function () { const p = permissions(); if (!isAdmin() && ((entryType === 'sale' && !p.recordSales) || (entryType === 'purchase' && !p.recordPurchases))) entryType = p.recordSales ? 'sale' : 'purchase'; standardRenderTransactions(); applyStaffAccess(); };
  const standardEnterApp = enterApp;
  enterApp = function () { standardEnterApp(); renderStaffAccess(); applyStaffAccess(); };

  document.addEventListener('submit', async event => {
    if (event.target.id === 'transactionForm' && !isAdmin()) {
      const p = permissions(); if ((entryType === 'sale' && !p.recordSales) || (entryType === 'purchase' && !p.recordPurchases)) { event.preventDefault(); event.stopImmediatePropagation(); document.getElementById('transactionError').textContent = `You do not have permission to record ${entryType === 'sale' ? 'sales' : 'purchases'}.`; }
    }
    if (event.target.id === 'staffAccessForm') {
      event.preventDefault(); event.stopImmediatePropagation();
      const modal = document.getElementById('staffAccessModal'); const editId = modal.dataset.editId; const name = document.getElementById('staffName').value.trim(); const role = document.getElementById('staffRole').value.trim(); const email = document.getElementById('staffLoginId').value.trim().toLowerCase(); const password = document.getElementById('staffPassword').value; const error = document.getElementById('staffAccessError');
      if (!name || !role || !email || (!editId && password.length < 6) || (password && password.length < 6)) { error.textContent = 'Complete the details and use a password of at least 6 characters.'; return; }
      const payload = { name, role, email, permissions: { recordSales: document.getElementById('staffRecordSales').checked, recordPurchases: document.getElementById('staffRecordPurchases').checked, viewAmounts: document.getElementById('staffViewAmounts').checked } }; if (password) payload.password = password;
      try {
        const response = editId ? await StockFlowAPI.updateUser(editId, payload) : await StockFlowAPI.createUser(payload);
        data.staffUsers = data.staffUsers || {}; data.staffUsers[response.user.userId] = response.user;
        closeStaffModal(); renderStaffAccess(); showToast(editId ? 'Staff access updated.' : 'New staff access created.');
      } catch (e) { error.textContent = e.message || 'Unable to save staff access.'; }
    }
  }, true);

  document.addEventListener('change', async event => {
    const control = event.target.closest('.staff-permission-toggle'); if (!control || !isAdmin()) return;
    const userId = control.dataset.user; const permission = control.dataset.permission; const previous = data.staffUsers[userId]?.permissions?.[permission];
    try {
      const response = await StockFlowAPI.updateUser(userId, { permissions: { ...data.staffUsers[userId].permissions, [permission]: control.checked } });
      data.staffUsers[userId] = response.user; renderStaffAccess(); showToast('Staff permission updated.');
    } catch (e) { control.checked = Boolean(previous); showToast(e.message || 'Unable to update permission.'); }
  });

  document.addEventListener('click', event => { if (event.target.closest('#addStaffAccess')) { openStaffModal(); return; } const edit = event.target.closest('[data-edit-staff]'); if (edit) { openStaffModal(edit.dataset.editStaff); return; } if (event.target.closest('[data-close-staff-modal]')) closeStaffModal(); });
})();
