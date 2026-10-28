import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CAMPUS_PLAYWRIGHT || 'playwright');
const base = process.env.CAMPUS_BASE || 'http://localhost:8790';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Use a local preview');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
try {
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, reducedMotion: 'reduce' });
  await page.goto(base);
  await page.locator('#login').waitFor({ state: 'visible' });
  // Inspect real controls and their computed styles without creating private account data.
  async function contrast(selector) {
    return page.locator(selector).evaluateAll(elements => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      function rgb(value) { ctx.clearRect(0,0,1,1); ctx.fillStyle=value; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data]; }
      const blend = (top, bottom) => top.slice(0,3).map((v,i)=>v*top[3]/255+bottom[i]*(1-top[3]/255));
      const lum = color => color.slice(0,3).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
      return elements.filter(e=>!e.matches(':disabled')&&!e.querySelector('input:disabled')).map(e=>{
        const ancestors=[]; for(let node=e;node;node=node.parentElement)ancestors.unshift(node);
        let background=[255,255,255];
        for(const node of ancestors)background=blend(rgb(getComputedStyle(node).backgroundColor),background);
        const text=blend(rgb(getComputedStyle(e).color),background);
        const a=lum(text),b=lum(background);
        return {text:e.textContent.trim(),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      });
    });
  }
  for (const theme of ['light','dark']) {
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    if(theme==='light')check(await page.locator('#login-form .primary').evaluate(e=>getComputedStyle(e).backgroundImage)==='none','Light primary action must have a solid fill');
    for (const tab of ['login','register']) {
      await page.locator(`[data-auth="${tab}"]`).click();
      await page.mouse.move(0,0);
      await page.waitForTimeout(250);
      for(const item of await contrast('.auth-tabs button,.login-locale button'))check(item.ratio>=4.5,`${theme}/${tab}: ${item.text} contrast ${item.ratio.toFixed(2)}`);
    }
    await page.evaluate(()=>{document.querySelector('#login').classList.add('hidden');document.querySelector('#app').classList.remove('hidden')});
    await page.locator('#add-task').click();
    await page.locator('#task-dialog').waitFor({state:'visible'});
    for(const selector of ['#task-dialog .choices label','#priority-segments button','#offset-chips .chip']) {
      for(const item of await contrast(selector))check(item.ratio>=4.5,`${theme}/task: ${item.text} contrast ${item.ratio.toFixed(2)}`);
    }
    const weekday=page.locator('.weekdays label').first();
    await weekday.click(); await weekday.click();
    check(await weekday.locator('input').isChecked(),`${theme}: checkbox interaction`);
    await page.locator('#priority-segments [data-priority="1"]').click();
    check(await page.locator('#priority-segments [data-priority="1"]').getAttribute('aria-checked')==='true',`${theme}: priority interaction`);
    await page.locator('#cancel-task').click();
    await page.evaluate(()=>{document.querySelector('#app').classList.add('hidden');document.querySelector('#login').classList.remove('hidden')});
  }
  await page.evaluate(()=>{document.querySelector('#app').classList.remove('hidden');document.querySelector('#login').classList.add('hidden')});
  for(const width of [1440,1920,2560]) {
    await page.setViewportSize({width,height:1000});
    const layout=await page.locator('main').evaluate(e=>{const r=e.getBoundingClientRect(),grid=getComputedStyle(e.parentElement).gridTemplateColumns.split(' ').map(parseFloat);return {leftGap:r.left-grid[0],rightGap:innerWidth-r.right,overflow:document.documentElement.scrollWidth>innerWidth}});
    check(Math.abs(layout.leftGap-layout.rightGap)<3,`${width}px: main is off-center ${JSON.stringify(layout)}`);
    check(!layout.overflow,`${width}px: horizontal overflow`);
  }
  await page.setViewportSize({width:390,height:844});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px: horizontal overflow');
  console.log(failures.length ? failures.join('\n') : 'PASS: light/dark auth and task contrast, selection interactions, 390/1440/1920/2560px layout');
  assert.equal(failures.length,0);
} finally { await browser.close(); }
