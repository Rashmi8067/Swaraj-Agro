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
const sfSeed = require('./stockflow/seed-data.json');
const jwt = require('jsonwebtoken');

const REQUIRED_ENV=['MONGODB_URI','JWT_SECRET','INITIAL_ADMIN_PASSWORD','INITIAL_STAFF_PASSWORD','INITIAL_WAREHOUSE_PASSWORD'];
const missingEnv=REQUIRED_ENV.filter(k=>!process.env[k]);
if(missingEnv.length){
  console.error(`\nMissing required environment variable(s): ${missingEnv.join(', ')}.\nCopy .env.example to .env (locally) or set them in your host's environment settings, then restart.\n`);
  process.exit(1);
}

const app=express();
const PORT=process.env.PORT||3000;
const SESSION_SECRET=process.env.SESSION_SECRET||process.env.JWT_SECRET;
const uploadsDir=path.join(__dirname,'public','uploads');
fs.mkdirSync(uploadsDir,{recursive:true});
app.set('view engine','ejs'); app.set('views',path.join(__dirname,'views'));
app.use(express.urlencoded({extended:true,limit:'2mb'}));
app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname,'public')));
app.use('/uploads', express.static(uploadsDir));
app.use(session({secret:SESSION_SECRET,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:1000*60*30}}));

// ----- StockFlow inventory application -----
const STOCKFLOW_DIR = path.join(__dirname, 'stockflow');
app.get('/stockflow', (req,res) => res.redirect('/stockflow/'));
app.use('/stockflow', express.static(STOCKFLOW_DIR, { index: 'index.html', fallthrough: true }));



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
      const uploadStream=cloudinary.uploader.upload_stream({folder:'swaraj-agro',resource_type:'image'},(err,res)=>err?reject(err):resolve(res));
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
app.post('/enquiry',async(req,res)=>{ try{
  const name=String(req.body.name||'').trim(); const phone=String(req.body.phone||'').trim();
  const category=String(req.body.category||'').trim(); const product=String(req.body.product||'').trim();
  const location=String(req.body.location||'').trim(); const message=String(req.body.message||'').trim();
  const isFarm=category==='Farm Machinery';
  if(!name||!phone) return res.status(400).json({ok:false,message:'Name and mobile number are required.'});
  if(isFarm&&!product) return res.status(400).json({ok:false,message:'Please select a farm machinery product.'});
  const enquiry={id:crypto.randomUUID(),createdAt:new Date().toISOString(),name,phone,product:product||category||'General enquiry',category,location,message};
  await store.update(d=>{ d.enquiries=d.enquiries||[]; d.enquiries.push(enquiry); });
  res.json({ok:true,message:'Successfully submitted, our team will contact you shortly.'});
 }catch(e){ console.error(e); res.status(500).json({ok:false,message:'Could not submit enquiry.'}); } });
app.get('/admin/enquiries/latest',adminOnly,async(req,res)=>{ try{ const site=await store.read(); const list=[...(site.enquiries||[])].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)); res.json({count:list.length,latest:list[0]||null}); }catch(e){res.status(500).json({ok:false});} });
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

app.get('/admin/login',async(req,res,next)=>{ try{
  if(req.session.admin) return res.redirect('/admin');
  res.render('login',{error:null,resetEmail:await auth.getResetEmail()});
 }catch(e){next(e);} });
app.post('/admin/login',async(req,res)=>{ try{
  const ok=await auth.verify(req.body.password||'');
  if(!ok) return res.render('login',{error:'Invalid admin password.',resetEmail:await auth.getResetEmail(),rememberMe:false});
  req.session.admin=true;
  try {
    const sfAdmin = await stockflowDb.collection('users').findOne({ isAdmin: true, userId: 'admin' });
    const publicAdmin = await auth.ensureAdmin();
    if (sfAdmin && publicAdmin?.passwordHash) await stockflowDb.collection('users').updateOne({ _id: sfAdmin._id }, { $set: { passwordHash: publicAdmin.passwordHash, updatedAt: new Date() } });
  } catch (syncError) { console.error('[StockFlow] admin password sync on login failed:', syncError.message); }
  const remember=String(req.body.rememberMe||'')==='on';
  req.session.cookie.maxAge=remember?(1000*60*60*24*30):(1000*60*30);
  res.redirect('/admin');
 }catch(e){res.render('login',{error:e.message,resetEmail:await auth.getResetEmail(),rememberMe:false});} });
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
  await auth.changePassword(newPassword);
  try { await stockflowDb.collection('users').updateOne({ isAdmin: true, userId: 'admin' }, { $set: { passwordHash: require('bcryptjs').hashSync(newPassword, 12), updatedAt: new Date() } }); } catch (syncError) { console.error('[StockFlow] admin password sync after reset failed:', syncError.message); }
  delete otpStore[email];
  return res.render('login',{error:null,resetEmail:await auth.getResetEmail(),success:'Password reset successfully. You can now log in.'});
});


