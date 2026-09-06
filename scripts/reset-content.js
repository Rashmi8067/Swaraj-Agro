require('dotenv').config();
const fs=require('fs');
const path=require('path');
const { MongoClient }=require('mongodb');
const { v2: cloudinary }=require('cloudinary');
const defaultProducts=require('../lib/default-products');

const cleanSeed={
  company:{
    name:'Swaraj Agro',
    tagline:'Agro • Solar • Equipment',
    description:'Swaraj Agro provides reliable farm machinery and solar rooftop solutions for farmers, homes and businesses, with practical local support.',
    gstin:'21CIIPB9638R2ZP',
    address:'Sahoo Complex, Gokhana Bazar, NC College Road, Jajpur, 755007',
    email:'swarajagro@proton.me',
    phones:['8763645106','7608058076'],
    logo:'', bannerImage:'',
    heroTitle:'Powering Farms. Building Better.',
    heroText:'Reliable farm machinery and solar rooftop solutions to help farmers, homes and businesses grow a cleaner, stronger tomorrow.',
    about:'Swaraj Agro works across two core areas: farm machinery and solar rooftop solutions. We focus on dependable products, practical guidance and responsive local support.',
    stats:[
      {value:'2',label:'Business Verticals'},
      {value:'Farm',label:'Machinery Solutions'},
      {value:'Solar',label:'Rooftop Solutions'},
      {value:'Jajpur',label:'Local Support Base'},
      {value:'Trusted',label:'Local Team'}
    ],
    googleMapsUrl:'https://maps.app.goo.gl/wpYgXqZweD7wHVCL8'
  },
  branches:[],products:defaultProducts,photos:[],productCatalogSeedVersion:1
};

function local(){
  const file=path.join(__dirname,'..','data','site.json');
  fs.writeFileSync(file,JSON.stringify(cleanSeed,null,2)+'\n');
  console.log('Local site.json reset.');
}

async function cloudinaryReset(){
  const ready=process.env.CLOUDINARY_CLOUD_NAME&&process.env.CLOUDINARY_API_KEY&&process.env.CLOUDINARY_API_SECRET;
  if(!ready){console.log('Cloudinary not configured; skipped cloud media deletion.');return;}
  cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
  let next;
  let total=0;
  do {
    const r=await cloudinary.api.resources({type:'upload',prefix:'ds-swaraj-agro/',max_results:500,next_cursor:next});
    const ids=(r.resources||[]).map(x=>x.public_id);
    if(ids.length){await cloudinary.api.delete_resources(ids);total+=ids.length;}
    next=r.next_cursor;
  } while(next);
  console.log(`Cloudinary reset complete. Deleted ${total} image resource(s).`);
}

async function main(){
  local();
  if(process.env.MONGODB_URI){
    const client=new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db=client.db(process.env.MONGODB_DB||'ds_swaraj_agro');
    await db.collection('site').replaceOne({_id:'main'},{_id:'main',...cleanSeed},{upsert:true});
    await client.close();
    console.log('MongoDB site document reset.');
  } else console.log('MONGODB_URI not configured; skipped MongoDB reset.');
  await cloudinaryReset();
}
main().catch(err=>{console.error(err);process.exit(1);});
