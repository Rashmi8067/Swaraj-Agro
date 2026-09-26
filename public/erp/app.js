const S = {
  user: null,
  companies: [],
  companyId: localStorage.getItem('companyId') || '',
  data: { summary: {}, products: [], parties: [], documents: [], payments: [], expenses: [], accounts: [], entries: [] },
  theme: localStorage.getItem('swarajTheme') || localStorage.getItem('theme') || 'dark',
  menuPinned: localStorage.getItem('menuPinned') === '1',
  menuOpen: false,
  menuTimer: null,
  booted: false,
  previousPage: '#/dashboard'
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const money = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(v) || 0);
const numberFmt = v => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(v) || 0);
const today = () => new Date().toISOString().slice(0, 10);
const fyLabel = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${String(y).slice(-2)}-${String(y + 1).slice(-2)}`; };
const api = async (u, o = {}) => {
  const target = u.startsWith('/api/') ? `/erp-api${u.slice(4)}` : u;
  const headers = { 'Content-Type': 'application/json', ...(o.headers || {}) };
  if (localStorage.token) headers.Authorization = `Bearer ${localStorage.token}`;
  const r = await fetch(target, { ...o, headers, credentials:'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed ${r.status}`);
  return j;
};

function company() { return S.companies.find(c => c.id === S.companyId) || S.companies[0] || {}; }
function cVal(c, a, b, d = '') { return c?.[a] ?? c?.[b] ?? d; }
function setTheme() {
  document.documentElement.dataset.theme = S.theme;
  localStorage.setItem('theme', S.theme);
  localStorage.setItem('swarajTheme', S.theme);
  localStorage.setItem('swarajSiteTheme', S.theme);
  const button = $('#themeToggle');
  if (button) button.innerHTML = S.theme === 'dark' ? '☀' : '◐';
}
function toggleTheme() { S.theme = S.theme === 'dark' ? 'light' : 'dark'; setTheme(); render(); }
window.addEventListener('storage', e => { if (e.key === 'swarajTheme' && e.newValue && e.newValue !== S.theme) { S.theme = e.newValue; setTheme(); render(); } });
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function currentHash() { return location.hash || '#/dashboard'; }
function parts() { return currentHash().replace(/^#\//, '').split('/').filter(Boolean); }
function isDocRoute() { return ['gst-invoice', 'non-gst', 'quotation', 'proforma', 'delivery-challan', 'purchase-bill'].includes(parts()[1]); }
function docTypeFromRoute() {
  return { 'gst-invoice': 'invoice', 'non-gst': 'non_gst', quotation: 'quotation', proforma: 'proforma', 'delivery-challan': 'delivery_challan', 'purchase-bill': 'purchase' }[parts()[1]] || 'invoice';
}
function pageTitle() {
  const p = parts();
  if (p[0] === 'dashboard') return 'Overview';
  if (p[0] === 'billing' && !p[1]) return 'Billing workspace';
  if (p[0] === 'billing' && p[1]) return ({ 'gst-invoice': 'GST Tax Invoice', 'non-gst': 'Non-GST Cash Bill', quotation: 'Quotation', proforma: 'Proforma Invoice', 'delivery-challan': 'Delivery Challan' }[p[1]] || 'Billing');
  if (p[0] === 'purchases') return p[1] === 'purchase-bill' ? 'Purchase Bill' : 'Purchase register';
  if (p[0] === 'inventory') return 'Inventory & stock';
  if (p[0] === 'parties') return 'Customers & suppliers';
  if (p[0] === 'money') return 'Money & ledger';
  if (p[0] === 'reports') return 'Reports & analytics';
  if (p[0] === 'admin') return 'Admin control center';
  return 'Swaraj ERP';
}

async function boot() {
  setTheme();
  try {
    const b = await api('/api/bootstrap');
    S.user = b.user;
    S.siteSession = !!b.siteAdmin;
    if (S.siteSession) localStorage.removeItem('token');
    S.companies = b.companies || [];
    S.companyId = S.companies.some(c => c.id === S.companyId) ? S.companyId : (b.activeCompanyId || S.companies[0]?.id || '');
    localStorage.companyId = S.companyId;
    S.booted = true;
    await refresh();
    window.onhashchange = render;
    render();
  } catch (e) {
    localStorage.removeItem('token');
    S.booted = false;
    renderLogin(e.message);
  }
}

function renderLogin(error = '') {
  document.body.innerHTML = `
    <main class="login-shell">
      <div class="ambient a1"></div><div class="ambient a2"></div><div class="ambient a3"></div>
      <section class="login-panel">
        <div class="login-top"><div class="brand-lock"><span class="brand-mark">S</span><div><b>Swaraj ERP</b><small>Unified business control</small></div></div><button id="loginTheme" class="ghost-icon" title="Theme">${S.theme === 'dark' ? '☀' : '◐'}</button></div>
        <div class="login-grid">
          <div class="login-story"><span class="kicker">MULTI-COMPANY ERP</span><h1>Three businesses.<br><em>One operating system.</em></h1><p>Billing, stock, purchases, receivables, payables and reporting in a single workspace.</p><div class="story-stats"><span><b>3</b><small>companies</small></span><span><b>∞</b><small>documents</small></span><span><b>24/7</b><small>control</small></span></div></div>
          <form id="loginForm" class="login-form">
            <div><label>Email</label><input name="email" type="email" autocomplete="username" required></div>
            <div><label>Password</label><input name="password" type="password" autocomplete="current-password" placeholder="Enter password" required></div>
            <label class="checkline"><input type="checkbox" name="remember"><span>Remember this device for 30 days</span></label>
            <button class="button primary full" type="submit">Enter workspace <span>→</span></button>
            <div class="login-error">${esc(error)}</div>
            <small class="login-help">Website administrators can enter directly through the main Swaraj Agro admin login.</small>
          </form>
        </div>
      </section>
    </main>`;
  $('#loginTheme').onclick = () => { S.theme = S.theme === 'dark' ? 'light' : 'dark'; renderLogin(); setTheme(); };
  $('#loginForm').onsubmit = async e => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    try {
      const j = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(form) });
      localStorage.token = j.token;
      S.user = j.user;
      await boot();
    } catch (x) { $('.login-error').textContent = x.message; }
  };
}

function navTab(href, icon, label, tone) {
  const active = currentHash().startsWith(href);
  return `<a class="vtab ${active ? 'active' : ''}" data-href="${href}" style="--tab-tone:${tone}"><span class="vtab-icon">${icon}</span><span class="vtab-copy"><b>${label}</b><small>${label === 'Overview' ? 'Command center' : label === 'Billing' ? 'Sales documents' : label === 'Purchases' ? 'Vendor bills' : label === 'Inventory' ? 'Items & stock' : label === 'Parties' ? 'Contacts & balances' : label === 'Money' ? 'Receipts & ledger' : 'Business intelligence'}</small></span></a>`;
}

