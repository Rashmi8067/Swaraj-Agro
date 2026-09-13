const defaultData = {"name":"Swaraj Agro – Farm Machinery","symbol":"F","description":"Farm machinery & agricultural equipment","products":[{"id":101,"name":"Multi Crop Harvester","sku":"SAG-FM-001","category":"Harvesting","stock":2,"reorder":1,"price":2640000,"emoji":"◈"},{"id":102,"name":"Multi Crop Thresher","sku":"SAG-FM-002","category":"Threshing","stock":3,"reorder":1,"price":271000,"emoji":"◈"},{"id":103,"name":"Rotavator","sku":"SAG-FM-003","category":"Tillage","stock":6,"reorder":2,"price":142000,"emoji":"◈"},{"id":104,"name":"Power Weeder","sku":"SAG-FM-004","category":"Tillage & Weeding","stock":8,"reorder":2,"price":23000,"emoji":"◈"},{"id":105,"name":"Mini Rice Mill – Annapurna","sku":"SAG-FM-005","category":"Rice Processing","stock":5,"reorder":2,"price":20000,"emoji":"◈"},{"id":106,"name":"Rubber Sheller – Satya Subhra","sku":"SAG-FM-006","category":"Crop Processing","stock":4,"reorder":1,"price":25000,"emoji":"◈"},{"id":107,"name":"Petrol PumpSet 2\" – Kisan Kraft","sku":"SAG-FM-007","category":"Pumps & Irrigation","stock":7,"reorder":2,"price":13500,"emoji":"◈"},{"id":108,"name":"Paddy Thresher – Agreameate","sku":"SAG-FM-008","category":"Threshing","stock":4,"reorder":1,"price":40000,"emoji":"◈"}],"accounts":[{"id":1,"name":"SBI Current Account","type":"Cash & bank","balance":245000,"icon":"⌁"},{"id":2,"name":"Cash in hand","type":"Cash & bank","balance":32500,"icon":"◌"},{"id":3,"name":"Inventory asset","type":"Asset","balance":7583500,"icon":"□"},{"id":4,"name":"Sales revenue","type":"Income","balance":185000,"icon":"↗"}],"transactions":[{"id":101,"type":"sale","productId":101,"product":"Multi Crop Harvester","qty":1,"price":2640000,"account":"SBI Current Account","date":"2026-09-11","note":"SO-1001","time":"10:20 AM"},{"id":102,"type":"purchase","productId":102,"product":"Multi Crop Thresher","qty":2,"price":211380.0,"account":"SBI Current Account","date":"2026-09-10","note":"PO-2001","time":"11:15 AM"},{"id":103,"type":"sale","productId":103,"product":"Rotavator","qty":1,"price":142000,"account":"Cash in hand","date":"2026-09-09","note":"Walk-in / Site sale","time":"02:40 PM"},{"id":104,"type":"purchase","productId":104,"product":"Power Weeder","qty":2,"price":18400.0,"account":"SBI Current Account","date":"2026-09-08","note":"PO-2000","time":"09:35 AM"}]};

let data = clone(defaultData);
let currentUser = null;
let currentPage = 'dashboard';
let entryType = 'sale';
let toastTimer;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function loadData() { return clone(defaultData); }
function applyServerWorkspace(workspace) { if (!workspace) return; const active = workspace.activeCompany || data.activeCompany || 'machinery'; data = clone(workspace); if (!data.companies && data.shops) { data.companies = clone(data.shops); delete data.shops; } data.activeCompany = active; if (active && data.companies?.[active]) { data.products = clone(data.companies[active].products); data.accounts = clone(data.companies[active].accounts); data.transactions = clone(data.companies[active].transactions); } }
function persist() { if (!currentUser || !isAdmin()) return Promise.resolve(); return StockFlowAPI.saveWorkspace(data); }
window.applyServerWorkspace = applyServerWorkspace;
function money(value) { return `₹ ${Math.round(Number(value || 0)).toLocaleString('en-IN')}`; }
function formatDate(value) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char])); }
function shortDate() { return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date()); }
function displayName() { return currentUser === 'admin' ? 'Admin' : 'Team member'; }

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3400); }
function isAdmin() { return currentUser === 'admin'; }
function stockStatus(product) { if (product.stock <= product.reorder) return 'low'; if (product.stock <= product.reorder * 1.5) return 'moderate'; return 'good'; }
function productById(id) { return data.products.find(product => product.id === Number(id)); }
function accountByName(name) { return data.accounts.find(account => account.name === name); }
function updateInventoryValue() { const total = data.products.reduce((sum, product) => sum + product.stock * product.price, 0); const inventory = data.accounts.find(a => a.type === 'Asset' || a.name === 'Inventory asset'); if (inventory) inventory.balance = total; return total; }
function lowStockProducts() { return data.products.filter(product => product.stock <= product.reorder).sort((a, b) => a.stock - b.stock); }