app.post('/admin/enquiries/delete',adminOnly,async(req,res)=>{ try{ await store.update(d=>{ d.enquiries=(d.enquiries||[]).filter(e=>e.id!==req.body.id); }); setFlash(req,'success','Enquiry deleted.'); }catch(e){setFlash(req,'error','Could not delete enquiry.');} res.redirect('/admin#enquiries'); });

app.get('/admin/stockflow-token', adminOnly, async (req, res) => {
  try {
    const user = await stockflowDb.collection('users').findOne({ isAdmin: true, userId: 'admin' });
    if (!user) return res.status(503).json({ error: 'StockFlow administrator account is not initialized.' });
    res.json({ token: signToken(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to open StockFlow admin.' });
  }
});

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
  res.redirect('/admin#pm-suryaghar');
});

app.post('/admin/company',adminOnly,async(req,res,next)=>{ try{
  await store.update(d=>{ const c=d.company; Object.assign(c,{name:req.body.name,tagline:req.body.tagline,description:req.body.description,gstin:req.body.gstin,address:req.body.address,email:req.body.email,phones:splitPhones(req.body.phones),googleMapsUrl:req.body.googleMapsUrl,heroTitle:req.body.heroTitle,heroText:req.body.heroText,about:req.body.about}); c.solarVendor=Object.assign(c.solarVendor||{},{name:req.body.vendorName||'DS Swaraj Agro',state:req.body.vendorState||'Odisha',district:req.body.vendorDistrict||'Jajpur',installations:req.body.vendorInstallations||'0',capacity:req.body.vendorCapacity||'0 kWp',rating:req.body.vendorRating||'0/5',ratingCount:req.body.vendorRatingCount||'0',portalUrl:req.body.vendorPortalUrl||'https://pmsuryaghar.gov.in/#/registered-vendors'}); });
  setFlash(req,'success','Company and solar vendor information saved.'); res.redirect('/admin#company');
 }catch(e){next(e);} });

app.post('/admin/solar-vendor',adminOnly,async(req,res,next)=>{ try{
  await store.update(d=>{ d.company.solarVendor=Object.assign(d.company.solarVendor||{},{name:req.body.vendorName||'DS Swaraj Agro',state:req.body.vendorState||'Odisha',district:req.body.vendorDistrict||'Jajpur',installations:req.body.vendorInstallations||'0',capacity:req.body.vendorCapacity||'0 kWp',rating:req.body.vendorRating||'0/5',ratingCount:req.body.vendorRatingCount||'0',portalUrl:req.body.vendorPortalUrl||'https://pmsuryaghar.gov.in/#/registered-vendors'}); });
  setFlash(req,'success','PM Surya Ghar vendor information saved.'); res.redirect('/admin#pm-suryaghar');
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



let stockflowDb;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function normalizeWorkspace(workspace) {
  const result = clone(workspace);
  delete result.passwords;
  delete result.staffUsers;
  result.activeShop = result.activeShop || 'greenfield';
  return result;
}

function buildSeedWorkspace() {
  const main = clone(sfSeed.defaultData);
  const shops = {
    greenfield: {
      name: 'Greenfield Goods', symbol: 'G', description: 'Pantry & lifestyle',
      products: clone(main.products), accounts: clone(main.accounts), transactions: clone(main.transactions)
    },
    mitti: clone(sfSeed.shopSeeds.mitti),
    roastline: clone(sfSeed.shopSeeds.roastline)
  };
  for (const shop of Object.values(shops)) {
    const inv = shop.accounts.find(a => a.type === 'Asset' || a.name.toLowerCase().includes('inventory'));
    if (inv) inv.balance = shop.products.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.price || 0), 0);
  }
  return normalizeWorkspace({ shops, activeShop: 'greenfield' });
}

async function ensureWorkspace() {
  const collection = stockflowDb.collection('workspaces');
  let workspace = await collection.findOne({ key: 'default' });
  if (!workspace) {
    const now = new Date();
    workspace = { key: 'default', ...buildSeedWorkspace(), createdAt: now, updatedAt: now };
    await collection.insertOne(workspace);
  }
  return workspace;
}

async function ensureUser(email, password, profile) {
  const users = stockflowDb.collection('users');
  const existing = await users.findOne({ email: email.toLowerCase() });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const user = {
    ...profile,
    email: email.toLowerCase(),
    passwordHash,
    createdAt: now,
    updatedAt: now
  };
  await users.insertOne(user);
  return user;
}

async function ensureUsers() {
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const staffPassword = process.env.INITIAL_STAFF_PASSWORD;
  const warehousePassword = process.env.INITIAL_WAREHOUSE_PASSWORD;
  if (!adminPassword || !staffPassword || !warehousePassword) {
    console.error('Missing INITIAL_ADMIN_PASSWORD, INITIAL_STAFF_PASSWORD, or INITIAL_WAREHOUSE_PASSWORD.');
    process.exit(1);
  }
  await ensureUser(process.env.INITIAL_ADMIN_EMAIL || 'admin@ledgerly.demo', adminPassword, {
    userId: 'admin', name: 'Aarav Rao', initials: 'AR', role: 'Administrator', isAdmin: true,
    permissions: { viewAmounts: true, recordSales: true, recordPurchases: true }
  });
  await ensureUser(process.env.INITIAL_STAFF_EMAIL || 'staff@ledgerly.demo', staffPassword, {
    userId: 'staff', name: 'Neha Thakur', initials: 'NT', role: 'Sales associate', isAdmin: false,
    permissions: { viewAmounts: true, recordSales: true, recordPurchases: true }
  });
  await ensureUser(process.env.INITIAL_WAREHOUSE_EMAIL || 'warehouse@ledgerly.demo', warehousePassword, {
    userId: 'warehouse', name: 'Kabir Singh', initials: 'KS', role: 'Warehouse associate', isAdmin: false,
    permissions: { viewAmounts: false, recordSales: false, recordPurchases: true }
  });
}

function publicUser(user) {
  return {
    id: user.userId,
    userId: user.userId,
    name: user.name,
    initials: user.initials,
    email: user.email,
    loginId: user.loginId || user.email,
    role: user.role,
    isAdmin: Boolean(user.isAdmin),
    permissions: user.permissions || { viewAmounts: false, recordSales: false, recordPurchases: false }
  };
}

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), userId: user.userId, isAdmin: Boolean(user.isAdmin) }, JWT_SECRET, { expiresIn: '7d' });
}