function render() {
  if (!S.booted) return renderLogin();
  document.title = `${pageTitle()} · Swaraj ERP`;
  document.body.innerHTML = `
    <div class="app" id="app">
      <aside class="vertical-nav ${S.menuPinned ? 'pinned' : ''} ${S.menuOpen ? 'open' : ''}" id="verticalNav">
        <div class="nav-head">
          <div class="brand-lock"><span class="brand-mark">S</span><div class="nav-brand-copy"><b>Swaraj ERP</b><small>Business OS</small></div></div>
          <button class="pin-button ${S.menuPinned ? 'on' : ''}" id="pinMenu" title="${S.menuPinned ? 'Unfreeze menu' : 'Freeze menu'}">${S.menuPinned ? '◀' : '▶'}</button>
        </div>
        <div class="company-card">
          <span class="company-code">${esc(company().code || 'SA')}</span>
          <div><b>${esc(company().name || 'Company')}</b><small>${esc(company().description || 'Workspace')}</small></div>
          <select id="companySelect" aria-label="Company">${S.companies.map(c => `<option value="${c.id}" ${c.id === S.companyId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        </div>
        <div class="vtab-label">WORKSPACE</div>
        <nav class="vtab-stack">
          ${navTab('#/dashboard', '⌂', 'Overview', '#8067ff')}
          ${navTab('#/billing', '₹', 'Billing', '#4f8cff')}
          ${navTab('#/purchases', '↓', 'Purchases', '#ff7b65')}
          ${navTab('#/inventory', '▦', 'Inventory', '#25c79a')}
          ${navTab('#/parties', '◎', 'Parties', '#f0ae43')}
          ${navTab('#/money', '◌', 'Money', '#58b7ff')}
          ${navTab('#/reports', '◔', 'Reports', '#ba6aff')}
        </nav>
        <div class="nav-bottom">
          <button id="logout" class="logout-row"><span>↪</span><div><b>Sign out</b><small>${esc(S.user?.email || '')}</small></div></button>
        </div>
      </aside>
      <div class="nav-edge" id="navEdge"></div>
      <main class="main-area">
        <header class="topbar">
          <div class="topbar-left">
            <button id="topMenu" class="circle-button" title="${S.menuPinned ? 'Unfreeze vertical tabs' : 'Freeze vertical tabs'}">☰</button>
            <div class="breadcrumbs"><span>Swaraj ERP</span><b>/</b><strong>${esc(pageTitle())}</strong></div>
          </div>
          <div class="topbar-center"><div class="company-pill"><span>${esc(company().code || 'SA')}</span><select id="topCompanySelect">${S.companies.map(c => `<option value="${c.id}" ${c.id === S.companyId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>
          <div class="topbar-right">
            <span class="fy-pill">FY ${fyLabel()}</span>
            <button id="themeToggle" class="circle-button" title="Switch theme">${S.theme === 'dark' ? '☀' : '◐'}</button>
            ${S.user?.isAdmin ? `<a class="top-admin" href="/admin">Website Admin</a>` : ''}

          </div>
        </header>
        <section id="page"></section>
      </main>
    </div>
    <div id="toastHost"></div>`;
  bindChrome();
  routeRender();
  setMenuState();
}

function bindChrome() {
  const changeCompany = async id => { if (!id) return; S.companyId = id; localStorage.companyId = id; await refresh(); go('#/dashboard'); };
  $('#companySelect').onchange = e => changeCompany(e.target.value);
  $('#topCompanySelect').onchange = e => changeCompany(e.target.value);
  $('#logout').onclick = () => { localStorage.removeItem('companyId'); if(S.siteSession) location.href='/admin/logout'; else { localStorage.removeItem('token'); location.reload(); } };
  $('#themeToggle').onclick = toggleTheme;
  $('#topMenu').onclick = () => { S.menuOpen = !S.menuOpen; setMenuState(); };
  $('#pinMenu').onclick = () => { S.menuOpen = !S.menuOpen; setMenuState(); };
  $$('.vtab,[data-href]').forEach(a => a.onclick = e => { const href = a.dataset.href || a.getAttribute('href'); if (href) { e.preventDefault(); go(href); } });
}
function mouseEdgeWatcher(e) {}
function openMenu() { S.menuOpen = true; setMenuState(); }
function scheduleMenuClose() {}
function toggleMenuPin() { S.menuOpen = !S.menuOpen; setMenuState(); }
function setMenuState() { $('#verticalNav')?.classList.toggle('pinned', S.menuPinned); $('#verticalNav')?.classList.toggle('open', S.menuOpen || S.menuPinned); const p = $('#pinMenu'); if (p) { p.classList.toggle('on', S.menuPinned); p.textContent = S.menuPinned ? '◀' : '▶'; } }
function showProfileMenu() {
  const old = $('.floating-menu'); if (old) old.remove();
  const el = document.createElement('div'); el.className = 'floating-menu'; el.innerHTML = `<button id="profilePassword">Change password</button><a href="#/admin/security">Login & security</a><button id="profileLogout">Sign out</button>`;
  document.body.appendChild(el);
  const r = $('#profileButton').getBoundingClientRect(); el.style.top = `${r.bottom + 8}px`; el.style.right = `${Math.max(12, window.innerWidth - r.right)}px`;
  $('#profilePassword').onclick = () => { el.remove(); go('#/admin/security'); };
  $('#profileLogout').onclick = () => { localStorage.removeItem('companyId'); if(S.siteSession) location.href='/admin/logout'; else { localStorage.removeItem('token'); location.reload(); } };
  setTimeout(() => document.addEventListener('click', function close(e) { if (!el.contains(e.target) && e.target.id !== 'profileButton') { el.remove(); document.removeEventListener('click', close); } }, { once: true }), 0);
}

async function refresh() {
  if (!S.companyId) return;
  try {
    const cid = encodeURIComponent(S.companyId);
    const [summary, products, parties, documents, payments, expenses, ledger] = await Promise.all([
      api(`/api/reports/summary?companyId=${cid}`), api(`/api/products?companyId=${cid}`), api(`/api/parties?companyId=${cid}`), api(`/api/documents?companyId=${cid}`), api(`/api/payments?companyId=${cid}`), api(`/api/expenses?companyId=${cid}`), api(`/api/ledger?companyId=${cid}`)
    ]);
    S.data = { summary: summary || {}, products: products.products || [], parties: parties.parties || [], documents: documents.documents || [], payments: payments.payments || [], expenses: expenses.expenses || [], accounts: ledger.accounts || [], entries: ledger.entries || [] };
  } catch (e) { toast(e.message, true); }
}

function routeRender() {
  const el = $('#page');
  if (!el) return;
  const p = parts();
  let html = '';
  if (p[0] === 'dashboard' || !p[0]) html = dashboardPage();
  else if (p[0] === 'billing' && !p[1]) html = billingHomePage();
  else if (p[0] === 'billing' && p[1] && p[2] === 'new') html = documentPage(docTypeFromRoute());
  else if (p[0] === 'billing' && p[1] && p[2] === 'all') html = documentAllPage(docTypeFromRoute());
  else if (p[0] === 'billing' && p[1]) html = documentChoicePage(docTypeFromRoute());
  else if (p[0] === 'purchases' && p[1] === 'purchase-bill' && p[2] === 'new') html = documentPage('purchase');
  else if (p[0] === 'purchases' && p[1] === 'purchase-bill' && p[2] === 'all') html = documentAllPage('purchase');
  else if (p[0] === 'purchases' && p[1] === 'purchase-bill') html = documentChoicePage('purchase');
  else if (p[0] === 'purchases') html = purchasePage();
  else if (p[0] === 'inventory' && p[1] === 'new') html = itemFormPage();
  else if (p[0] === 'inventory' && p[1] === 'edit') html = itemFormPage(p[2]);
  else if (p[0] === 'inventory' && p[1] === 'stock-in') html = stockPage('in');
  else if (p[0] === 'inventory' && p[1] === 'stock-out') html = stockPage('out');
  else if (p[0] === 'inventory') html = inventoryPage();
  else if (p[0] === 'parties' && p[1] === 'customer' && p[2] === 'new') html = partyFormPage('', 'customer');
  else if (p[0] === 'parties' && p[1] === 'supplier' && p[2] === 'new') html = partyFormPage('', 'supplier');
  else if (p[0] === 'parties' && p[1]) html = partyFormPage(p[1]);
  else if (p[0] === 'parties') html = partiesPage();
  else if (p[0] === 'money' && ['receive','pay','expense'].includes(p[1])) html = moneyFormPage(p[1]);
  else if (p[0] === 'money') html = moneyPage();
  else if (p[0] === 'reports') html = reportsPage();
  else if (p[0] === 'admin' && p[1] === 'company' && p[2]) html = companyFormPage(p[2]);
  else if (p[0] === 'admin' && p[1] === 'staff' && p[2] === 'new') html = staffFormPage();
  else if (p[0] === 'admin' && p[1] === 'staff' && p[2] === 'edit' && p[3]) html = staffFormPage(p[3]);
  else if (p[0] === 'admin' && p[1] === 'change-password') html = passwordPage();
  else if (p[0] === 'admin') html = adminPage(p[1] || 'companies');
  else html = dashboardPage();
  el.innerHTML = `<div class="page-transition">${html}</div>`;
  bindPage();
}

function pageHeader(eyebrow, title, sub, actions = '') { return `<div class="page-header"><div><span class="kicker">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="page-actions">${actions}</div></div>`; }
function button(label, href, cls = 'secondary') { return `<a class="button ${cls}" href="${href}">${label}</a>`; }
function statusBadge(s) { return `<span class="status ${s === 'posted' ? 'ok' : s === 'cancelled' ? 'bad' : 'neutral'}">${esc(s || 'posted')}</span>`; }
function docBadge(t) { const map = { invoice:['GST','gst'], non_gst:['CASH','cash'], quotation:['QUOTE','quote'], proforma:['PI','proforma'], delivery_challan:['DC','delivery'], purchase:['PURCHASE','purchase'], credit_note:['CN','credit'], debit_note:['DN','debit'] }; const x = map[t] || [String(t).toUpperCase(),'neutral']; return `<span class="doc-badge ${x[1]}">${x[0]}</span>`; }
function emptyState(title, text, href, action = 'Create') { return `<div class="empty-state"><div class="empty-glyph">＋</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${href ? button(action, href, 'primary') : ''}</div>`; }

function dashboardPage() {
  const d = S.data.summary || {}, c = company();
  const low = d.lowStock || [], recent = d.recentDocs || [];
  return pageHeader('COMMAND CENTER', 'Good morning, keep the business moving.', `${c.name} · ${c.description || ''}`, `${button('Billing desk', '#/billing', 'secondary')} ${button('New GST invoice', '#/billing/gst-invoice', 'primary')}`) + `
    <section class="hero-grid">
      <article class="hero-panel hero-main"><div><span class="hero-label">ACTIVE COMPANY</span><h2>${esc(c.name || 'Company')}</h2><p>Use routine billing as a single-entry workflow: choose the customer, pick the item, and let the ERP calculate tax, stock and settlement.</p></div><div class="hero-meta"><span>FY ${fyLabel()}</span><span>Auto numbering</span><span>Live stock</span></div></article>
      <article class="hero-panel hero-date"><span class="hero-label">TODAY</span><b>${new Intl.DateTimeFormat('en-IN',{weekday:'short',day:'2-digit',month:'short'}).format(new Date())}</b><small>${new Intl.DateTimeFormat('en-IN',{hour:'2-digit',minute:'2-digit'}).format(new Date())}</small></article>
    </section>
    <section class="metric-row">
      ${metric('Sales this month', money(d.salesAmount), `${d.sales?.c || 0} documents`, 'blue')}
      ${metric('Purchases this month', money(d.purchaseAmount), `${d.purchases?.c || 0} vendor bills`, 'orange')}
      ${metric('Inventory value', money(d.inventoryValue), `${d.productCount || 0} active SKUs`, 'green')}
      ${metric('Net cash movement', money((d.receipts || 0) - (d.paid || 0) - (d.expenses || 0)), 'Receipts − payments − expenses', 'purple')}
    </section>
    <section class="quick-strip"><div><span class="kicker">QUICK ACTIONS</span><b>Routine work without digging through menus.</b></div><div class="quick-links">${button('GST Sale', '#/billing/gst-invoice','quick-blue')}${button('Cash Bill', '#/billing/non-gst','quick-orange')}${button('Quotation', '#/billing/quotation','quick-purple')}${button('Purchase', '#/purchases/purchase-bill','quick-red')}</div></section>
    <section class="dashboard-grid"><article class="panel"><div class="panel-head"><div><span class="kicker">ATTENTION</span><h3>Low stock</h3></div><span class="counter">${low.length}</span></div>${low.length ? table(`<tr><th>Item</th><th>Stock</th><th>Minimum</th></tr>`, low.slice(0,8).map(p=>`<tr><td><b>${esc(p.name)}</b><small>${esc(p.sku || '—')}</small></td><td>${numberFmt(p.stock)} ${esc(p.unit || 'pcs')}</td><td>${numberFmt(p.minStock)}</td></tr>`).join('')) : emptyState('Stock looks healthy','No items are below their reorder level.')}</article>
      <article class="panel"><div class="panel-head"><div><span class="kicker">RECENT</span><h3>Latest documents</h3></div>${button('Open register','#/billing','text-link')}</div>${recent.length ? table(`<tr><th>Document</th><th>Type</th><th>Total</th></tr>`, recent.map(x=>`<tr><td><b>${esc(x.number)}</b><small>${esc(x.partyName || 'Walk-in')}</small></td><td>${docBadge(x.type)}</td><td>${money(x.total)}</td></tr>`).join('')) : emptyState('No documents yet','Your billing activity will appear here.')}</article></section>`;
}
function metric(name, value, sub, tone) { return `<article class="metric-card ${tone}"><span>${esc(name)}</span><b>${value}</b><small>${esc(sub)}</small></article>`; }
function table(head, rows) { return `<div class="table-scroll"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`; }

function billingHomePage() {
  const docs = S.data.documents.filter(d => ['invoice','non_gst','quotation','proforma','delivery_challan'].includes(d.type));
  return pageHeader('BILLING DESK', 'Create the document you need.', 'Tally/Marg-inspired simplicity: one document type per page, automatic numbering and automatic stock/tax handling.', button('New GST invoice','#/billing/gst-invoice','primary')) + `
    <section class="billing-cards">
      ${billingCard('invoice','GST Tax Invoice','#/billing/gst-invoice','Issue a tax invoice with HSN, GST, CGST/SGST or IGST.','GST','blue','→')}
      ${billingCard('non_gst','Non-GST Cash Bill','#/billing/non-gst','Fast cash / retail billing without tax components.','CASH','orange','＋')}
      ${billingCard('quotation','Quotation','#/billing/quotation','Price offer with no stock or ledger posting.','QUOTE','purple','✦')}
      ${billingCard('proforma','Proforma Invoice','#/billing/proforma','Pre-sale document for advance requests and approvals.','PI','cyan','◌')}
      ${billingCard('delivery_challan','Delivery Challan','#/billing/delivery-challan','Dispatch document without sales posting.','DC','green','□')}
      ${billingCard('purchase','Purchase Bill','#/purchases/purchase-bill','Record vendor bill and receive stock in one step.','PUR','red','↓')}
    </section>
    <section class="panel register-panel"><div class="panel-head"><div><span class="kicker">DOCUMENT REGISTER</span><h3>Recent billing</h3><small>${docs.length} documents in this company</small></div><div class="inline-tools"><input id="docSearch" placeholder="Search number or party"><select id="docFilter"><option value="all">All types</option><option value="invoice">GST</option><option value="non_gst">Cash</option><option value="quotation">Quotation</option><option value="proforma">Proforma</option><option value="delivery_challan">Delivery</option></select></div></div>${docs.length ? `<div id="docRegister">${billingRegisterRows(docs)}</div>` : emptyState('No billing documents','Start with a GST invoice or quotation.','#/billing/gst-invoice','Start billing')}</section>`;
}
function billingCard(type, title, href, text, badgeText, tone, icon) { return `<a class="billing-card ${tone}" href="${href}"><div class="billing-icon">${icon}</div><div class="billing-copy"><span>${badgeText}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div><strong>→</strong></a>`; }
function billingRegisterRows(docs) {
  return `<div class="table-scroll"><table><thead><tr><th>Number</th><th>Date</th><th>Type</th><th>Party</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${docs.map(d=>`<tr data-text="${esc(`${d.number} ${d.partyName || ''} ${d.type}`.toLowerCase())}" data-type="${esc(d.type)}"><td><b>${esc(d.number)}</b></td><td>${esc(d.date)}</td><td>${docBadge(d.type)}</td><td>${esc(d.partyName || 'Walk-in')}</td><td>${money(d.total)}</td><td>${statusBadge(d.status)}</td><td><button class="mini" data-download-pdf="${d.id}">PDF</button>${d.status !== 'cancelled' ? `<button class="mini danger" data-cancel-doc="${d.id}">Cancel</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

function documentMeta(type) {
  return {
    invoice:{title:'GST Tax Invoice',badge:'GST',tone:'blue',desc:'Issue a tax invoice with HSN, GST and stock posting.',filter:'invoice',newRoute:'#/billing/gst-invoice/new',allRoute:'#/billing/gst-invoice/all'},
    non_gst:{title:'Non-GST Cash Bill',badge:'CASH',tone:'orange',desc:'Fast cash or retail billing without tax components.',filter:'non_gst',newRoute:'#/billing/non-gst/new',allRoute:'#/billing/non-gst/all'},
    quotation:{title:'Quotation',badge:'QUOTE',tone:'purple',desc:'Price offer with no stock or ledger posting.',filter:'quotation',newRoute:'#/billing/quotation/new',allRoute:'#/billing/quotation/all'},
    proforma:{title:'Proforma Invoice',badge:'PI',tone:'cyan',desc:'Pre-sale document for advance requests and approvals.',filter:'proforma',newRoute:'#/billing/proforma/new',allRoute:'#/billing/proforma/all'},
    delivery_challan:{title:'Delivery Challan',badge:'DC',tone:'green',desc:'Dispatch document without sales posting.',filter:'delivery_challan',newRoute:'#/billing/delivery-challan/new',allRoute:'#/billing/delivery-challan/all'},
    purchase:{title:'Purchase Bill',badge:'PUR',tone:'red',desc:'Record a vendor bill and receive stock in one step.',filter:'purchase',newRoute:'#/purchases/purchase-bill/new',allRoute:'#/purchases/purchase-bill/all'}
  }[type] || {title:'Document',badge:'DOC',tone:'blue',desc:'Create and manage business documents.',filter:type,newRoute:'#/billing',allRoute:'#/billing'};
}
function documentChoicePage(type) {
  const m=documentMeta(type), docs=S.data.documents.filter(d=>d.type===m.filter).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const recent=docs.slice(0,3);
  return `<div class="doc-choice-page doc-choice-${m.tone}">
    <div class="document-head"><div><a href="#/billing" class="back-link">← Back to Billing</a><div class="doc-title-row"><span class="doc-page-mark">${m.badge}</span><div><span class="kicker">${esc(m.badge)} WORKSPACE</span><h1>${esc(m.title)}</h1><p>${esc(m.desc)}</p></div></div></div></div>
    <section class="choice-actions"><a class="choice-action primary-choice" href="${m.newRoute}"><span class="choice-icon">＋</span><div><b>Generate new</b><small>Create a new ${esc(m.title.toLowerCase())} with all available options.</small></div><strong>→</strong></a><a class="choice-action" href="${m.allRoute}"><span class="choice-icon">▤</span><div><b>View all</b><small>Open the complete ${esc(m.title.toLowerCase())} register and export PDFs.</small></div><strong>→</strong></a></section>
    <section class="panel recent-docs-choice"><div class="panel-head"><div><span class="kicker">RECENT</span><h3>Last 3 generated</h3><small>${docs.length} total in this company</small></div><a class="text-link" href="${m.allRoute}">View all →</a></div>${recent.length?`<div class="choice-recent-list">${recent.map(d=>`<div class="choice-recent-row"><div><b>${esc(d.number)}</b><small>${esc(d.partyName||'Walk-in')} · ${esc(d.date||'')}</small></div><strong>${money(d.total)}</strong><button class="mini" data-download-pdf="${esc(d.id)}">PDF</button></div>`).join('')}</div>`:emptyState('No documents yet',`No ${m.title.toLowerCase()}s have been generated for this company.`)}</section>
  </div>`;
}
function documentAllPage(type) {
  const m=documentMeta(type), docs=S.data.documents.filter(d=>d.type===m.filter).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const back = m.filter==='purchase' ? '#/purchases/purchase-bill' : `#/billing/${m.filter==='invoice'?'gst-invoice':m.filter}`;
  return `<div class="billing-subpage-shell">
    <div class="page-header billing-subpage-header"><div><a href="${back}" class="back-link">← Back</a><span class="kicker">DOCUMENT REGISTER</span><h1>All ${esc(m.title)}s</h1><p>View or export every generated document for this company.</p></div><div class="page-actions"><a class="button primary" href="${m.newRoute}">Generate new →</a></div></div>
    <section class="panel billing-register-panel"><div class="panel-head"><div><span class="kicker">${esc(m.badge)} · REGISTER</span><h3>Generated ${esc(m.title)}s</h3><small>${docs.length} document${docs.length===1?'':'s'} in this company</small></div></div>
      <div class="table-scroll"><table><thead><tr><th>Number</th><th>Date</th><th>Party</th><th>Total</th><th>Status</th><th>PDF</th></tr></thead><tbody>${docs.length?docs.map(d=>`<tr><td><b>${esc(d.number)}</b></td><td>${esc(d.date||'')}</td><td>${esc(d.partyName||'Walk-in')}</td><td>${money(d.total)}</td><td>${statusBadge(d.status)}</td><td><button class="mini" data-download-pdf="${esc(d.id)}">View / Export PDF</button></td></tr>`).join(''):`<tr><td colspan="6"><div class="empty-state"><h3>No documents yet</h3><p>Generate the first ${esc(m.title.toLowerCase())} for this company.</p></div></td></tr>`}</tbody></table></div>
    </section>
  </div>`;
}


function documentPage(type) {
  const cfg = {
    invoice: { tone:'doc-blue', eyebrow:'SALES · TAX INVOICE', title:'GST Tax Invoice', desc:'Tax invoice mode. Party tax details, GST split, HSN and stock posting are handled automatically.', tag:'GST', party:'customer', save:'Save & generate invoice', back:'#/billing' },
    non_gst: { tone:'doc-orange', eyebrow:'SALES · RETAIL', title:'Non-GST Cash Bill', desc:'A compact retail-style bill for quick cash sales. No GST components are posted.', tag:'CASH', party:'customer', save:'Save & generate cash bill', back:'#/billing' },
    quotation: { tone:'doc-purple', eyebrow:'SALES · COMMERCIAL OFFER', title:'Quotation', desc:'A pricing offer only. It does not reduce stock or post accounts until you create a sale.', tag:'QUOTE', party:'customer', save:'Save quotation', back:'#/billing' },
    proforma: { tone:'doc-cyan', eyebrow:'SALES · PRE-INVOICE', title:'Proforma Invoice', desc:'A pre-sale document for approvals and advance requests. No stock is posted.', tag:'PI', party:'customer', save:'Save proforma', back:'#/billing' },
    delivery_challan: { tone:'doc-green', eyebrow:'LOGISTICS · DISPATCH', title:'Delivery Challan', desc:'Dispatch documentation with vehicle and delivery references. It does not post a sale.', tag:'DC', party:'customer', save:'Save challan', back:'#/billing' },
    purchase: { tone:'doc-red', eyebrow:'PURCHASE · INWARD', title:'Purchase Bill', desc:'Vendor invoice entry. Posting receives stock and updates the purchase ledger in one step.', tag:'PUR', party:'supplier', save:'Post purchase bill', back:'#/purchases' }
  }[type];
  return `<div class="billing-subpage-shell document-page-clean ${cfg.tone} variant-${type}">
    <div class="document-head"><div><a href="${cfg.back}" class="back-link">← Back</a><div class="doc-title-row"><span class="doc-page-mark">${cfg.tag}</span><div><span class="kicker">${cfg.eyebrow}</span><h1>${cfg.title}</h1><p>${cfg.desc}</p></div></div></div><div class="doc-head-side"><span class="auto-pill">AUTO NUMBER</span><span class="fy-big">FY ${fyLabel()}</span></div></div>
    ${documentVariantBody(type, cfg)}
  </div>`;
}
function documentVariantBody(type, cfg) {
  const partyType=cfg.party;
  const parties=S.data.parties.filter(p=>p.type===partyType);
  const partySelect=`<select name="partyId" id="docParty"><option value="">${partyType==='supplier'?'Select supplier':'Walk-in / cash customer'}</option>${parties.map(p=>`<option value="${p.id}">${esc(p.name)}${p.gstin?` · ${esc(p.gstin)}`:''}</option>`).join('')}</select>`;
  const commonPlace=`<input name="place_of_supply" id="placeSupply" value="${esc(cVal(company(),'state','state','Odisha'))}">`;
  const items=`<section class="doc-section items-section"><div class="section-head"><div><span class="kicker">LINE ITEMS</span><h3>${type==='purchase'?'Received items':type==='delivery_challan'?'Dispatch items':'Document items'}</h3></div><a href="#/inventory" class="text-link">Manage items ↗</a></div><div id="docLines"></div><button type="button" class="add-line" id="addDocLine">＋ Add item</button></section>`;
  const notes=`<section class="doc-section"><div class="section-head"><div><span class="kicker">NOTES</span><h3>References & notes</h3></div></div><div class="form-grid"><div class="field full"><label>Notes</label><textarea name="notes" rows="3" placeholder="Optional note for the document"></textarea></div></div></section>`;
  const totals=`<section class="total-card"><span class="kicker">LIVE SUMMARY</span><div id="docSummary"></div><div class="grand-row"><span>Total</span><b id="docGrand">₹0.00</b></div></section>`;

  if(type==='invoice') return `<form id="documentForm" class="document-layout gst-layout" data-type="invoice"><section class="document-main"><section class="doc-section invoice-party"><div class="section-head"><div><span class="kicker">TAX INVOICE</span><h3>Customer & invoice details</h3></div><div class="tax-auto"><span>✓ GST auto split</span><span>✓ HSN from item</span></div></div><div class="form-grid"><div class="field span2"><label>Customer</label>${partySelect}</div><div class="field"><label>Invoice date</label><input name="date" type="date" value="${today()}"></div><div class="field"><label>Place of supply</label>${commonPlace}</div><div class="field"><label>Payment mode</label><select name="payment_mode" id="paymentMode"><option>Credit</option><option>Cash</option><option>Bank</option><option>UPI</option><option>Cheque</option></select></div><div class="field"><label>Due date</label><input name="due_date" id="dueDate" type="date" value="${today()}"></div><div class="field"><label>Reference</label><input name="ref_no" placeholder="PO / order ref"></div></div></section>${items}${notes}</section><aside class="document-side">${totals}<section class="payment-card"><div class="section-head"><div><span class="kicker">SETTLEMENT</span><h3>Payment</h3></div></div><label class="checkline large"><input type="checkbox" id="markPaid" name="mark_paid"><span><b>Mark invoice as paid</b><small>Automatically post the customer receipt.</small></span></label><label class="checkline large"><input type="checkbox" id="roundOff" name="round_off" checked><span><b>Round off</b><small>Round the final amount to the nearest rupee.</small></span></label></section><button class="button primary save-document full" type="submit">${cfg.save} <span>→</span></button><p class="form-note">Sales posting reduces stock and records the sales ledger automatically.</p></aside></form>`;

  if(type==='non_gst') return `<form id="documentForm" class="document-layout cash-layout" data-type="non_gst"><section class="document-main"><section class="cash-party"><div class="cash-party-title"><div><span class="kicker">FAST CASH SALE</span><h3>Who is buying?</h3></div><span class="cash-pill">NO GST</span></div><div class="cash-party-grid"><div class="field"><label>Customer (optional)</label>${partySelect}</div><div class="field"><label>Date</label><input name="date" type="date" value="${today()}"></div><div class="field"><label>Payment mode</label><select name="payment_mode" id="paymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Cheque</option><option>Credit</option></select></div><div class="field"><label>Reference</label><input name="ref_no" placeholder="Optional bill reference"></div><input type="hidden" name="place_of_supply" id="placeSupply" value="${esc(company().state||'Odisha')}"></div></section>${items}${notes}</section><aside class="document-side cash-side">${totals}<section class="cash-pay"><span class="kicker">QUICK SETTLEMENT</span><div class="cash-big" id="cashBig">₹0.00</div><label class="checkline large"><input type="checkbox" id="markPaid" name="mark_paid" checked><span><b>Paid now</b><small>Creates the receipt automatically.</small></span></label><label class="checkline large"><input type="checkbox" id="roundOff" name="round_off" checked><span><b>Round off</b><small>Neat retail total.</small></span></label></section><button class="button primary save-document full" type="submit">${cfg.save} <span>→</span></button></aside></form>`;

  if(type==='quotation') return `<form id="documentForm" class="document-layout quote-layout" data-type="quotation"><section class="document-main"><section class="quote-intro"><div class="quote-word">QUOTATION</div><div class="quote-sub">Commercial offer · no stock posting</div></section><section class="doc-section"><div class="form-grid"><div class="field span2"><label>Customer</label>${partySelect}</div><div class="field"><label>Quotation date</label><input name="date" type="date" value="${today()}"></div><div class="field"><label>Valid until</label><input name="valid_until" type="date" value="${today()}"></div><div class="field"><label>Place of supply</label>${commonPlace}</div><div class="field"><label>Reference</label><input name="ref_no" placeholder="Enquiry / requirement no."></div></div></section>${items}${notes}</section><aside class="document-side quote-side"><section class="offer-card"><span class="kicker">OFFER CONTROL</span><h3>Keep the offer flexible</h3><p>Quotation prices can be adjusted line by line. Saving it does not alter stock or ledger.</p><div class="offer-rule"><span>Tax</span><b>Shown for reference</b></div><div class="offer-rule"><span>Stock</span><b>Not posted</b></div></section>${totals}<button class="button primary save-document full" type="submit">${cfg.save} <span>→</span></button></aside></form>`;

  if(type==='proforma') return `<form id="documentForm" class="document-layout proforma-layout" data-type="proforma"><section class="document-main"><section class="proforma-banner"><div><span class="kicker">PROFORMA · PRE-SALE</span><h3>Advance-ready document</h3><p>Use it before a final invoice. No stock or ledger posting happens here.</p></div><span class="pi-seal">PI</span></section><section class="doc-section"><div class="form-grid"><div class="field span2"><label>Customer</label>${partySelect}</div><div class="field"><label>Date</label><input name="date" type="date" value="${today()}"></div><div class="field"><label>Advance %</label><input name="advance_percent" type="number" value="0" min="0" max="100" step="1"></div><div class="field"><label>Expected payment mode</label><select name="payment_mode"><option>Bank</option><option>UPI</option><option>Cash</option><option>Cheque</option></select></div><div class="field"><label>Place of supply</label>${commonPlace}</div><div class="field full"><label>Reference</label><input name="ref_no" placeholder="Order / approval reference"></div></div></section>${items}${notes}</section><aside class="document-side proforma-side"><section class="advance-card"><span class="kicker">ADVANCE EXPECTATION</span><div class="advance-value" id="advanceValue">₹0.00</div><small>Calculated from the current document total.</small></section>${totals}<button class="button primary save-document full" type="submit">${cfg.save} <span>→</span></button></aside></form>`;

  if(type==='delivery_challan') return `<form id="documentForm" class="document-layout challan-layout" data-type="delivery_challan"><section class="document-main"><section class="dispatch-banner"><div><span class="kicker">DISPATCH NOTE</span><h3>Move goods, not revenue</h3><p>This challan is a logistics document. It does not create a sale or reduce stock in this version.</p></div><span class="dispatch-mark">DC</span></section><section class="doc-section"><div class="form-grid"><div class="field span2"><label>Customer / consignee</label>${partySelect}</div><div class="field"><label>Challan date</label><input name="date" type="date" value="${today()}"></div><div class="field"><label>Delivery address</label><input name="delivery_address" placeholder="Destination / site"></div><div class="field"><label>Vehicle number</label><input name="vehicle_no" placeholder="OD-XX-XXXX"></div><div class="field"><label>E-way bill no.</label><input name="eway_bill_no" placeholder="Optional"></div><div class="field"><label>Reference</label><input name="ref_no" placeholder="Sales order / PO"></div><input type="hidden" name="place_of_supply" id="placeSupply" value="${esc(company().state||'Odisha')}"></div></section>${items}${notes}</section><aside class="document-side challan-side"><section class="dispatch-check"><span class="kicker">DISPATCH CHECK</span><div><b>Customer verified</b><span>Confirm party before saving.</span></div><div><b>Item quantities</b><span>Use this page only for logistics.</span></div><div><b>Stock posting</b><span>Not changed by challan.</span></div></section>${totals}<button class="button primary save-document full" type="submit">${cfg.save} <span>→</span></button></aside></form>`;

  return `<form id="documentForm" class="document-layout purchase-layout" data-type="purchase"><section class="document-main"><section class="purchase-banner"><div><span class="kicker">INWARD ENTRY</span><h3>Receive the supplier bill once.</h3><p>Posting this bill increases stock and creates the purchase ledger entry.</p></div><span class="purchase-mark">PUR</span></section><section class="doc-section"><div class="form-grid"><div class="field span2"><label>Supplier</label>${partySelect}</div><div class="field"><label>Bill date</label><input name="date" type="date" value="${today()}"></div><div class="field"><label>Supplier invoice no.</label><input name="ref_no" placeholder="Vendor invoice number"></div><div class="field"><label>Place of supply</label>${commonPlace}</div><div class="field"><label>Payment mode</label><select name="payment_mode" id="paymentMode"><option>Credit</option><option>Bank</option><option>UPI</option><option>Cash</option><option>Cheque</option></select></div><div class="field"><label>Due date</label><input name="due_date" id="dueDate" type="date" value="${today()}"></div></div></section>${items}${notes}</section><aside class="document-side purchase-side">${totals}<section class="payment-card"><div class="section-head"><div><span class="kicker">PAYABLE</span><h3>Supplier settlement</h3></div></div><label class="checkline large"><input type="checkbox" id="markPaid" name="mark_paid"><span><b>Paid supplier now</b><small>Automatically record the payment.</small></span></label><label class="checkline large"><input type="checkbox" id="roundOff" name="round_off" checked><span><b>Round off</b><small>Round the purchase total.</small></span></label></section><button class="button primary save-document full" type="submit">${cfg.save} <span>→</span></button><p class="form-note">Purchase posting increases stock and updates the purchase ledger.</p></aside></form>`;
}
function addLineRow(type, preset = {}) {
  const host = $('#docLines'); if (!host) return;
  const row = document.createElement('div'); row.className = 'doc-line';
  row.innerHTML = `<div class="field"><label>Item</label><select class="line-product"><option value="">Select item</option>${S.data.products.map(p=>`<option value="${p.id}" ${p.id===preset.productId?'selected':''}>${esc(p.name)}${p.sku ? ` · ${esc(p.sku)}` : ''}</option>`).join('')}</select></div><div class="field"><label>Qty</label><input class="line-qty" type="number" min="0.01" step="any" value="${preset.qty || 1}"></div><div class="field"><label>Rate</label><input class="line-price" type="number" min="0" step="0.01" value="${preset.price || 0}"></div><div class="field"><label>Discount</label><input class="line-discount" type="number" min="0" step="0.01" value="0"></div><div class="line-actions"><button type="button" class="remove-line">×</button></div>`;
  host.appendChild(row);
  const select = $('.line-product', row);
  select.onchange = () => { const p = S.data.products.find(x => x.id === select.value); if (p) $('.line-price', row).value = type === 'purchase' ? Number(p.purchasePrice || 0) : Number(p.salePrice || 0); updateDocSummary(type); };
  $$('.line-qty,.line-price,.line-discount', row).forEach(i => i.oninput = () => updateDocSummary(type));
  $('.remove-line', row).onclick = () => { row.remove(); updateDocSummary(type); };
  if (preset.productId) select.dispatchEvent(new Event('change')); else updateDocSummary(type);
}
function updateDocSummary(type) {
  const c = company(); let subtotal = 0, discount = 0, cgst = 0, sgst = 0, igst = 0;
  const place = ($('#placeSupply')?.value || '').trim().toLowerCase(); const state = String(cVal(c,'state','state','')).toLowerCase(); const code = String(cVal(c,'stateCode','state_code','')).toLowerCase();
  const same = !place || place === state || place === code;
  $$('.doc-line').forEach(row => { const p = S.data.products.find(x => x.id === $('.line-product',row)?.value); const qty = Number($('.line-qty',row)?.value)||0; const price = Number($('.line-price',row)?.value)||0; const disc = Number($('.line-discount',row)?.value)||0; const base = Math.max(0, qty*price-disc); subtotal += qty*price; discount += disc; if (p && type === 'invoice') { const rate = Number(p.gstRate)||0; if (same) { cgst += base*rate/200; sgst += base*rate/200; } else igst += base*rate/100; } });
  const taxable = Math.max(0, subtotal-discount), raw = taxable+cgst+sgst+igst, rounded = $('#roundOff')?.checked === false ? raw : Math.round(raw), round = rounded-raw, total = rounded;
  const summary = $('#docSummary'); if (!summary) return;
  summary.innerHTML = `<div class="sum-line"><span>Subtotal</span><b>${money(subtotal)}</b></div><div class="sum-line"><span>Discount</span><b>${money(discount)}</b></div>${type==='invoice' ? `${cgst||sgst ? `<div class="sum-line"><span>CGST</span><b>${money(cgst)}</b></div><div class="sum-line"><span>SGST</span><b>${money(sgst)}</b></div>` : ''}${igst ? `<div class="sum-line"><span>IGST</span><b>${money(igst)}</b></div>`:''}` : `<div class="sum-line"><span>Tax</span><b>${money(0)}</b></div>`}<div class="sum-line"><span>Round off</span><b>${money(round)}</b></div>`;
  $('#docGrand').textContent = money(total);
  if ($('#cashBig')) $('#cashBig').textContent = money(total);
  if ($('#advanceValue')) { const pct = Number($('[name=advance_percent]')?.value || 0); $('#advanceValue').textContent = money(total * Math.max(0, Math.min(100, pct)) / 100); }
}
function collectDocument(type) {
  const form = $('#documentForm'); const f = new FormData(form); const items = $$('.doc-line').map(row => { const p = S.data.products.find(x => x.id === $('.line-product',row).value); if (!p) return null; return { product_id:p.id, name:p.name, hsn:p.hsn, unit:p.unit, qty:Number($('.line-qty',row).value)||0, unit_price:Number($('.line-price',row).value)||0, discount:Number($('.line-discount',row).value)||0, gst_rate:type==='invoice'?Number(p.gstRate||0):0 }; }).filter(Boolean);
  const metadata = {};
  for (const [key, name] of [['validUntil','valid_until'],['advancePercent','advance_percent'],['deliveryAddress','delivery_address'],['vehicleNo','vehicle_no']]) if (f.get(name)) metadata[key] = f.get(name);
  return { ...Object.fromEntries(f), companyId:S.companyId, type, items, mark_paid:f.get('mark_paid') === 'on', round_off:f.get('round_off') === 'on', metadata };
}

function purchasePage() {
  const docs = S.data.documents.filter(d=>d.type==='purchase');
  return pageHeader('PURCHASE CONTROL','Purchase register','Track supplier bills, stock receipts and open supplier balances.',button('New purchase','#/purchases/purchase-bill','primary')) + `<section class="register-banner red"><div><span class="kicker">ONE-ENTRY RECEIVING</span><b>Post the vendor bill once.</b><small>Stock, purchase ledger and payable movement happen together.</small></div><div class="banner-stat"><b>${docs.length}</b><span>purchase bills</span></div></section><section class="panel register-panel"><div class="panel-head"><div><span class="kicker">PURCHASE REGISTER</span><h3>Supplier bills</h3></div><input id="purchaseSearch" placeholder="Search bill or supplier"></div>${docs.length?`<div id="purchaseRegister">${billingRegisterRows(docs)}</div>`:emptyState('No purchase bills','Receive your first stock inward.','#/purchases/purchase-bill','Record purchase')}</section>`;
}

function inventoryPage() {
  const ps = S.data.products; const value = ps.reduce((s,p)=>s+(Number(p.stock_value)||0),0); const units = ps.reduce((s,p)=>s+(Number(p.stock)||0),0); const low=ps.filter(p=>p.minStock>0&&p.stock<=p.minStock);
  return pageHeader('INVENTORY','Items, stock and reorder control','Maintain a simple item master with automatic stock movement from billing.',`${button('Stock in','#/inventory/stock-in','secondary')} ${button('Stock out','#/inventory/stock-out','secondary')} ${button('New item','#/inventory/new','primary')}`)+`<section class="inventory-stats">${metric('Active SKUs',ps.length,'Products in this company','blue')}${metric('Units in stock',numberFmt(units),'Across all SKUs','green')}${metric('Stock value',money(value),'At purchase cost','purple')}${metric('Low-stock items',low.length,'Needs attention','orange')}</section><section class="panel"><div class="panel-head"><div><span class="kicker">ITEM MASTER</span><h3>Products</h3></div><input id="productSearch" placeholder="Search SKU, item or category"></div><div class="table-scroll"><table id="productTable"><thead><tr><th>Item</th><th>SKU</th><th>Category</th><th>Stock</th><th>Purchase</th><th>Sale</th><th>GST</th><th></th></tr></thead><tbody>${ps.map(p=>`<tr data-text="${esc(`${p.name} ${p.sku||''} ${p.category||''}`.toLowerCase())}"><td><b>${esc(p.name)}</b><small>${esc(p.hsn||'No HSN')}</small></td><td>${esc(p.sku||'—')}</td><td>${esc(p.category||'—')}</td><td class="${p.minStock>0&&p.stock<=p.minStock?'low-number':''}">${numberFmt(p.stock)} ${esc(p.unit||'pcs')}</td><td>${money(p.purchasePrice)}</td><td>${money(p.salePrice)}</td><td>${numberFmt(p.gstRate)}%</td><td><a class="mini" href="#/inventory/edit/${p.id}">Edit</a></td></tr>`).join('')}</tbody></table></div></section>`;
}

function itemFormPage(id='') {
  const p = S.data.products.find(x=>x.id===id) || {};
  return pageHeader(id?'ITEM MASTER':'NEW ITEM',id?'Edit product':'Create a product', 'Set the price, tax and reorder settings used by automatic billing.',button('Back to inventory','#/inventory','secondary')) + `<section class="form-page"><form id="productForm" class="panel form-card"><div class="section-head"><div><span class="kicker">MASTER DATA</span><h3>${id?'Edit':'New'} product</h3></div></div><div class="form-grid"><div class="field span2"><label>Product name</label><input name="name" required value="${esc(p.name||'')}"></div><div class="field"><label>SKU / code</label><input name="sku" value="${esc(p.sku||'')}"></div><div class="field"><label>Category</label><input name="category" value="${esc(p.category||'')}"></div><div class="field"><label>HSN</label><input name="hsn" value="${esc(p.hsn||'')}"></div><div class="field"><label>Unit</label><input name="unit" value="${esc(p.unit||'pcs')}"></div><div class="field"><label>GST rate %</label><input name="gst_rate" type="number" step="0.01" value="${p.gstRate??18}"></div><div class="field"><label>Purchase price</label><input name="purchase_price" type="number" step="0.01" value="${p.purchasePrice??0}"></div><div class="field"><label>Sale price</label><input name="sale_price" type="number" step="0.01" value="${p.salePrice??0}"></div><div class="field"><label>Minimum stock</label><input name="min_stock" type="number" step="0.01" value="${p.minStock??0}"></div>${id?'':'<div class="field"><label>Opening quantity</label><input name="opening_qty" type="number" step="0.01" value="0"></div><div class="field"><label>Opening value</label><input name="opening_value" type="number" step="0.01" value="0"></div>'}</div><div class="form-actions"><a href="#/inventory" class="button secondary">Cancel</a><button class="button primary" type="submit">Save product</button></div></form></section>`;
}

function stockPage(type) {
  const isOut = type === 'out';
  return pageHeader(isOut?'STOCK OUT':'STOCK IN',isOut?'Issue stock manually':'Receive stock manually','Use this only for adjustments, transfers or opening corrections; normal sales and purchases update stock automatically.',button('Back to inventory','#/inventory','secondary')) + `<section class="form-page"><form id="stockForm" class="panel form-card"><div class="section-head"><div><span class="kicker">MANUAL ADJUSTMENT</span><h3>${isOut?'Reduce':'Increase'} stock</h3></div></div><div class="form-grid"><div class="field span2"><label>Item</label><select name="productId" required>${S.data.products.map(p=>`<option value="${p.id}">${esc(p.name)} · ${numberFmt(p.stock)} ${esc(p.unit||'pcs')}</option>`).join('')}</select></div><div class="field"><label>Quantity</label><input name="qty" type="number" step="0.01" min="0.01" required></div><div class="field"><label>Date</label><input name="date" type="date" value="${today()}"></div><div class="field span2"><label>Reason / note</label><input name="note" placeholder="Physical count, transfer, damaged stock..."></div></div><div class="form-actions"><a href="#/inventory" class="button secondary">Cancel</a><button class="button ${isOut?'danger':'primary'}" type="submit">Post stock ${isOut?'out':'in'}</button></div></form></section>`;
}

function partiesPage() {
  const customers=S.data.parties.filter(p=>p.type==='customer'), suppliers=S.data.parties.filter(p=>p.type==='supplier');
  return pageHeader('PARTY MASTER','Customers & suppliers','Keep tax details, contact information and open balances in one place.',`${button('Customer','#/parties/customer/new','secondary')} ${button('Supplier','#/parties/supplier/new','primary')}`)+`<section class="party-tabs"><div class="party-summary"><b>${customers.length}</b><span>customers</span></div><div class="party-summary"><b>${suppliers.length}</b><span>suppliers</span></div><div class="party-summary"><b>${money(customers.reduce((s,p)=>s+Math.max(0,p.outstanding),0))}</b><span>receivable</span></div><div class="party-summary"><b>${money(suppliers.reduce((s,p)=>s+Math.max(0,p.outstanding),0))}</b><span>payable</span></div></section><section class="panel"><div class="panel-head"><div><span class="kicker">CUSTOMERS & SUPPLIERS</span><h3>Party register</h3></div><input id="partySearch" placeholder="Search name, phone, GSTIN"></div><div class="table-scroll"><table id="partyTable"><thead><tr><th>Party</th><th>Type</th><th>Phone</th><th>GSTIN</th><th>Outstanding</th><th></th></tr></thead><tbody>${S.data.parties.map(p=>`<tr data-text="${esc(`${p.name} ${p.phone||''} ${p.gstin||''}`.toLowerCase())}"><td><b>${esc(p.name)}</b><small>${esc(p.address||'')}</small></td><td><span class="party-type ${p.type}">${p.type}</span></td><td>${esc(p.phone||'—')}</td><td>${esc(p.gstin||'—')}</td><td>${money(p.outstanding)}</td><td><a class="mini" href="#/parties/${p.id}">Open</a></td></tr>`).join('')}</tbody></table></div></section>`;
}
function partyFormPage(id='', type='customer') {
  const p=S.data.parties.find(x=>x.id===id)||{}; type=p.type||type;
  return pageHeader(id?'PARTY MASTER':'NEW PARTY',id?`Edit ${type}`:`Create ${type}`,'Customer and supplier details are reused automatically in billing.',button('Back to parties','#/parties','secondary'))+`<section class="form-page"><form id="partyForm" class="panel form-card"><div class="section-head"><div><span class="kicker">${type.toUpperCase()}</span><h3>${id?'Edit':'New'} party</h3></div></div><div class="form-grid"><div class="field span2"><label>Name</label><input name="name" required value="${esc(p.name||'')}"></div><div class="field"><label>Phone</label><input name="phone" value="${esc(p.phone||'')}"></div><div class="field"><label>Email</label><input name="email" value="${esc(p.email||'')}"></div><div class="field"><label>GSTIN</label><input name="gstin" value="${esc(p.gstin||'')}"></div><div class="field"><label>State</label><input name="state" value="${esc(p.state||company().state||'Odisha')}"></div><div class="field"><label>State code</label><input name="state_code" value="${esc(p.stateCode||company().state_code||'21')}"></div><div class="field"><label>PIN</label><input name="pin" value="${esc(p.pin||'')}"></div><div class="field full"><label>Address</label><textarea name="address" rows="3">${esc(p.address||'')}</textarea></div><div class="field"><label>Opening balance</label><input name="opening_balance" type="number" step="0.01" value="${p.openingBalance??0}"></div><div class="field full"><label>Notes</label><textarea name="notes" rows="2">${esc(p.notes||'')}</textarea></div></div><div class="form-actions"><a href="#/parties" class="button secondary">Cancel</a><button class="button primary">Save party</button></div></form></section>`;
}

function moneyPage() {
  const receipts=S.data.payments.filter(x=>x.type==='receipt'), payments=S.data.payments.filter(x=>x.type==='payment');
  return pageHeader('MONEY','Receipts, payments and ledger','Simple cash/bank control for settlements that happen after documents are posted.',`${button('Receive money','#/money/receive','primary')} ${button('Pay supplier','#/money/pay','secondary')} ${S.user?.isAdmin?button('Add expense','#/money/expense','secondary'):''}`)+`<section class="money-grid">${metric('Receipts',money(receipts.reduce((s,x)=>s+x.amount,0)),'All customer receipts','green')}${metric('Payments',money(payments.reduce((s,x)=>s+x.amount,0)),'All supplier payments','orange')}${metric('Expenses',money(S.data.expenses.reduce((s,x)=>s+x.amount,0)),'Recorded overheads','purple')}${metric('Ledger entries',S.data.entries.length,'Recent accounting activity','blue')}</section><section class="panel"><div class="panel-head"><div><span class="kicker">LEDGER ACCOUNTS</span><h3>Account balances</h3></div></div><div class="account-grid">${S.data.accounts.map(a=>`<article class="account-card"><span>${esc(a.type)}</span><b>${esc(a.name)}</b><strong>${money(a.balance)}</strong></article>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="kicker">RECENT MONEY MOVEMENTS</span><h3>Payments & receipts</h3></div></div>${S.data.payments.length?table(`<tr><th>Date</th><th>Party</th><th>Type</th><th>Mode</th><th>Amount</th></tr>`,S.data.payments.slice(0,30).map(p=>`<tr><td>${esc(p.date)}</td><td><b>${esc(p.partyName||'—')}</b><small>${esc(p.reference||'')}</small></td><td>${esc(p.type)}</td><td>${esc(p.mode||'')}</td><td>${money(p.amount)}</td></tr>`).join('')):emptyState('No money movements','Receipts and payments will appear here.')}</section>`;
}
function moneyFormPage(mode) {
  if (mode==='expense' && !S.user?.isAdmin) return pageHeader('MONEY','Access restricted','Only administrators can post expenses.');
  const isReceipt=mode==='receive'; const partyType=isReceipt?'customer':'supplier'; const title=isReceipt?'Receive money':'Pay supplier';
  if(mode==='expense') return pageHeader('MONEY','Add expense','Post a cash/bank expense into the company ledger.',button('Back to money','#/money','secondary'))+`<section class="form-page"><form id="expenseForm" class="panel form-card"><div class="form-grid"><div class="field"><label>Category</label><input name="category" required placeholder="Fuel, salary, travel..."></div><div class="field"><label>Amount</label><input name="amount" type="number" step="0.01" required></div><div class="field"><label>Date</label><input name="date" type="date" value="${today()}"></div><div class="field"><label>Mode</label><select name="mode"><option>Cash</option><option>Bank</option><option>UPI</option></select></div><div class="field full"><label>Note</label><textarea name="note" rows="3"></textarea></div></div><div class="form-actions"><a class="button secondary" href="#/money">Cancel</a><button class="button primary">Save expense</button></div></form></section>`;
  return pageHeader('MONEY',title,'Record the settlement and update the counterparty balance.',button('Back to money','#/money','secondary'))+`<section class="form-page"><form id="paymentForm" class="panel form-card"><div class="form-grid"><div class="field span2"><label>Party</label><select name="partyId" required>${S.data.parties.filter(p=>p.type===partyType).map(p=>`<option value="${p.id}">${esc(p.name)} · ${money(p.outstanding)}</option>`).join('')}</select></div><div class="field"><label>Amount</label><input name="amount" type="number" step="0.01" required></div><div class="field"><label>Date</label><input name="date" type="date" value="${today()}"></div><div class="field"><label>Mode</label><select name="mode"><option>Cash</option><option>Bank</option><option>UPI</option><option>Cheque</option></select></div><div class="field"><label>Reference</label><input name="reference"></div><div class="field full"><label>Note</label><textarea name="note" rows="3"></textarea></div></div><div class="form-actions"><a class="button secondary" href="#/money">Cancel</a><button class="button primary">${title}</button></div></form></section>`;
}

function reportsPage() {
  const d=S.data.summary||{}; const sales=S.data.documents.filter(x=>['invoice','non_gst'].includes(x.type)&&x.status!=='cancelled'); const purch=S.data.documents.filter(x=>x.type==='purchase'&&x.status!=='cancelled');
  const topProducts=[...S.data.products].sort((a,b)=>b.stock_value-a.stock_value).slice(0,8); const max=Math.max(1,...topProducts.map(p=>Number(p.stock_value)||0));
  return pageHeader('REPORTS','Business intelligence','A compact view of sales, purchases, inventory and cash movement.',button('Refresh','#/reports','secondary'))+`<section class="report-hero"><div><span class="kicker">CURRENT MONTH</span><h2>${money(d.salesAmount)}</h2><p>Sales across GST and non-GST bills</p></div><div><span>Purchases</span><b>${money(d.purchaseAmount)}</b></div><div><span>Inventory</span><b>${money(d.inventoryValue)}</b></div><div><span>Net cash</span><b>${money((d.receipts||0)-(d.paid||0)-(d.expenses||0))}</b></div></section><section class="reports-grid"><article class="panel"><div class="panel-head"><div><span class="kicker">INVENTORY VALUE</span><h3>Top items by stock value</h3></div></div><div class="bar-list">${topProducts.map(p=>`<div><div class="bar-meta"><span>${esc(p.name)}</span><b>${money(p.stock_value)}</b></div><div class="bar"><i style="width:${Math.round((Number(p.stock_value)||0)/max*100)}%"></i></div></div>`).join('')}</div></article><article class="panel"><div class="panel-head"><div><span class="kicker">VOLUME</span><h3>Document count</h3></div></div><div class="report-big"><b>${sales.length}</b><span>sales documents</span></div><div class="report-note"><span>Purchase bills</span><b>${purch.length}</b></div><div class="report-note"><span>Quotations</span><b>${S.data.documents.filter(x=>x.type==='quotation').length}</b></div><div class="report-note"><span>Proforma invoices</span><b>${S.data.documents.filter(x=>x.type==='proforma').length}</b></div></article></section>`;
}

function adminPage(tab='companies') {
  if (!S.user?.isAdmin) return pageHeader('ADMIN','Access denied','Administrator access required.',button('Back','#/dashboard','secondary'));
  return pageHeader('ADMIN CONTROL','Settings stay outside the operating menu.','Manage company profiles, staff, security and data.',`<nav class="admin-links">${['companies','staff','security','audit','data'].map(x=>`<a href="#/admin/${x}" class="${tab===x?'active':''}">${({companies:'Companies',staff:'Staff access',security:'Security',audit:'Audit log',data:'Backup & restore'}[x])}</a>`).join('')}</nav>`)+adminBody(tab);
}
function adminBody(tab) {
  if(tab==='companies') return `<section class="company-grid">${S.companies.map(c=>`<article class="company-setting"><div class="company-setting-head"><div class="company-badge">${esc(c.code||'CO')}</div><div><span class="kicker">${esc(c.code||'COMPANY')}</span><h3>${esc(c.name)}</h3><p>${esc(c.description||'')}</p></div></div><div class="setting-grid"><span>GSTIN</span><b>${esc(c.gstin||'—')}</b><span>Phone</span><b>${esc(c.phone||'—')}</b><span>Bank</span><b>${esc(cVal(c,'bankName','bank_name','—'))}</b></div><a class="button secondary full" href="#/admin/company/${c.id}">Customize company</a></article>`).join('')}</section>`;
  if(tab==='staff') return staffAdminPage();
  if(tab==='security') return securityAdminPage();
  if(tab==='audit') return auditAdminPage();
  return dataAdminPage();
}
function staffAdminPage(){ return `<section class="panel"><div class="panel-head"><div><span class="kicker">ACCESS CONTROL</span><h3>Staff users</h3></div><a href="#/admin/staff/new" class="button primary">＋ Add staff</a></div><div id="staffList"><div class="loading">Loading staff…</div></div></section>`; }
async function loadStaff(){ const host=$('#staffList'); if(!host)return; try{ const j=await api('/api/users'); host.innerHTML=table(`<tr><th>Name</th><th>Email</th><th>Role</th><th>Sales</th><th>Purchases</th><th>Amounts</th><th></th></tr>`,j.users.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.permissions?.recordSales?'Yes':'No'}</td><td>${u.permissions?.recordPurchases?'Yes':'No'}</td><td>${u.permissions?.viewAmounts?'Yes':'No'}</td><td><a class="mini" href="#/admin/staff/edit/${u.id}">Edit</a></td></tr>`).join('')); } catch(e){ host.innerHTML=`<div class="error-box">${esc(e.message)}</div>`; } }
function staffFormPage(id=''){ return `<div class="form-page"><a class="back-link" href="#/admin/staff">← Back to staff</a><section class="panel form-card"><div class="section-head"><div><span class="kicker">ACCESS CONTROL</span><h3>${id?'Edit staff':'Add staff user'}</h3></div></div><div id="staffFormMount"><div class="loading">Loading…</div></div></section></div>`; }
async function loadStaffForm(id=''){const host=$('#staffFormMount'); if(!host)return; let u={}; if(id){const j=await api('/api/users'); u=j.users.find(x=>x.id===id)||{};} host.innerHTML=`<form id="staffForm" class="form-grid"><div class="field"><label>Name</label><input name="name" required value="${esc(u.name||'')}"></div><div class="field"><label>Email</label><input name="email" type="email" required value="${esc(u.email||'')}"></div><div class="field"><label>Role</label><input name="role" value="${esc(u.role||'Staff')}"></div><div class="field"><label>${id?'New password (optional)':'Password'}</label><input name="password" type="password" ${id?'':'required'}></div>${[['recordSales','Record sales',true],['recordPurchases','Record purchases',true],['viewAmounts','View financial amounts',false],['manageProducts','Manage products',false],['managePayments','Manage payments',false],['manageSettings','Manage settings',false]].map(x=>`<label class="check-card"><input name="${x[0]}" type="checkbox" ${(u.permissions?.[x[0]] ?? x[2])?'checked':''}><span><b>${x[1]}</b><small>Permission</small></span></label>`).join('')}<div class="form-actions full"><a href="#/admin/staff" class="button secondary">Cancel</a><button class="button primary">Save access</button></div></form>`; $('#staffForm').onsubmit=async e=>{e.preventDefault(); const f=new FormData(e.target); const b={name:f.get('name'),email:f.get('email'),role:f.get('role'),permissions:{}}; for(const k of ['recordSales','recordPurchases','viewAmounts','manageProducts','managePayments','manageSettings']) b.permissions[k]=f.get(k)==='on'; if(f.get('password'))b.password=f.get('password'); try{await api(id?`/api/users/${id}`:'/api/users',{method:id?'PATCH':'POST',body:JSON.stringify(b)});go('#/admin/staff');}catch(x){toast(x.message,true)}}; }
function securityAdminPage(){ return `<section class="settings-grid"><article class="setting-panel"><span class="kicker">LOGIN SECURITY</span><h3>Remembered devices</h3><p>The login checkbox creates a 30-day signed session. Without it, the session is shorter.</p><div class="security-status"><span>30-day remembered session</span><b>ENABLED</b></div><a href="#/admin/change-password" class="button primary">Change admin password</a></article><article class="setting-panel"><span class="kicker">SESSION POLICY</span><h3>Staff roles</h3><p>Each staff account can be limited by sales, purchase, product, payment and settings permissions.</p><div class="security-status"><span>Permission model</span><b>ROLE + FLAGS</b></div></article></section>`; }
function auditAdminPage(){ return `<section class="panel"><div class="panel-head"><div><span class="kicker">AUDIT TRAIL</span><h3>Recent activity</h3></div></div><div id="auditMount" class="loading">Loading audit log…</div></section>`; }
async function loadAudit(){const j=await api('/api/audit');$('#auditMount').innerHTML=table(`<tr><th>Date</th><th>User</th><th>Action</th><th>Entity</th><th>Company</th></tr>`,j.logs.slice(0,200).map(x=>`<tr><td>${esc(x.createdAt)}</td><td>${esc(x.userName||'—')}</td><td>${esc(x.action)}</td><td>${esc(x.entity)}</td><td>${esc(x.companyName||'—')}</td></tr>`).join(''));}
function dataAdminPage(){ return `<section class="settings-grid"><article class="setting-panel"><span class="kicker">BACKUP</span><h3>Download a full backup</h3><p>Export companies, products, parties, documents, payments, expenses, ledger and audit history.</p><button class="button primary" id="downloadBackup">Download JSON backup</button></article><article class="setting-panel"><span class="kicker">RESTORE</span><h3>Restore a backup</h3><p>Restore a previously exported Swaraj ERP JSON file. This replaces the current dataset.</p><input id="restoreFile" type="file" accept="application/json" hidden><button class="button secondary" id="restoreBtn">Choose backup</button></article></section>`; }
function companyFormPage(cid){ const c=S.companies.find(x=>x.id===cid)||{}; return pageHeader('COMPANY SETTINGS',c.name||'Company profile','Configure billing identity, banking information and document numbering.',button('Back to admin','#/admin/companies','secondary'))+`<section class="form-page"><form id="companyForm" class="panel form-card"><div class="form-grid"><div class="field span2"><label>Company name</label><input name="name" value="${esc(c.name||'')}" required></div><div class="field"><label>Short code</label><input name="code" value="${esc(c.code||'')}" maxlength="8"></div><div class="field"><label>GSTIN</label><input name="gstin" value="${esc(c.gstin||'')}"></div><div class="field"><label>PAN</label><input name="pan" value="${esc(c.pan||'')}"></div><div class="field"><label>State</label><input name="state" value="${esc(cVal(c,'state','state','Odisha'))}"></div><div class="field"><label>State code</label><input name="stateCode" value="${esc(cVal(c,'stateCode','state_code','21'))}"></div><div class="field"><label>PIN</label><input name="pin" value="${esc(c.pin||'')}"></div><div class="field"><label>Phone</label><input name="phone" value="${esc(c.phone||'')}"></div><div class="field"><label>Email</label><input name="email" value="${esc(c.email||'')}"></div><div class="field full"><label>Address</label><textarea name="address" rows="3">${esc(c.address||'')}</textarea></div><div class="field"><label>Bank name</label><input name="bankName" value="${esc(cVal(c,'bankName','bank_name',''))}"></div><div class="field"><label>Branch</label><input name="bankBranch" value="${esc(cVal(c,'bankBranch','bank_branch',''))}"></div><div class="field"><label>Account number</label><input name="accountNumber" value="${esc(cVal(c,'accountNumber','account_number',''))}"></div><div class="field"><label>IFSC</label><input name="ifsc" value="${esc(c.ifsc||'')}"></div><div class="field"><label>Account type</label><input name="accountType" value="${esc(cVal(c,'accountType','account_type','Current'))}"></div><div class="field full"><div class="subhead">Document numbering</div></div>${[['invoicePrefix','GST invoice'],['quotationPrefix','Quotation'],['proformaPrefix','Proforma'],['purchasePrefix','Purchase'],['challanPrefix','Delivery challan']].map(([n,l])=>`<div class="field"><label>${l} prefix</label><input name="${n}" value="${esc(cVal(c,n,n.replace(/[A-Z]/g,m=>'_'+m.toLowerCase()),''))}"></div>`).join('')}</div><div class="form-actions"><a class="button secondary" href="#/admin/companies">Cancel</a><button class="button primary">Save company</button></div></form></section>`; }
function passwordPage(){return pageHeader('SECURITY','Change administrator password','Use the existing password to authorise a new one.',button('Back to security','#/admin/security','secondary'))+`<section class="form-page"><form id="passwordForm" class="panel form-card"><div class="form-grid"><div class="field full"><label>Current password</label><input name="currentPassword" type="password" required></div><div class="field"><label>New password</label><input name="newPassword" type="password" minlength="6" required></div><div class="field"><label>Confirm new password</label><input name="confirmPassword" type="password" minlength="6" required></div></div><div class="form-actions"><a class="button secondary" href="#/admin/security">Cancel</a><button class="button primary">Update password</button></div></form></section>`;}

function bindPage() {
  const p = parts();
  if (p[0]==='billing' && !p[1]) bindBillingHome();
  if ((isDocRoute() && p[2]==='new') || (p[0]==='purchases' && p[1]==='purchase-bill' && p[2]==='new')) bindDocumentPage(docTypeFromRoute());
  if (p[0]==='inventory' && !p[1]) bindInventory();
  if (p[0]==='inventory' && p[1]==='new') bindProductForm();
  if (p[0]==='inventory' && p[1]==='edit') bindProductForm(p[2]);
  if (p[0]==='inventory' && (p[1]==='stock-in'||p[1]==='stock-out')) bindStockForm(p[1]==='stock-out');
  if (p[0]==='parties' && !p[1]) bindParties();
  if (p[0]==='parties' && (p[1]==='customer'||p[1]==='supplier') && p[2]==='new') bindPartyForm('',p[1]);
  if (p[0]==='parties' && p[1] && !['customer','supplier'].includes(p[1])) bindPartyForm(p[1]);
  if (p[0]==='money' && ['receive','pay','expense'].includes(p[1])) bindMoneyForm(p[1]);
  if (p[0]==='reports') ;
  if (p[0]==='admin' && p[1]==='staff') loadStaff();
  if (p[0]==='admin' && p[1]==='staff' && (p[2]==='new'||p[2]==='edit')) loadStaffForm(p[2]==='edit'?p[3]:'');
  if (p[0]==='admin' && p[1]==='audit') loadAudit();
  if (p[0]==='admin' && p[1]==='company' && p[2]) bindCompanyForm(p[2]);
  if (p[0]==='admin' && p[1]==='change-password') bindPasswordForm();
  $$('[data-download-pdf]').forEach(b=>b.onclick=()=>downloadPdf(b.dataset.downloadPdf));
  $$('[data-cancel-doc]').forEach(b=>b.onclick=()=>cancelDoc(b.dataset.cancelDoc));
  if ($('#downloadBackup')) $('#downloadBackup').onclick = downloadBackup;
  if ($('#restoreBtn')) $('#restoreBtn').onclick = () => $('#restoreFile').click();
  if ($('#restoreFile')) $('#restoreFile').onchange = restoreFile;
}

function bindBillingHome(){ $('#docSearch')?.addEventListener('input',filterDocs); $('#docFilter')?.addEventListener('change',filterDocs); }
function filterDocs(){const q=($('#docSearch')?.value||'').toLowerCase(),t=$('#docFilter')?.value||'all';$$('#docRegister tbody tr').forEach(r=>r.style.display=(!q||r.dataset.text.includes(q))&&(t==='all'||r.dataset.type===t)?'':'none');}
function bindDocumentPage(type){const form=$('#documentForm'); if(!form)return; $('#addDocLine').onclick=()=>addLineRow(type); $('#docParty').onchange=e=>{const p=S.data.parties.find(x=>x.id===e.target.value); if(p && p.state) $('#placeSupply').value=p.state; updateDocSummary(type);}; $('#placeSupply').oninput=()=>updateDocSummary(type); $('#roundOff').onchange=()=>updateDocSummary(type); $('#paymentMode').onchange=e=>{const credit=e.target.value==='Credit'; $('#dueDate').disabled=!credit; const paid=$('#markPaid'); if(paid){paid.disabled=credit; if(credit)paid.checked=false;}}; addLineRow(type); form.onsubmit=async e=>{e.preventDefault(); const b=collectDocument(type); if(!b.items.length) return toast('Add at least one item',true); if(['quotation','proforma','delivery_challan'].includes(type)) b.mark_paid=false; try{const j=await api('/api/documents',{method:'POST',body:JSON.stringify(b)}); toast(`${j.document.number} saved`); if(['invoice','non_gst','purchase'].includes(type)) await refresh(); await downloadPdf(j.document.id); go(type==='purchase'?'#/purchases':'#/billing'); } catch(x){toast(x.message,true);} }; updateDocSummary(type);}
async function downloadPdf(id){try{const r=await fetch(`/erp-api/documents/${encodeURIComponent(id)}/pdf`,{credentials:'same-origin'});if(!r.ok)throw new Error(`PDF failed (${r.status})`);const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(r.headers.get('Content-Disposition')||'document.pdf').replace(/^.*filename="?([^";]+)"?.*$/i,'$1');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){toast(e.message,true);}}
async function cancelDoc(id){if(!confirm('Cancel this document? Stock posted by this document will be reversed.'))return;try{await api(`/api/documents/${id}/cancel`,{method:'POST'});await refresh();routeRender();toast('Document cancelled');}catch(e){toast(e.message,true);}}
function bindInventory(){ $('#productSearch')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();$$('#productTable tbody tr').forEach(r=>r.style.display=!q||r.dataset.text.includes(q)?'':'none');}); }
function bindProductForm(id=''){ const f=$('#productForm'); if(!f)return; f.onsubmit=async e=>{e.preventDefault(); const b=Object.fromEntries(new FormData(f)); b.companyId=S.companyId; try{ await api(id?`/api/products/${id}`:'/api/products',{method:id?'PATCH':'POST',body:JSON.stringify(b)}); await refresh(); go('#/inventory'); toast(id?'Product updated':'Product created'); }catch(x){toast(x.message,true);} }; }
function bindStockForm(out){const f=$('#stockForm'); if(!f)return; f.onsubmit=async e=>{e.preventDefault(); const b=Object.fromEntries(new FormData(f)); b.companyId=S.companyId;b.type=out?'out':'in'; try{await api('/api/stock',{method:'POST',body:JSON.stringify(b)});await refresh();go('#/inventory');toast('Stock movement posted');}catch(x){toast(x.message,true)}};}
function bindParties(){ $('#partySearch')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();$$('#partyTable tbody tr').forEach(r=>r.style.display=!q||r.dataset.text.includes(q)?'':'none');}); }
function bindPartyForm(id='',type='customer'){const f=$('#partyForm');if(!f)return;f.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(f));b.companyId=S.companyId;b.type=type;try{await api(id?`/api/parties/${id}`:'/api/parties',{method:id?'PATCH':'POST',body:JSON.stringify(b)});await refresh();const back=history.state?.fromDoc||'#/parties';go(back);toast(id?'Party updated':'Party created');}catch(x){toast(x.message,true)}}}
function bindMoneyForm(mode){if(mode==='expense'){const f=$('#expenseForm');if(!f)return;f.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(f));b.companyId=S.companyId;try{await api('/api/expenses',{method:'POST',body:JSON.stringify(b)});await refresh();go('#/money');toast('Expense saved');}catch(x){toast(x.message,true)}};return;}const f=$('#paymentForm');if(!f)return;f.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(f));b.companyId=S.companyId;try{await api('/api/payments',{method:'POST',body:JSON.stringify(b)});await refresh();go('#/money');toast(mode==='receive'?'Receipt saved':'Payment saved');}catch(x){toast(x.message,true)}}}
function bindCompanyForm(cid){const f=$('#companyForm');if(!f)return;f.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(f));try{const j=await api(`/api/companies/${cid}`,{method:'PATCH',body:JSON.stringify(b)});S.companies=S.companies.map(c=>c.id===cid?j.company:c);await refresh();go('#/admin/companies');toast('Company settings updated');}catch(x){toast(x.message,true)}}}
function bindPasswordForm(){const f=$('#passwordForm');if(!f)return;f.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(f));if(b.newPassword!==b.confirmPassword)return toast('New passwords do not match',true);try{await api('/api/me/password',{method:'POST',body:JSON.stringify({currentPassword:b.currentPassword,newPassword:b.newPassword})});go('#/admin/security');toast('Password changed');}catch(x){toast(x.message,true);}}}
function downloadBackup(){fetch('/erp-api/backup',{credentials:'same-origin'}).then(r=>r.blob()).then(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`swaraj-erp-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}).catch(e=>toast(e.message,true));}
function restoreFile(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=async()=>{try{await api('/api/restore',{method:'POST',body:reader.result});location.reload();}catch(x){toast(x.message,true);}};reader.readAsText(file);}

function toast(message, error=false){const host=$('#toastHost')||document.body;const el=document.createElement('div');el.className=`toast ${error?'error':''}`;el.textContent=message;host.appendChild(el);setTimeout(()=>el.remove(),3500);}

window.addEventListener('resize',()=>{if(window.innerWidth<=900){S.menuOpen=false;setMenuState();}});
setTheme();
boot();
