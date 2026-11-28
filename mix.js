const mixNames=['Website-only','Smaller ticketing','Established ticketing','Medium ticketing','Large ticketing','Mixed venue','App-only membership'];
function mixPanel(){
 const plan=config['mix'+year];
 const won=r=>r.deals.some(d=>d.stage===4&&d.wonDate?.startsWith(year+'-'));
 const open=r=>!won(r)&&r.status!=='Client'&&r.deals.some(d=>d.stage<4&&(!d.close||d.close.startsWith(year+'-')));
 const table=mixNames.map((name,i)=>{
  const companies=rows.filter(r=>r.salesProfile===name),wins=companies.filter(won).length,pipeline=companies.filter(open);
  const goal=plan?.counts[i],gap=plan?Math.max(0,goal-wins):null;
  return '<tr><th>'+name+'</th><td>'+(goal??'—')+'</td><td>'+wins+'</td><td>'+pipeline.length+'</td><td>'+(gap??'—')+'</td><td>'+(plan?Math.max(0,gap-pipeline.length):'—')+'</td></tr>'
 }).join('');
 const unknown=rows.filter(r=>!mixNames.includes(r.salesProfile));
 return '<section class="panel" style="margin:18px 0"><div class=row><h2>Client mix</h2>'+btn(plan?'Adjust plan':'Build target plan','openMix()','primary')+'</div><p>New company wins for '+year+'. Pipeline counts companies with an open deal due this year or without a close date.</p><div class=scroll><table><tr><th>Sales profile</th><th>Target</th><th>Won</th><th>Pipeline</th><th>Wins needed</th><th>Still to source¹</th></tr>'+table+'</table></div><small>¹ Minimum additional companies needed if every open opportunity converts.</small>'+(unknown.length?'<details><summary>Assign a sales profile · '+unknown.length+' companies</summary>'+unknown.map(r=>btn(esc(r.name),"edit('"+r.id+"')")).join(' ')+'</details>':'')+'</section>'
}
function openMix(){
 const params=new URLSearchParams({year}),plan=config['mix'+year];
 if(plan)params.set('plan',JSON.stringify(plan.state));
 popup('Target planner · '+year,'<iframe id="mixPlanner" title="Assembly sales target planner" style="width:100%;height:72vh;border:0" src="/target-planner?'+esc(params.toString())+'"></iframe>');
 modal.style.width='min(1200px,95vw)';modal.style.maxWidth='95vw';
 modal.addEventListener('close',()=>{modal.style.width='';modal.style.maxWidth=''}, {once:true})
}
window.addEventListener('message',async event=>{
 const frame=document.querySelector('#mixPlanner'),msg=event.data;
 if(event.origin!==location.origin||!modal.open||!frame||event.source!==frame.contentWindow||msg?.type!=='apply-sales-mix'||msg.year!==year)return;
 try{await api({mix:{year,state:msg.state,counts:msg.counts,previous:config['mix'+year]||null}});await load();modal.close()}catch(e){err.textContent=e.message}
});
