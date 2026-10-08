import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import worker from '../src/worker.js';
import { hash,b64,random,seal,unseal,makePasswordHash } from '../src/security.js';
import { deliver } from '../src/jobs.js';
function database(){
  const sqlite=new DatabaseSync(':memory:');for(const name of ['0001.sql','0002_accounts.sql','0003_profile.sql','0004_message_localizations.sql','0005_localization_version.sql','0006_outlook_connections.sql','0007_mail_preferences.sql','0008_account_scoped_records.sql','0009_collaboration.sql','0010_meeting_planner.sql','0011_meeting_votes_and_announcements.sql'])sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const db={prepare(sql){let args=[];const obj={bind(...a){args=a;return obj;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:r.changes}};}};return obj;},async batch(stmts){sqlite.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};return db;
}
test('meeting workflow migration preserves historical confirmed state',()=>{
  const sqlite=new DatabaseSync(':memory:'),names=['0001.sql','0002_accounts.sql','0003_profile.sql','0004_message_localizations.sql','0005_localization_version.sql','0006_outlook_connections.sql','0007_mail_preferences.sql','0008_account_scoped_records.sql','0009_collaboration.sql','0010_meeting_planner.sql'];
  for(const name of names)sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  sqlite.prepare("INSERT INTO meeting_polls(id,group_id,creator_user_id,name,range_start,range_end,duration_minutes,status,confirmed_start,confirmed_end,created,updated) VALUES('old','group','owner','Old meeting',1,10,1,'confirmed',2,3,0,0)").run();
  sqlite.exec(readFileSync(new URL('../migrations/0011_meeting_votes_and_announcements.sql',import.meta.url),'utf8'));
  assert.equal(sqlite.prepare("SELECT phase FROM meeting_polls WHERE id='old'").get().phase,'confirmed');
});
test('authenticated CRUD persists and completing cancels pending reminders',async()=>{
  const env={DB:database(),OWNER_EMAIL:'test@example.com'},origin='https://campus.example',token=random();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('u1','test@example.com','unused',0)").run();
  await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?)').bind(await hash(token),Date.now()+3600000,'u1').run();
  await env.DB.prepare("INSERT INTO subscriptions(id,data,created,user_id) VALUES('u1-endpoint','{}',0,'u1')").run();
  const req=(path,method='GET',data)=>worker.fetch(new Request(origin+'/api/'+path,{method,headers:{Cookie:'campus_session='+token,Origin:origin,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),env);
  assert.equal((await worker.fetch(new Request(origin+'/api/tasks'),env)).status,401);
  const created=await req('tasks','POST',{title:'Test assignment',due:Date.now()+5*86400000});assert.equal(created.status,201);
  const task=await created.json();assert.ok(task.id);
  assert.equal((await (await req('tasks')).json()).length,1);
  assert.ok((await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE state='pending'").first()).n>0);
  const completed=await req('tasks/'+task.id,'PATCH',{version:1,completed:true});assert.equal(completed.status,200);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE state='pending'").first()).n,0);
  assert.equal((await req('tasks/'+task.id,'PATCH',{version:1,completed:false})).status,409);
  assert.equal((await req('tasks/'+task.id,'DELETE',{})).status,200);
  assert.equal((await (await req('tasks')).json()).length,0);
  assert.equal((await worker.fetch(new Request(origin+'/api/tasks',{method:'POST',headers:{Cookie:'campus_session='+token,Origin:'https://evil.example'},body:'{}'}),env)).status,403);
});
test('a queued reminder with obsolete task version never sends',async()=>{
  const env={DB:database()};await env.DB.prepare("INSERT INTO jobs(id,task_id,version,at,channel,payload) VALUES('old','removed-task',1,0,'email','{}')").run();
  await deliver(env);assert.equal((await env.DB.prepare("SELECT state FROM jobs WHERE id='old'").first()).state,'cancelled');
});
test('OAuth tokens encrypted at rest and tampering rejected',async()=>{
  const key=random(),value={refresh_token:'private-test-token'};const cipher=await seal(value,key);
  assert.ok(!cipher.includes('private-test-token'));assert.deepEqual(await unseal(cipher,key),value);
  await assert.rejects(()=>unseal(cipher,random()));
});
test('password change invalidates other sessions and changes login credential',async()=>{
  const old='initial-secret-2026',next='new-private-secret-2026';
  const env={DB:database(),PASSWORD_HASH:await makePasswordHash(old),LOGIN_EMAIL:'owner@example.com'},origin='https://campus.example';
  const login=async(password,email='owner@example.com')=>worker.fetch(new Request(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'127.0.0.1'},body:JSON.stringify({email,password})}),env);
  assert.equal((await login(old,'wrong@example.com')).status,401);
  const first=await login(old),second=await login(old);
  assert.equal(first.status,200);assert.equal(second.status,200);
  const cookie=first.headers.get('Set-Cookie').split(';')[0],other=second.headers.get('Set-Cookie').split(';')[0];
  const changed=await worker.fetch(new Request(origin+'/api/password',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({current:old,next})}),env);
  assert.equal(changed.status,200);assert.equal((await login(old)).status,401);assert.equal((await login(next)).status,200);
  assert.equal((await worker.fetch(new Request(origin+'/api/tasks',{headers:{Cookie:other}}),env)).status,401);
});
test('forwarded email is reduced to structured metadata without storing its raw body',async()=>{
  const env={DB:database(),MAIL_INGEST_MODE:'forwarding',SCHOOL_EMAIL:'student@university.example',LOGIN_EMAIL:'owner@example.com'};
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('owner','owner@example.com','unused',0)").run();
  const raw=['Message-ID: <school-1@example.edu>','Subject: Scholarship payment notice','Content-Type: text/plain; charset=utf-8','','From: Finance Office <finance@example.edu>','To: student@university.example','','Scholarship payment is ready. Please confirm your bank details.'].join('\r\n');
  const pending=[];
  await worker.email({from:'forwarder@example.com',rawSize:raw.length,raw:new Blob([raw]).stream(),setReject(){throw new Error('unexpected reject');}},env,{waitUntil(p){pending.push(p);}});
  await Promise.all(pending);
  const saved=await env.DB.prepare('SELECT * FROM messages WHERE id=?').bind('<school-1@example.edu>').first();
  assert.equal(saved.category,1);assert.match(saved.sender,/finance@example\.edu/);
  assert.equal(JSON.stringify(saved).includes('Content-Type:'),false);
});
test('authenticated iPhone mail handoff stores a suggestion without creating a task',async()=>{
  const env={DB:database(),SCHOOL_EMAIL:'student@university.example',SHORTCUT_INGEST_KEY:'test-shortcut-secret',LOGIN_EMAIL:'owner@example.com'};
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('owner','owner@example.com','unused',0)").run();
  const origin='https://campus.example',payload={subject:'SOC 210 Assignment 2 deadline',sender:'student@university.example',content:'From: Teacher <teacher@ln.edu.hk>\nPlease submit Assignment 2 before the deadline.'};
  const send=key=>worker.fetch(new Request(origin+'/api/mail/shortcut',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload)}),env);
  assert.equal((await send('wrong-secret')).status,401);
  const imported=await send('test-shortcut-secret');assert.equal(imported.status,201);
  assert.deepEqual(await imported.json(),{ok:true,duplicate:false,category:2,suggestion:true,task:false});
  assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM messages').first()).n,1);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM tasks').first()).n,0);
  const duplicate=await send('test-shortcut-secret');assert.equal((await duplicate.json()).duplicate,true);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM tasks').first()).n,0);
});
test('registration, account isolation, recovery, and scoped deletion work together',async()=>{
  const env={DB:database(),OWNER_EMAIL:'owner@example.com'},origin='https://campus.example';
  const call=(path,data,cookie)=>worker.fetch(new Request(origin+'/api/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)}),env);
  const register=async(email)=>call('register',{email,password:'private-password-2026',question:'我最喜欢的颜色是什么？',answer:'绿色'});
  const first=await register('one@example.com'),second=await register('two@example.com');assert.equal(first.status,200);assert.equal(second.status,200);
  const firstCookie=first.headers.get('Set-Cookie').split(';')[0],secondCookie=second.headers.get('Set-Cookie').split(';')[0];
  const create=await call('tasks',{title:'only one can see this'},firstCookie);assert.equal(create.status,201);const task=await create.json();
  assert.equal((await (await worker.fetch(new Request(origin+'/api/tasks',{headers:{Cookie:secondCookie}}),env)).json()).length,0);
  assert.equal((await worker.fetch(new Request(origin+'/api/tasks/'+task.id,{method:'DELETE',headers:{Origin:origin,Cookie:secondCookie,'Content-Type':'application/json'},body:'{}'}),env)).status,404);
  const firstUser=await env.DB.prepare('SELECT id FROM users WHERE email=?').bind('one@example.com').first();
  await env.DB.prepare("INSERT INTO messages(id,subject,received,sender,origin,category,summary,action,url,quality,user_id) VALUES('m1','Private mail',0,'sender','origin',2,'summary','action','','test',?)").bind(firstUser.id).run();
  await worker.fetch(new Request(origin+'/api/messages/m1',{method:'DELETE',headers:{Origin:origin,Cookie:secondCookie,'Content-Type':'application/json'},body:'{}'}),env);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM messages WHERE id='m1'").first()).n,1);
  await worker.fetch(new Request(origin+'/api/messages/m1',{method:'DELETE',headers:{Origin:origin,Cookie:firstCookie,'Content-Type':'application/json'},body:'{}'}),env);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM messages WHERE id='m1'").first()).n,0);
  const question=await call('recovery/question',{email:'one@example.com'});assert.equal((await question.json()).question,'我最喜欢的颜色是什么？');
  assert.equal((await call('recovery/reset',{email:'one@example.com',answer:'wrong',password:'replacement-2026'})).status,401);
  assert.equal((await call('recovery/reset',{email:'one@example.com',answer:'绿色',password:'replacement-2026'})).status,200);
  assert.equal((await call('login',{email:'one@example.com',password:'replacement-2026'})).status,200);
});

test('provider identifiers and localization caches are unique within an account',async()=>{
  const env={DB:database()},reminders='{"offsets":[],"exact":[],"repeat":0,"maxCount":0,"start":"08:00","end":"23:00","days":[0],"push":false,"email":false}';
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('one','one@example.com','unused',0),('two','two@example.com','unused',0)").run();
  await env.DB.prepare("INSERT INTO tasks(id,title,source,source_id,reminders,created,updated,user_id) VALUES('t1','First','email','provider-1',?,0,0,'one'),('t2','Second','email','provider-1',?,0,0,'two')").bind(reminders,reminders).run();
  await env.DB.prepare("INSERT INTO messages(id,subject,received,sender,origin,category,summary,action,url,quality,user_id) VALUES('provider-1','First',0,'sender','origin',2,'summary','action','','test','one'),('provider-1','Second',0,'sender','origin',2,'summary','action','','test','two')").run();
  const localization="INSERT INTO message_localizations(message_id,user_id,locale,subject,sender,origin,summary,action,quality,updated) VALUES('provider-1',?,'en',?,'sender','origin','summary','action','test',0)";
  await env.DB.prepare(localization).bind('one','First').run();
  await env.DB.prepare(localization).bind('two','Second').run();
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM tasks WHERE source_id='provider-1'").first()).n,2);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM messages WHERE id='provider-1'").first()).n,2);
  assert.equal((await env.DB.prepare("SELECT subject FROM message_localizations WHERE user_id='one' AND message_id='provider-1'").first()).subject,'First');
  assert.equal((await env.DB.prepare("SELECT subject FROM message_localizations WHERE user_id='two' AND message_id='provider-1'").first()).subject,'Second');
});

