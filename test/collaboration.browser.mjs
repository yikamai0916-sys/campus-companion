// Run only against the isolated acceptance config on localhost:8788.
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.CAMPUS_PLAYWRIGHT||'playwright');
const base=process.env.CAMPUS_ACCEPTANCE_BASE||'http://localhost:8788';
assert.equal(new URL(base).hostname,'localhost');assert.equal(new URL(base).port,'8788');
const browser=await chromium.launch({channel:'chrome',headless:true}),pages=[],errors=[];
const password='Acceptance-only-'+crypto.randomUUID(),run=Date.now();
async function call(page,path,method='GET',data,expected=200){
 const result=await page.evaluate(async({path,method,data})=>{const response=await fetch('/api/'+path,{method,headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,data:await response.json()};},{path,method,data});
 assert.equal(result.status,expected,method+' '+path+': '+JSON.stringify(result.data));return result.data;
}
async function refreshGroups(page){await page.locator('[data-view=groups]').click();await page.locator('#groups-content .group-loading').waitFor({state:'hidden'});await page.waitForLoadState('networkidle');}
try{
 for(let i=0;i<3;i++){
  const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1280,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));pages.push(page);
  await page.goto(base);await page.locator('[data-auth=register]').click();
  for(const [name,value] of Object.entries({email:`acceptance-${run}-${i}@example.com`,password,confirmPassword:password,question:'Testing security question',answer:'Testing-only-answer'}))await page.locator(`#register-form [name=${name}]`).fill(value);
  await page.locator('#register-form [type=submit]').click();await page.locator('#app').waitFor({state:'visible'});
 }
 const [a,b,c]=pages,identities=await Promise.all(pages.map(p=>call(p,'status'))),ids=identities.map(s=>s.account.id);
 assert.ok(identities.every(s=>!s.ai&&!s.outlook&&!s.outlookConfigured));
 // Create through the real UI, then drive the same authenticated routes from each browser.
 await refreshGroups(a);await a.locator('#new-group').click();await a.locator('#group-form [name=name]').fill('Three-student acceptance '+run);await a.locator('#group-form [type=submit]').click();await a.locator('#group-dialog').waitFor({state:'hidden'});
 const group=(await call(a,'groups'))[0],g=group.id;
 assert.equal((await call(c,`groups/${g}`,'GET',undefined,404)).error.length>0,true);
 for(const [p,i] of [[b,1],[c,2]]){
  await call(a,`groups/${g}/members`,'POST',{email:identities[i].account.email},201);
  const invite=(await call(p,'invitations'))[0];
  if(i===1){await call(c,`invitations/${invite.id}`,'POST',{decision:'accept'},404);await call(p,`invitations/${invite.id}`,'POST',{decision:'reject'});await call(a,`groups/${g}/members`,'POST',{email:identities[i].account.email},201);}
  const pending=(await call(p,'invitations'))[0];await call(p,`invitations/${pending.id}`,'POST',{decision:'accept'});
 }
 assert.equal((await call(a,`groups/${g}`)).members.length,3);
 await refreshGroups(a);await a.locator('#candidate-form [name=title]').fill('Keep my draft');
 let failGroupRead=true;await a.route('**/api/groups',async route=>{if(failGroupRead&&route.request().method()==='GET')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary group read failure'})});return route.continue();});
 await a.locator('[data-view=groups]').click();await a.locator('#groups-load-error .load-error').waitFor();assert.equal(await a.locator('#candidate-form [name=title]').inputValue(),'Keep my draft');
 failGroupRead=false;await a.locator('#groups-load-error button').click();await a.locator('#groups-load-error').waitFor({state:'hidden'});await a.waitForFunction(()=>document.querySelector('#candidate-form [name=title]').value==='Keep my draft');
 console.log('PASS T10 real group draft survives failed reload and retry');
 const createCandidate=assignee=>call(a,`groups/${g}/candidates`,'POST',{title:'Prepare verifiable slides',proposedAssigneeId:assignee,notes:'Deliver two slides',evidence:{title:'Member volunteered in the meeting.'}},201);
 const candidate=await createCandidate(ids[1]);
 await call(b,`task-candidates/${candidate.id}/review`,'POST',{decision:'confirm'},404);
 const task=await call(a,`task-candidates/${candidate.id}/review`,'POST',{decision:'confirm'});
 await call(a,`tasks/${task.id}/assignment`,'POST',{decision:'accept'},404);
 await refreshGroups(b);await b.locator(`[data-assignment=reject][data-task-id="${task.id}"]`).click();
 await b.waitForFunction(id=>!document.querySelector(`[data-assignment=reject][data-task-id="${id}"]`),task.id);
 assert.equal((await call(a,`groups/${g}`)).tasks.find(t=>t.id===task.id).acceptance_status,'declined');
 const replacement=await createCandidate(ids[2]),newTask=await call(a,`task-candidates/${replacement.id}/review`,'POST',{decision:'confirm'});
 await call(a,`task-candidates/${replacement.id}/review`,'POST',{decision:'confirm'},409);
 await refreshGroups(c);await c.locator(`[data-assignment=accept][data-task-id="${newTask.id}"]`).click();
 await c.waitForFunction(id=>!document.querySelector(`[data-assignment=accept][data-task-id="${id}"]`),newTask.id);
 await c.locator('[data-view=tasks]').click();await c.locator(`[data-check="${newTask.id}"]`).check();
 await c.waitForFunction(()=>document.querySelector('#completed').textContent==='1');
 assert.equal((await call(a,`groups/${g}`)).tasks.find(t=>t.id===newTask.id).completed,1);
 await call(c,`tasks/${newTask.id}`,'PATCH',{version:1,completed:false},409);
 console.log('PASS T11 three real accounts: invite reject/accept, review, decline, replacement, accept, complete, replay rejection');
 const start=Date.now()+3*86400000,end=start+5*3600000;
 const poll=await call(a,`groups/${g}/meeting-polls`,'POST',{name:'Three-student meeting',rangeStart:start,rangeEnd:end,durationMinutes:60,slotMinutes:30,bufferMinutes:0},201);
 const path=`meeting-polls/${poll.id}`;
 await call(a,path+'/availability','PUT',{intervals:[[start,start+3600000]]});
 let snapshot=await call(a,path);assert.equal(snapshot.result.missingMemberIds.length,2);assert.equal(snapshot.result.hasAllMemberOption,false);
 await call(a,path+'/voting','POST',{},409);
 for(const p of [b,c])await call(p,path+'/availability','PUT',{intervals:[[start+2*3600000,end]]});
 snapshot=await call(a,path);assert.equal(snapshot.result.hasAllMemberOption,false);assert.equal(snapshot.result.missingMemberIds.length,0);
 await call(a,path+'/availability','PUT',{intervals:[[start,end]]});
 snapshot=await call(a,path);const options=snapshot.result.proposals.filter(p=>p.allAvailable);assert.ok(options.length>=2);
 await call(a,path+'/voting','POST',{});
 for(const p of pages)await call(p,path+'/vote','POST',{start:options[0].start});
 await call(b,path+'/confirm','POST',{start:options[0].start},403);
 await call(a,path+'/confirm','POST',{start:options[0].start});
 await call(a,path+'/confirm','POST',{start:options[0].start},409);
 for(const p of pages){assert.equal((await call(p,'tasks')).filter(t=>t.source_id===poll.id).length,1);await refreshGroups(p);await p.locator(`[data-open-poll="${poll.id}"]`).click();await p.locator('#groups-content').getByText('Three-student meeting',{exact:false}).first().waitFor();}
 snapshot=await call(a,path);assert.equal((await call(a,`groups/${g}`)).announcements.length,1);
 const revision=snapshot.poll.revision;
 await call(a,path+'/lifecycle','POST',{action:'cancel',revision});
 for(const p of pages)assert.equal((await call(p,'tasks')).some(t=>t.source_id===poll.id),false);
 await call(a,path+'/lifecycle','POST',{action:'reopen',revision,rangeStart:start+86400000,rangeEnd:end+86400000},409);
 snapshot=await call(a,path);
 await call(a,path+'/lifecycle','POST',{action:'reopen',revision:snapshot.poll.revision,rangeStart:start+86400000,rangeEnd:end+86400000});
 snapshot=await call(a,path);assert.equal(snapshot.poll.phase,'collecting');assert.equal(snapshot.submissions.length,0);assert.equal(snapshot.ownVote,null);
 await call(a,path+'/lifecycle','POST',{action:'cancel',revision:snapshot.poll.revision});
 console.log('PASS T12 real meeting: missing, no overlap, amend, vote, confirm, tasks and announcement, cancel, stale revision, reopen');
 await call(a,`groups/${g}/membership`,'POST',{action:'remove',userId:ids[1]});
 await call(b,`groups/${g}`,'GET',undefined,404);await call(b,path,'GET',undefined,404);
 await call(b,path+'/vote','POST',{start:options[0].start},404);
 await call(a,'profile','PATCH',{nickname:'Saved immediately'});assert.equal((await call(a,'profile')).nickname,'Saved immediately');
 await a.locator('[data-view=settings]').click();await a.locator('#edit-profile').click();await a.locator('#profile-form [name=nickname]').fill('Persisted nickname');await a.locator('#profile-form [type=submit]').click();
 await a.waitForFunction(()=>document.querySelector('#profile-display-name').textContent==='Persisted nickname');assert.equal((await call(a,'profile')).nickname,'Persisted nickname');
 await a.reload();await a.locator('[data-view=settings]').click();await a.locator('#profile-display-name').getByText('Persisted nickname').waitFor();
 await a.locator('#settings-logout').click();await a.locator('#login').waitFor({state:'visible'});
 await a.locator('#login-form [name=email]').fill(identities[1].account.email);await a.locator('#login-form [name=password]').fill(password);await a.locator('#login-form [type=submit]').click();await a.locator('#app').waitFor({state:'visible'});
 assert.equal((await call(a,'status')).account.id,ids[1]);await call(a,`groups/${g}`,'GET',undefined,404);
 assert.equal(await a.locator('#mail-detail-zh').textContent(),'');assert.equal(await a.locator('#mail-detail-en').textContent(),'');
 if(process.env.CAMPUS_QA_DIR){await mkdir(process.env.CAMPUS_QA_DIR,{recursive:true});for(let i=0;i<3;i++)await pages[i].screenshot({path:process.env.CAMPUS_QA_DIR+`/student-${i+1}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS T13 real account boundaries, removal, stale task, persisted profile, logout and account switch');
}finally{await browser.close();}

