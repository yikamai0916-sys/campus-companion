import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.CAMPUS_PLAYWRIGHT||'playwright');
const base=process.env.CAMPUS_BASE||'http://localhost:8787';
const browser=await chromium.launch({channel:'chrome',headless:true});
const failures=[];
async function check(name,run){try{await run();console.log('PASS',name);}catch(e){failures.push(name+': '+e.message);console.log('FAIL',name,e.message);}}
try{
 for(const locale of ['zh-CN','zh-TW','en']){
  const page=await browser.newPage();page.on('pageerror',e=>console.log('PAGEERROR',e.message));page.setDefaultTimeout(4000);let mode=404;
  await page.addInitScript(l=>localStorage.setItem('campus-locale',l),locale);
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(path==='/api/status')return reply({account:{id:'fixture',email:'fixture@example.com',locale},pushReady:false});
   if(path==='/api/profile')return reply({nickname:'Student',avatar:'',locale,nameAliases:[]});
   if(path==='/api/messages/fixture')return mode==='offline'?route.abort():reply({error:mode===401?'Session expired':'Mail unavailable',...(mode===401?{code:'SESSION_EXPIRED'}:{})},mode);
   if(path==='/api/messages')return reply({messages:[{id:'fixture',subject:'Fixture mail',sender:'Office',category:2,received:Date.now()}]});
   return reply([]);
  });
  await page.goto(base);await page.locator('#app').waitFor({state:'visible'});
  for(const failure of [404,500,'offline'])await check(`T01 ${locale} ${failure}`,async()=>{
   await page.reload();await page.locator('#app').waitFor({state:'visible'});mode=failure;await page.locator('[data-view=mail]').click();await page.locator('[data-open-mail]').first().click();
   await page.locator('#mail-detail-error').waitFor({state:'visible',timeout:2000});
   assert.ok(await page.locator('#close-mail-detail').isVisible());
   if(failure!==404)assert.ok(await page.locator('#mail-detail-error button').isVisible());
  });
  await check(`T02 ${locale} expiry`,async()=>{
   // API call from the currently open reader must remove its covering section.
   await page.reload();await page.locator('#app').waitFor({state:'visible'});
   mode=401;await page.locator('[data-view=mail]').click();await page.locator('[data-open-mail]').first().click();
   await page.locator('#login').waitFor({state:'visible'});
   assert.ok(await page.locator('#mail-detail-dialog').evaluate(el=>el.classList.contains('hidden')));
   assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);
  });
  await page.close();
 }
 const page=await browser.newPage();page.setDefaultTimeout(5000);
 await page.route('**/?view=*',async route=>route.fulfill({response:await route.fetch({url:base+'/'} )}));
 let nickname='Student',savedName='',failProfile=false,failLogout=false,failGroups=false,failSuggestions=false,failRefresh=false,writes=0;
 let releaseSearch=null,holdReader=false,releaseReader=null,expireRead=false,activeAccount='fixture';
 const item={id:'fixture',subject:'Project notice',sender:'Office',origin:'School',category:2,received:Date.now(),summary:'Please review the project.',brief:{title:'Project notice',topic:'Course',points:[{text:'Please review the project.'}],actions:[]}};
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(path==='/api/status')return reply({account:{id:activeAccount,email:'fixture@example.com',locale:'en'},pushReady:false});
  if(path==='/api/login'){activeAccount='second-account';expireRead=false;return reply({});}
  if(path==='/api/profile'){
   if(req.method()==='PATCH'){savedName=req.postDataJSON().nickname;if(failProfile)return reply({error:'Profile save failed'},503);nickname=savedName;}
   return reply({nickname,avatar:'',locale:'en',nameAliases:[]});
  }
  if(path==='/api/messages/fixture'){
   const detail={id:'fixture',display:item,english:{subject:'Project notice',body:'Actual project notice.'},translationEnabled:false};
   if(holdReader)return new Promise(resolve=>{releaseReader=async()=>{await reply(detail);resolve();};});
   return reply(detail);
  }
  if(path==='/api/messages'){
   const query=new URL(req.url()).searchParams.get('q');
   if(query==='older')return new Promise(resolve=>{releaseSearch=async()=>{await reply({messages:[{...item,subject:'Older search',brief:{...item.brief,title:'Older search'}}]});resolve();};});
   return reply({messages:[query==='newer'?{...item,subject:'Newer search',brief:{...item.brief,title:'Newer search'}}:item]});
  }
  if(path==='/api/digests')return reply([{id:'d',title:'Daily briefing',created:Date.now(),items:[item]}]);
  if(path==='/api/tasks/t'&&req.method()==='PATCH'){writes++;failRefresh=true;return reply({});}
  if(path==='/api/tasks')return expireRead?reply({error:'Session expired',code:'SESSION_EXPIRED'},401):failRefresh?reply({error:'Refresh failed'},503):reply([{id:'t',title:'Fixture task',notes:'',completed:false,priority:2,version:1,reminders:{}}]);
  if(path==='/api/groups')return failGroups?reply({error:'Groups unavailable'},503):reply([]);
  if(path==='/api/mail-suggestions')return failSuggestions?reply({error:'Suggestions unavailable'},503):reply([]);
  if(path==='/api/logout'&&failLogout)return reply({error:'Logout failed'},503);
  return reply([]);
 });
 await page.goto(base);await page.locator('#app').waitFor({state:'visible'});
 await check('T03 digest title, expand, source link, back and forward',async()=>{
  await page.locator('[data-view=digests]').click();await page.locator('.dg-head').first().waitFor();
  await page.locator('[data-dg-filter=info]').first().click();
  await page.locator('.dg-head').first().click();await page.locator('#mail-detail-en').getByText('Actual project notice.').waitFor();
  assert.match(page.url(),/view=digests&message=fixture/);
  await page.locator('#close-mail-detail').click();await page.waitForURL('**/?view=digests');
  assert.equal(await page.locator('[data-dg-filter=info]').first().getAttribute('aria-pressed'),'true');
  await page.locator('[data-dg-expand]').first().click();await page.locator('[data-dg-open]').first().click();
  await page.locator('#mail-detail-en').getByText('Actual project notice.').waitFor();
  await page.goBack();await page.waitForURL('**/?view=digests');
  await page.goForward();await page.locator('#mail-detail-en').getByText('Actual project notice.').waitFor();
  await page.locator('#close-mail-detail').click();await page.waitForURL('**/?view=digests');
 });
 await check('T03 direct link returns to the mail list without a history loop',async()=>{
  await page.goto(base+'/?view=mail&message=fixture');await page.locator('#mail-detail-en').getByText('Actual project notice.').waitFor();
  await page.locator('#close-mail-detail').click();await page.waitForURL('**/?view=mail');assert.ok(await page.locator('#mail-view').isVisible());
 });
 await check('T04 immediate save, Enter and failed profile save retain current input',async()=>{
  await page.locator('[data-view=settings]').click();await page.locator('#edit-profile').click();
  const name=page.locator('#profile-form [name=nickname]');await name.fill('Changed Student');
  await page.locator('#profile-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#profile-display-name').textContent==='Changed Student');assert.equal(savedName,'Changed Student');
  await name.fill('Enter Student');await name.press('Enter');await page.waitForFunction(()=>document.querySelector('#profile-display-name').textContent==='Enter Student');assert.equal(savedName,'Enter Student');
  failProfile=true;await name.fill('Keep draft');await page.locator('#profile-form [type=submit]').click();
  await page.locator('#profile-form .error').waitFor();assert.equal(await name.inputValue(),'Keep draft');assert.equal(nickname,'Enter Student');failProfile=false;
 });
 await check('T08 failed logout stays signed in',async()=>{
  failLogout=true;await page.locator('#settings-logout').click();await page.getByText('Logout failed',{exact:true}).first().waitFor();assert.ok(await page.locator('#app').isVisible());
 });
 await check('T09 successful checkbox write with failed refresh never replays mutation',async()=>{
  await page.locator('[data-view=tasks]').click();const box=page.locator('[data-check=t]');await box.check();
  await page.locator('#task-list .load-error').waitFor();assert.equal(writes,1);
  failRefresh=false;await page.locator('#task-list .load-error button').click();await page.locator('[data-check=t]').waitFor();assert.equal(writes,1);
 });
 await check('T10 suggestions fail independently and groups retry preserves drafts',async()=>{
  failSuggestions=true;await page.locator('[data-view=mail]').click();await page.locator('#mail-suggestions .load-error').waitFor();await page.locator('[data-open-mail]').first().waitFor();
  failSuggestions=false;await page.locator('#mail-suggestions .load-error button').click();await page.locator('#mail-suggestions .load-error').waitFor({state:'hidden'});
  failGroups=true;await page.locator('[data-view=groups]').click();await page.locator('#groups-load-error .load-error').waitFor();
  failGroups=false;await page.locator('#groups-load-error button').click();await page.locator('#groups-load-error').waitFor({state:'hidden'});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 });
 await check('T09 later search wins when the earlier response arrives last',async()=>{
  await page.setViewportSize({width:1280,height:900});await page.locator('[data-view=mail]').click();await page.locator('#mail-search-toggle').click();
  const old=page.waitForRequest(r=>new URL(r.url()).searchParams.get('q')==='older');await page.locator('#mail-search').fill('older');await old;
  const newer=page.waitForRequest(r=>new URL(r.url()).searchParams.get('q')==='newer');await page.locator('#mail-search').fill('newer');await newer;await page.locator('#mail-list').getByText('Newer search',{exact:true}).waitFor();
  assert.ok(releaseSearch);await releaseSearch();await page.waitForLoadState('networkidle');assert.equal(await page.locator('#mail-list').getByText('Older search',{exact:true}).count(),0);
 });
 await check('T02 delayed old-account reader response stays discarded after another login',async()=>{
  await page.locator('#mail-search').fill('');await page.waitForLoadState('networkidle');
  holdReader=true;await page.locator('[data-open-mail]').first().click();await page.locator('#mail-detail-title').waitFor();
  expireRead=true;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.locator('#login').waitFor({state:'visible'});
  await page.locator('#login-form [name=email]').fill('second@example.com');await page.locator('#login-form [name=password]').fill('Example-password-2026');await page.locator('#login-form [type=submit]').click();await page.locator('#app').waitFor({state:'visible'});
  assert.ok(releaseReader);await releaseReader();await page.waitForLoadState('networkidle');
  assert.equal(activeAccount,'second-account');assert.ok(await page.locator('#mail-detail-dialog').evaluate(el=>el.classList.contains('hidden')));assert.equal(await page.locator('#mail-detail-en').textContent(),'');
 });
 await page.close();
}finally{await browser.close();}
assert.deepEqual(failures,[]);

