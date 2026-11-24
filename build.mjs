import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8').replace('BRANDCSS',()=>fs.readFileSync('brand.css','utf8')).replace('EXTRAS',()=>['sales.js','gmail.js','records.js','drive.js','prospects.js','workspace.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n')), script=html.split('<script>')[1].split('</script>')[0];
new Function(script);
fs.mkdirSync('dist/server',{recursive:true});
fs.mkdirSync('dist/.openai',{recursive:true});fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
fs.writeFileSync('dist/server/index.js','const assets='+JSON.stringify(Object.fromEntries(['archivo-regular.ttf','archivo-bold.ttf','mark.svg'].map(f=>['/'+f,[f.endsWith('ttf')?'font/ttf':'image/svg+xml',fs.readFileSync(f).toString('base64')]])))+';const html='+JSON.stringify(html)+';\n'+fs.readFileSync('website.mjs','utf8')+'\n'+fs.readFileSync('server.mjs','utf8'))