function setupAuth() {
  $$('.role-tab').forEach(button => button.addEventListener('click', () => {
    $$('.role-tab').forEach(tab => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-selected', tab === button ? 'true' : 'false'); });
    const role = button.dataset.role;
    $('#loginEmail').placeholder = role === 'admin' ? 'Enter admin email' : 'Enter staff email';
  }));
  $('#showPassword').addEventListener('click', () => { const input = $('#loginPassword'); input.type = input.type === 'password' ? 'text' : 'password'; $('#showPassword').textContent = input.type === 'password' ? 'Show' : 'Hide'; });
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('#loginEmail').value.trim().toLowerCase(); const password = $('#loginPassword').value;
    const button = event.submitter || $('#loginForm button[type="submit"]');
    button.disabled = true; $('#loginError').textContent = '';
    try {
      const payload = await StockFlowAPI.login(email, password);
      currentUser = payload.user.userId;
      data = payload.workspace;
      if (!data.companies) data.companies = {};
      enterApp();
    } catch (error) {
      $('#loginError').textContent = error.message || 'Unable to sign in.';
    } finally { button.disabled = false; }
  });
}
function enterApp() {
  $('#authView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  $$('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));
  $('.admin-only-action')?.classList.toggle('hidden', !isAdmin());
  $('#sidebarAvatar').className = `avatar ${isAdmin() ? 'admin-avatar' : 'staff-avatar'}`; $('#sidebarAvatar').textContent = isAdmin() ? 'SA' : 'ST';
  $('#sidebarUserName').textContent = isAdmin() ? 'Swaraj Agro Admin' : 'Swaraj Agro Team'; $('#sidebarUserRole').textContent = isAdmin() ? 'Administrator' : 'Staff member'; $('#greetingName').textContent = displayName();
  $('#todayDate').textContent = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
  currentPage = 'dashboard'; switchPage('dashboard'); renderAll();
}

