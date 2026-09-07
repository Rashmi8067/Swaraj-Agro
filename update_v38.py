from pathlib import Path
p=Path('/mnt/data/swaraj-build')

# Header: add floating mobile actions and improve mobile menu items.
f=p/'views/partials/header.ejs'
s=f.read_text()
s=s.replace('<a href="/">Home</a><a href="/branches">Branches</a><a href="/photos">Photos</a><a href="/contact">Contact</a><a href="/about">About</a><a href="/admin/login">Admin</a>', '<a href="/">Home</a><a href="/farm-machinery">Farm Machinery</a><a href="/solar-solutions">Solar Solutions</a><a href="/branches">Our Branches</a><a href="/photos">Gallery</a><a href="/about">About Us</a><a href="/contact">Contact</a><a href="/admin/login">Admin</a>')
s=s.replace('</header>', '''</header>
<div class="mobile-floating-actions" aria-label="Quick contact">
  <% const quickPhone=(site.company.phones||[])[0] || ''; const waPhone=quickPhone.replace(/\\D/g,''); %>
  <% if(waPhone){ %><a href="https://wa.me/91<%= waPhone %>" target="_blank" rel="noopener" aria-label="WhatsApp Swaraj Agro"><span>◔</span> WhatsApp</a><i aria-hidden="true"></i><% } %>
  <% if(quickPhone){ %><a href="tel:<%= quickPhone %>" aria-label="Call Swaraj Agro"><span>⌕</span> Call</a><% } %>
</div>''')
f.write_text(s)

# Home: add Why Choose, testimonials and keep current hero/stats/gallery intact.
f=p/'views/index.ejs'
s=f.read_text()
needle='''    <section class="reference-moments section">'''
insert='''    <section class="why-choose section">
      <div class="section-head"><div><span class="eyebrow">WHY CHOOSE US</span><h2>Why Choose Swaraj Agro?</h2></div><p>Reliable products. Real support. A brighter tomorrow.</p></div>
      <div class="why-grid">
        <article><span class="why-icon">⚙</span><h3>Genuine Farm Machinery</h3><p>Quality equipment from trusted brands for real farm work.</p></article>
        <article><span class="why-icon">✓</span><h3>Authorised Solar Vendor</h3><p>Registered under PM Surya Ghar for rooftop solar support.</p></article>
        <article><span class="why-icon">♧</span><h3>Local Support</h3><p>Installation guidance and after-sales assistance from a local team.</p></article>
        <article><span class="why-icon">★</span><h3>Trusted Brands</h3><p>A wide range of dependable equipment and solutions.</p></article>
        <article><span class="why-icon">⌖</span><h3>Multiple Branches</h3><p>Accessible local support across our operating locations.</p></article>
        <article><span class="why-icon">⌁</span><h3>Committed to Sustainable Growth</h3><p>Practical solutions that help farms and homes move forward.</p></article>
      </div>
    </section>

'''
s=s.replace(needle,insert+needle)
# Add testimonial section before contact CTA.
needle='''    <section class="reference-contact-cta">'''
insert='''    <section class="testimonials section">
      <div class="section-head"><div><span class="eyebrow">CUSTOMER VOICE</span><h2>What Our Customers Say</h2></div><p>Real relationships matter as much as the products we supply.</p></div>
      <div class="testimonial-card">
        <div class="testimonial-mark">“</div>
        <p>We believe good service continues after the purchase. Customer feedback and experiences are important to how Swaraj Agro improves its support.</p>
        <strong>Swaraj Agro</strong><small>Farm Machinery &amp; Solar Solutions</small>
      </div>
    </section>

'''
s=s.replace(needle,insert+needle)
f.write_text(s)

