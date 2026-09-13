/* Three independently managed business units for Swaraj Agro. */
(function(){
  const cloneShop = value => JSON.parse(JSON.stringify(value));
  const originalEnterApp = window.enterApp;
  const originalPersist = window.persist;
  const originalRenderAll = window.renderAll;
  function ensureCompanies(){
    if (!data.companies) data.companies = {};
    const main = data.products ? { name:'Swaraj Agro – Farm Machinery', symbol:'F', description:'Farm machinery & agricultural equipment', products:cloneShop(data.products), accounts:cloneShop(data.accounts), transactions:cloneShop(data.transactions)} : null;
    if (!data.companies.machinery && main) data.companies.machinery = main;
    if (!data.companies.solar) data.companies.solar = { name:'Swaraj Agro – Solar Division', symbol:'S', description:'Rooftop solar systems & components', products:[], accounts:[], transactions:[] };
    if (!data.companies.service) data.companies.service = { name:'Swaraj Agro – Parts & Service', symbol:'P', description:'Spare parts, consumables & service stock', products:[], accounts:[], transactions:[] };
    data.activeCompany = data.activeCompany || 'machinery';
  }
  function activeCompany(){ return data.companies?.[data.activeCompany]; }
  function capture(){ const c=activeCompany(); if(c){ c.products=cloneShop(data.products); c.accounts=cloneShop(data.accounts); c.transactions=cloneShop(data.transactions);} }
  function hydrate(){ const c=activeCompany(); if(c){ data.products=cloneShop(c.products); data.accounts=cloneShop(c.accounts); data.transactions=cloneShop(c.transactions);} }
  window.renderCompanyPicker=function(){
    const c=activeCompany(); if(!c) return;
    const chip=document.querySelector('.workspace-chip');
    if(chip){ chip.querySelector('.workspace-symbol').textContent=c.symbol; chip.querySelector('strong').textContent=c.name; chip.querySelector('small').textContent=c.description; }
    let sw=document.getElementById('companySwitcher');
    if(!sw && chip){ chip.insertAdjacentHTML('afterend','<div id="companySwitcher" class="shop-switcher"><label>ACTIVE COMPANY<select id="activeCompanySelect" aria-label="Active company"></select></label><small>Inventory, entries and ledgers are kept separate by business unit.</small></div>'); sw=document.getElementById('companySwitcher'); }
    const select=document.getElementById('activeCompanySelect');
    if(select){ select.innerHTML=Object.entries(data.companies).map(([id,item])=>`<option value="${id}">${item.name}</option>`).join(''); select.value=data.activeCompany; }
    const summary=document.getElementById('dashboardSummary'); if(summary) summary.textContent=`Here’s how ${c.name} is tracking today.`;
  };
  window.renderCompanyPicker();
  window.switchCompany=function(id){ if(!data.companies[id]||id===data.activeCompany) return; capture(); data.activeCompany=id; hydrate(); originalPersist(); originalRenderAll(); window.renderCompanyPicker(); showToast(`${activeCompany().name} is now active.`); };
  window.persist=function(){ capture(); return originalPersist(); };
  document.addEventListener('change',e=>{ if(e.target.id==='activeCompanySelect') window.switchCompany(e.target.value); });
  ensureCompanies(); hydrate();
  const oldRenderAll=window.renderAll;
  window.renderAll=function(){ oldRenderAll(); window.renderCompanyPicker(); };
  const oldEnter=window.enterApp;
  window.enterApp=function(){ ensureCompanies(); hydrate(); oldEnter(); window.renderCompanyPicker(); };
})();
