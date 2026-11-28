const streams=['Site subscriptions','Ticket fees','Membership','Messaging'],rates=[.30,.15,.125,.125],currency=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);
function commission(v){return v[0]*12*rates[0]+v[1]*v[2]*v[3]/100*v[7]/100+v[4]*v[5]*12*v[6]/100*rates[2]+(v[13]||0)*12*rates[3]}
let year, targetYear=2027, ledgerYear=new Date().getFullYear();
function target(){return {income:12000,wins:19,...config['goal'+year],...(year===2027?{wins:operatingPlan().counts.reduce((a,b)=>a+b,0)}:{})}}
function entries(selectedYear=year){return rows.flatMap(r=>(r.ledger||[]).map(l=>({...l,r}))).filter(l=>l.date.startsWith(selectedYear+'-')).sort((a,b)=>b.date.localeCompare(a.date))}
function tracker(p){year=p===5?targetYear:ledgerYear;let items=entries(),earned=items.reduce((s,l)=>s+l.amount,0),paid=items.reduce((s,l)=>s+(l.paid?l.amount:0),0),wins=rows.filter(r=>r.deals.some(d=>d.stage===4&&d.wonDate?.startsWith(year+'-'))).length,t=target(),summary=(title,value,desc)=>'<section class=stat><small>'+title+'</small><strong>'+value+'</strong><small>'+desc+'</small></section>';
if(p===5){
 const goalCard=(title,current,goal,fmt)=>{const pct=goal?Math.round(current/goal*100):100;return '<section class=goal-card><div class=row><h2>'+title+'</h2><span>'+pct+'%</span></div><p><strong>'+fmt(current)+'</strong> <small>of '+fmt(goal)+'</small></p><progress aria-label="'+title+'" max="'+goal+'" value="'+Math.min(current,goal)+'"></progress><small>'+(current>=goal?'Target reached':fmt(goal-current)+' remaining')+'</small></section>'};
 return heading('Sales targets','',btn('Edit targets','editGoals()','primary'))+'<div class=year-nav>'+btn('‹','targetYear--;render()').replace('<button','<button aria-label="Previous year"')+'<b>'+year+'</b>'+btn('›','targetYear++;render()').replace('<button','<button aria-label="Next year"')+'</div>'+(year===2027?revenueProgress(items,wins):'')+monthlyForecast(year,items)+'<div class=goal-grid>'+goalCard('Earned commission',earned,t.income,currency)+goalCard('Company wins',wins,t.wins,String)+'</div>'+mixPanel()+'<section class="panel settlement"><div class=row><h2>Commission payments</h2>'+btn('View ledger','show(6)','link')+'</div><div class=split><div><small>Paid</small><strong>'+currency(paid)+'</strong></div><div><small>Awaiting payment</small><strong>'+currency(earned-paid)+'</strong></div></div></section>'
}
return heading(p===5?'Sales targets':'Commission tracker',p===5?'Annual progress against wins and earned commission.':'Commission earned on recorded client revenue, by payment status.',btn(p===5?'Edit targets':'Record revenue',p===5?'editGoals()':'addReceipt()','primary'))+'<div class=tools>'+btn('Previous year','ledgerYear--;render()')+'<button disabled>'+year+'</button>'+btn('Next year','ledgerYear++;render()')+'</div><div class=stats>'+summary('Earned',currency(earned),'Revenue dated in '+year)+summary('Paid',currency(paid),'Settled commission')+summary('Outstanding',currency(earned-paid),'Awaiting payment')+summary('Wins this year',wins,'Dated won companies')+'</div>'+(p===5?'<section class=panel><h2>Annual targets</h2>'+[['Commission',earned,t.income,currency],['Company wins',wins,t.wins,String]].map(([n,v,g,fmt])=>'<p class=row><b>'+n+'</b>'+fmt(v)+' / '+fmt(g)+'</p><progress value="'+Math.min(v,g)+'" max="'+g+'"></progress><small>'+fmt(Math.max(0,g-v))+' remaining</small>').join('')+'</section>':partnerPlan()+'<section class=panel><h2>Commission ledger</h2><p class=sub>Subscription 30% · ticket fees at the deal rate · membership and messaging 25% of gross profit at a 50% margin.</p><div class=scroll><table><tr>'+['Company','Revenue date','Stream','Received','Commission','Status'].map(x=>'<th>'+x+'</th>').join('')+'</tr>'+items.map(l=>'<tr><td>'+esc(l.r.name)+'</td><td>'+esc(l.date)+'</td><td>'+streams[l.stream]+'</td><td>'+currency(l.revenue)+'</td><td>'+currency(l.amount)+'</td><td>'+(l.paid?'Paid':btn('Mark paid',"pay('"+l.r.id+"','"+l.id+"')"))+'</td></tr>').join('')+'</table></div>'+(!items.length?'<p class=empty>No commission recorded for this year.</p>':'')+'</section>')}
function editGoals(){let t=target();popup('Targets for '+year,'<form id=f><div class=grid>'+input('income','Annual commission (£)',t.income,'number','min=1 required')+input('wins','Company wins',t.wins,'number',year===2027?'readonly title="Calculated from client mix"':'min=1 required')+'</div><button class=primary>Save targets</button></form>');f.onsubmit=async e=>{e.preventDefault();try{await api({goal:{year,income:+f.income.value,wins:+f.wins.value}});await load();modal.close()}catch(e){err.textContent=e.message}}}
function addReceipt(){if(!rows.length){edit();return}popup('Record client revenue','<form id=f><div class=grid><label>Company<select name=company>'+rows.map(r=>'<option value="'+r.id+'">'+esc(r.name)+'</option>').join('')+'</select></label>'+'<label>Deal<select name=deal></select></label>'+select('stream','Revenue stream',streams,streams[0])+input('revenue','Assembly revenue received (£)','','number','min=0.01 step=.01 required')+input('date','Revenue date',new Date().toISOString().slice(0,10),'date','required')+'</div><button class=primary>Record commission</button></form>');let refresh=()=>{f.deal.innerHTML='<option value="">Company only</option>'+get(f.company.value).deals.map(d=>'<option value="'+d.id+'">'+esc(d.name)+'</option>').join('')};f.company.onchange=refresh;refresh();f.onsubmit=async e=>{e.preventDefault();let d=Object.fromEntries(new FormData(f)),r=get(d.company),i=streams.indexOf(d.stream),rate=i===1?(r.deals.find(x=>x.id===d.deal)?.v?.[7]??r.v[7])/100:rates[i];await save({...r,ledger:[...(r.ledger||[]),{id:crypto.randomUUID(),date:d.date,stream:i,deal:d.deal,revenue:+d.revenue,amount:Math.round(d.revenue*rate*100)/100,paid:false}]})}}
function pay(id,entry){let r=get(id);save({...r,ledger:r.ledger.map(l=>l.id===entry?{...l,paid:true}:l)})}
function partnerPlan(){
 const plans=[['Website only',10,0],['Smaller ticketing',4,50000],['Established ticketing',3,200000],['Mixed client',2,120000]];
 let annual=0;
 const body=plans.map(([label,count,ticketSales],i)=>{
 const values=defaults.slice();values[1]=ticketSales;values[2]=1;
 if(i===3){values[4]=500;values[13]=350}
 const payout=commission(values);annual+=count*payout;
 return '<tr><td>'+label+'</td><td>'+count+'</td><td>'+money(ticketSales)+'</td><td>'+currency(payout/2)+'</td><td>'+currency(payout)+'</td></tr>'
 }).join('');
 return '<section class=panel style="margin-bottom:16px"><h2>Sales partner forecast</h2><p>Deck mix · 19 clients · '+currency(annual/2)+' first year · '+currency(annual)+' annual run rate</p><details><summary>Rates and worked examples</summary><p>£100 monthly website fee × 30%. Ticket sales × 2.5% Assembly fee × 15%. Membership and messaging pay 25% of gross profit at the assumed 50% margin.</p><div class=scroll><table><tr><th>Client</th><th>Count</th><th>Annual ticket sales</th><th>First year / client</th><th>Full year / client</th></tr>'+body+'</table></div><p>First year assumes six recurring months and 50% of annual ticket fees. The mixed client includes 500 members at £5/month, a 10% Assembly membership fee and £350/month messaging revenue.</p><a href="https://assembly-sales-partners.toadonro.chatgpt.site/#calculator" target="_blank" rel="noopener">Open sales partner calculator</a></details></section>'
}

