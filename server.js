require('dotenv').config();
const express=require('express');
const session=require('express-session');
const path=require('path');
const fs=require('fs');
const crypto=require('crypto');
const stream=require('stream');
const multer=require('multer');
const nodemailer=require('nodemailer');
const store=require('./lib/store');
const auth=require('./lib/auth');
const { syncVendor } = require('./lib/pm-surya-sync');
const { makePdf } = require('./lib/quotation-pdf');

const REQUIRED_ENV=['ADMIN_PASSWORD','RESET_EMAIL','SESSION_SECRET'];
const missingEnv=REQUIRED_ENV.filter(k=>!process.env[k]);
if(missingEnv.length){
  console.error(`\nMissing required environment variable(s): ${missingEnv.join(', ')}.\nCopy .env.example to .env (locally) or set them in your host's environment settings, then restart.\n`);
  process.exit(1);
}

const app=express();
const PORT=process.env.PORT||3000;
const uploadsDir=path.join(__dirname,'public','uploads');
fs.mkdirSync(uploadsDir,{recursive:true});
app.set('view engine','ejs'); app.set('views',path.join(__dirname,'views'));
app.use(express.urlencoded({extended:true,limit:'2mb'}));
app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname,'public')));
app.use('/uploads', express.static(uploadsDir));
app.use(session({secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:false,maxAge:1000*60*60*4}}));

// Image storage: uses Cloudinary when configured (survives redeploys on hosts
// with an ephemeral filesystem), otherwise falls back to local disk for local dev.
const useCloudinary=!!(process.env.CLOUDINARY_CLOUD_NAME&&process.env.CLOUDINARY_API_KEY&&process.env.CLOUDINARY_API_SECRET);
let cloudinary=null;
if(useCloudinary){
  cloudinary=require('cloudinary').v2;
  cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
}

const upload=multer({storage:useCloudinary?multer.memoryStorage():multer.diskStorage({destination:uploadsDir,filename:(req,file,cb)=>{
  const ext=path.extname(file.originalname).toLowerCase();
  cb(null,`${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`);
}}),limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>{
  if(/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null,true); else cb(new Error('Only JPG, PNG and WEBP images are allowed.'));
}});

// Uploads the given multer file (memory or disk) and returns the URL/path to store.
async function storeUpload(file){
  if(!file) return null;
  if(useCloudinary){
    const result=await new Promise((resolve,reject)=>{
      const uploadStream=cloudinary.uploader.upload_stream({folder:'ds-swaraj-agro',resource_type:'image'},(err,res)=>err?reject(err):resolve(res));
      stream.Readable.from(file.buffer).pipe(uploadStream);
    });
    return result.secure_url;
  }
  return '/uploads/'+file.filename;
}

function adminOnly(req,res,next){ if(!req.session.admin) return res.redirect('/admin/login'); next(); }
function safeUnlink(name){
  if(!name||useCloudinary) return; // Cloudinary-hosted images are left in place; local disk only.
  const p=path.join(uploadsDir,path.basename(name)); if(fs.existsSync(p)) fs.unlinkSync(p);
}
function slugify(s){ return String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || crypto.randomUUID(); }
function splitPhones(v){ return String(v||'').split(/[,\n]/).map(s=>s.trim()).filter(Boolean); }
function smtpTransport(){
  if(!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE).toLowerCase()==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
}
const otpStore={};
function setFlash(req,type,msg){ req.session.flash={type,msg}; }

app.get('/health',(req,res)=>res.json({status:'ok'}));
app.get('/',async(req,res,next)=>{ try{ res.render('index',{site:await store.read()}); }catch(e){next(e);} });
app.get('/contact',async(req,res,next)=>{ try{ res.render('contact',{site:await store.read()}); }catch(e){next(e);} });
app.get('/about',async(req,res,next)=>{ try{ res.render('about',{site:await store.read()}); }catch(e){next(e);} });
app.get('/branches',async(req,res,next)=>{ try{ res.render('branches',{site:await store.read()}); }catch(e){next(e);} });
app.get('/solar-solutions',async(req,res,next)=>{ try{ res.render('solar',{site:await store.read()}); }catch(e){next(e);} });
app.get('/farm-machinery',async(req,res,next)=>{ try{ res.render('farm',{site:await store.read()}); }catch(e){next(e);} });
app.get('/photos',async(req,res,next)=>{ try{ res.render('photos',{site:await store.read()}); }catch(e){next(e);} });
app.get('/photos/category/:category',async(req,res,next)=>{ try{
  const categories=['Farm Machinery','Solar Rooftop Installation','Office Inside','Exterior'];
  const category=decodeURIComponent(String(req.params.category||''));
  if(!categories.includes(category)) return res.redirect('/photos');
  const site=await store.read();
  const items=(site.photos||[]).filter(photo=>(photo.category||'Other')===category);
  res.render('photo-category',{site,category,items});
 }catch(e){next(e);} });

