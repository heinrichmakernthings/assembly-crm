function quickFind(){
 popup('Search workspace','<input class=quick-input id=quickQuery placeholder="Company, contact, deal or page" aria-label="Search workspace"><div id=quickResults></div>');
 const input=document.querySelector('#quickQuery'),results=document.querySelector('#quickResults');
 const options=pages.map((name,i)=>({name,group:'Page',open:()=>show(i)}));
 for(const r of rows){
 options.push({name:r.name,group:'Company',open:()=>detail(r.id)});
 for(const c of r.contacts)options.push({name:c.name,group:r.name+' · Contact',open:()=>contactPage(r.id,c.id)});
 for(const d of r.deals)options.push({name:d.name,group:r.name+' · Deal',open:()=>detail(r.id,d.id)})
 }
 function matches(){results.replaceChildren();const q=input.value.trim().toLowerCase(),found=options.filter(x=>(x.name+' '+x.group).toLowerCase().includes(q)).slice(0,12);for(const x of found){const b=document.createElement('button');b.className='quick-result';b.textContent=x.name;const meta=document.createElement('small');meta.textContent=x.group;b.append(meta);b.onclick=()=>{modal.close();x.open()};results.append(b)}if(!found.length)results.textContent='No matching records.'}
 input.oninput=matches;input.onkeydown=e=>{if(e.key==='Enter')results.querySelector('button')?.click()};matches();input.focus()
}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!modal.open){e.preventDefault();quickFind()}});
