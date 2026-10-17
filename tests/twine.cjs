const {_electron:electron,chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const title='Final IP — Technical Prototype';
async function waitFile(file) {for(let i=0;i<100;i++){if(fs.existsSync(file)&&fs.statSync(file).size>0)return;await sleep(100);}throw new Error('Export file was not created');}
async function importStory(window,file){
 await window.getByRole('tab',{name:'Library',exact:true}).click();
 await window.getByRole('button',{name:'Import',exact:true}).click();
 await window.locator('input[type=file]').setInputFiles(file);
 await window.waitForTimeout(300);
 const selection=window.getByRole('checkbox',{name:title,exact:true});
 if(await selection.count()){
  if(await selection.getAttribute('aria-checked')!=='true')await selection.click();
  await window.getByRole('button',{name:'Import Selected Files',exact:true}).click();
 }
 await window.getByRole('button',{name:title,exact:true}).waitFor();
 await window.getByRole('button',{name:title,exact:true}).click();
}
async function exportStory(app,window,file){
 await window.getByRole('tab',{name:'Build',exact:true}).click();
 await app.evaluate(({session,BrowserWindow},target)=>{
  session.defaultSession.once('will-download',(_event,item)=>item.setSavePath(target));
  BrowserWindow.getAllWindows().forEach(w=>w.show());
 },file);
 await window.getByRole('button',{name:'Export As Twee',exact:true}).click();
 await waitFile(file);
}
function compare(expected,actual){
 const map=rows=>Object.fromEntries(rows.map(p=>[p.tags.includes('script')?'__script':p.tags.includes('stylesheet')?'__style':p.name,{...p,tags:[...p.tags].sort()}]));
 const left=map(expected),right=map(actual);
 assert.deepEqual(Object.keys(right).sort(),Object.keys(left).sort(),'Passage set');
 for(const name of Object.keys(left)){
  if(name==='StoryData'){
   const a=JSON.parse(left[name].body),b=JSON.parse(right[name].body);
   for(const key of ['ifid','format','format-version','start'])assert.equal(b[key],a[key],key);
  } else {
   assert.equal(right[name].body,left[name].body,'Passage body: '+name);
   assert.deepEqual(right[name].tags,left[name].tags,'Passage tags: '+name);
  }
 }
 return Object.keys(left);
}
(async()=>{
 const {passages}=await import(pathToFileURL(path.join(root,'scripts/project.mjs')).href);
 const profile=path.join(root,'.local','twine-test-'+Date.now());
 fs.mkdirSync(profile,{recursive:true});
 fs.writeFileSync(path.join(profile,'prefs.json'),JSON.stringify({locale:'en-us',welcomeSeen:true,storyFormat:{name:'Harlowe',version:'3.3.9'}}));
 const library=path.join(profile,'stories'),backups=path.join(profile,'backups');
 const scratch=path.join(profile,'scratch');
 fs.mkdirSync(scratch,{recursive:true});
 fs.cpSync(path.join(root,'dist/assets'),path.join(scratch,'assets'),{recursive:true});
 fs.writeFileSync(path.join(profile,'app-prefs.json'),JSON.stringify({storyLibraryFolderPath:library,backupFolderPath:backups,scratchFolderPath:scratch}));
 const report={checkedAt:new Date().toISOString(),status:'running',sourceSha256:hash(path.join(root,'src/story.twee')),humanEditorTrial:'pending',method:'Actual Twine desktop import and Export As Twee. Native download destination set by the test.'};
 let app;
 try{
  app=await electron.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Programs/Twine/Twine.exe'),args:['--user-data-dir='+profile,'--storyLibraryFolderPath='+library,'--backupFolderPath='+backups],timeout:30000});
  const window=await app.firstWindow();await window.waitForLoadState('domcontentloaded');
  await window.getByRole('tab',{name:'Library',exact:true}).waitFor();
  await importStory(window,path.join(root,'dist/index.html'));
  const first=path.join(profile,'first-export.twee');await exportStory(app,window,first);
  await app.evaluate(({shell})=>{
   globalThis.finalIPPreviewPath=null;
   shell.openExternal=async url=>{globalThis.finalIPPreviewPath=url;};
   shell.openPath=async file=>{globalThis.finalIPPreviewPath=file;return '';};
  });
  await window.getByRole('button',{name:'Play',exact:true}).click();
  let nativePreview;
  for(let i=0;i<100;i++){
   nativePreview=await app.evaluate(()=>globalThis.finalIPPreviewPath);
   if(nativePreview)break;
   await sleep(100);
  }
  assert(nativePreview,'Twine Play opens a local preview');
  console.log('Twine Play path: '+nativePreview);
  const original=passages(fs.readFileSync(path.join(root,'src/story.twee'),'utf8'));
  const exported=passages(fs.readFileSync(first,'utf8'));
  report.firstExportPassages=compare(original,exported);
  const runtime=path.join(profile,'runtime');fs.mkdirSync(runtime,{recursive:true});
  const compiled=path.join(runtime,'index.html');
  const build=spawnSync(path.join(root,'.tools/tweego/tweego.exe'),['-f','harlowe-3','-o',compiled,first],{encoding:'utf8',windowsHide:true,env:{...process.env,TWEEGO_PATH:path.join(root,'.tools/storyformats')}});
  assert.equal(build.status,0,build.stderr);
  fs.cpSync(path.join(root,'dist/assets'),path.join(runtime,'assets'),{recursive:true});
  await importStory(window,compiled);
  const second=path.join(profile,'second-export.twee');await exportStory(app,window,second);
  report.secondExportPassages=compare(original,passages(fs.readFileSync(second,'utf8')));
  report.exportSha256=[hash(first),hash(second)];
  report.ifid='68419E4A-05BC-4A6D-904C-7F7E391BA8A2';
  await window.getByRole('button',{name:title,exact:true}).dblclick();
  await window.waitForTimeout(400);
  await window.screenshot({path:path.join(root,'evidence/tests/screenshots/twine-story-map.png')});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
   const context=await browser.newContext({offline:true});let page=await context.newPage();
   await page.goto(nativePreview.startsWith('file:')?nativePreview:pathToFileURL(nativePreview).href);
   await page.getByRole('link',{name:'Start prototype',exact:true}).click();
   assert(await page.locator('.scene img').evaluate(img=>img.complete&&img.naturalWidth===1280),'Twine native Play loads its local image');
   await page.getByRole('button',{name:'Play sound',exact:true}).click();
   await page.waitForFunction(()=>!FinalIP.audio.paused&&FinalIP.audio.currentTime>0.1);
   report.nativePlay='passed: offline image and audio in the configured scratch folder';
   // A fresh tab avoids Harlowe's per-tab recovery for the same story IFID.
   await page.close();page=await context.newPage();
   await page.goto(pathToFileURL(compiled).href);
   await page.getByRole('link',{name:'Start prototype',exact:true}).click();
   await page.getByRole('link',{name:'Option B',exact:true}).click();
   await page.locator('.scene tw-link').click();
   await page.getByRole('heading',{name:/View B/}).waitFor();
   assert.equal(await page.locator('.choice-value').innerText(),'Option B');
   await page.getByRole('button',{name:/Open long text/}).click();
   assert.equal((await page.locator('#reader-body').innerText()).trim().split(/\s+/).length,2500);
   report.recompiledRuntime='passed: offline navigation, shared state and long text';
  }finally{await browser.close();}
  report.status='passed';console.log('Twine import / export / compile / reimport passed.');
 }catch(e){report.status='failed';report.error=e.stack;console.error(e);process.exitCode=1;}
 finally{if(app)await app.close();fs.writeFileSync(path.join(root,'evidence/tests/twine-roundtrip.json'),JSON.stringify(report,null,2)+'\n');}
})();
