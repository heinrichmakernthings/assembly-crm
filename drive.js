let driveToken='',driveExpiry=0;
const driveScope='https://www.googleapis.com/auth/drive.metadata.readonly';
function driveReady(){return Boolean(driveToken&&Date.now()<driveExpiry)}
function driveConnection(){return '<section class=panel style="margin-top:16px"><div class=panelhead><h2>Google Drive</h2><span class=badge>'+(driveReady()?'Connected':'Disconnected')+'</span></div><p>Find proposals, contracts and client documents to link to a company or deal.</p><div class=tools>'+btn(driveReady()?'End Drive session':'Connect Google Drive',driveReady()?'endDrive()':'authoriseDrive()','primary')+btn('Connection settings','mailSettings()')+'</div></section>'}
function endDrive(){driveToken='';driveExpiry=0;render()}
async function authoriseDrive(id,deal=''){
 if(!config.googleClient){mailSettings();return}
 try{await gis();let grant=await new Promise((resolve,reject)=>google.accounts.oauth2.initTokenClient({client_id:config.googleClient,scope:driveScope,include_granted_scopes:false,callback:x=>x.error?reject(Error(x.error_description||x.error)):resolve(x),error_callback:x=>reject(Error(x.type))}).requestAccessToken());if(!grant.scope?.split(' ').includes(driveScope))throw Error('Drive file metadata access is required to search files.');driveToken=grant.access_token;driveExpiry=Date.now()+(Number(grant.expires_in)-30)*1000;render();if(id)browseDrive(id,deal)}catch(e){popup('Google Drive','<p>'+esc(e.message)+'</p>')}
}
function driveUrl(raw){try{let u=new URL(raw);return u.protocol==='https:'&&['drive.google.com','docs.google.com','sheets.google.com','slides.google.com'].includes(u.hostname)?u.href:''}catch{return ''}}
function drivePanel(r,deal){let files=(r.driveFiles||[]).filter(x=>!deal||x.deal===deal);return block('Google Drive',files.map(x=>'<p><a target=_blank rel=noopener href="'+esc(driveUrl(x.url))+'">'+esc(x.name)+'</a><small>'+esc(r.deals.find(d=>d.id===x.deal)?.name||'Company file')+'</small></p>').join('')+button('Link a file','browseDrive',r.id,deal||''))}
function browseDrive(id,deal){
 if(!driveReady()){authoriseDrive(id,deal);return}
 popup('Link from Google Drive','<form class=tools id=driveSearch><input name=query aria-label="File name" placeholder="Search Drive by file name"><button class=primary>Search</button></form><div id=driveResults aria-live=polite></div>');
 const form=document.querySelector('#driveSearch'),out=document.querySelector('#driveResults');let version=0;
 async function search(term,pageToken=''){let request=++version;out.textContent='Searching Drive…';try{
 let literal=term.replaceAll('\\','\\\\').replaceAll("'","\\'"),params=new URLSearchParams({q:"trashed = false and mimeType != 'application/vnd.google-apps.folder'"+(term?" and name contains '"+literal+"'":''),fields:'nextPageToken,files(id,name,webViewLink,resourceKey)',orderBy:'modifiedTime desc',pageSize:'25',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});if(pageToken)params.set('pageToken',pageToken);
 let res=await fetch('https://www.googleapis.com/drive/v3/files?'+params,{headers:{Authorization:'Bearer '+driveToken},cache:'no-store'});if(res.status===401){endDrive();throw Error('Your Drive session expired. Reconnect in Connections.')}if(!res.ok)throw Error('Drive search failed ('+res.status+'). Check the Google Drive API is enabled and your account has access.');let data=await res.json();if(request!==version||!out.isConnected)return;out.replaceChildren();
 for(let x of data.files){let b=document.createElement('button');b.className='drive-result';b.textContent=x.name;b.onclick=async()=>{let r=get(id),files=r.driveFiles||[];if(files.some(v=>v.id===x.id&&v.deal===deal)){modal.close();return}b.disabled=true;let url=driveUrl(x.webViewLink)||'https://drive.google.com/open?'+new URLSearchParams({id:x.id,...(x.resourceKey?{resourcekey:x.resourceKey}:{})});try{await save({...r,driveFiles:[...files,{id:x.id,name:x.name,url,deal}],logs:[...r.logs,{kind:'File',text:'Linked '+x.name,at:now(),deal}]})}finally{b.disabled=false}};out.append(b)}
 if(!data.files.length)out.textContent='No files found.';if(data.nextPageToken){let b=document.createElement('button');b.textContent='Next page';b.onclick=()=>search(term,data.nextPageToken);out.append(b)}
 }catch(e){if(request===version)out.textContent=e.message}}
 form.onsubmit=e=>{e.preventDefault();search(form.elements.query.value.trim())};search('')
}
