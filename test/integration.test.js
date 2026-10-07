import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import worker from '../src/worker.js';
import { hash,b64,random,seal,unseal,makePasswordHash } from '../src/security.js';
import { deliver } from '../src/jobs.js';
function database(){
  const sqlite=new DatabaseSync(':memory:');for(const name of ['0001.sql','0002_accounts.sql','0003_profile.sql','0004_message_localizations.sql','0005_localization_version.sql','0006_outlook_connections.sql','0007_mail_preferences.sql'])sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const db={prepare(sql){let args=[];const obj={bind(...a){args=a;return obj;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:r.changes}};}};return obj;},async batch(stmts){sqlite.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};return db;
}
test('authenticated CRUD persists and completing cancels pending reminders',async()=>{
  const env={DB:database(),OWNER_EMAIL:'test@example.com'},origin='https://campus.example',token=random();
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('u1','test@example.com','unused',0)").run();
  await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?)').bind(await hash(token),Date.now()+3600000,'u1').run();
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
test('authenticated iPhone mail handoff imports a message and creates only an explicit assignment task',async()=>{
  const env={DB:database(),SCHOOL_EMAIL:'student@university.example',SHORTCUT_INGEST_KEY:'test-shortcut-secret',LOGIN_EMAIL:'owner@example.com'};
  await env.DB.prepare("INSERT INTO users(id,email,password_hash,created) VALUES('owner','owner@example.com','unused',0)").run();
  const origin='https://campus.example',payload={subject:'SOC 210 Assignment 2 deadline',sender:'student@university.example',content:'From: Teacher <teacher@ln.edu.hk>\nPlease submit Assignment 2 before the deadline.'};
  const send=key=>worker.fetch(new Request(origin+'/api/mail/shortcut',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload)}),env);
  assert.equal((await send('wrong-secret')).status,401);
  const imported=await send('test-shortcut-secret');assert.equal(imported.status,201);
  assert.deepEqual(await imported.json(),{ok:true,duplicate:false,category:2,task:true});
  assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM messages').first()).n,1);
  const task=await env.DB.prepare('SELECT * FROM tasks').first();assert.match(task.title,/Assignment 2/);assert.equal(task.due,null);
  const duplicate=await send('test-shortcut-secret');assert.equal((await duplicate.json()).duplicate,true);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM tasks').first()).n,1);
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
  const response=await worker.fetch(new Request(origin+'/api/outlook/start?email=personal@outlook.com',{headers:{Cookie:'campus_session='+token},redirect:'manual'}),env);
  assert.equal(response.status,302);
  const authorization=new URL(response.headers.get('location'));
  assert.equal(authorization.hostname,'login.microsoftonline.com');
  assert.equal(authorization.searchParams.get('login_hint'),'personal@outlook.com');
  assert.equal(authorization.searchParams.get('prompt'),'select_account');
  const state=authorization.searchParams.get('state');
  assert.equal((await env.DB.prepare('SELECT user_id FROM oauth WHERE state=?').bind(state).first()).user_id,'second');
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
