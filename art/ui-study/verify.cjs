// Run from the project: node art/ui-study/verify.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '../..');
const evidence = path.join(root, 'evidence/tests');
const shots = path.join(evidence, 'screenshots/ui-study');
fs.mkdirSync(shots, {recursive:true});
const sizes = [{width:1920,height:1080},{width:1366,height:768},{width:800,height:600}];
const url = pathToFileURL(path.join(__dirname, 'index.html')).href;
const results = [];
const sameRect = (a,b) => ['x','y','width','height'].every(key=>Math.abs(a[key]-b[key])<.1);

async function verify(browser, channel, size) {
  const context = await browser.newContext({viewport:size,offline:true});
  const page = await context.newPage();
  const errors = [], remote = [], failed = [];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/.test(request.url())) remote.push(request.url());});
  page.on('requestfailed',request=>failed.push(request.url()));
  const label = `${channel}-${size.width}x${size.height}`;
  try {
    await page.goto(url);
    await page.evaluate(()=>document.fonts.ready);
    const fonts = await page.evaluate(()=>[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})));
    assert(fonts.length===3 && fonts.every(f=>f.status==='loaded'),'All local fonts loaded');
    assert(await page.locator('.camera-frame img').evaluate(image=>image.complete&&image.naturalWidth===1280),'Local image loaded');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page horizontal overflow');
    assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2),'Desktop study fits viewport');
    assert.equal(await page.locator('body').getAttribute('data-mode'),'motion');
    const self=await page.locator('.left-rail').boundingBox(), sheet=await page.locator('.paper-grid').boundingBox();
    assert(Math.abs(self.width/sheet.width-.3)<.01,'Thirty percent left column');
    await page.screenshot({path:path.join(shots,`${label}-normal.png`),fullPage:true});

    // Observe the actual recurring animation and ensure its hit areas remain fixed.
    const word = page.locator('[data-motion-word]').first();
    const otherParagraph = page.locator('.quiet-copy');
    const before = await word.boundingBox(), paragraphBefore = await otherParagraph.boundingBox();
    await page.evaluate(()=>{
      window.__motionSamples=[];
      window.__motionProbe=setInterval(()=>{
        const words=[...document.querySelectorAll('[data-motion-word]')];
        window.__motionSamples.push({
          active:words.filter(w=>w.querySelector('.glyph').getAnimations().some(a=>a.playState==='running')).length,
          rect:words[0].getBoundingClientRect().toJSON()
        });
      },15);
    });
    await page.waitForFunction(()=>window.__motionSamples.some(s=>s.active>0),null,{timeout:8000});
    await page.screenshot({path:path.join(shots,`${label}-motion.png`),fullPage:true,animations:'allow'});
    await page.waitForTimeout(350);
    const samples = await page.evaluate(()=>{clearInterval(window.__motionProbe);return window.__motionSamples;});
    assert(samples.some(s=>s.active>0)&&samples.every(s=>s.active<=2),'At most two words animate');
    assert(samples.every(s=>sameShape(s.rect)), 'Motion samples are finite');
    function sameShape(rect){return Number.isFinite(rect.x)&&Number.isFinite(rect.y);}
    assert(samples.every(s=>sameRect(before,s.rect)),'Animated word hit box stays fixed');
    assert(sameRect(paragraphBefore,await otherParagraph.boundingBox()),'Other paragraphs do not move');
    await word.click();
    assert.equal(await word.getAttribute('aria-pressed'),'true','Decoration does not intercept clicks');
    assert(sameRect(before,await word.boundingBox()),'Selected word does not reflow');
    await page.screenshot({path:path.join(shots,`${label}-selected.png`),fullPage:true});
    await word.focus();
    await page.keyboard.press('Space');
    assert.equal(await word.getAttribute('aria-pressed'),'false','Keyboard operates word');

    await page.getByRole('button',{name:'Ink',exact:true}).click();
    assert.equal(await page.locator('body').getAttribute('data-mode'),'ink');
    assert.equal(await page.locator('.is-moving').count(),0,'Ink stops recurring motion');
    await page.getByRole('button',{name:'Clean',exact:true}).click();
    assert.equal(await page.locator('body').getAttribute('data-mode'),'clean');
    const echo = await word.locator('.glyph').evaluate(el=>getComputedStyle(el,'::after').opacity);
    assert.equal(echo,'0','Clean removes ghost text');
    await page.getByRole('button',{name:'Local motion',exact:true}).click();
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#motion-status').textContent.includes('reduced'));
    assert.match(await page.locator('#motion-status').innerText(),/reduced/);
    await page.waitForTimeout(50);
    assert.equal(await page.locator('.is-moving').count(),0);
    assert.equal(await word.locator('.glyph').evaluate(el=>getComputedStyle(el).animationName),'none');
    const staticInk = await word.locator('.glyph').evaluate(el=>getComputedStyle(el,'::after').opacity);
    assert(Number(staticInk)>0,'Reduced motion keeps static ink');
    await page.emulateMedia({reducedMotion:'no-preference'});

    for (const name of ['Pending','Reports','Diary','Crew log']) {
      const trigger=page.getByRole('button',{name,exact:true});
      await trigger.click();
      assert.equal(await trigger.getAttribute('aria-expanded'),'true');
      const drawer=await page.locator('.drawer').boundingBox();
      const reader=await page.locator('.reading-scroll').boundingBox();
      const lineHeight=await page.locator('.reading-scroll').evaluate(el=>parseFloat(getComputedStyle(el).lineHeight));
      assert(drawer.height<=size.height/2,'Drawer occupies at most half viewport');
      assert(reader.height>=lineHeight*2,'Thinking retains at least two body lines');
      assert(reader.y+reader.height<=drawer.y+1,'Drawer does not cover Thinking reading region');
      assert.equal(await page.locator('#drawer-title').innerText(),name);
    }
    await page.screenshot({path:path.join(shots,`${label}-drawer.png`),fullPage:true});
    await page.keyboard.press('Escape');
    assert(await page.locator('.drawer').isHidden());
    assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Crew log','Escape returns focus');
    await page.getByRole('button',{name:'Reports',exact:true}).click();
    await page.getByRole('button',{name:'Reports',exact:true}).click();
    assert(await page.locator('.drawer').isHidden(),'Selecting active drawer closes it');

    await page.getByRole('button',{name:/^Long text/}).click();
    const reading = page.locator('.reading-scroll');
    const longResult=await reading.evaluate(el=>{
      const p=el.querySelector('#long-copy');
      el.scrollTop=el.scrollHeight;
      return {words:[...p.children].map(node=>node.textContent).join(' ').trim().split(/\s+/).length,top:el.scrollTop,overflow:el.scrollWidth>el.clientWidth+1,last:p.lastElementChild.textContent};
    });
    assert(longResult.words>=2000&&longResult.top>0&&!longResult.overflow,'Long text is readable and scrollable');
    await page.getByRole('button',{name:'Reports',exact:true}).click();
    const withDrawer = await reading.boundingBox();
    const lineHeight = await reading.evaluate(el=>parseFloat(getComputedStyle(el).lineHeight));
    assert(withDrawer.height>=lineHeight*2,'Long text retains two lines with drawer');
    await page.keyboard.press('Escape');
    await reading.evaluate(el=>{el.scrollTop=0;});
    await page.screenshot({path:path.join(shots,`${label}-long.png`),fullPage:true});
    assert(!/[\u3400-\u9fff]/.test(await page.locator('body').innerText()),'Visible study content is English');
    assert.deepEqual(errors,[],'No JavaScript errors');
    assert.deepEqual(remote,[],'No network requests');
    assert.deepEqual(failed,[],'No missing local resources');
    results.push({channel,viewport:size,status:'passed',fonts,longWords:longResult.words,checks:['offline assets','geometry','stable click targets','max two animated words','keyboard words','three treatments','reduced motion','four drawers','Thinking visibility','scrollable long text','English-only display'],screenshots:['normal','motion','selected','drawer','long'].map(kind=>`screenshots/ui-study/${label}-${kind}.png`)});
  } catch (error) {
    await page.screenshot({path:path.join(shots,`${label}-failure.png`),fullPage:true});
    results.push({channel,viewport:size,status:'failed',error:error.stack,errors,remote,failed});
    throw error;
  } finally {await context.close();}
}

(async()=>{
  try {
    for (const channel of ['chrome','msedge']) {
      const browser=await chromium.launch({channel,headless:true});
      try {for (const size of sizes) await verify(browser,channel,size);}
      finally {await browser.close();}
    }
  } finally {
    fs.writeFileSync(path.join(evidence,'ui-study.json'),JSON.stringify({checkedAt:new Date().toISOString(),scope:'Standalone visual study; not Harlowe integration or formal story validation',results},null,2)+'\n');
  }
  console.log(JSON.stringify({passed:results.length,results:results.map(r=>({channel:r.channel,viewport:r.viewport,status:r.status}))},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