function switchPage(page) {
  if (!isAdmin() && page === 'settings') { showToast('Settings are only available to administrators.'); return; }
  currentPage = page; $$('.page').forEach(section => section.classList.toggle('active-page', section.id === `${page}Page`));
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  const pageName = { dashboard: 'Overview', inventory: 'Products', transactions: 'Sales & purchases', ledger: 'Ledger accounts', settings: 'Company settings' }[page]; $('#breadcrumbPage').textContent = pageName;
  $('#sidebar').classList.remove('open'); $('#backdrop').classList.remove('visible'); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderDashboard() {
  const lowItems = lowStockProducts(); const inventoryValue = updateInventoryValue();
  $('#inventoryValue').textContent = money(inventoryValue); $('#lowStockMetric').textContent = lowItems.length;
  $('#stockAlerts').innerHTML = lowItems.slice(0, 4).map(product => `<div class="alert-row"><span class="product-thumb">${product.emoji}</span><div><strong>${escapeHtml(product.name)}</strong><small>${product.sku} · Reorder at ${product.reorder}</small></div><span class="stock-pill">${product.stock} left</span></div>`).join('') || '<p class="empty-state">All products are above their reorder point.</p>';
  $('#dashboardLedger').innerHTML = data.accounts.slice(0, 4).map(account => `<div class="ledger-row"><span class="account-icon">${account.icon || '◌'}</span><div><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(account.type)}</small></div><b>${money(account.balance)}</b></div>`).join('');
  $('#activityList').innerHTML = data.transactions.slice(0, 4).map(entry => `<div class="activity-row"><span class="activity-icon activity-${entry.type}">${entry.type === 'sale' ? '↗' : '↓'}</span><div><strong>${entry.type === 'sale' ? 'Sale recorded' : 'Purchase received'} · ${escapeHtml(entry.product)}</strong><span>${entry.note || 'Stock movement'} · ${entry.time || formatDate(entry.date)} · <b>${money(entry.qty * entry.price)}</b></span></div></div>`).join('');
}

function renderProducts() {
  const query = $('#productSearch')?.value?.trim().toLowerCase() || ''; const filter = $('#stockFilter')?.value || 'all';
  const products = data.products.filter(product => { const matches = `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query); const status = stockStatus(product); return matches && (filter === 'all' || (filter === 'low' ? status === 'low' : status !== 'low')); });
  $('#productNavCount').textContent = data.products.length; $('#productTableCount').textContent = products.length;
  $('#productTable').innerHTML = products.map(product => { const status = stockStatus(product); const label = status === 'low' ? 'Low stock' : status === 'moderate' ? 'Watch stock' : 'In stock'; return `<tr><td><div class="product-cell"><span class="product-thumb">${product.emoji || '◒'}</span><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)}</small></span></div></td><td>${escapeHtml(product.sku)}</td><td>${escapeHtml(product.category)}</td><td class="number"><b>${product.stock}</b></td><td class="number">${money(product.price)}</td><td><span class="status ${status}">${label}</span></td><td><button class="row-action" type="button" data-restock="${product.id}" aria-label="Restock ${escapeHtml(product.name)}">⋯</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="empty-cell">No products found. Try a different search.</td></tr>';
}

function fillEntryForm() {
  const select = $('#entryProduct'); const lastId = select.value; select.innerHTML = data.products.map(product => `<option value="${product.id}">${escapeHtml(product.name)} (${product.stock} in stock)</option>`).join(''); if (data.products.some(product => product.id === Number(lastId))) select.value = lastId;
  const account = $('#entryAccount'); const previous = account.value; account.innerHTML = data.accounts.filter(item => item.type === 'Cash & bank').map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join(''); if ([...account.options].some(option => option.value === previous)) account.value = previous;
  updateEntryHint();
}
function updateEntryHint() { const product = productById($('#entryProduct').value); if (!product) return; $('#entryPrice').value = product.price; $('#entryStockHint').innerHTML = entryType === 'sale' ? `<b>${product.stock} units</b> currently available. This sale will reduce stock.` : `<b>${product.stock} units</b> currently in stock. This purchase will add stock.`; }
function renderTransactions() {
  fillEntryForm(); $('#accountLabel').firstChild.textContent = entryType === 'sale' ? 'Paid into' : 'Paid from'; $('#entrySubmitText').textContent = entryType === 'sale' ? 'Record sale' : 'Record purchase';
  $('#transactionCountText').textContent = `${data.transactions.length} recorded movements`;
  $('#transactionTable').innerHTML = data.transactions.map(entry => `<tr><td><span class="entry-type ${entry.type}">${entry.type === 'sale' ? 'Sale' : 'Purchase'}</span></td><td><div class="ledger-entry"><strong>${escapeHtml(entry.product)}</strong><small>${escapeHtml(entry.note || 'No reference')}</small></div></td><td>${formatDate(entry.date)}</td><td>${escapeHtml(entry.account)}</td><td class="number">${entry.type === 'sale' ? '−' : '+'}${entry.qty}</td><td class="number"><b>${money(entry.qty * entry.price)}</b></td><td><span class="status good">Completed</span></td></tr>`).join('');
}

function renderLedger() {
  $('#ledgerCards').innerHTML = data.accounts.map(account => `<article class="ledger-card"><div class="ledger-card-top"><span class="account-icon">${account.icon || '◌'}</span><span>${escapeHtml(account.type)}</span></div><strong>${money(account.balance)}</strong><p>${escapeHtml(account.name)}</p></article>`).join('');
  const running = {}; data.accounts.forEach(account => running[account.name] = Number(account.balance));
  const rows = data.transactions.slice(0, 8).map(entry => { const amount = entry.qty * entry.price; const debit = entry.type === 'purchase' ? amount : 0; const credit = entry.type === 'sale' ? amount : 0; const account = accountByName(entry.account); return `<tr><td><div class="ledger-entry"><strong>${escapeHtml(entry.account)}</strong><small>${account?.type || 'Account'}</small></div></td><td><span class="entry-type ${entry.type}">${entry.type === 'sale' ? 'Sale receipt' : 'Purchase payment'}</span></td><td>${formatDate(entry.date)}</td><td>${escapeHtml(entry.note || '—')}</td><td class="number">${debit ? money(debit) : '—'}</td><td class="number">${credit ? money(credit) : '—'}</td><td class="number"><b>${money(account?.balance || 0)}</b></td></tr>`; }).join(''); $('#ledgerTable').innerHTML = rows || '<tr><td colspan="7" class="empty-cell">No ledger postings yet.</td></tr>';
}
function renderAll() { renderDashboard(); renderProducts(); renderTransactions(); renderLedger(); }

function openModal(id) { $(`#${id}`).classList.remove('hidden'); setTimeout(() => $(`#${id} input, #${id} select`)?.focus(), 20); }
function closeModal(id) { $(`#${id}`).classList.add('hidden'); $(`#${id} form`)?.reset(); const error = $(`#${id.replace('Modal', 'Error')}`); if (error) error.textContent = ''; }
function downloadCsv(filename, rows) { const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); showToast(`${filename} downloaded.`); }

