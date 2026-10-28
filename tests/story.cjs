const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/tests');
const report={checkedAt:new Date().toISOString(),status:'running',sourceSha256:createHash('sha256').update(fs.readFileSync(path.join(root,'src/story.twee'))).digest('hex'),runtimeSha256:createHash('sha256').update(fs.readFileSync(process.env.FINAL_IP_ENTRY||path.join(root,'dist/index.html'))).digest('hex'),cases:[],screenshots:[],authorTrial:'pending',anotherComputer:'pending',speakerListening:'pending'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function click(p,t){await (['Terminal','Pending','Reports','Diary','Crew logs'].includes(t)?p.getByRole('button',{name:t,exact:true}):p.getByText(t,{exact:true})).first().click();await sleep(60);}
async function scene(p,s){await p.waitForSelector(`.story-shell[data-scene="${s}"]`);assert.equal(await p.locator('tw-error').count(),0,await p.locator('tw-error').allTextContents());}
async function start(p){await click(p,'进入故事');await scene(p,'TMinus3');await click(p,'下一段（字幕占位）');await click(p,'下一段（字幕占位）');for(const s of ['TMinus2','TMinus1','T0']){await click(p,'进入下一场（开发占位）');await scene(p,s);}}
async function state(p){return p.locator('#flags').textContent();}
async function panel(p,name){await click(p,name);return p.locator('.drawer-body').innerText();}
async function route(p,warning,actions){
 await start(p);await click(p,'暂缓，先查看记录');await scene(p,'T0');assert(!(await state(p)).includes('交付：true'));
 await click(p,'执行航路预测');await click(p,warning==='reveal'?'公布预言结论':'隐瞒，只报有限航路');await scene(p,'T05');
 await click(p,'有效警告送达并避险');await scene(p,'T1');await click(p,'进入下一场（开发占位）');await scene(p,'T2');await click(p,'进入下一场（开发占位）');await scene(p,'T3');
 for(const a of actions){await click(p,a==='R'?'交出完整报告':'执行自身预测');if(a==='P'){await scene(p,'SelfVision');await click(p,'查看预测后继续');}}
 if(actions.length<2)await click(p,'结束交易');
 await scene(p,'T4');
}
async function run(browser,label,size){
 for(const warning of ['reveal','hide'])for(const [order,ending] of [[[],'E1'],[['R','P'],'E2'],[['P','R'],'E3'],[['P'],'E3'],[['R'],'E5']]){
  const c=await browser.newContext({viewport:size,offline:true}),p=await c.newPage(),errors=[],remote=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
  try{
   await p.goto(pathToFileURL((process.env.FINAL_IP_ENTRY||path.join(root,'dist/index.html'))).href);await route(p,warning,order);
   assert.equal((await p.locator('#route-state').textContent()).trim(),ending);assert((await state(p)).includes('公开：false'));assert((await state(p)).includes('封锁：false'));
   const diary=await panel(p,'Diary');assert.equal(diary.includes('未来视觉中断'),order.includes('P'));assert.equal(diary.includes('曾告知预言'),warning==='reveal');
   await click(p,'Diary');await click(p,'Diary');assert.equal(await p.locator('.drawer-body').innerText(),diary);await p.keyboard.press('Escape');
   await click(p,'Camera ↗');assert.equal(await p.locator('.camera-grid img').count(),4);await click(p,'回到 Self');
   assert(await p.locator('img:visible').evaluateAll(xs=>xs.every(x=>x.complete&&x.naturalWidth>0)));
   if(ending==='E1'){await click(p,'时间跳转至收束');await scene(p,'T7');assert(!(await p.locator('#visited').textContent()).includes('T5'));}
   else {await click(p,'进入下一场（开发占位）');await scene(p,'T5');assert((await state(p)).includes('封锁：'+String(ending==='E5')));assert((await state(p)).includes('公开：'+String(ending==='E2'||ending==='E3'&&order.includes('R'))));
    await click(p,'进入下一场（开发占位）');await scene(p,'T6');assert((await state(p)).includes('退化：'+String(ending!=='E5')));assert((await state(p)).includes('封锁：'+String(ending==='E5')));await click(p,'进入下一场（开发占位）');await scene(p,'T7');}
   await click(p,'查看本次收尾');await scene(p,ending);
   if(['E2','E5'].includes(ending)){await click(p,'进入下一场（开发占位）');await scene(p,'Final'+ending);}
   assert.equal(remote.length,0);assert.deepEqual(errors,[]);report.cases.push({browser:label,size,warning,order,ending,status:'passed'});
   await click(p,'重新开始');await p.getByText('进入故事',{exact:true}).waitFor();
  }finally{await c.close();}
 }
 for(const warning of ['reveal','hide'])for(const reason of ['未执行预测','执行但无有效回答','预测正确但未告知']){
  const c=await browser.newContext({viewport:size,offline:true}),p=await c.newPage();try{
   await p.goto(pathToFileURL((process.env.FINAL_IP_ENTRY||path.join(root,'dist/index.html'))).href);await start(p);await click(p,'执行航路预测');await click(p,warning==='reveal'?'公布预言结论':'隐瞒，只报有限航路');await click(p,reason);await scene(p,'E4');
   const d=await panel(p,'Diary');assert.equal(d.includes('警告未送达'),reason==='预测正确但未告知');assert(!d.includes('未来视觉中断'));assert.equal(d.includes('本次未执行轨迹预测'),reason==='未执行预测');assert.equal(d.includes('本次执行了轨迹预测'),reason==='执行但无有效回答');await click(p,'Reports');const r=await p.locator('.drawer-body').innerText();assert.equal(r.includes('本次已执行轨迹预测'),reason!=='未执行预测');assert(!(await p.locator('#visited').textContent()).includes('T3'));await click(p,'Crew logs');assert((await p.locator('.drawer-body').innerText()).includes('全员获救'));
   report.cases.push({browser:label,size,warning,reason,ending:'E4',status:'passed'});
  }finally{await c.close();}
 }
 const c=await browser.newContext({viewport:size,offline:true}),p=await c.newPage();try{
  await p.goto(pathToFileURL((process.env.FINAL_IP_ENTRY||path.join(root,'dist/index.html'))).href);await route(p,'reveal',['R','P']);await sleep(700);
  for(const drawer of ['Terminal','Pending','Reports','Diary','Crew logs']){await panel(p,drawer);const d=await p.locator('.drawer').boundingBox(),t=await p.locator('.thinking-scroll').boundingBox();assert(d.height<=size.height/2+1);assert(t.height>=64);await p.keyboard.press('Escape');}
  await panel(p,'Terminal');await click(p,'They');await click(p,'still');await click(p,'Camera ↗');await click(p,'回到 Self');assert((await p.locator('.sentence').innerText()).includes('They'));
  await p.locator('.sentence').getByRole('button',{name:'左移',exact:true}).nth(1).click();assert((await p.locator('.sentence span').first().innerText()).startsWith('still'));
  await p.locator('.sentence').getByRole('button',{name:'They',exact:true}).click();assert.equal(await p.locator('.sentence span').count(),1);
  await click(p,'清空');assert.equal(await p.locator('.sentence span').count(),0);await p.getByRole('button',{name:'They',exact:true}).focus();await p.keyboard.press('Enter');assert.equal(await p.locator('.sentence span').count(),1);
  await p.keyboard.press('Escape');assert.equal(await p.getByRole('button',{name:'Terminal',exact:true}).evaluate(x=>x===document.activeElement),true);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const file=`story-${label}-${size.width}.png`;await p.screenshot({path:path.join(out,'screenshots',file)});report.screenshots.push(file);
 }finally{await c.close();}
}
(async()=>{fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});try{for(const [label,exe] of [['chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'],['edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]){
 const b=await chromium.launch({executablePath:exe,headless:true});try{for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:800,height:600}]){await run(b,label,size);console.log(label,size.width,'passed');}}finally{await b.close();}}
 report.status='passed';}catch(e){report.status='failed';report.error=e.stack;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'story-tests.json'),JSON.stringify(report,null,2));}})();
