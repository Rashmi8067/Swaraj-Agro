function escPdf(s){return String(s??'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7E]/g,'?')}
function wrap(text,max=72){const words=String(text||'').replace(/\r/g,'').split(/\s+/);const out=[];let line='';for(const w of words){if(!w)continue;if((line+' '+w).trim().length>max){if(line)out.push(line);line=w}else line=(line+' '+w).trim()}if(line)out.push(line);return out}
function money(n){return Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
function makePdf(quote,site){
  const c=site.company||{}; const solar=quote.solar||{}; const items=Array.isArray(quote.items)?quote.items:[];
  const pageW=595,pageH=842, left=42,right=553; const cmds=[];
  const rgb=(r,g,b)=>`${(r/255).toFixed(6)} ${(g/255).toFixed(6)} ${(b/255).toFixed(6)}`;
  const fillRect=(x,y,w,h,color)=>{cmds.push(`${rgb(...color)} rg`);cmds.push(`${x} ${y} ${w} ${h} re f`)};
  const strokeRect=(x,y,w,h,color,lw=1)=>{cmds.push(`${rgb(...color)} RG`);cmds.push(`${lw} w`);cmds.push(`${x} ${y} ${w} ${h} re S`)};
  const text=(x,y,t,size=9,bold=false,color=[28,43,58])=>{cmds.push('BT');cmds.push(`${rgb(...color)} rg`);cmds.push(`/F${bold?2:1} ${size} Tf`);cmds.push(`${x} ${y} Td`);cmds.push(`(${escPdf(t)}) Tj`);cmds.push('ET')};
  const line=(x1,y1,x2,y2,color=[18,51,73],lw=1)=>{cmds.push(`${rgb(...color)} RG`);cmds.push(`${lw} w`);cmds.push(`${x1} ${y1} m ${x2} ${y2} l S`)};
  const blue=[18,51,73], wheat=[242,166,60], paper=[250,248,241], stone=[95,107,118], ink=[28,43,58], soft=[242,236,216], rust=[193,101,42];
  fillRect(0,0,pageW,pageH,paper); fillRect(0,pageH-10,pageW,10,blue); fillRect(0,pageH-10,pageW,4,wheat);
  // header
  fillRect(left,720,58,58,blue); strokeRect(left,720,58,58,wheat,2); text(left+18,750,'☀',22,true,wheat);
  text(left+72,757,c.name||'Swaraj Agro',21,true,blue);
  text(left+72,739,`GSTIN: ${c.gstin||''}`,8.5,false,stone);
  text(left+72,726,c.address||'',8.5,false,stone);
  const phones=(c.phones||[]).join(', '); text(left+72,713,`${phones}  |  ${c.email||''}`,8.5,false,stone);
  text(390,757,'QUOTATION',9,true,rust); text(390,738,quote.number||'',16,true,blue); text(390,718,`Date: ${quote.date||''}`,8.5,false,stone); text(390,705,`Valid until: ${quote.expiryDate||''}`,8.5,false,stone);
  line(left,691,right,691,blue,2);
  text(left,670,'QUOTATION FOR',8,true,rust);
  text(left,650,quote.customer?.name||'',13,true,blue);
  let yy=633; const rel=quote.customer?.relationName; if(rel){text(left,yy,`C/o ${rel}`,9,false,stone);yy-=15}
  const cu=quote.customer||{}; const addrLines=[`${cu.village||''}, ${cu.post||''}`,`${cu.block||''}, ${cu.district||''}`,`${cu.state||''} - ${cu.pincode||''}`].filter(x=>x.replace(/[ ,\-]/g,'').trim());
  addrLines.forEach(a=>{text(left,yy,a,9,false,stone);yy-=14}); if(cu.phone){text(left,yy,cu.phone,9,false,stone);yy-=14}
  // configuration summary
  const conf=`${solar.plantName||'Solar Power Plant'}${solar.batteryTech?` · ${solar.batteryTech} ${solar.batteryAh} × ${solar.batteryQty}`:''}`;
  text(320,670,'SYSTEM REQUIREMENT',8,true,rust); wrap(conf,34).slice(0,3).forEach((t,i)=>text(320,650-i*13,t,8.5,i===0,ink));
  // table
  let top=600; const cols=[left,320,365,420,465,right]; fillRect(left,top-22,right-left,22,blue);
  text(left+8,top-15,'Product',8,true,[243,239,221]); text(327,top-15,'Qty',8,true,[243,239,221]); text(372,top-15,'Rate',8,true,[243,239,221]); text(426,top-15,'GST',8,true,[243,239,221]); text(472,top-15,'Amount',8,true,[243,239,221]);
  let y=top-35; let subtotal=0,totalGst=0; let showTotals=true;
  items.forEach((it,i)=>{
    const gross=Number.isFinite(Number(it.amount))?Number(it.amount):null; const rate=Number.isFinite(Number(it.rate))?Number(it.rate):null; const gstAmt=gross!=null&&rate!=null?gross-rate*Number(it.quantity||1):null;
    if(gross==null||rate==null) showTotals=false; else {subtotal+=rate*Number(it.quantity||1); totalGst+=gstAmt}
    if(i%2===1) fillRect(left,y-25,right-left,25,soft);
    text(left+8,y,wrap(it.name,40)[0]||'',8.5,true,ink); let dy=12; wrap(it.description||'',40).slice(0,2).forEach(t=>{text(left+8,y-dy,t,7.3,false,stone);dy+=10});
    text(327,y,String(it.quantity||1),8.5,false,ink); text(372,y,rate==null?'To quote':money(rate),7.6,false,ink); text(426,y,`${it.gstRate||0}%`,8,false,ink); text(472,y,gross==null?'To quote':money(gross),7.6,false,ink); line(left,y-27,right,y-27,[217,212,194],0.6); y-=Math.max(38,25+dy);
  });
  if(y<180){y=170; text(left,y,'See system description and pricing confirmation in vendor review.',8,false,stone); y-=20}
  if(showTotals){const tx=370; text(tx,y,'Subtotal',8.5,false,stone); text(478,y,money(subtotal),8.5,false,ink); y-=16; text(tx,y,'GST',8.5,false,stone); text(478,y,money(totalGst),8.5,false,ink); const grand=Math.round(subtotal+totalGst); const ro=grand-(subtotal+totalGst); if(Math.abs(ro)>=0.005){y-=16;text(tx,y,'Round off',8.5,false,stone);text(478,y,(ro<0?'− ':'+ ')+money(Math.abs(ro)),8.5,false,ink)} y-=22; line(tx,y+8,right,y+8,blue,1.5); text(tx,y-10,'TOTAL',12,true,blue); text(465,y-10,money(grand),12,true,blue); y-=40;
  } else {y-=15; line(370,y+8,right,y+8,blue,1.2); text(370,y-8,'Final price',10,true,blue); text(452,y-8,'To be quoted',9,true,rust); y-=35; text(left,y,'Final pricing will be confirmed by Swaraj Agro for this configuration.',8.5,false,stone); y-=18;}
  if(quote.message){text(left,y,'Additional requirements',8,true,rust); y-=14; wrap(quote.message,82).slice(0,4).forEach(t=>{text(left,y,t,8.2,false,stone);y-=12}); y-=6}
  line(left,92,right,92,[217,212,194],0.8); text(left,74,`This quotation is valid until ${quote.expiryDate||''}.`,8,true,rust); text(left,59,'Prices include applicable GST as specified; this is a quotation, not a tax invoice.',8,false,stone); text(410,59,'Prepared by Swaraj Agro',8,true,blue);
  const content=['q',...cmds,'Q'].join('\n')+'\n';
  const objs=[];const offsets=[];let body='%PDF-1.4\n';const addObj=s=>{offsets.push(Buffer.byteLength(body,'binary'));const n=objs.length+1;body+=`${n} 0 obj\n${s}\nendobj\n`;objs.push(n)};
  addObj('<< /Type /Catalog /Pages 2 0 R >>'); addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'); addObj('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>'); addObj(`<< /Length ${Buffer.byteLength(content,'binary')} >>\nstream\n${content}endstream`); addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const xref=Buffer.byteLength(body,'binary'); body+='xref\n0 7\n0000000000 65535 f \n'; for(const off of offsets) body+=String(off).padStart(10,'0')+' 00000 n \n'; body+='trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n'; return Buffer.from(body,'binary');
}
module.exports={makePdf};