function setupAppEvents() {
  $$('.nav-item').forEach(item => item.addEventListener('click', () => switchPage(item.dataset.page)));
  $$('[data-page-jump]').forEach(item => item.addEventListener('click', () => switchPage(item.dataset.pageJump)));
  $$('[data-action="view-ledger"]').forEach(item => item.addEventListener('click', () => switchPage('ledger')));
  $('#logoutButton').addEventListener('click', () => { if (new URLSearchParams(location.search).get('embedded') === '1') { window.top.location.href = '/admin/logout'; return; } StockFlowAPI.logout(); currentUser = null; $('#appView').classList.add('hidden'); $('#authView').classList.remove('hidden'); $('#loginForm').reset(); showToast('You have been signed out.'); });
  $('#quickEntry').addEventListener('click', () => switchPage('transactions'));
  $('#menuButton').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#backdrop').classList.add('visible'); }); $('#closeSidebar').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#backdrop').classList.remove('visible'); }); $('#backdrop').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#backdrop').classList.remove('visible'); });
  $('#helpButton').addEventListener('click', () => showToast('Tip: record a sale or purchase to update stock and the linked account.'));
  $('#newProductButton').addEventListener('click', () => openModal('productModal')); $('#newAccountButton').addEventListener('click', () => openModal('accountModal'));
  $$('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
  $$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop.id); }));
  $('#productSearch').addEventListener('input', renderProducts); $('#stockFilter').addEventListener('change', renderProducts);
  $('#productTable').addEventListener('click', event => { const button = event.target.closest('[data-restock]'); if (!button) return; const product = productById(button.dataset.restock); switchPage('transactions'); entryType = 'purchase'; $$('.entry-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.entryType === entryType)); renderTransactions(); $('#entryProduct').value = product.id; updateEntryHint(); $('#entryQuantity').focus(); showToast(`Ready to restock ${product.name}.`); });
  $('#exportProducts').addEventListener('click', () => downloadCsv('swaraj-agro-products.csv', [['Product','SKU','Category','In stock','Unit price','Reorder point'], ...data.products.map(p => [p.name,p.sku,p.category,p.stock,p.price,p.reorder])]));
  $('#downloadLedger').addEventListener('click', () => downloadCsv('swaraj-agro-ledger.csv', [['Type','Product','Date','Account','Quantity','Amount','Reference'], ...data.transactions.map(t => [t.type,t.product,t.date,t.account,t.qty,t.qty*t.price,t.note])]));
  $$('.entry-tab').forEach(tab => tab.addEventListener('click', () => { entryType = tab.dataset.entryType; $$('.entry-tab').forEach(item => item.classList.toggle('active', item === tab)); $('#transactionError').textContent = ''; renderTransactions(); }));
  $('#entryProduct').addEventListener('change', updateEntryHint);
  $('#transactionForm').addEventListener('submit', async event => { event.preventDefault(); const product = productById($('#entryProduct').value); const qty = Number($('#entryQuantity').value); const price = Number($('#entryPrice').value); const account = accountByName($('#entryAccount').value); if (!product || !qty || qty < 1 || !price || price < 1 || !account) { $('#transactionError').textContent = 'Please complete all required entry details.'; return; } if (entryType === 'sale' && qty > product.stock) { $('#transactionError').textContent = `Only ${product.stock} units of ${product.name} are available.`; return; }
    const submit = $('#transactionForm button[type="submit"]'); submit.disabled = true; $('#transactionError').textContent = '';
    try { await StockFlowAPI.recordTransaction({ companyId: data.activeCompany || 'machinery', type: entryType, productId: product.id, qty, price, accountName: account.name, date: $('#entryDate').value, note: $('#entryNote').value.trim() }); $('#transactionForm').reset(); $('#entryDate').value = new Date().toISOString().slice(0, 10); renderAll(); showToast(`${entryType === 'sale' ? 'Sale' : 'Purchase'} recorded. Stock and ledger updated.`); }
    catch (error) { $('#transactionError').textContent = error.message || 'Unable to record this entry.'; }
    finally { submit.disabled = false; }
  });
  $('#productForm').addEventListener('submit', event => { event.preventDefault(); const name = $('#newProductName').value.trim(); const sku = $('#newProductSku').value.trim().toUpperCase(); const category = $('#newProductCategory').value.trim(); const price = Number($('#newProductPrice').value); const stock = Number($('#newProductStock').value); const reorder = Number($('#newProductReorder').value); if (data.products.some(product => product.sku.toLowerCase() === sku.toLowerCase())) { $('#productError').textContent = 'That SKU is already in your catalogue.'; return; } if (!name || !sku || !category || price < 1 || stock < 0 || reorder < 0) { $('#productError').textContent = 'Please complete the product details.'; return; } data.products.unshift({ id: Date.now(), name, sku, category, price, stock, reorder, emoji: '◈' }); updateInventoryValue(); persist(); closeModal('productModal'); renderAll(); showToast(`${name} was added to your catalogue.`); });
  $('#accountForm').addEventListener('submit', event => { event.preventDefault(); const name = $('#newAccountName').value.trim(); const type = $('#newAccountType').value; const balance = Number($('#newAccountBalance').value); if (!name) { $('#accountError').textContent = 'Please enter an account name.'; return; } if (data.accounts.some(account => account.name.toLowerCase() === name.toLowerCase())) { $('#accountError').textContent = 'An account with this name already exists.'; return; } data.accounts.push({ id: Date.now(), name, type, balance, icon: '◌' }); persist(); closeModal('accountModal'); renderAll(); showToast(`${name} ledger account created.`); });
  $('#passwordForm').addEventListener('submit', async event => { event.preventDefault(); const current = $('#currentPassword').value; const next = $('#newPassword').value; const confirm = $('#confirmPassword').value; if (next.length < 6) { $('#passwordError').textContent = 'Use a new password with at least 6 characters.'; return; } if (next !== confirm) { $('#passwordError').textContent = 'The new passwords do not match.'; return; } try { await StockFlowAPI.changePassword(current, next); $('#passwordForm').reset(); $('#passwordError').textContent = ''; showToast('Administrator password updated successfully.'); } catch (error) { $('#passwordError').textContent = error.message || 'Unable to update password.'; } });
}

async function bootstrapEmbeddedAdmin() {
  try {
    const response = await fetch('/admin/stockflow-token', { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.token) throw new Error(payload.error || 'Admin session unavailable.');
    StockFlowAPI.useToken(payload.token);
    const workspacePayload = await StockFlowAPI.bootstrap();
    currentUser = workspacePayload.user.userId;
    data = workspacePayload.workspace;
    document.body.classList.add('embedded-admin');
    enterApp();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:30px;font-family:Inter,system-ui,sans-serif;color:#17263a;background:#f7f8fb"><section style="background:#fff;border:1px solid #e7ebf1;border-radius:16px;padding:28px;max-width:520px;box-shadow:0 14px 35px rgba(25,43,67,.08)"><h2 style="margin:0 0 8px">StockFlow admin session expired</h2><p style="color:#728097">Please return to the Swaraj Agro admin dashboard and open the StockFlow tab again.</p></section></main>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  $('#entryDate').value = new Date().toISOString().slice(0, 10);
  setupAuth(); setupAppEvents();
  const embedded = new URLSearchParams(location.search).get('embedded') === '1';
  if (embedded) {
    document.body.classList.add('embedded-admin');
    await bootstrapEmbeddedAdmin();
    return;
  }
  if (StockFlowAPI.token()) { try { const payload = await StockFlowAPI.bootstrap(); currentUser = payload.user.userId; data = payload.workspace; enterApp(); } catch { StockFlowAPI.logout(); } }
});
const baseEnterApp = enterApp;
enterApp = function () {
  baseEnterApp();
  $$('.admin-only-action').forEach(action => action.classList.toggle('hidden', !isAdmin()));
};