async function sfAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await stockflowDb.collection('users').findOne({ _id: new ObjectId(payload.sub) });
    if (!user) return res.status(401).json({ error: 'User account not found.' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

function sfRequireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Administrator access required.' });
  next();
}

async function getWorkspace() {
  const workspace = await stockflowDb.collection('workspaces').findOne({ key: 'default' });
  if (!workspace) throw new Error('Workspace not initialized.');
  return normalizeWorkspace(workspace);
}

async function saveWorkspace(nextWorkspace) {
  const sanitized = normalizeWorkspace(nextWorkspace);
  sanitized.updatedAt = new Date();
  await stockflowDb.collection('workspaces').updateOne({ key: 'default' }, { $set: sanitized });
  return sanitized;
}

function activeShopState(workspace, shopId) {
  const shop = workspace.shops?.[shopId];
  if (!shop) throw new Error('Shop not found.');
  return shop;
}


app.get('/api/health', async (req, res) => {
  try {
    await stockflowDb.command({ ping: 1 });
    res.json({ ok: true, service: 'stockflow' });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await stockflowDb.collection('users').findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'That email or password does not match this workspace.' });
    const workspace = await getWorkspace();
    const staffUsers = {};
    const users = await stockflowDb.collection('users').find({}).project({ passwordHash: 0 }).toArray();
    for (const item of users) if (!item.isAdmin) staffUsers[item.userId] = publicUser(item);
    workspace.staffUsers = staffUsers;
    res.json({ token: signToken(user), user: publicUser(user), workspace });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to sign in right now.' });
  }
});

