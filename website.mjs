function publicWebsite(value){
 const url=new URL(value);
 if(!['https:','http:'].includes(url.protocol)||url.port||url.username||url.password||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/i.test(url.hostname)||/\.(localhost|internal|local|test|invalid|example)$/i.test(url.hostname))throw Error('Enter a public website address.');
 return url
}
async function readCompanyPage(url,signal,host){
 let res;
 for(let i=0;i<5;i++){res=await fetch(url,{redirect:'manual',headers:{Accept:'text/html'},signal});if(res.status<300||res.status>=400)break;await res.body?.cancel();url=publicWebsite(new URL(res.headers.get('location'),url).href);if(host&&url.hostname!==host)throw Error('Off-site redirect')}
 if(!res.ok||!res.headers.get('content-type')?.includes('text/html'))throw Error('This website could not be read.');
 let title='',schema='',meta={},orgs=[],links=[],email='',phone='';
 function collect(x){if(Array.isArray(x)){x.forEach(collect);return}if(!x||typeof x!=='object')return;if(x['@graph'])collect(x['@graph']);if(x.name&&(/Organization|Business|Restaurant|Cafe|Store|Venue|BarOrPub|Festival|Sauna|MusicGroup/i.test(String(x['@type']))||x.address))orgs.push(x);if(x.publisher)collect(x.publisher)}
 const reader=res.body.getReader(),decoder=new TextDecoder();let html='',bytes=0;
 try{while(bytes<768000){const {done,value}=await reader.read();if(done)break;html+=decoder.decode(value.subarray(0,768000-bytes),{stream:true});bytes+=value.length}html+=decoder.decode()}finally{await reader.cancel()}
 await new HTMLRewriter().on('title',{text(t){title+=t.text}}).on('meta',{element(e){meta[(e.getAttribute('property')||e.getAttribute('name')||'').toLowerCase()]=e.getAttribute('content')||''}}).on('script[type="application/ld+json"]',{element(e){schema='';e.onEndTag(()=>{try{collect(JSON.parse(schema))}catch{}})},text(t){schema+=t.text}}).on('a[href]',{element(e){let h=e.getAttribute('href');try{let next=new URL(h,url);next.hash='';if(next.hostname===url.hostname&&next.href!==url.href&&/contact|find-us|visit|location|about|where-to-find/i.test(next.pathname)&&!links.includes(next.href))links.push(next.href)}catch{};if(!email&&/^mailto:/i.test(h))email=h.slice(7).split('?')[0];if(!phone&&/^tel:/i.test(h))phone=h.slice(4)}}).transform(new Response(html)).text();
 let o=orgs.find(x=>x.address)||orgs[0]||{},a=o.address||{},kind=String(o['@type']||'');
 const clean=x=>typeof x==='string'?x.replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,1000):'';
 const contacts=visibleContacts(html);const cp=[o.contactPoint].flat().find(Boolean)||{};
 return {url,links,data:{name:clean(o.name||meta['og:site_name']||meta['og:title']||title),description:clean(o.description||meta.description||meta['og:description']),city:clean(a.addressLocality),address:clean(typeof a==='string'?a:[a.streetAddress,a.addressLocality,a.postalCode].filter(Boolean).join(', '))||contacts.address,publicEmail:clean(o.email||cp.email||email||contacts.email).replace(/^mailto:/i,''),phone:clean(o.telephone||cp.telephone||phone||contacts.phone),type:/Cafe/i.test(kind)?'Café':/Restaurant/i.test(kind)?'Restaurant':/BarOrPub/i.test(kind)?'Pub':/Venue/i.test(kind)?'Venue':/Festival/i.test(kind)?'Festival':/Sauna/i.test(kind)?'Sauna':''}}
}
function visibleContacts(html){
 const text=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<(?:br\b[^>]*|\/(?:address|p|div|li|h[1-6]|section))>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/gi,' ').replace(/&#64;|&commat;/gi,'@').replace(/&amp;/gi,'&').replace(/[ \t]+/g,' ');
 const email=text.match(/[\w.%+'-]+@[\w.-]+\.[a-z]{2,24}\b/i)?.[0]||'';
 const phoneMatches=text.match(/(?:\+44\s*(?:\(0\)\s*)?|\b0)(?:[ ()-]*\d){9,10}\b/g)||[];
 const phone=phoneMatches.find(s=>/^(?:0\d{9,10}|44\d{9,10})$/.test(s.replace('(0)','').replace(/\D/g,'')))||'';
 const street=/\b\d{1,5}[a-z]?(?:\s*[-–/]\s*\d{1,5})?\s+(?:[\w’.&'-]+\s+){0,5}(?:Road|Street|Avenue|Lane|Square|Place|Parade|Hill|Drive|Terrace|Close|Way|Row|Quay|Rd|St)\b/i;
 const flat=text.replace(/\s+/g,' ');let address='';
 for(const postcode of flat.matchAll(/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/gi)){
 const before=flat.slice(Math.max(0,postcode.index-165),postcode.index),match=street.exec(before);
 if(match&&before.length-match.index<140){address=(before.slice(match.index)+postcode[0]).trim();break}}
 if(!address){const part=html.match(/<address\b[^>]*>([\s\S]*?)<\/address>/i)?.[1]||'';const line=part.replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();if(line.length<180&&!line.includes('@')&&/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i.test(line))address=line}
 return {email,phone,address}
}
async function importWebsite(req){
 const fail=(error,status)=>Response.json({error},{status});
 if(req.method!=='POST'||req.headers.get('origin')!==new URL(req.url).origin)return fail('Invalid request.',403);
 try{
 const {website}=await req.json();if(typeof website!=='string'||website.length>2048)return fail('Enter a website address.',400);
 const home=await readCompanyPage(publicWebsite(website),AbortSignal.timeout(10000));
 const fields=['address','publicEmail','phone'],data=home.data;
 if(fields.some(k=>!data[k])){
 const rank=s=>/contact|find-us/i.test(new URL(s).pathname)?0:/visit|location/i.test(new URL(s).pathname)?1:2;
 const links=home.links.sort((a,b)=>rank(a)-rank(b)).slice(0,3);
 const results=await Promise.allSettled(links.map(u=>readCompanyPage(publicWebsite(u),AbortSignal.timeout(6500),home.url.hostname)));
 for(const result of results){if(result.status!=='fulfilled')continue;for(const k of fields)if(!data[k])data[k]=result.value.data[k];if(!data.city&&result.value.data.address===data.address)data.city=result.value.data.city}
 }
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch{return fail('Could not read this page. Check the address or enter the details manually.',422)}
}