function dealRevenue(d){
 const entered=value=>value!==''&&value!=null;
 if(entered(d.monthlyRevenue)||entered(d.onceRevenue)){
  return {monthly:Number(d.monthlyRevenue||0),once:Number(d.onceRevenue||0)};
 }
 return d.v?{monthly:calc(d.v)[1]/12,once:0}:null;
}
function dealAnnualValue(d){
 const value=dealRevenue(d);
 return value?value.monthly*12+value.once:0;
}
function forecastMonths(selectedYear,deals,items){
 const months=Array.from({length:12},()=>({won:0,open:0,received:0}));
 let undated=0,unpriced=0;
 for(const {d} of deals){
  if(d.stage===5)continue;
  const start=(d.stage===4?(d.wonDate||d.close):d.close)?.slice(0,7);
  if(!start){undated++;continue}
  if(start>selectedYear+'-12')continue;
  const value=dealRevenue(d);
  if(!value){unpriced++;continue}
  for(const [index,month] of months.entries()){
   const period=selectedYear+'-'+String(index+1).padStart(2,'0');
   if(period>=start)month[d.stage===4?'won':'open']+=value.monthly+(period===start?value.once:0);
  }
 }
 for(const item of items)months[Number(item.date.slice(5,7))-1].received+=item.revenue;
 return {months,undated,unpriced};
}
function monthlyForecast(selectedYear,items){
 const {months,undated,unpriced}=forecastMonths(selectedYear,allDeals(),items);
 const total=months.reduce((sum,m)=>sum+m.won+m.open,0);
 const body=months.map((m,i)=>{
  const amount=m.won+m.open,previous=i?months[i-1].won+months[i-1].open:0;
  return '<tr><th>'+new Date(selectedYear,i,1).toLocaleString('en-GB',{month:'short'})+'</th>'+[money(m.won),money(m.open),money(amount),i?money(amount-previous):'—',money(m.received)].map(v=>'<td>'+v+'</td>').join('')+'</tr>'
 }).join('');
 return '<section class="panel" style="margin:18px 0"><h2>Monthly revenue forecast · '+selectedYear+'</h2><p><strong>'+money(total)+'</strong> if all open deals close'+(selectedYear===2027?' · '+money(Math.max(0,500000-total))+' gap to annual target':'')+'</p><div class=scroll><table><tr><th>Month</th><th>Won deals</th><th>Open potential</th><th>Total potential</th><th>Monthly change</th><th>Received</th></tr>'+body+'</table></div><details><summary>Forecast assumptions and exclusions</summary><p>Monthly fees start in the close month and continue each month. One-off fees appear once. Calculator-only estimates spread annual revenue evenly. Won deals use the won date where available. Open deals assume a full close. Receipts are shown separately.</p><p>'+undated+' deals without a start date · '+unpriced+' dated deals without a price · lost deals excluded.</p></details></section>'
}