const CATEGORIES=['Solar Solution','Farm Machinery'];
const PHOTO_CATEGORIES=['Farm Machinery','Solar Rooftop Installation','Office Inside','Exterior','Other'];
app.get('/products',async(req,res,next)=>{ try{
  const site=await store.read();
  const category=CATEGORIES.includes(req.query.category)?req.query.category:null;
  const q=String(req.query.q||'').trim();
  let items=site.products;
  if(category) items=items.filter(p=>p.category===category);
  if(q){
    const needle=q.toLowerCase();
    items=items.filter(p=>[p.name,p.subcategory,p.description,p.category].some(f=>String(f||'').toLowerCase().includes(needle)));
  }
  res.render('products',{site,category,q,items});
 }catch(e){next(e);} });

app.get('/quotation',async(req,res,next)=>{ try{
  const site=await store.read();
  res.render('quotation',{site});
 }catch(e){next(e);} });

function nextQuotationNumber(site){
  const prefix=`DS/${String(new Date().getFullYear()).slice(-2)}-17/`;
  const nums=(site.quotations||[]).map(q=>String(q.number||'')).filter(n=>n.startsWith(prefix)).map(n=>Number(n.split('/').pop())).filter(Number.isFinite);
  const next=(nums.length?Math.max(...nums):0)+1;
  return prefix+String(next).padStart(3,'0');
}
function inclusiveTaxParts(total, rate){
  const gross=Number(total)||0; const taxable=gross/(1+rate/100); return {taxable, gst:gross-taxable, gross};
}
function buildSolarQuote(body,site){
  const panel=String(body.panel||'').trim();
  const type=String(body.systemType||'').trim();
  const kw=Number(body.kwp);
  const inverter=String(body.inverter||'').trim();
  const batteryTech=String(body.batteryTech||'').trim();
  const batteryAh=String(body.batteryAh||'').trim();
  const batteryQty=Math.max(1,Math.min(3,Number(body.batteryQty)||1));
  if(!['Loom','Adani','Waaree'].includes(panel)) throw new Error('Please select a panel company.');
  if(!['On-grid','Off-grid','Hybrid'].includes(type)) throw new Error('Please select a system type.');
  if(!Number.isFinite(kw) || kw<2) throw new Error('System size must be at least 2 kWp.');
  if(type==='On-grid' && (!Number.isInteger(kw)||kw<2||kw>8)) throw new Error('On-grid size must be 2–8 kWp.');
  if(type==='Hybrid' && (!Number.isInteger(kw)||kw<2||kw>10)) throw new Error('Hybrid size must be 2–10 kWp.');
  if(type==='Hybrid' && !['Loom','Deye','Involtics'].includes(inverter)) throw new Error('Please select a hybrid inverter company.');
  if(type==='Hybrid' && !['Li-ion','Lead'].includes(batteryTech)) throw new Error('Please select a battery technology.');
  if(type==='Hybrid' && batteryTech==='Li-ion' && !['150 Ah','200 Ah'].includes(batteryAh)) throw new Error('Please select a Li-ion battery configuration.');
  if(type==='Hybrid' && batteryTech==='Lead' && batteryAh!=='150 Ah') throw new Error('Please select the lead battery configuration.');

  const panelLabel=panel==='Loom'?'Loom':panel;
  const plantName=`${kw} kWp ${type} Solar Power Plant with ${panelLabel} Solar Panel`;
  const panelNos=kw===2?4:(kw===3?5:null);
  const description=[
    panelNos?`Solar panel – ${panelNos} Nos`:'Solar panel – as per requirement',
    type==='On-grid'?'On-grid inverter':null,
    type==='On-grid'||type==='Hybrid'?`Solar structure for ${kw} kWp`:`Solar structure for ${kw} kWp`,
    'Havells ACDB and DCDB','Lightning arrester – copper bonded','Earthing – GI-Chemical Earthing Rod',
    '4 Sq MM Tinned Copper DC wire – 40 Mtr','4 Sq MM Dual Core AC wire – 10 Mtr','16 Sq MM Aluminium earthing wire – 70 Mtr','DC MC4 Connector, PVC Pipe, Cable Tray – as per need'
  ].filter(Boolean);
  const items=[]; let priced=false;
  const add=(name,desc,gross,gstRate,qty=1,kind='')=>{ const parts=gross==null?null:inclusiveTaxParts(gross,gstRate); items.push({name,description:desc,quantity:qty,rate:parts?parts.taxable:null,gstRate,amount:parts?parts.gross:null,grossAmount:parts?parts.gross:null,kind}); if(parts) priced=true; };
  if(type==='On-grid'){
    let base=null;
    if(kw===2) base=panel==='Loom'?160000:(panel==='Adani'||panel==='Waaree'?170000:null);
    if(kw===3) base=panel==='Loom'?210000:(panel==='Adani'||panel==='Waaree'?220000:null);
    add(plantName,description.join('\n'),base,5,1,'plant');
  } else if(type==='Hybrid'){
    let base=null;
    if(kw===3) base=panel==='Loom'?210000:(panel==='Adani'||panel==='Waaree'?220000:null);
    add(plantName,description.join('\n'),base,5,1,'plant');
    let invExtra=null; if(kw===3) invExtra=(inverter==='Involtics'?35000:40000);
    add(`${kw} kW ${inverter} Hybrid Inverter`,'Hybrid inverter – as per requirement',invExtra,5,1,'inverter');
    const battGross=batteryTech==='Li-ion'?(batteryAh==='150 Ah'?80000:100000):17000;
    add(`${batteryTech} Battery ${batteryAh}`,'Battery configuration as selected',battGross,18,batteryQty,'battery');
  } else {
    add(plantName,description.join('\n'),null,5,1,'plant');
  }
  return {panel,type,kw,inverter,batteryTech,batteryAh,batteryQty,plantName,description,items,priced};
}

