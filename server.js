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

app.get('/',async(req,res,next)=>{ try{ res.render('index',{site:await store.read()}); }catch(e){next(e);} });
app.get('/contact',(req,res)=>res.redirect('/#contact'));

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

app.get('/admin',adminOnly,async(req,res,next)=>{ try{
  const site=await store.read(); const flash=req.session.flash; delete req.session.flash;
  res.render('dashboard',{site,flash,resetEmail:await auth.getResetEmail()});
 }catch(e){next(e);} });

app.post('/admin/company',adminOnly,upload.single('logo'),async(req,res,next)=>{ try{
  const logoUrl=req.file?await storeUpload(req.file):null;
  await store.update(d=>{ const c=d.company; Object.assign(c,{name:req.body.name,tagline:req.body.tagline,description:req.body.description,gstin:req.body.gstin,address:req.body.address,email:req.body.email,phones:splitPhones(req.body.phones),heroTitle:req.body.heroTitle,heroText:req.body.heroText,about:req.body.about}); if(logoUrl){ if(c.logo)safeUnlink(c.logo); c.logo=logoUrl; } });
  setFlash(req,'success','Company information saved.'); res.redirect('/admin');
 }catch(e){next(e);} });

app.post('/admin/branches/save',adminOnly,upload.single('image'),async(req,res,next)=>{ try{
  const imageUrl=req.file?await storeUpload(req.file):null;
  await store.update(d=>{
    const id=req.body.id||crypto.randomUUID(); const existing=(d.branches||[]).find(b=>b.id===id); const b={id,name:req.body.name,city:req.body.city,address:req.body.address,phone:req.body.phone,email:req.body.email,description:req.body.description,image:existing?.image||''};
    if(imageUrl) b.image=imageUrl;
    const idx=(d.branches||[]).findIndex(x=>x.id===id); if(idx>=0)d.branches[idx]=b; else d.branches.push(b);
  });
  setFlash(req,'success','Branch saved.'); res.redirect('/admin');
 }catch(e){next(e);} });
app.post('/admin/branches/delete',adminOnly,async(req,res,next)=>{ try{
  await store.update(d=>{ const b=(d.branches||[]).find(x=>x.id===req.body.id); if(b?.image)safeUnlink(b.image); d.branches=(d.branches||[]).filter(x=>x.id!==req.body.id); });
  setFlash(req,'success','Branch deleted.'); res.redirect('/admin');
 }catch(e){next(e);} });

app.post('/admin/products/save',adminOnly,upload.single('image'),async(req,res,next)=>{ try{
  const imageUrl=req.file?await storeUpload(req.file):null;
  await store.update(d=>{
    const allowed=['Solar Solution','Farm Machinery']; const category=allowed.includes(req.body.category)?req.body.category:'Farm Machinery'; const id=req.body.id||slugify(req.body.name); const existing=d.products.find(p=>p.id===id); const p={id,name:req.body.name,category,subcategory:req.body.subcategory,price:req.body.price,description:req.body.description,featured:req.body.featured==='on',image:existing?.image||''};
    if(imageUrl) p.image=imageUrl;
    const idx=d.products.findIndex(x=>x.id===id); if(idx>=0)d.products[idx]=p; else d.products.push(p);
  });
  setFlash(req,'success','Product saved.'); res.redirect('/admin');
 }catch(e){next(e);} });
app.post('/admin/products/delete',adminOnly,async(req,res,next)=>{ try{
  await store.update(d=>{ const p=d.products.find(x=>x.id===req.body.id); if(p?.image)safeUnlink(p.image); d.products=d.products.filter(x=>x.id!==req.body.id); });
  setFlash(req,'success','Product deleted.'); res.redirect('/admin');
 }catch(e){next(e);} });

app.use((err,req,res,next)=>{ if(err instanceof multer.MulterError || err?.message?.includes('Only JPG')){setFlash(req,'error',err.message);return res.redirect('/admin');} console.error(err); res.status(500).send('Something went wrong. Please try again.'); });

async function main(){
  await auth.ensureAdmin();
  app.listen(PORT,()=>console.log(`DS Swaraj Agro website running at http://localhost:${PORT}`));
}
main().catch(err=>{ console.error('Failed to start server:',err.message); process.exit(1); });