test('a reassigned push endpoint cannot receive an older account job',async()=>{
  const env={DB:database()};
  await env.DB.prepare("INSERT INTO subscriptions(id,data,created,user_id) VALUES('endpoint','{}',0,'new-owner')").run();
  await env.DB.prepare("INSERT INTO jobs(id,at,channel,payload,state,user_id) VALUES('private-job',0,'push:endpoint','{}','pending','old-owner')").run();
  await deliver(env,1);
  assert.equal((await env.DB.prepare("SELECT state FROM jobs WHERE id='private-job'").first()).state,'cancelled');
  assert.equal((await env.DB.prepare("SELECT user_id FROM subscriptions WHERE id='endpoint'").first()).user_id,'new-owner');
});

test('group candidate review and assignee acceptance are separate transitions',async()=>{
  const env={DB:database()},origin='https://campus.example',ownerToken=random(),memberToken=random(),outsiderToken=random();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('owner','owner@example.com','unused',0),('member','member@example.com','unused',0),('outsider','outsider@example.com','unused',0)").run();
  await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?),(?,?,?),(?,?,?)').bind(await hash(ownerToken),Date.now()+3600000,'owner',await hash(memberToken),Date.now()+3600000,'member',await hash(outsiderToken),Date.now()+3600000,'outsider').run();
  const call=(token,path,method='GET',data)=>worker.fetch(new Request(origin+'/api/'+path,{method,headers:{Cookie:'campus_session='+token,Origin:origin,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),env);
  const groupResponse=await call(ownerToken,'groups','POST',{name:'CDS2003 Group Project'});assert.equal(groupResponse.status,201);
  const group=await groupResponse.json();
  assert.equal((await call(ownerToken,`groups/${group.id}/members`,'POST',{email:'member@example.com'})).status,201);
  assert.equal((await call(outsiderToken,`groups/${group.id}`)).status,404);
  const candidateResponse=await call(ownerToken,`groups/${group.id}/candidates`,'POST',{title:'Analyse meeting algorithm',proposedAssigneeId:'member',due:Date.now()+5*86400000,evidence:{title:'Member will analyse the meeting algorithm.'}});assert.equal(candidateResponse.status,201);
  const candidate=await candidateResponse.json();
  const pendingForMember=await (await call(memberToken,`groups/${group.id}`)).json();assert.equal(pendingForMember.candidates[0].next_action,'owner_review');assert.equal(pendingForMember.candidates[0].next_actor_user_id,'owner');
  await env.DB.prepare("INSERT INTO subscriptions(id,data,created,user_id) VALUES('member-endpoint','{}',0,'member')").run();
  assert.equal((await call(outsiderToken,`task-candidates/${candidate.id}/review`,'POST',{decision:'confirm'})).status,404);
  const revisedDue=Date.now()+6*86400000;
  const confirmedResponse=await call(ownerToken,`task-candidates/${candidate.id}/review`,'POST',{decision:'confirm',changes:{title:'Verify meeting algorithm',notes:'Use boundary cases.',due:revisedDue,evidence:{title:'Reviewer clarified the deliverable.'}}});assert.equal(confirmedResponse.status,200);
  const task=await confirmedResponse.json();assert.equal(task.acceptance_status,'pending');assert.equal(task.user_id,'member');assert.equal(task.title,'Verify meeting algorithm');assert.equal(task.due,revisedDue);
  const reviewedCandidate=await env.DB.prepare('SELECT * FROM task_candidates WHERE id=?').bind(candidate.id).first();assert.equal(JSON.parse(reviewedCandidate.evidence).title,'Reviewer clarified the deliverable.');
  assert.equal((await (await call(memberToken,'tasks')).json()).length,0);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM jobs WHERE task_id=?').bind(task.id).first()).n,0);
  assert.equal((await call(memberToken,`tasks/${task.id}`,'PATCH',{version:1,completed:true})).status,409);
  assert.equal((await call(ownerToken,`tasks/${task.id}/assignment`,'POST',{decision:'accept'})).status,404);
  const accepted=await call(memberToken,`tasks/${task.id}/assignment`,'POST',{decision:'accept'});assert.equal(accepted.status,200);assert.equal((await accepted.json()).acceptance_status,'accepted');
  assert.equal((await (await call(memberToken,'tasks')).json()).length,1);
  assert.ok((await env.DB.prepare('SELECT COUNT(*) n FROM jobs WHERE task_id=?').bind(task.id).first()).n>0);
  assert.equal((await call(ownerToken,`task-candidates/${candidate.id}/review`,'POST',{decision:'confirm'})).status,409);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM tasks WHERE candidate_id=?').bind(candidate.id).first()).n,1);
  const snapshot=await (await call(memberToken,`groups/${group.id}`)).json();assert.equal(snapshot.members.length,2);assert.equal(snapshot.tasks[0].acceptance_status,'accepted');

  const selfCandidate=await (await call(ownerToken,`groups/${group.id}/candidates`,'POST',{title:'Prepare opening slides',proposedAssigneeId:'owner',evidence:{title:'Owner volunteered.'}})).json();
  const selfTask=await (await call(ownerToken,`task-candidates/${selfCandidate.id}/review`,'POST',{decision:'confirm'})).json();
  assert.equal(selfTask.acceptance_status,'pending');
  const selfAccepted=await call(ownerToken,`tasks/${selfTask.id}/assignment`,'POST',{decision:'accept'});assert.equal(selfAccepted.status,200);assert.equal((await selfAccepted.json()).acceptance_status,'accepted');
});

test('failed task creation rolls back every candidate review change',async()=>{
  const env={DB:database()},origin='https://campus.example',ownerToken=random();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('owner','owner@example.com','unused',0)").run();
  await env.DB.prepare("INSERT INTO groups(id,name,owner_user_id,created,updated) VALUES('group','Project','owner',0,0)").run();
  await env.DB.prepare("INSERT INTO group_members(group_id,user_id,role,joined) VALUES('group','owner','owner',0)").run();
  await env.DB.prepare("INSERT INTO task_candidates(id,group_id,creator_user_id,proposed_assignee_id,title,notes,due,evidence,status,created,updated) VALUES('candidate','group','owner','owner','Original','',NULL,'{}','pending',0,0)").run();
  const reminders='{"offsets":[],"exact":[],"repeat":0,"maxCount":0,"start":"08:00","end":"23:00","days":[0],"push":false,"email":false}';
  await env.DB.prepare("INSERT INTO tasks(id,title,source,source_id,reminders,created,updated,user_id,group_id,acceptance_status,candidate_id) VALUES('existing','Existing','candidate','candidate',?,0,0,'owner','group','pending','candidate')").bind(reminders).run();
  await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?)').bind(await hash(ownerToken),Date.now()+3600000,'owner').run();
  const response=await worker.fetch(new Request(origin+'/api/task-candidates/candidate/review',{method:'POST',headers:{Cookie:'campus_session='+ownerToken,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({decision:'confirm',changes:{title:'Must roll back',evidence:{title:'Must also roll back'}}})}),env);
  assert.equal(response.status,409);
  const candidate=await env.DB.prepare("SELECT title,evidence,status FROM task_candidates WHERE id='candidate'").first();
  assert.equal(candidate.title,'Original');assert.equal(candidate.status,'pending');assert.deepEqual(JSON.parse(candidate.evidence),{});
});

test('meeting polls treat missing availability as unknown and confirm only full-group proposals',async()=>{
  const env={DB:database()},origin='https://campus.example',ownerToken=random(),memberToken=random(),member2Token=random(),lateToken=random(),outsiderToken=random(),start=Date.now()+5*86400000,end=Date.now()+5*86400000+4*3600000;
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('owner','owner@example.com','unused',0),('member','member@example.com','unused',0),('member2','member2@example.com','unused',0),('late','late@example.com','unused',0),('outsider','outsider@example.com','unused',0)").run();
  await env.DB.prepare("INSERT INTO groups(id,name,owner_user_id,created,updated) VALUES('group','Project','owner',0,0)").run();
  await env.DB.prepare("INSERT INTO group_members(group_id,user_id,role,joined) VALUES('group','owner','owner',0),('group','member','member',1),('group','member2','member',2)").run();
  await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?),(?,?,?),(?,?,?),(?,?,?),(?,?,?)').bind(await hash(ownerToken),Date.now()+3600000,'owner',await hash(memberToken),Date.now()+3600000,'member',await hash(member2Token),Date.now()+3600000,'member2',await hash(lateToken),Date.now()+3600000,'late',await hash(outsiderToken),Date.now()+3600000,'outsider').run();
  const call=(token,path,method='GET',data)=>worker.fetch(new Request(origin+'/api/'+path,{method,headers:{Cookie:'campus_session='+token,Origin:origin,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),env);
  const created=await call(ownerToken,'groups/group/meeting-polls','POST',{name:'Progress meeting',rangeStart:start,rangeEnd:end,durationMinutes:60,slotMinutes:30,bufferMinutes:0});assert.equal(created.status,201);const poll=await created.json();
  assert.equal((await call(outsiderToken,`meeting-polls/${poll.id}`)).status,404);
  assert.equal((await call(outsiderToken,`meeting-polls/${poll.id}/vote`,'POST',{start})).status,404);
  assert.equal((await call(ownerToken,`meeting-polls/${poll.id}/vote`,'POST',{start})).status,409);
  assert.equal((await call(ownerToken,`meeting-polls/${poll.id}/availability`,'PUT',{intervals:[[start,end]]})).status,200);
  const incomplete=await (await call(ownerToken,`meeting-polls/${poll.id}`)).json();assert.deepEqual(incomplete.result.missingMemberIds,['member','member2']);assert.equal(incomplete.result.hasAllMemberOption,false);assert.deepEqual(incomplete.memberStatuses,[{userId:'owner',submitted:true},{userId:'member',submitted:false},{userId:'member2',submitted:false}]);
  assert.equal((await call(ownerToken,`meeting-polls/${poll.id}/voting`,'POST',{})).status,409);
  assert.equal((await call(memberToken,`meeting-polls/${poll.id}/availability`,'PUT',{intervals:[[start+60*60000,end]],avoidIntervals:[[start+60*60000,start+90*60000]]})).status,200);
  assert.equal((await call(member2Token,`meeting-polls/${poll.id}/availability`,'PUT',{intervals:[[start+60*60000,end]]})).status,200);
  const complete=await (await call(ownerToken,`meeting-polls/${poll.id}`)).json(),options=complete.result.proposals.filter(item=>item.allAvailable);assert.ok(options.length>=2);const [proposal,secondProposal]=options;
  const voting=await call(ownerToken,`meeting-polls/${poll.id}/voting`,'POST',{});assert.equal(voting.status,200);assert.equal((await voting.json()).phase,'voting');
  await env.DB.prepare("INSERT INTO group_members(group_id,user_id,role,joined) VALUES('group','late','member',3)").run();
  assert.equal((await call(lateToken,`meeting-polls/${poll.id}/vote`,'POST',{start:proposal.start})).status,403);
  assert.equal((await call(ownerToken,`meeting-polls/${poll.id}/vote`,'POST',{start:proposal.start})).status,200);
  assert.equal((await call(ownerToken,`meeting-polls/${poll.id}/confirm`,'POST',{start:proposal.start})).status,409);
  assert.equal((await call(memberToken,`meeting-polls/${poll.id}/vote`,'POST',{start:proposal.start})).status,200);
  assert.equal((await call(member2Token,`meeting-polls/${poll.id}/vote`,'POST',{start:secondProposal.start})).status,200);
  const voted=await (await call(memberToken,`meeting-polls/${poll.id}`)).json();assert.equal(voted.votes.find(item=>item.start===proposal.start).count,2);assert.deepEqual(voted.missingVoterIds,[]);assert.equal(voted.memberStatuses.length,3);
  assert.equal((await call(ownerToken,`meeting-polls/${poll.id}/confirm`,'POST',{start:secondProposal.start})).status,409);
  assert.equal((await call(memberToken,`meeting-polls/${poll.id}/confirm`,'POST',{start:proposal.start})).status,403);
  await env.DB.prepare("INSERT INTO subscriptions(id,data,created,user_id) VALUES('owner-push','{}',0,'owner'),('member-push','{}',0,'member'),('member2-push','{}',0,'member2')").run();
  const confirmed=await call(ownerToken,`meeting-polls/${poll.id}/confirm`,'POST',{start:proposal.start});assert.equal(confirmed.status,200);assert.equal((await confirmed.json()).status,'confirmed');
  assert.equal((await call(ownerToken,`meeting-polls/${poll.id}/confirm`,'POST',{start:proposal.start})).status,409);
  assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM tasks WHERE source='meeting' AND source_id=?").bind(poll.id).first()).n,3);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM group_announcements WHERE group_id=?').bind('group').first()).n,1);
  assert.ok((await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE task_id IN (SELECT id FROM tasks WHERE source='meeting' AND source_id=?)").bind(poll.id).first()).n>0);
  assert.equal((await (await call(ownerToken,'tasks')).json()).some(task=>task.source==='meeting'),true);
  assert.equal((await (await call(memberToken,'tasks')).json()).some(task=>task.source==='meeting'),true);
  assert.equal((await (await call(lateToken,'tasks')).json()).some(task=>task.source==='meeting'),false);
});

test('unauthenticated shared view URLs redirect to the public home page',async()=>{
  const env={DB:database(),ASSETS:{fetch:async()=>new Response('public app')}};
  const response=await worker.fetch(new Request('https://campus.example/?view=settings',{redirect:'manual'}),env);
  assert.equal(response.status,302);assert.equal(response.headers.get('location'),'https://campus.example/');
  const publicResponse=await worker.fetch(new Request('https://campus.example/'),env);
  assert.equal(publicResponse.status,200);
});

test('each signed-in account can start its own Outlook connection with an email hint',async()=>{
  const env={DB:database(),MS_CLIENT_ID:'test-client',MS_CLIENT_SECRET:'test-secret',APP_ORIGIN:'https://campus.example',TOKEN_KEY:random()},origin='https://campus.example',token=random();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('second','second@example.com','unused',0)").run();
  await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?)').bind(await hash(token),Date.now()+3600000,'second').run();
  const status=await (await worker.fetch(new Request(origin+'/api/status',{headers:{Cookie:'campus_session='+token}}),env)).json();assert.equal(status.outlookConfigured,true);assert.deepEqual(status.outlookMissingConfig,[]);
  const response=await worker.fetch(new Request(origin+'/api/outlook/start?email=personal@outlook.com',{headers:{Cookie:'campus_session='+token},redirect:'manual'}),env);
  assert.equal(response.status,302);
  const authorization=new URL(response.headers.get('location'));
  assert.equal(authorization.hostname,'login.microsoftonline.com');
  assert.equal(authorization.searchParams.get('login_hint'),'personal@outlook.com');
  assert.equal(authorization.searchParams.get('prompt'),'select_account');
  assert.match(authorization.searchParams.get('scope'),/\bMail\.Read\b/);
  assert.doesNotMatch(authorization.searchParams.get('scope'),/\bMail\.Send\b/);
  const state=authorization.searchParams.get('state');
  assert.equal((await env.DB.prepare('SELECT user_id FROM oauth WHERE state=?').bind(state).first()).user_id,'second');
});

test('Outlook diagnostics reject example placeholders before OAuth starts',async()=>{
  const env={DB:database(),MS_CLIENT_ID:'REPLACE_WITH_YOUR_MICROSOFT_APP_CLIENT_ID',MS_CLIENT_SECRET:'replace-with-secret-value',APP_ORIGIN:'https://your-worker.your-subdomain.workers.dev',TOKEN_KEY:'generated_by_setup_secrets'},origin='https://campus.example',token=random();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('user','user@example.com','unused',0)").run();
  await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?)').bind(await hash(token),Date.now()+3600000,'user').run();
  const request=path=>worker.fetch(new Request(origin+'/api/'+path,{headers:{Cookie:'campus_session='+token},redirect:'manual'}),env);
  const status=await (await request('status')).json();assert.equal(status.outlookConfigured,false);assert.deepEqual(status.outlookMissingConfig.sort(),['APP_ORIGIN','MS_CLIENT_ID','MS_CLIENT_SECRET','TOKEN_KEY']);
  assert.equal((await request('outlook/start?email=personal@outlook.com')).status,400);
});

test('disconnecting Outlook removes only the current account authorization',async()=>{
  const env={DB:database()},origin='https://campus.example',token=random();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('one','one@example.com','unused',0),('two','two@example.com','unused',0)").run();
  await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?)').bind(await hash(token),Date.now()+3600000,'one').run();
  await env.DB.prepare("INSERT INTO outlook_connections(user_id,token,email,status) VALUES('one','encrypted-a','one@outlook.com','同步完成'),('two','encrypted-b','two@outlook.com','同步完成')").run();
  await env.DB.prepare("INSERT INTO messages(id,subject,received,sender,origin,category,summary,action,url,quality,user_id) VALUES('keep','School mail',0,'sender','school',2,'summary','action','','test','one')").run();
  const response=await worker.fetch(new Request(origin+'/api/outlook',{method:'DELETE',headers:{Origin:origin,Cookie:'campus_session='+token,'Content-Type':'application/json'}}),env);
  assert.equal(response.status,200);
  assert.equal(await env.DB.prepare("SELECT user_id FROM outlook_connections WHERE user_id='one'").first(),null);
  assert.equal((await env.DB.prepare("SELECT email FROM outlook_connections WHERE user_id='two'").first()).email,'two@outlook.com');
  assert.equal((await env.DB.prepare("SELECT id FROM messages WHERE id='keep' AND user_id='one'").first()).id,'keep');
});

test('mail reminder preferences are saved separately for each account',async()=>{
  const env={DB:database()},origin='https://campus.example',token=random();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('prefs','prefs@example.com','unused',0)").run();
  await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?)').bind(await hash(token),Date.now()+3600000,'prefs').run();
  const preferences={focusTerms:['scholarship','SOC 210'],daily:{enabled:true,time:'18:30'},late:{enabled:false,time:'00:30'}};
  const response=await worker.fetch(new Request(origin+'/api/profile',{method:'PATCH',headers:{Origin:origin,Cookie:'campus_session='+token,'Content-Type':'application/json'},body:JSON.stringify({mailPreferences:preferences})}),env);
  assert.equal(response.status,200);assert.deepEqual((await response.json()).mailPreferences,preferences);
  const profile=await worker.fetch(new Request(origin+'/api/profile',{headers:{Cookie:'campus_session='+token}}),env);
  assert.deepEqual((await profile.json()).mailPreferences,preferences);
});


test('digest history is visible only to the account that received it',async()=>{
  const env={DB:database()},origin='https://campus.example',firstToken=random(),secondToken=random();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('first','first@example.com','unused',0),('second','second@example.com','unused',0)").run();
  await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?),(?,?,?)').bind(await hash(firstToken),Date.now()+3600000,'first',await hash(secondToken),Date.now()+3600000,'second').run();
  await env.DB.prepare("INSERT INTO kv(key,value) VALUES('digest:first:daily:2026-09-24:18:30',?),('digest:second:daily:2026-09-24:18:30',?)").bind(JSON.stringify({title:'First digest',body:'private one',created:1}),JSON.stringify({title:'Second digest',body:'private two',created:2})).run();
  const get=token=>worker.fetch(new Request(origin+'/api/digests',{headers:{Cookie:'campus_session='+token}}),env);
  const first=await (await get(firstToken)).json(),second=await (await get(secondToken)).json();
  assert.equal(first.length,1);assert.equal(first[0].title,'First digest');
  assert.equal(second.length,1);assert.equal(second[0].title,'Second digest');
});