app.post('/quotation/request',async(req,res,next)=>{ try{
  const site=await store.read();
  const customer={
    name:String(req.body.name||'').trim(), phone:String(req.body.phone||'').trim(),
    relationName:String(req.body.relationName||'').trim(),
    village:String(req.body.village||'').trim(), post:String(req.body.post||'').trim(), block:String(req.body.block||'').trim(),
    district:String(req.body.district||'').trim(), state:String(req.body.state||'').trim(), pincode:String(req.body.pincode||'').trim()
  };
  if(!customer.name||!customer.phone) return res.status(400).json({ok:false,message:'Name and phone number are required.'});
  const solar=buildSolarQuote(req.body,site);
  const number=nextQuotationNumber(site);
  const dateObj=new Date(); const expiry=new Date(dateObj); expiry.setDate(expiry.getDate()+30);
  const quote={id:crypto.randomUUID(),number,createdAt:dateObj.toISOString(),date:dateObj.toLocaleDateString('en-IN'),expiryDate:expiry.toLocaleDateString('en-IN'),customer,category:'Solar Power Plant',solar,items:solar.items,message:String(req.body.message||'').trim(),status:'New'};
  await store.update(d=>{d.quotations.push(quote);});
  res.json({ok:true,number});
 }catch(e){res.status(400).json({ok:false,message:e.message||'Could not submit quotation request.'});} });

app.get('/admin/login',async(req,res,next)=>{ try{
  if(req.session.admin) return res.redirect('/admin');
  res.render('login',{error:null,resetEmail:await auth.getResetEmail()});
 }catch(e){next(e);} });
app.post('/admin/login',async(req,res)=>{ try{
  const ok=await auth.verify(req.body.password||'');
  if(!ok) return res.render('login',{error:'Invalid admin password.',resetEmail:await auth.getResetEmail()});
  req.session.admin=true; res.redirect('/admin');
 }catch(e){res.render('login',{error:e.message,resetEmail:await auth.getResetEmail()});} });
