const mixNames=['Website-only','Smaller ticketing','Established ticketing','Medium ticketing','Large ticketing','Mixed venue','App-only membership'];
function mixPanel(){
 const plan=year===2027?operatingPlan():config['mix'+year];
 const won=r=>r.deals.some(d=>d.stage===4&&d.wonDate?.startsWith(year+'-'));
 const open=r=>!won(r)&&r.status!=='Client'&&r.deals.some(d=>d.stage<4&&(!d.close||d.close.startsWith(year+'-')));
 const table=mixNames.map((name,i)=>{
  const companies=rows.filter(r=>r.salesProfile===name),wins=companies.filter(won).length,pipeline=companies.filter(open);
  const goal=plan?.counts[i],gap=plan?Math.max(0,goal-wins):null;
  return '<tr><th>'+name+'</th><td>'+(goal??'—')+'</td><td>'+wins+'</td><td>'+pipeline.length+'</td><td>'+(gap??'—')+'</td><td>'+(plan?Math.max(0,gap-pipeline.length):'—')+'</td></tr>'
 }).join('');
 const unknown=rows.filter(r=>!mixNames.includes(r.salesProfile));
 return '<section class="panel" style="margin:18px 0"><div class=row><h2>Client mix</h2>'+btn(year===2027?'Advanced assumptions':plan?'Adjust plan':'Build target plan','openMix()','primary')+'</div><p>New company wins for '+year+'. Pipeline counts companies with an open deal due this year or without a close date.</p><div class=scroll><table><tr><th>Sales profile</th><th>Target</th><th>Won</th><th>Pipeline</th><th>Wins needed</th><th>Still to source¹</th></tr>'+table+'</table></div><small>¹ Minimum additional companies needed if every open opportunity converts.</small>'+(year===2027?mixEditor(plan.state):'')+(unknown.length?'<details><summary>Assign a sales profile · '+unknown.length+' companies</summary>'+unknown.map(r=>btn(esc(r.name),"edit('"+r.id+"')")).join(' ')+'</details>':'')+'</section>'
}
function openMix(){
 const params=new URLSearchParams({year}),plan=year===2027?operatingPlan():config['mix'+year];
 if(plan)params.set('plan',JSON.stringify(plan.state));
 popup('Target planner · '+year,'<iframe id="mixPlanner" title="Assembly sales target planner" style="width:100%;height:72vh;border:0" src="/target-planner?'+esc(params.toString())+'"></iframe>');
 modal.style.width='min(1200px,95vw)';modal.style.maxWidth='95vw';
 modal.addEventListener('close',()=>{modal.style.width='';modal.style.maxWidth=''}, {once:true})
}
window.addEventListener('message',async event=>{
 const frame=document.querySelector('#mixPlanner'),msg=event.data;
 if(event.origin!==location.origin||!modal.open||!frame||event.source!==frame.contentWindow||msg?.type!=='apply-sales-mix'||msg.year!==year)return;
 if(year===2027&&(msg.state.target!==500000||msg.state.unit!=='annual'||msg.state.metric!=='revenue')){err.textContent='The 2027 operating plan requires an annual Assembly revenue target of £500,000.';return}
 try{await api({mix:{year,state:msg.state,counts:msg.counts,previous:config['mix'+year]||null}});await load();modal.close()}catch(e){err.textContent=e.message}
});

function operatingPlan(){
 const saved=config.mix2027?.state;
 const state={...(saved||__model.defaults),basis:saved?.basis||'first',metric:'revenue',unit:'annual',target:500000};
 return {state,...__model.solve(state)};
}
function revenueProgress(items,wins){
 const plan=operatingPlan(),received=items.reduce((sum,item)=>sum+item.revenue,0);
 return '<section class="panel" style="margin:18px 0;border-top:4px solid #7054c6"><small>2027 · Annual Assembly revenue target</small><h2 style="font-size:2.2rem;margin:.3em 0">£500,000</h2><progress aria-label="Revenue received" max="500000" value="'+Math.min(received,500000)+'"></progress><p><strong>'+money(received)+'</strong> recorded in the revenue ledger · '+money(Math.max(0,500000-received))+' remaining</p><small>'+(plan.status==='unreachable'?'Target unreachable with current assumptions':plan.count+' new companies required · '+money(plan.combined.revenue)+' modelled revenue')+' · '+(plan.state.basis==='first'?'First-year ramp':'Full-year run rate')+'</small></section>'+paceDashboard(plan,received,wins)
}
function mixEditor(state){
 return '<form onsubmit="saveWeights(event)"><h3>Adjust your sales mix</h3><p>Give a profile more weight to target a larger share of wins.</p><div class=grid>'+mixNames.map((name,i)=>input('w'+i,name,state.profiles[i].weight,'number','min=0 max=100000 required')).join('')+'</div><button class=primary>Update 2027 plan</button><p role=status></p></form>'
}
async function saveWeights(event){
 event.preventDefault();
 const form=event.currentTarget,state=structuredClone(operatingPlan().state);
 state.profiles.forEach((p,i)=>p.weight=Number(form.elements['w'+i].value));
 const result=__model.solve(state);
 if(result.status==='unreachable'){form.querySelector('[role=status]').textContent='This mix cannot reach the target. Add weight to a revenue-generating profile.';return}
 try{await api({mix:{year:2027,state,counts:result.counts,previous:config.mix2027||null}});await load()}catch(e){form.querySelector('[role=status]').textContent=e.message}
}
function paceDashboard(plan,received,wins,now=new Date()){
 const start=Date.UTC(2027,0,1),end=Date.UTC(2028,0,1);
 const today=Date.parse(now.toLocaleDateString('en-CA',{timeZone:'Europe/London'})+'T00:00:00Z');
 const fraction=Math.max(0,Math.min(1,(end-today)/(end-start)));
 const months=plan.state.months,weeks=plan.state.weeks;
 function card(title,target,actual,format,colour){
  const gap=Math.max(0,target-actual),pct=target?Math.min(100,actual/target*100):100;
  const rate=periods=>gap===0?format(0):fraction?format(gap/(periods*fraction)):'Year ended';
  return '<article class="goal-card"><div class="row"><h3>'+title+'</h3><div aria-hidden="true" style="width:52px;height:52px;border-radius:50%;background:conic-gradient('+colour+' '+pct+'%,#e7e6ec 0)"></div></div><small>'+format(actual)+' of '+format(target)+' · '+pct.toFixed(1)+'% achieved</small><div class="split"><div><small>Per month</small><strong>'+rate(months)+'</strong></div><div><small>Per week</small><strong>'+rate(weeks)+'</strong></div></div></article>'
 }
 return '<section class="panel" style="margin:18px 0"><h2>Onboarding &amp; revenue pace</h2><p>Average needed across the remaining year, based on '+months+' selling months and '+weeks+' selling weeks spread evenly through 2027.</p><div class="goal-grid">'+(plan.status==='unreachable'?'<article class="goal-card"><h3>Client onboarding</h3><p>Adjust the mix to reach the revenue target.</p></article>':card('Client onboarding',plan.count,wins,n=>n.toLocaleString('en-GB',{maximumFractionDigits:1}),'#7958cd'))+card('Assembly revenue',500000,received,money,'#23836e')+'</div><small>Each pie shows annual progress. Onboarding uses distinct companies with a won deal. Revenue uses recorded receipts.</small></section>'
}
