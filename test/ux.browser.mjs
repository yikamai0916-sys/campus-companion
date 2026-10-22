// Run with CAMPUS_PLAYWRIGHT pointing to an installed Playwright package.
// API fixtures keep browser checks separate from real student accounts/mail.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CAMPUS_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('campus-locale','zh-CN'));
  await page.route('**/?view=*',async route=>{
    // The real document gate checks database sessions, while this suite mocks auth.
    const response=await route.fetch({url:'http://localhost:8787/'});
    await route.fulfill({response});
  });
  let loggedIn=false,registerCalls=0,outlookCalls=0,failTasks=false,expireTasks=false;
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(path==='/api/status')return loggedIn?reply({account:{id:'fixture',email:'fixture@example.com',locale:'zh-CN'},outlook:false,outlookConfigured:true,outlookMissingConfig:[],pushReady:false}):reply({error:'请先登录',code:'SESSION_EXPIRED'},401);
    if(path==='/api/register'){registerCalls++;loggedIn=true;return reply({});}
    if(path==='/api/profile')return reply({nickname:'测试用户',avatar:'',locale:'zh-CN',nameAliases:[],reminders:{offsets:[],repeat:0,start:'08:00',end:'23:00'}});
    if(path==='/api/tasks')return expireTasks?reply({error:'请先登录',code:'SESSION_EXPIRED'},401):failTasks?route.abort('failed'):reply([]);
    if(path==='/api/outlook/start'){outlookCalls++;return reply({error:'请输入有效的 Outlook 邮箱'},400);}
    if(path==='/api/password')return reply({error:'当前密码不正确'},401);
    return reply([]);
  });
  await page.goto('http://localhost:8787/');
  await page.locator('#login').waitFor({state:'visible'});
  await page.locator('[data-auth=register]').click();
  await page.locator('#register-form [name=email]').fill('fixture@example.com');
  await page.locator('#register-form [name=password]').fill('example-password-2026');
  await page.locator('#register-form [name=confirmPassword]').fill('different-password');
  await page.locator('#register-form [name=question]').fill('我喜欢的第一本书');
  await page.locator('#register-form [name=answer]').fill('test answer');
  await page.locator('#register-form [type=submit]').click();
  assert.equal(registerCalls,0);
  assert.match(await page.locator('#register-error').innerText(),/密码不一致/);
  const eye=page.locator('#register-form .password-toggle').first();
  await eye.focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#register-form [name=password]').getAttribute('type'),'text');
  assert.equal(await eye.getAttribute('aria-pressed'),'true');
  await eye.click();
  assert.equal(await page.locator('#register-form [name=password]').getAttribute('type'),'password');
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.CAMPUS_QA_SCREENSHOT)await page.screenshot({path:process.env.CAMPUS_QA_SCREENSHOT,fullPage:true});
  await page.locator('#register-form [name=confirmPassword]').fill('example-password-2026');
  await page.locator('#register-form [type=submit]').click();
  await page.locator('#app').waitFor({state:'visible'});assert.equal(registerCalls,1);
  await page.setViewportSize({width:1280,height:900});
  await page.locator('[data-view=settings]').click();
  await page.locator('#outlook-connect-form').waitFor();
  await page.locator('#outlook-connect-form [name=email]').fill('kaiqiou@outlook');
  await page.locator('#outlook-connect-form [type=submit]').click();
  assert.equal(outlookCalls,0);assert.ok(!page.url().includes('/api/'));
  assert.match(await page.locator('#outlook-connect-form .error').innerText(),/完整邮箱/);
  await page.locator('#outlook-connect-form [name=email]').fill('example@outlook.com');
  await page.locator('#outlook-connect-form [type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#outlook-connect-form .error')?.textContent.includes('有效的 Outlook'));
  assert.equal(outlookCalls,1);assert.ok(!page.url().includes('/api/'));
  await page.locator('#password-form [name=current]').fill('wrong-password');
  await page.locator('#password-form [name=next]').fill('example-new-password');
  await page.locator('#password-form [name=confirmPassword]').fill('example-new-password');
  await page.locator('#password-form [type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#password-form .error')?.textContent.includes('当前密码不正确'));
  assert.equal(await page.locator('#app').isVisible(),true);
  failTasks=true;await page.locator('[data-view=tasks]').click();
  await page.locator('#task-list .load-error').waitFor();
  assert.match(await page.locator('#task-list .load-error').innerText(),/无法连接服务器/);
  failTasks=false;await page.locator('#task-list .load-error button').click();
  await page.waitForFunction(()=>!document.querySelector('#task-list .load-error'));
  await page.goto('http://localhost:8787/?view=settings&outlookError=cancelled');
  await page.waitForFunction(()=>document.querySelector('#settings-content')?.textContent.includes('尚未完成 Outlook 授权'));
  await page.locator('[data-view=tasks]').click();
  await page.locator('#add-task').click();
  await page.locator('#task-form [name=title]').fill('Session expiry test');
  expireTasks=true;
  await page.locator('#task-form [type=submit]').click();
  await page.locator('#login').waitFor({state:'visible'});
  assert.equal(await page.locator('#task-dialog').isVisible(),false);
  assert.match(await page.locator('#login-error').innerText(),/登录已失效/);
  assert.deepEqual(errors,[]);
  console.log('PASS: confirm password, keyboard reveal, mobile width, invalid email, server validation, credential errors, network retry, OAuth return');
}finally{await browser.close();}