app.post('/admin/logout',adminOnly,(req,res)=>req.session.destroy(()=>res.redirect('/admin/login')));

app.post('/admin/reset/request',async(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase();
  const configured=(await auth.getResetEmail()).toLowerCase();
  if(email!==configured) return res.render('login',{error:'That email is not configured for password reset.',resetEmail:configured});
  const otp=String(crypto.randomInt(100000,999999));
  otpStore[email]={otp,expires:Date.now()+10*60*1000};
  const transport=smtpTransport();
  try{
    if(!transport) console.log(`\n[DEV OTP] Password reset OTP for ${email}: ${otp}\n`);
    else await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:email,subject:'DS Swaraj Agro admin password reset OTP',text:`Your DS Swaraj Agro admin password reset OTP is ${otp}. It expires in 10 minutes.`});
    return res.render('reset',{email,message:'OTP sent. Check your inbox and enter the 6-digit code.'});
  }catch(e){ return res.render('login',{error:'Email delivery failed. Check SMTP configuration.',resetEmail:configured}); }
});
app.post('/admin/reset/verify',async(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase(); const otp=String(req.body.otp||'').trim(); const rec=otpStore[email];
  if(!rec || rec.expires<Date.now() || rec.otp!==otp) return res.render('reset',{email,message:'Invalid or expired OTP.'});
  const newPassword=String(req.body.newPassword||'');
  if(newPassword.length<8) return res.render('reset',{email,message:'New password must be at least 8 characters.'});
  await auth.changePassword(newPassword); delete otpStore[email];
  return res.render('login',{error:null,resetEmail:await auth.getResetEmail(),success:'Password reset successfully. You can now log in.'});
});

