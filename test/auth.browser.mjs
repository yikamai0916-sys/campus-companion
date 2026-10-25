import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.CAMPUS_PLAYWRIGHT||'playwright');
const base=process.env.CAMPUS_BASE||'http://localhost:8789';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];let calls=0,registers=0;
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/login')calls++;
  if(path==='/api/register')registers++;
  await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'邮箱或密码不正确',...(path==='/api/status'?{code:'SESSION_EXPIRED'}:{})})});
 });
 await page.goto(base);await page.locator('#login').waitFor({state:'visible'});
 const password=page.locator('#login-form [name=password]'),email=page.locator('#login-form [name=email]'),eye=page.locator('#login-form .password-toggle');
 await email.fill('fixture@example.com');await password.fill('Incorrect-password-2026');
 await eye.focus();await page.keyboard.press('Enter');assert.equal(await password.getAttribute('type'),'text');
 assert.equal(await eye.getAttribute('aria-pressed'),'true');
 await page.locator('#login-form [type=submit]').click();await page.locator('#login-error').getByText('邮箱或密码不正确').waitFor();
 assert.equal(calls,1);assert.equal(await password.inputValue(),'');assert.equal(await email.inputValue(),'fixture@example.com');assert.equal(await password.getAttribute('type'),'password');assert.equal(await eye.getAttribute('aria-pressed'),'false');
 await password.fill('Another-password-2026');await eye.click();await page.locator('[data-auth=register]').click();
 assert.equal(await password.inputValue(),'');assert.equal(await password.getAttribute('type'),'password');
 const form=page.locator('#register-form');await form.locator('[name=email]').fill('new@example.com');await form.locator('[name=password]').fill('New-password-2026');await form.locator('[name=confirmPassword]').fill('Mismatch-password-2026');await form.locator('[name=question]').fill('My favourite book');await form.locator('[name=answer]').fill('Test answer');
 await form.locator('[type=submit]').click();assert.equal(registers,0);assert.ok(await form.locator('[name=confirmPassword]').evaluate(el=>!el.validity.valid));
 await page.locator('[data-auth=login]').click();await page.locator('[data-auth=register]').click();
 for(const name of ['password','confirmPassword','answer'])assert.equal(await form.locator(`[name=${name}]`).inputValue(),'');
 assert.equal(await form.locator('[name=email]').inputValue(),'new@example.com');assert.equal(await form.locator('.password-toggle').count(),3);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS: reveal, failed-login clearing, preserved email, tab clearing, confirmation and mobile layout at '+base);
}finally{await browser.close();}