app.get('/api/bootstrap', sfAuth, async (req, res) => {
  const workspace = await getWorkspace();
  const users = await stockflowDb.collection('users').find({}).project({ passwordHash: 0 }).toArray();
  const staffUsers = {};
  for (const item of users) if (!item.isAdmin) staffUsers[item.userId] = publicUser(item);
  workspace.staffUsers = staffUsers;
  res.json({ user: publicUser(req.user), workspace });
});

app.put('/api/workspace', sfAuth, sfRequireAdmin, async (req, res) => {
  try {
    const candidate = normalizeWorkspace(req.body);
    if (!candidate.shops || typeof candidate.shops !== 'object') return res.status(400).json({ error: 'Invalid workspace payload.' });
    const workspace = await saveWorkspace(candidate);
    res.json({ workspace });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to save the workspace.' });
  }
});

app.post('/api/transactions', sfAuth, async (req, res) => {
  try {
    const { shopId = 'greenfield', type, productId, qty, price, accountName, date, note } = req.body;
    if (!['sale', 'purchase'].includes(type)) return res.status(400).json({ error: 'Invalid transaction type.' });
    const quantity = Number(qty); const unitPrice = Number(price);
    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 1) return res.status(400).json({ error: 'Invalid quantity or price.' });
    const permission = type === 'sale' ? 'recordSales' : 'recordPurchases';
    if (!req.user.isAdmin && !req.user.permissions?.[permission]) return res.status(403).json({ error: `You do not have permission to record ${type === 'sale' ? 'sales' : 'purchases'}.` });
    const workspace = await getWorkspace();
    const shop = activeShopState(workspace, shopId);
    const product = shop.products.find(p => Number(p.id) === Number(productId));
    const account = shop.accounts.find(a => a.name === accountName);
    if (!product || !account) return res.status(404).json({ error: 'Product or account not found.' });
    if (type === 'sale' && quantity > Number(product.stock)) return res.status(400).json({ error: `Only ${product.stock} units of ${product.name} are available.` });
    product.stock += type === 'sale' ? -quantity : quantity;
    const total = quantity * unitPrice;
    account.balance += type === 'sale' ? total : -total;
    shop.transactions.unshift({ id: Date.now(), type, productId: product.id, product: product.name, qty: quantity, price: unitPrice, account: account.name, date: date || new Date().toISOString().slice(0,10), note: String(note || '').trim() || (type === 'sale' ? 'New sale' : 'New purchase'), time: new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) });
    const inv = shop.accounts.find(a => a.type === 'Asset' || a.name.toLowerCase().includes('inventory'));
    if (inv) inv.balance = shop.products.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.price || 0), 0);
    workspace.updatedAt = new Date();
    await saveWorkspace(workspace);
    res.json({ workspace, transaction: shop.transactions[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to record that transaction.' });
  }
});

app.get('/api/users', sfAuth, sfRequireAdmin, async (req, res) => {
  const users = await stockflowDb.collection('users').find({ isAdmin: false }).project({ passwordHash: 0 }).toArray();
  res.json({ users: users.map(publicUser) });
});