app.get('/admin/quotations/:id/download',adminOnly,async(req,res,next)=>{ try{
  const site=await store.read(); const quote=(site.quotations||[]).find(q=>q.id===req.params.id);
  if(!quote) return res.status(404).send('Quotation not found');
  const pdf=makePdf(quote,site); res.setHeader('Content-Type','application/pdf'); const safeFileName=String(quote.number||'quotation').replace(/\//g,'_')+'.pdf'; res.setHeader('Content-Disposition',`attachment; filename="${safeFileName}"`); res.send(pdf);
 }catch(e){next(e);} });
app.post('/admin/quotations/delete',adminOnly,async(req,res)=>{ try{ await store.update(d=>{d.quotations=(d.quotations||[]).filter(q=>q.id!==req.body.id);}); setFlash(req,'success','Quotation request deleted.'); }catch(e){setFlash(req,'error','Could not delete quotation request.');} res.redirect('/admin#quotations'); });

app.get('/admin',adminOnly,async(req,res,next)=>{ try{
  const site=await store.read(); const flash=req.session.flash; delete req.session.flash;
  res.render('dashboard',{site,flash,resetEmail:await auth.getResetEmail()});
 }catch(e){next(e);} });

app.post('/admin/solar-vendor/sync',adminOnly,async(req,res)=>{
  try {
    const site=await store.read();
    const result=await syncVendor(site.company.solarVendor||{});
    if(result.ok){
      await store.update(d=>{ d.company.solarVendor=result.vendor; });
      setFlash(req,'success','PM Surya Ghar vendor data synced successfully.');
    } else {
      await store.update(d=>{ d.company.solarVendor=Object.assign(d.company.solarVendor||{}, result.vendor, {syncStatus:'fallback',syncError:result.error}); });
      setFlash(req,'error','Automatic PM Surya Ghar sync could not update the figures. Existing values were kept.');
    }
  } catch(e){ setFlash(req,'error','PM Surya Ghar sync failed: '+e.message); }
  res.redirect('/admin#company');
});

app.post('/admin/company',adminOnly,async(req,res,next)=>{ try{
  await store.update(d=>{ const c=d.company; Object.assign(c,{name:req.body.name,tagline:req.body.tagline,description:req.body.description,gstin:req.body.gstin,address:req.body.address,email:req.body.email,phones:splitPhones(req.body.phones),googleMapsUrl:req.body.googleMapsUrl,heroTitle:req.body.heroTitle,heroText:req.body.heroText,about:req.body.about}); c.solarVendor=Object.assign(c.solarVendor||{},{name:req.body.vendorName||'DS Swaraj Agro',state:req.body.vendorState||'Odisha',district:req.body.vendorDistrict||'Jajpur',installations:req.body.vendorInstallations||'0',capacity:req.body.vendorCapacity||'0 kWp',rating:req.body.vendorRating||'0/5',ratingCount:req.body.vendorRatingCount||'0',portalUrl:req.body.vendorPortalUrl||'https://pmsuryaghar.gov.in/#/registered-vendors'}); });
  setFlash(req,'success','Company and solar vendor information saved.'); res.redirect('/admin#company');
 }catch(e){next(e);} });

app.post('/admin/branches/save',adminOnly,upload.fields([{name:'image',maxCount:1},{name:'gallery',maxCount:8}]),async(req,res,next)=>{ try{
  const imageFile=req.files?.image?.[0]; const galleryFiles=req.files?.gallery||[];
  const imageUrl=imageFile?await storeUpload(imageFile):null; const galleryUrls=[];
  for(const file of galleryFiles){ const u=await storeUpload(file); if(u) galleryUrls.push(u); }
  await store.update(d=>{
    const id=req.body.id||crypto.randomUUID(); const existing=(d.branches||[]).find(b=>b.id===id); const oldGallery=Array.isArray(existing?.gallery)?existing.gallery.filter(Boolean):[]; const mainImage=imageUrl || existing?.image || oldGallery[0] || '';
    let gallery=[...oldGallery]; if(imageUrl){ gallery=[imageUrl,...gallery.filter(x=>x!==imageUrl)]; } else if(mainImage && !gallery.length) gallery=[mainImage];
    for(const u of galleryUrls) if(!gallery.includes(u)) gallery.push(u);
    const b={id,name:req.body.name,city:req.body.city,address:req.body.address,googleMapsUrl:req.body.googleMapsUrl||'',phone:req.body.phone,email:req.body.email,description:req.body.description,image:mainImage,gallery};
    const idx=(d.branches||[]).findIndex(x=>x.id===id); if(idx>=0)d.branches[idx]=b; else d.branches.push(b);
  });
  setFlash(req,'success','Branch saved.'); res.redirect('/admin');
 }catch(e){next(e);} });
app.post('/admin/branches/delete',adminOnly,async(req,res,next)=>{ try{
  await store.update(d=>{ const b=(d.branches||[]).find(x=>x.id===req.body.id); if(b?.image)safeUnlink(b.image); for(const img of (b?.gallery||[])) if(img!==b?.image) safeUnlink(img); d.branches=(d.branches||[]).filter(x=>x.id!==req.body.id); });
  setFlash(req,'success','Branch deleted.'); res.redirect('/admin');
 }catch(e){next(e);} });

app.post('/admin/products/save',adminOnly,upload.fields([{name:'image',maxCount:1},{name:'gallery',maxCount:8}]),async(req,res,next)=>{ try{
  const imageFile=req.files?.image?.[0]; const galleryFiles=req.files?.gallery||[];
  const imageUrl=imageFile?await storeUpload(imageFile):null; const galleryUrls=[];
  for(const file of galleryFiles){ const u=await storeUpload(file); if(u) galleryUrls.push(u); }
  await store.update(d=>{
    const allowed=['Solar Solution','Farm Machinery']; const category=allowed.includes(req.body.category)?req.body.category:'Farm Machinery'; const id=req.body.id||slugify(req.body.name); const existing=d.products.find(p=>p.id===id);
    const oldGallery=Array.isArray(existing?.gallery)?existing.gallery.filter(Boolean):[]; const mainImage=imageUrl || existing?.image || oldGallery[0] || '';
    let gallery=[...oldGallery]; if(imageUrl){ gallery=[imageUrl,...gallery.filter(x=>x!==imageUrl)]; } else if(mainImage && !gallery.length) gallery=[mainImage];
    for(const u of galleryUrls) if(!gallery.includes(u)) gallery.push(u);
    const p={id,name:req.body.name,category,subcategory:req.body.subcategory,price:req.body.price,description:req.body.description,featured:req.body.featured==='on',image:mainImage,gallery};
    const idx=d.products.findIndex(x=>x.id===id); if(idx>=0)d.products[idx]=p; else d.products.push(p);
  });
  setFlash(req,'success','Product saved.'); res.redirect('/admin');
 }catch(e){next(e);} });
app.post('/admin/products/delete',adminOnly,async(req,res,next)=>{ try{
  await store.update(d=>{ const p=d.products.find(x=>x.id===req.body.id); if(p?.image)safeUnlink(p.image); for(const img of (p?.gallery||[])) if(img!==p?.image) safeUnlink(img); d.products=d.products.filter(x=>x.id!==req.body.id); });
  setFlash(req,'success','Product deleted.'); res.redirect('/admin');
 }catch(e){next(e);} });

app.post('/admin/photos/upload',adminOnly,upload.array('photos',20),async(req,res,next)=>{ try{
  const uploaded=[];
  for(const file of (req.files||[])){ uploaded.push({id:crypto.randomUUID(),image:await storeUpload(file),caption:String(req.body.caption||'').trim(),category:PHOTO_CATEGORIES.includes(req.body.category)?req.body.category:'Other',homeFeatured:false}); }
  await store.update(d=>{ d.photos=Array.isArray(d.photos)?d.photos:[]; d.photos.push(...uploaded); });
  setFlash(req,'success',`${uploaded.length} photo${uploaded.length===1?'':'s'} uploaded.`); res.redirect('/admin');
 }catch(e){next(e);} });
app.post('/admin/photos/home-featured',adminOnly,async(req,res,next)=>{ try{
  const ids=Array.isArray(req.body.homePhotoIds)?req.body.homePhotoIds:(req.body.homePhotoIds?[req.body.homePhotoIds]:[]);
  if(ids.length>4){ setFlash(req,'error','Select a maximum of 4 photos for the homepage.'); return res.redirect('/admin'); }
  await store.update(d=>{
    for(const photo of (d.photos||[])) {
      photo.homeFeatured=ids.includes(photo.id);
      const key=`photoCategory_${photo.id}`;
      if(Object.prototype.hasOwnProperty.call(req.body,key) && PHOTO_CATEGORIES.includes(req.body[key])) photo.category=req.body[key];
    }
  });
  setFlash(req,'success',`${ids.length} homepage photo${ids.length===1?'':'s'} selected.`); res.redirect('/admin');
 }catch(e){next(e);} });
app.post('/admin/photos/delete',adminOnly,async(req,res,next)=>{ try{
  await store.update(d=>{ const deleteId=req.body.id || req.body.deletePhotoId; const photo=(d.photos||[]).find(x=>x.id===deleteId); if(photo?.image)safeUnlink(photo.image); d.photos=(d.photos||[]).filter(x=>x.id!==deleteId); });
  setFlash(req,'success','Photo deleted.'); res.redirect('/admin');
 }catch(e){next(e);} });

app.use((err,req,res,next)=>{ if(err instanceof multer.MulterError || err?.message?.includes('Only JPG')){setFlash(req,'error',err.message);return res.redirect('/admin');} console.error(err); res.status(500).send('Something went wrong. Please try again.'); });

// Background refresh of the official PM Surya Ghar vendor metrics. If the
// government endpoint is unavailable or its response format changes, the last
// known values remain in place and the website continues to work normally.
async function refreshSolarVendor(){
  try {
    const site=await store.read();
    const result=await syncVendor(site.company.solarVendor||{});
    if(result.ok) await store.update(d=>{ d.company.solarVendor=result.vendor; });
    else await store.update(d=>{ d.company.solarVendor=Object.assign(d.company.solarVendor||{}, {syncStatus:'fallback',syncError:result.error}); });
    console.log(result.ok ? '[PM Surya Ghar] vendor metrics refreshed.' : `[PM Surya Ghar] sync fallback: ${result.error}`);
  } catch(e) { console.error('[PM Surya Ghar] sync error:',e.message); }
}

async function main(){
  await auth.ensureAdmin();
  app.listen(PORT,()=>{ console.log(`DS Swaraj Agro website running at http://localhost:${PORT}`); setTimeout(refreshSolarVendor,5000); setInterval(refreshSolarVendor,6*60*60*1000); });
}
main().catch(err=>{ console.error('Failed to start server:',err.message); process.exit(1); });