# Solar: enhanced vendor + calculator + product section remains.
f=p/'views/solar.ejs'
s=f.read_text()
# replace vendor card block only
start=s.index('<section class="section solar-vendor-section">')
end=s.index('</section><section class="section"><div class="compact-product-grid">', start)+len('</section>')
vendor='''<section class="section solar-vendor-section"><div class="solar-vendor-card solar-vendor-enhanced"><div class="solar-vendor-top"><div><span class="eyebrow">PM SURYA GHAR • REGISTERED VENDOR</span><h2><%= site.company.solarVendor?.name || 'DS Swaraj Agro' %></h2><p class="solar-vendor-lead">Registered solar rooftop vendor for <strong><%= site.company.solarVendor?.district || 'Jajpur' %>, <%= site.company.solarVendor?.state || 'Odisha' %></strong> under the Government of India’s PM Surya Ghar: Muft Bijli Yojana.</p></div><span class="solar-vendor-badge">✓ Verified Vendor</span></div><div class="solar-vendor-stats"><div><span class="vendor-stat-icon">♧</span><strong><%= site.company.solarVendor?.installations || '111' %>+</strong><span>Installations</span></div><div><span class="vendor-stat-icon">ϟ</span><strong><%= site.company.solarVendor?.capacity || '333 kWp' %></strong><span>Installed Capacity</span></div><div><span class="vendor-stat-icon">★</span><strong><%= site.company.solarVendor?.rating || '5.0/5' %></strong><span>Vendor Rating · <%= site.company.solarVendor?.ratingCount || '117' %> ratings</span></div></div><div class="vendor-logos"><span>☀ <strong>PM Surya Ghar</strong><small>Muft Bijli Yojana</small></span><span>▣ <strong>Ministry of New and Renewable Energy</strong><small>Government of India</small></span></div><div class="solar-vendor-bottom"><span>Figures can be updated from the admin panel; the official portal remains the verification source.</span><a class="btn primary" href="<%= site.company.solarVendor?.portalUrl || 'https://pmsuryaghar.gov.in/#/registered-vendors' %>" target="_blank" rel="noopener noreferrer">View Our Official Vendor Profile ↗</a></div></div></section>'''
s=s[:start]+vendor+s[end:]
# Insert calculator before product section.
needle='<section class="section"><div class="compact-product-grid">'
calc='''<section class="section solar-calculator-section"><div class="section-head"><div><span class="eyebrow">SOLAR ESTIMATOR</span><h2>Solar Savings Calculator</h2></div><p>Get a quick, approximate idea of the system size and savings that may fit your property.</p></div><div class="solar-calculator" id="solar-calculator"><div class="calculator-fields"><label>Monthly electricity bill<input id="solar-bill" type="number" min="0" value="3000" inputmode="numeric"></label><label>Property type<select id="solar-property"><option>Residential</option><option>Commercial</option></select></label><label>Recommended system size<select id="solar-size"><option value="2">2 kW</option><option value="3" selected>3 kW</option><option value="4">4 kW</option><option value="5">5 kW</option><option value="6">6 kW</option><option value="8">8 kW</option><option value="10">10 kW</option></select></label></div><div class="calculator-result"><span>Estimated annual generation</span><strong id="solar-generation">~ 4,000 units</strong><span>Estimated annual savings</span><strong id="solar-savings">~ ₹ 36,000</strong><small>Figures are approximate for planning only. Actual generation and savings depend on roof, tariff, shade and system design.</small><a class="btn primary" href="/contact">Get a Solar Quote →</a></div></div></section>'''
s=s.replace(needle,calc+needle)
# Append calculator script before closing body.
needle='</script></section></main>'
# solar file has product script with this ending; inject before its closing section.
script='''</script><script>(()=>{const bill=document.getElementById('solar-bill'),size=document.getElementById('solar-size'),gen=document.getElementById('solar-generation'),save=document.getElementById('solar-savings');if(!bill||!size)return;const calc=()=>{const kw=Number(size.value||3),b=Number(bill.value||0),generation=Math.round(kw*1300/100)*100,monthlyTariff=b/300||10,savings=Math.round(Math.min(b*12,generation*monthlyTariff));gen.textContent=`~ ${generation.toLocaleString('en-IN')} units`;save.textContent=`~ ₹ ${savings.toLocaleString('en-IN')}`};bill.addEventListener('input',calc);size.addEventListener('change',calc);calc()})();</script></section></main>'''
s=s.replace(needle,script)
f.write_text(s)

