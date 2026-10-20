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
const css=fs.readFileSync(path.join(__dirname,'study.css'),'utf8');
const maskData=css.match(/mask-image:url\("data:image\/svg\+xml;base64,([^"]+)"\)/);
assert(maskData,'Offline mask embedded');
assert(Buffer.from(maskData[1],'base64').equals(fs.readFileSync(path.join(__dirname,'assets/ink-fragments.svg'))),'Embedded mask matches source');
const crypto=require('node:crypto');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'sources.json'),'utf8'));
for(const asset of source.assets) {
  const bytes=fs.readFileSync(path.join(__dirname,asset.file));
  assert.equal(bytes.length,asset.bytes,asset.file);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.file);
}
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
    assert(['FIP Rock Salt','FIP Caveat','FIP Kalam'].every(name=>fonts.some(f=>f.family===name&&f.status==='loaded')),'Initial handwriting fonts loaded');
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
    await page.waitForTimeout(750);
    await word.click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.is-scattering').count(),1);
    assert(await word.locator('.ink-fragments').first().evaluate(el=>getComputedStyle(el).maskImage.includes('data:image/svg+xml')));
    assert(await word.locator('.ink-fragments').first().evaluate(el=>el.getAnimations().some(a=>a.playState==='running')));
    assert(sameRect(before,await word.boundingBox()),'Scatter target stays fixed');
    await page.screenshot({path:path.join(shots,`${label}-scatter.png`),fullPage:true,animations:'allow'});
    await word.evaluate(el=>{for(let i=0;i<11;i++)el.click();});
    assert.equal(await page.locator('.is-scattering').count(),1,'Rapid clicks keep only one burst');
    assert.equal(await page.locator('.ink-fragments').count(),9,'Particle layers stay bounded');
    await page.waitForTimeout(800);
    assert.equal(await page.locator('.is-scattering').count(),0,'Burst ends');
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
    assert.equal(await page.locator('.is-moving,.is-scattering').count(),0);
    assert.equal(await word.locator('.glyph').evaluate(el=>getComputedStyle(el).animationName),'none');
    const staticInk = await word.locator('.glyph').evaluate(el=>getComputedStyle(el,'::after').opacity);
    assert(Number(staticInk)>0,'Reduced motion keeps static ink');
    await word.click();
    assert.equal(await page.locator('.is-scattering').count(),0,'Reduced motion blocks click bursts');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await word.click();
    // Controlled visibility event; actual OS tab switching remains a manual check.
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await page.locator('.is-moving,.is-scattering').count(),0,'Simulated background cancels all effects');
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});

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
      if(name==='Diary') {
        await page.evaluate(()=>document.fonts.ready);
        assert((await page.locator('.drawer-copy').evaluate(el=>getComputedStyle(el).fontFamily)).includes('FIP Reenie'));
        assert(await page.evaluate(()=>[...document.fonts].some(f=>f.family==='FIP Reenie'&&f.status==='loaded')));
        await page.screenshot({path:path.join(shots,`${label}-diary.png`),fullPage:true});
      }
    }
    await page.screenshot({path:path.join(shots,`${label}-drawer.png`),fullPage:true});
    await page.keyboard.press('Escape');
    assert(await page.locator('.drawer').isHidden());
    assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Crew log','Escape returns focus');
    await page.getByRole('button',{name:'Reports',exact:true}).click();
    await page.getByRole('button',{name:'Reports',exact:true}).click();
    assert(await page.locator('.drawer').isHidden(),'Selecting active drawer closes it');


    async function drawerGeometry() {
      const d=await page.locator('.drawer').boundingBox(),r=await page.locator('.reading-scroll').boundingBox();
      const line=await page.locator('.reading-scroll').evaluate(el=>parseFloat(getComputedStyle(el).lineHeight));
      assert(d.height<=size.height/2&&r.height>=line*2&&r.y+r.height<=d.y+1,'Drawer leaves two unobscured Thinking lines');
      assert.equal(await page.locator('[data-drawer][aria-expanded=true]').count(),1);
    }
    await page.getByRole('button',{name:'Terminal',exact:true}).click();
    await drawerGeometry();
    await page.getByRole('button',{name:'Add They',exact:true}).focus();
    await page.keyboard.press('Enter');
    for(const t of ['still','talk','to','me.']) await page.getByRole('button',{name:`Add ${t}`,exact:true}).click();
    assert.equal(await page.locator('output').innerText(),'They still talk to me.');
    assert(await page.getByRole('button',{name:'Add They',exact:true}).isDisabled());
    assert(await page.getByRole('button',{name:'Move They left',exact:true}).isDisabled());
    assert(await page.getByRole('button',{name:'Move me. right',exact:true}).isDisabled());
    await page.getByRole('button',{name:'Move still right',exact:true}).click();
    assert.equal(await page.locator('output').innerText(),'They talk still to me.');
    await page.getByRole('button',{name:'Move still left',exact:true}).focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('output').innerText(),'They still talk to me.');
    const composerRect=await page.locator('.composer').boundingBox();
    const outputRect=await page.locator('output').boundingBox();
    assert(outputRect.y>=composerRect.y&&outputRect.y+outputRect.height<=composerRect.y+composerRect.height+1,'Sentence remains visible without scrolling');
    await page.screenshot({path:path.join(shots,`${label}-terminal.png`),fullPage:true});
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Terminal');
    await page.getByRole('button',{name:'Terminal',exact:true}).click();
    assert.equal(await page.locator('output').innerText(),'They still talk to me.','Closing preserves the sentence');
    await page.getByRole('link',{name:/Camera/}).click();
    await page.waitForFunction(()=>document.querySelector('.camera-open'));
    await drawerGeometry();
    assert(await page.locator('.left-rail').isHidden());
    const cameraRect=await page.locator('.camera-view').boundingBox();
    assert(Math.abs(cameraRect.width/sheet.width-.6)<.01);
    assert.equal(await page.locator('output').innerText(),'They still talk to me.');
    await page.screenshot({path:path.join(shots,`${label}-camera-terminal.png`),fullPage:true});
    await page.keyboard.press('Escape');
    for(const n of ['one','two','three','four']) {
      await page.getByRole('button',{name:`Select camera ${n}`,exact:true}).click();
      assert.equal(await page.locator('.camera-tile[aria-pressed=true]').count(),1);
    }
    await page.getByRole('button',{name:'Select camera one',exact:true}).click();
    await page.screenshot({path:path.join(shots,`${label}-camera.png`),fullPage:true});
    await page.goBack();
    await page.waitForFunction(()=>!document.querySelector('.camera-open'));
    await page.goForward();
    await page.waitForFunction(()=>document.querySelector('.camera-open'));
    await page.getByRole('link',{name:'Return to Self',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.camera-open'));
    await page.getByRole('button',{name:'Terminal',exact:true}).click();
    assert.equal(await page.locator('output').innerText(),'They still talk to me.');
    await page.getByRole('button',{name:'Remove talk',exact:true}).click();
    assert.equal(await page.locator('output').innerText(),'They still to me.');
    assert(await page.getByRole('button',{name:'Add talk',exact:true}).isEnabled());
    await page.getByRole('button',{name:'Clear',exact:true}).click();
    assert.equal(await page.locator('.chosen-token').count(),0);
    await page.getByRole('button',{name:'Add They',exact:true}).click();
    await page.keyboard.press('Escape');

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
    await reading.evaluate(el=>{el.scrollTop=180;});
    const savedScroll=await reading.evaluate(el=>el.scrollTop);
    const savedText=await page.locator('#long-copy').textContent();
    await page.getByRole('link',{name:/Camera/}).click();
    await page.waitForFunction(()=>document.querySelector('.camera-open'));
    assert.equal(await reading.evaluate(el=>el.scrollTop),savedScroll,'Camera preserves reading offset');
    assert.equal(await page.locator('#long-copy').textContent(),savedText,'No automatic narration');
    await page.getByRole('button',{name:'Reports',exact:true}).click();
    await drawerGeometry();
    await page.keyboard.press('Escape');
    await page.getByRole('link',{name:'Return to Self',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.camera-open'));
    await reading.evaluate(el=>{el.scrollTop=0;});
    await page.screenshot({path:path.join(shots,`${label}-long.png`),fullPage:true});
    assert(!/[\u3400-\u9fff]/.test(await page.locator('body').innerText()),'Visible study content is English');
    for(const [selector,family] of [['.short-copy','FIP Rock Salt'],['.self-copy','FIP Caveat'],['.terminal-title','FIP Kalam'],['#long-copy','FIP Kalam']]) {
      assert((await page.locator(selector).evaluate(el=>getComputedStyle(el).fontFamily)).includes(family));
    }
    assert(await page.evaluate(()=>[...document.images].every(i=>i.complete&&i.naturalWidth===1280)));
    const finalFonts=await page.evaluate(()=>[...document.fonts].map(f=>({family:f.family,status:f.status})));
    assert(finalFonts.length===7&&finalFonts.every(f=>f.status==='loaded'));
    await page.reload();
    await page.getByRole('button',{name:'Terminal',exact:true}).click();
    assert.equal(await page.locator('.chosen-token').count(),0,'Reload clears sentence');
    assert.deepEqual(errors,[],'No JavaScript errors');
    assert.deepEqual(remote,[],'No network requests');
    assert.deepEqual(failed,[],'No missing local resources');
    results.push({channel,viewport:size,status:'passed',fonts:finalFonts,longWords:longResult.words,checks:['offline assets','geometry','stable click targets','max two animated words','keyboard words','three treatments','reduced motion','five drawers','scatter with bounded layers','font roles','sentence add remove reorder clear','ephemeral composition','camera selection and history','reading position','simulated visibility event','Thinking visibility','scrollable long text','English-only display'],screenshots:['normal','motion','selected','scatter','drawer','diary','terminal','camera','camera-terminal','long'].map(kind=>`screenshots/ui-study/${label}-${kind}.png`)});
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
    fs.writeFileSync(path.join(evidence,'ui-study.json'),JSON.stringify({checkedAt:new Date().toISOString(),scope:'Standalone handwriting study; not Harlowe integration; background visibility event simulated',results},null,2)+'\n');
  }
  console.log(JSON.stringify({passed:results.length,results:results.map(r=>({channel:r.channel,viewport:r.viewport,status:r.status}))},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
