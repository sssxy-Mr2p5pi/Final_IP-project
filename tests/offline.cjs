const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const resultDir=path.join(root,'evidence/tests');
fs.mkdirSync(path.join(resultDir,'screenshots'),{recursive:true});
const sha = file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const wait = ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn, description, timeout=10000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline) { if(await fn()) return; await wait(80); }
  throw new Error('Timed out: '+description);
}
async function verifyTarget(page,view) {
  const scene=await page.locator('.scene').boundingBox();
  const target=await page.getByRole('button',{name:'Inspect target'}).boundingBox();
  const x=(target.x+target.width/2-scene.x)/scene.width*1280;
  const y=(target.y+target.height/2-scene.y)/scene.height*720;
  const left=view==='A'?280:805;
  assert(x>=left && x<=left+180,`Target ${view} x alignment: ${x}`);
  assert(y>=310 && y<=455,`Target ${view} y alignment: ${y}`);
  assert(Math.abs(scene.width/scene.height-16/9)<0.01,'Scene aspect ratio');
}
async function verifyOne(browser, browserName, size, entry) {
  const context=await browser.newContext({viewport:size,offline:true});
  const page=await context.newPage();
  const errors=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/i.test(r.url())) remote.push(r.url());});
  try {
    await page.goto(pathToFileURL(entry).href);
    await page.getByRole('link',{name:'Start prototype',exact:true}).click();
    await page.getByRole('link',{name:'Option A',exact:true}).click();
    assert.equal(await page.locator('.choice-value').innerText(),'Option A');
    await verifyTarget(page,'A');
    await page.locator('.scene tw-link').click();
    await page.getByRole('heading',{name:/View B/}).waitFor();
    assert.equal(await page.locator('.choice-value').innerText(),'Option A');
    await verifyTarget(page,'B');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal page overflow');
    await page.getByRole('link',{name:'Option B',exact:true}).click();
    await page.locator('.scene tw-link').click();
    await page.getByRole('heading',{name:/View A/}).waitFor();
    assert.equal(await page.locator('.choice-value').innerText(),'Option B');
    await page.getByRole('button',{name:'Inspect target'}).click();
    await page.locator('#reader[open]').waitFor();
    assert((await page.locator('#reader-body').innerText()).includes('TEST CONTENT ONLY'));
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:/Open long text/}).click();
    await page.locator('#reader[open]').waitFor();
    const words=(await page.locator('#reader-body').innerText()).trim().split(/\s+/).length;
    assert.equal(words,2500);
    await page.locator('#font-size').focus();
    await page.keyboard.press('End');
    assert.equal(await page.locator('#font-output').innerText(),'28 px');
    const underlying=await page.getByRole('link',{name:'Option A',exact:true}).boundingBox();
    await page.mouse.click(underlying.x+underlying.width/2,underlying.y+underlying.height/2);
    assert.equal(await page.locator('.choice-value').innerText(),'Option B','Modal prevents background choice');
    const scrolling=await page.locator('#reader-body').evaluate(el=>{
      el.scrollTop=el.scrollHeight;return {top:el.scrollTop,overflow:el.scrollHeight>el.clientHeight};
    });
    assert(scrolling.overflow && scrolling.top>0,'Long text scrolls');
    const close=await page.locator('#reader-close').boundingBox();
    assert(close.y>=0 && close.y+close.height<=size.height,'Close control stays visible');
    await page.screenshot({path:path.join(resultDir,'screenshots',`${browserName}-${size.width}-reader.png`)});
    await page.locator('#reader-close').click();
    await page.getByRole('button',{name:'Play sound',exact:true}).click();
    await until(()=>page.evaluate(()=>!FinalIP.audio.paused && FinalIP.audio.currentTime>0.15),'audio playback');
    const first=await page.evaluate(()=>FinalIP.audio.currentTime);
    await page.getByRole('button',{name:'Play sound',exact:true}).click();
    const second=await page.evaluate(()=>FinalIP.audio.currentTime);
    assert(second>=first,'Repeated play does not restart the sound');
    await page.locator('.scene tw-link').click();
    await page.getByRole('heading',{name:/View B/}).waitFor();
    assert.equal(await page.locator('.audio-status').innerText(),'Sound playing.');
    await page.getByRole('button',{name:'Stop',exact:true}).click();
    assert(await page.evaluate(()=>FinalIP.audio.paused && FinalIP.audio.currentTime===0));
    const visible=await page.locator('main').innerText();
    assert(!/[\u3400-\u9fff]/.test(visible),'English player interface');
    assert(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete && i.naturalWidth===1280)),'Images load locally');
    await page.screenshot({path:path.join(resultDir,'screenshots',`${browserName}-${size.width}-scene.png`)});
    await page.getByRole('link',{name:'Restart',exact:true}).click();
    await page.getByRole('link',{name:'Start prototype',exact:true}).click();
    assert.equal(await page.locator('.choice-value').innerText(),'Not selected');
    assert.equal(await page.locator('.audio-status').innerText(),'Sound stopped.');
    assert.deepEqual(remote,[],'No network requests');
    assert.deepEqual(errors,[],'No script errors');
    assert.equal(await page.locator('tw-error').count(),0,'No Harlowe errors');
    return {browser:browserName,viewport:size,status:'passed',longTextWords:words,offline:true,remoteRequests:remote.length,checks:['local images','hotspot alignment A/B','A/B state across views','short text','long text scroll','text size','modal isolation','visible close','audio decode and time advance','repeat play','audio across view changes','stop','English UI','restart']};
  } finally {await context.close();}
}
(async()=>{
  const report={checkedAt:new Date().toISOString(),sourceSha256:sha(path.join(root,'src/story.twee')),htmlSha256:sha(path.join(root,'dist/index.html')),results:[],humanListening:'pending',secondComputer:'pending',status:'running'};
  try {
    const zip=path.join(root,'releases/final-ip-technical-prototype.zip');
    const extracted=path.join(root,'.local','unpacked-'+Date.now());
    const quote=s=>"'"+s.replaceAll("'","''")+"'";
    const unpack=spawnSync('powershell.exe',['-NoProfile','-Command',`$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath ${quote(zip)} -DestinationPath ${quote(extracted)}`],{encoding:'utf8',windowsHide:true});
    assert.equal(unpack.status,0,unpack.stderr);
    const packageRecord=JSON.parse(fs.readFileSync(path.join(resultDir,'package.json'),'utf8'));
    assert.equal(packageRecord.sourceSha256,report.sourceSha256,'Rebuild the package after source changes');
    assert.equal(packageRecord.sha256,sha(zip),'Package hash matches its build record');
    const expected=packageRecord.files.sort();
    const walk=(dir,prefix='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name]);
    assert.deepEqual(walk(extracted).sort(),expected,'Only allowlisted runtime files in ZIP');
    assert.equal(sha(path.join(extracted,'index.html')),report.htmlSha256);
    report.package={status:'passed',files:expected,sha256:sha(zip),extractedLocally:true};
    for(const [name,exe] of [['Chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'],['Edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]) {
      const browser=await chromium.launch({executablePath:exe,headless:true});
      try {
        for(const size of [{width:1366,height:768},{width:1920,height:1080},{width:800,height:600}]) {
          report.results.push(await verifyOne(browser,name,size,path.join(extracted,'index.html')));
          console.log(name+' '+size.width+'x'+size.height+' passed');
        }
      } finally {await browser.close();}
    }
    report.status='passed';
  } catch(e) {report.status='failed';report.error=e.stack;console.error(e.stack);process.exitCode=1;}
  finally {fs.writeFileSync(path.join(resultDir,'browser-tests.json'),JSON.stringify(report,null,2)+'\n');}
})();