# Contact: enhanced enquiry form with WhatsApp submission.
f=p/'views/contact.ejs'
s=f.read_text()
old='''</section></main><%- include('partials/footer') %>'''
new='''</section><section class="section enquiry-section"><div class="enquiry-card"><div><span class="eyebrow">SEND US AN ENQUIRY</span><h2>Tell us what you need.</h2><p>We’ll get back to you shortly. For the fastest response, your enquiry can be sent directly to our team on WhatsApp.</p></div><form id="enquiry-form" class="enquiry-form"><label>Your name<input id="enq-name" required placeholder="Your name"></label><label>Phone number<input id="enq-phone" required inputmode="tel" placeholder="Your phone number"></label><label>Interested in<select id="enq-interest"><option>Farm Machinery</option><option>Solar Rooftop Installation</option><option>Other</option></select></label><label>Location<input id="enq-location" placeholder="Your location"></label><label class="full-field">Message<textarea id="enq-message" placeholder="Your message (optional)"></textarea></label><button class="btn primary full-field" type="submit">Submit Enquiry →</button></form></div></section></main><script>(()=>{const f=document.getElementById('enquiry-form');if(!f)return;f.addEventListener('submit',e=>{e.preventDefault();const p='<%= (site.company.phones||[])[0] || '' %>'.replace(/\\D/g,'');const msg=`Hello Swaraj Agro,\\n\\nName: ${document.getElementById('enq-name').value}\\nPhone: ${document.getElementById('enq-phone').value}\\nInterested in: ${document.getElementById('enq-interest').value}\\nLocation: ${document.getElementById('enq-location').value}\\nMessage: ${document.getElementById('enq-message').value}`;if(p)window.open(`https://wa.me/91${p}?text=${encodeURIComponent(msg)}`,'_blank')});})();</script><%- include('partials/footer') %>'''
s=s.replace(old,new)
f.write_text(s)