app.post('/api/users', sfAuth, sfRequireAdmin, async (req, res) => {
  try {
    const { userId, name, role, email, password, permissions } = req.body;
    const loginId = String(email || '').trim().toLowerCase();
    if (!name || !role || !loginId || !password || String(password).length < 6) return res.status(400).json({ error: 'Complete the details and use a password of at least 6 characters.' });
    if (await stockflowDb.collection('users').findOne({ email: loginId })) return res.status(409).json({ error: 'That access ID is already in use.' });
    const safeId = userId || `staff-${crypto.randomUUID()}`;
    const user = await ensureUser(loginId, password, { userId: safeId, name, initials: name.split(/\s+/).map(p => p[0]).join('').slice(0,2).toUpperCase(), role, isAdmin: false, permissions: permissions || {} });
    res.status(201).json({ user: publicUser(user) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to create staff access.' }); }
});

app.patch('/api/users/:userId', sfAuth, sfRequireAdmin, async (req, res) => {
  try {
    const allowed = {}; const { name, role, email, permissions, password } = req.body;
    if (name !== undefined) allowed.name = String(name).trim();
    if (role !== undefined) allowed.role = String(role).trim();
    if (email !== undefined) allowed.email = String(email).trim().toLowerCase();
    if (permissions !== undefined) allowed.permissions = permissions;
    if (password) allowed.passwordHash = await bcrypt.hash(String(password), 12);
    allowed.updatedAt = new Date();
    const query = { userId: req.params.userId, isAdmin: false };
    if (allowed.email && await stockflowDb.collection('users').findOne({ email: allowed.email, userId: { $ne: req.params.userId } })) return res.status(409).json({ error: 'That access ID is already in use.' });
    const result = await stockflowDb.collection('users').findOneAndUpdate(query, { $set: allowed }, { returnDocument: 'after', projection: { passwordHash: 0 } });
    const updated = result?.value ?? result;
    if (!updated) return res.status(404).json({ error: 'Staff account not found.' });
    if (allowed.name) { updated.initials = allowed.name.split(/\s+/).map(p => p[0]).join('').slice(0,2).toUpperCase(); await stockflowDb.collection('users').updateOne(query, { $set: { initials: updated.initials } }); }
    res.json({ user: publicUser(updated) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to update staff access.' }); }
});

app.post('/api/me/password', sfAuth, async (req, res) => {
  try {
    const current = String(req.body.currentPassword || '');
    const next = String(req.body.newPassword || '');
    if (next.length < 6) return res.status(400).json({ error: 'Use a new password with at least 6 characters.' });
    if (!(await bcrypt.compare(current, req.user.passwordHash))) return res.status(400).json({ error: 'Your current password is not correct.' });
    const passwordHash = await bcrypt.hash(next, 12);
    await stockflowDb.collection('users').updateOne({ _id: req.user._id }, { $set: { passwordHash, updatedAt: new Date() } });
    if (req.user.isAdmin) await stockflowDb.collection('admin').updateOne({ _id: 'main' }, { $set: { passwordHash, updatedAt: new Date() } });
    res.json({ ok: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to update your password.' }); }
});

app.post('/api/reset-demo', sfAuth, sfRequireAdmin, async (req, res) => {
  const workspace = buildSeedWorkspace();
  await saveWorkspace(workspace);
  res.json({ workspace });
});

app.post('/api/cloudinary/signature', sfAuth, sfRequireAdmin, async (req, res) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.status(503).json({ error: 'Cloudinary is not configured.' });
  const timestamp = Math.round(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_FOLDER || 'stockflow';
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
  res.json({ timestamp, folder, signature, cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY });
});

app.post('/api/cloudinary/upload', sfAuth, sfRequireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.status(503).json({ error: 'Cloudinary is not configured.' });
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });
    const folder = process.env.CLOUDINARY_FOLDER || 'stockflow';
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'auto' }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
      stream.end(req.file.buffer);
    });
    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Cloudinary upload failed.' }); }
});



async function main(){
  const { getDb } = require('./lib/db');
  stockflowDb = await getDb();
  if (!stockflowDb) throw new Error('MONGODB_URI is required for the merged StockFlow application.');
  // Initialize StockFlow collections in the same MongoDB database used by the public website.
  await ensureWorkspace();
  await ensureUsers();
  await auth.ensureAdmin();
  app.listen(PORT,'0.0.0.0',()=>{ 
    console.log(`Swaraj Agro + StockFlow running on port ${PORT}`);
    setTimeout(refreshSolarVendor,5000);
    setInterval(refreshSolarVendor,6*60*60*1000);
  });
}
main().catch(err=>{ console.error('Failed to start server:',err.message); process.exit(1); });
