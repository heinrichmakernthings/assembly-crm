function publicWebsite(value){
 const url=new URL(value);
 if(!['https:','http:'].includes(url.protocol)||url.port||url.username||url.password||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/i.test(url.hostname)||/\.(localhost|internal|local|test|invalid|example)$/i.test(url.hostname))throw Error('Enter a public website address.');
 return url
}
async function importWebsite(req){
 const fail=(message,status)=>Response.json({error:message},{status});
 if(req.method!=='POST'||req.headers.get('origin')!==new URL(req.url).origin)return fail('Invalid request.',403);
 try{
 const {website}=await req.json();if(typeof website!=='string'||website.length>2048)return fail('Enter a website address.',400);
 let url=publicWebsite(website),res;const signal=AbortSignal.timeout(12000);
 for(let i=0;i<5;i++){res=await fetch(url,{redirect:'manual',headers:{Accept:'text/html'},signal});if(res.status<300||res.status>=400)break;url=publicWebsite(new URL(res.headers.get('location'),url).href)}
 if(!res.ok||!res.headers.get('content-type')?.includes('text/html'))throw Error('This website could not be read.');
 let title='',schema='',meta={},orgs=[],email='',phone='';
 function collect(x){if(Array.isArray(x)){x.forEach(collect);return}if(!x||typeof x!=='object')return;if(x['@graph'])collect(x['@graph']);if(x.name&&(/Organization|Business|Restaurant|Cafe|Store|Venue|BarOrPub|Festival|Sauna|MusicGroup/i.test(String(x['@type']))||x.address))orgs.push(x);if(x.publisher)collect(x.publisher)}
 const reader=res.body.getReader(),decoder=new TextDecoder();let html='',bytes=0;
 try{while(bytes<768000){const {done,value}=await reader.read();if(done)break;html+=decoder.decode(value.subarray(0,768000-bytes),{stream:true});bytes+=value.length}html+=decoder.decode()}finally{await reader.cancel()}
 await new HTMLRewriter().on('title',{text(t){title+=t.text}}).on('meta',{element(e){meta[(e.getAttribute('property')||e.getAttribute('name')||'').toLowerCase()]=e.getAttribute('content')||''}}).on('script[type="application/ld+json"]',{element(e){schema='';e.onEndTag(()=>{try{collect(JSON.parse(schema))}catch{}})},text(t){schema+=t.text}}).on('a[href]',{element(e){let h=e.getAttribute('href');if(!email&&/^mailto:/i.test(h))email=h.slice(7).split('?')[0];if(!phone&&/^tel:/i.test(h))phone=h.slice(4)}}).transform(new Response(html)).text();
 let o=orgs.find(x=>x.address)||orgs[0]||{},a=o.address||{},kind=String(o['@type']||'');
 const clean=x=>typeof x==='string'?x.replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,1000):'';
 return Response.json({name:clean(o.name||meta['og:site_name']||meta['og:title']||title),description:clean(o.description||meta.description||meta['og:description']),city:clean(a.addressLocality),address:clean(typeof a==='string'?a:[a.streetAddress,a.addressLocality,a.postalCode].filter(Boolean).join(', ')),publicEmail:clean(o.email||email).replace(/^mailto:/i,''),phone:clean(o.telephone||phone),type:/Cafe/i.test(kind)?'Café':/Restaurant/i.test(kind)?'Restaurant':/BarOrPub/i.test(kind)?'Pub':/Venue/i.test(kind)?'Venue':/Festival/i.test(kind)?'Festival':/Sauna/i.test(kind)?'Sauna':''},{headers:{'Cache-Control':'no-store'}})
 }catch{return fail('Could not read this page. Check the address or enter the details manually.',422)}
}