# Branches: add richer cards while retaining modal gallery behavior.
f=p/'views/branches.ejs'
s=f.read_text()
old='''<section class="section alt"><div class="branch-locations"><% if(!site.branches.length){ %><div class="empty-card"><h3>More locations coming soon</h3><p>Branch locations can be added by the administrator.</p></div><% } %><% site.branches.forEach((b,i)=>{ %><button class="location-card" type="button" data-branch="branch-<%= i %>"><span class="location-pin">⌖</span><span><strong><%= b.name %></strong><small><%= b.city || b.address %></small></span><span class="location-arrow">→</span></button>'''
new='''<section class="section alt"><div class="branch-card-grid"><% if(!site.branches.length){ %><div class="empty-card"><h3>More locations coming soon</h3><p>Branch locations can be added by the administrator.</p></div><% } %><% site.branches.forEach((b,i)=>{ const branchGallery=(b.gallery&&b.gallery.length?b.gallery:[b.image]).filter(Boolean); %><article class="branch-showcase-card"><button class="branch-card-open" type="button" data-branch="branch-<%= i %>"><span class="branch-card-image"><% if(branchGallery[0]){ %><img src="<%= branchGallery[0] %>" alt="<%= b.name %>"><% }else{ %><span>⌖</span><% } %></span><span class="branch-card-copy"><small><%= b.city || 'Our branch' %></small><strong><%= b.name %></strong><span><%= b.address || '' %></span></span></button><div class="branch-card-actions"><% if(b.phone){ %><a href="tel:<%= b.phone %>">☎ Call</a><% } %><% if(b.googleMapsUrl){ %><a href="<%= b.googleMapsUrl %>" target="_blank" rel="noopener">⌖ Directions</a><% } %><button type="button" data-branch="branch-<%= i %>" class="branch-card-details">View details →</button></div></article>'''
# Need preserve branch-data after button. Replace prefix and let rest continue.
s=s.replace(old,new)
# The original following contains branch-data; okay, but now duplicated button closure? Original starts branch-data directly after button closure, our new ends article before it, so need restructure.
# Easier reconstruct section from beginning to before modal.
sec_start=s.index('<section class="section alt">')
sec_end=s.index('</section></main>',sec_start)+len('</section>')
newsec='''<section class="section alt"><div class="branch-card-grid"><% if(!site.branches.length){ %><div class="empty-card"><h3>More locations coming soon</h3><p>Branch locations can be added by the administrator.</p></div><% } %><% site.branches.forEach((b,i)=>{ const branchGallery=(b.gallery&&b.gallery.length?b.gallery:[b.image]).filter(Boolean); %><article class="branch-showcase-card"><button class="branch-card-open" type="button" data-branch="branch-<%= i %>"><span class="branch-card-image"><% if(branchGallery[0]){ %><img src="<%= branchGallery[0] %>" alt="<%= b.name %>"><% }else{ %><span>⌖</span><% } %></span><span class="branch-card-copy"><small><%= b.city || 'Our branch' %></small><strong><%= b.name %></strong><span><%= b.address || '' %></span></span></button><div class="branch-card-actions"><% if(b.phone){ %><a href="tel:<%= b.phone %>">☎ Call</a><% } %><% if(b.googleMapsUrl){ %><a href="<%= b.googleMapsUrl %>" target="_blank" rel="noopener">⌖ Directions</a><% } %><button type="button" data-branch="branch-<%= i %>" class="branch-card-details">View details →</button></div></article><div class="branch-data hidden" id="branch-<%= i %>"><div class="branch-modal-content"><% if(branchGallery.length){ %><div class="branch-gallery" data-branch-gallery><button type="button" class="branch-gallery-nav prev" aria-label="Previous branch photo">‹</button><img src="<%= branchGallery[0] %>" alt="<%= b.name %>" data-branch-gallery-image><button type="button" class="branch-gallery-nav next" aria-label="Next branch photo">›</button><span class="branch-gallery-counter" data-branch-gallery-counter><%= branchGallery.length>1 ? '1 / '+branchGallery.length : '' %></span><script type="application/json" data-branch-gallery-data><%- JSON.stringify(branchGallery) %></script></div><% } %><span class="tag"><%= b.city %></span><h3><%= b.name %></h3><p><%= b.description || '' %></p><% if(b.address){ %><p class="muted"><strong>Address:</strong> <% if(b.googleMapsUrl){ %><a class="branch-map-link" href="<%= b.googleMapsUrl %>" target="_blank" rel="noopener"> <%= b.address %> ↗</a><% } else { %><%= b.address %><% } %></p><% } %><% if(b.phone){ %><p class="muted"><strong>Phone:</strong> <a href="tel:<%= b.phone %>"><%= b.phone %></a></p><% } %><% if(b.email){ %><p class="muted"><strong>Email:</strong> <a href="mailto:<%= b.email %>"><%= b.email %></a></p><% } %></div></div><% }) %></div></section>'''
s=s[:sec_start]+newsec+s[sec_end:]
# Update JS selector to both classes.
s=s.replace("document.querySelectorAll('.location-card')", "document.querySelectorAll('.branch-card-open,.branch-card-details')")
f.write_text(s)

# Append polished v38 CSS.
css=p/'public/style.css'
s=css.read_text()
s += r'''

/* v38 — reference-inspired polish while preserving the existing core UI */
.why-choose{padding-top:40px;padding-bottom:55px}.why-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.why-grid article{background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px 18px;min-height:170px;box-shadow:0 7px 22px rgba(16,33,27,.035)}.why-icon{width:42px;height:42px;border-radius:13px;background:#eef8ed;color:var(--green);display:grid;place-items:center;font:700 22px 'Space Grotesk';margin-bottom:15px}.why-grid h3{font:600 17px/1.1 'Space Grotesk';margin:0 0 8px}.why-grid p{font-size:12px;line-height:1.55;margin:0}.testimonials{padding-top:45px;padding-bottom:35px}.testimonial-card{max-width:760px;margin:auto;background:#fff;border:1px solid var(--line);border-radius:24px;padding:30px 32px;box-shadow:0 10px 30px rgba(16,33,27,.05);position:relative}.testimonial-mark{font:700 46px/1 Georgia;color:var(--green);opacity:.45}.testimonial-card p{font:16px/1.65 'DM Sans';color:var(--ink);max-width:650px}.testimonial-card strong,.testimonial-card small{display:block}.testimonial-card small{color:var(--muted);margin-top:4px}
.solar-vendor-enhanced{background:linear-gradient(145deg,#eff8ed,#f8fbf6)}.vendor-stat-icon{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#fff;color:var(--green);font-size:18px;margin-bottom:5px}.vendor-logos{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:12px 0 20px}.vendor-logos>span{background:#fff;border:1px solid var(--line);border-radius:15px;padding:12px 14px;color:var(--green);display:grid;grid-template-columns:auto 1fr;column-gap:9px;align-items:center;font-size:20px}.vendor-logos strong{font-size:12px;color:var(--ink)}.vendor-logos small{grid-column:2;color:var(--muted);font-size:9px;margin-top:2px}.solar-calculator-section{padding-top:35px;padding-bottom:45px}.solar-calculator{max-width:1000px;background:#fff;border:1px solid var(--line);border-radius:24px;padding:24px;display:grid;grid-template-columns:1.1fr .9fr;gap:22px;box-shadow:0 10px 30px rgba(16,33,27,.045)}.calculator-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-content:start}.calculator-fields label:last-child{grid-column:1/-1}.calculator-fields label,.enquiry-form label{display:flex;flex-direction:column;gap:7px;font-size:11px;font-weight:700;color:#3c4a44}.calculator-fields input,.calculator-fields select,.enquiry-form input,.enquiry-form select,.enquiry-form textarea{width:100%;border:1px solid var(--line);border-radius:10px;background:#fff;padding:11px 12px;font:13px 'DM Sans';color:var(--ink);outline:none}.calculator-fields input:focus,.calculator-fields select:focus,.enquiry-form input:focus,.enquiry-form select:focus,.enquiry-form textarea:focus{border-color:#8ab39e;box-shadow:0 0 0 3px rgba(20,107,73,.08)}.calculator-result{background:#eef8ed;border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:6px}.calculator-result span{font-size:10px;color:var(--muted)}.calculator-result strong{font:600 25px 'Space Grotesk';color:var(--green);margin-bottom:9px}.calculator-result small{font-size:9px;color:var(--muted);line-height:1.45;margin:4px 0 8px}.calculator-result .btn{width:100%}
.branch-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.branch-showcase-card{background:#fff;border:1px solid var(--line);border-radius:22px;overflow:hidden;box-shadow:0 8px 26px rgba(16,33,27,.045)}.branch-card-open{width:100%;border:0;background:transparent;padding:0;text-align:left;cursor:pointer}.branch-card-image{display:block;height:210px;background:#eaf3e7;overflow:hidden}.branch-card-image img{width:100%;height:100%;object-fit:cover;display:block}.branch-card-image>span{height:100%;display:grid;place-items:center;color:var(--green);font-size:45px}.branch-card-copy{display:flex;flex-direction:column;gap:6px;padding:17px 18px 12px}.branch-card-copy small{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--green);font-weight:700}.branch-card-copy strong{font:600 21px 'Space Grotesk'}.branch-card-copy>span{font-size:11px;color:var(--muted);line-height:1.45}.branch-card-actions{display:flex;gap:8px;padding:0 18px 18px}.branch-card-actions a,.branch-card-actions button{flex:1;border:1px solid #a8c5b5;background:#fff;color:var(--green);border-radius:10px;padding:9px 8px;font:600 11px 'DM Sans';text-align:center;cursor:pointer}.branch-card-actions a:hover,.branch-card-actions button:hover{background:#edf7e8}.mobile-floating-actions{display:none}
.enquiry-section{padding-top:25px;padding-bottom:65px}.enquiry-card{background:#fff;border:1px solid var(--line);border-radius:26px;padding:28px;display:grid;grid-template-columns:.85fr 1.15fr;gap:35px;box-shadow:0 10px 30px rgba(16,33,27,.045)}.enquiry-card h2{font:600 36px 'Space Grotesk';margin:10px 0}.enquiry-card p{font-size:13px;line-height:1.65}.enquiry-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}.enquiry-form .full-field{grid-column:1/-1}.enquiry-form textarea{min-height:105px;resize:vertical}
/* Slightly more fluid interactions across cards and page controls. */
.why-grid article,.testimonial-card,.solar-vendor-card,.solar-calculator,.branch-showcase-card,.enquiry-card{transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}.why-grid article:hover,.testimonial-card:hover,.solar-calculator:hover,.branch-showcase-card:hover,.enquiry-card:hover{transform:translateY(-2px);box-shadow:0 14px 35px rgba(16,33,27,.08);border-color:#c5d6cc}
@media(max-width:900px){.why-grid{grid-template-columns:repeat(2,1fr)}.branch-card-grid{grid-template-columns:1fr 1fr}.solar-calculator{grid-template-columns:1fr}.enquiry-card{grid-template-columns:1fr}.vendor-logos{grid-template-columns:1fr}}
@media(max-width:720px){.why-choose{padding-top:30px;padding-bottom:35px}.why-grid{grid-template-columns:1fr 1fr;gap:9px}.why-grid article{min-height:150px;padding:17px 13px}.why-icon{width:36px;height:36px;font-size:18px;margin-bottom:11px}.why-grid h3{font-size:14px}.why-grid p{font-size:10px}.testimonials{padding-top:30px;padding-bottom:22px}.testimonial-card{padding:23px 20px;border-radius:20px}.testimonial-card p{font-size:13px}.solar-calculator-section{padding:25px 20px 30px}.solar-calculator{padding:16px;border-radius:20px;gap:14px}.calculator-fields{grid-template-columns:1fr;gap:10px}.calculator-fields label:last-child{grid-column:auto}.calculator-result{padding:17px}.calculator-result strong{font-size:22px}.branch-card-grid{grid-template-columns:1fr}.branch-card-image{height:190px}.branch-card-actions{flex-wrap:wrap}.branch-card-actions a,.branch-card-actions button{min-width:30%}.enquiry-section{padding:20px 20px 45px}.enquiry-card{padding:21px 18px;border-radius:21px;gap:15px}.enquiry-card h2{font-size:28px}.enquiry-form{grid-template-columns:1fr}.enquiry-form .full-field{grid-column:auto}.mobile-floating-actions{position:fixed;left:50%;bottom:15px;transform:translateX(-50%);z-index:45;display:flex;align-items:center;background:var(--green);color:#fff;border-radius:999px;padding:8px 13px;box-shadow:0 12px 30px rgba(5,45,32,.25);font:600 12px 'DM Sans';white-space:nowrap}.mobile-floating-actions a{color:#fff;display:flex;align-items:center;gap:6px;padding:4px 9px}.mobile-floating-actions span{font-size:15px}.mobile-floating-actions i{height:22px;width:1px;background:rgba(255,255,255,.45)}
  /* Keep the mobile menu visually quiet and aligned with the logo. */
  .reference-mobile-menu{top:-3px!important}.reference-mobile-menu summary{border-radius:11px!important;padding:10px 16px!important}
  .reference-home .mobile-floating-actions{bottom:12px}
}
@media(prefers-reduced-motion:reduce){.why-grid article,.testimonial-card,.solar-calculator,.branch-showcase-card,.enquiry-card{transition:none}}
'''
css.write_text(s)
