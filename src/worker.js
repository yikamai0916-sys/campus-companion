import { validateTask } from './domain.js';
import { random,hash,verifyPassword,makePasswordHash,makeAnswerHash,verifyAnswer } from './security.js';
import { getKV,setKV,startOAuth,finishOAuth,syncMail,reprocessMail,ingestForwardedEmail,ingestShortcutEmail,localizeMessages,outlookConnection,outlookConfigProblems } from './mail.js';
import { scheduleTask,repeatTasks,deliver,makeDigest,enqueue } from './jobs.js';
import { addGroupMember,createGroup,createTaskCandidate,groupSnapshot,listGroups,respondToAssignment,reviewTaskCandidate } from './collaboration.js';
import { confirmMeetingProposal,createMeetingPoll,meetingPollSnapshot,openMeetingVote,submitAvailability,voteMeetingProposal } from './meetings.js';
const json=(data,status=200)=>Response.json(data,{status});
async function body(request){if(Number(request.headers.get('content-length'))>7*1024*1024)throw new Error('请求过大');const text=await request.text();if(text.length>7*1024*1024)throw new Error('请求过大');return JSON.parse(text);}
const emailOf=value=>String(value||'').trim().toLowerCase();
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254;
const defaultReminder={offsets:[4320,1440,120,30],repeat:1440,maxCount:0,start:'08:00',end:'23:00',days:[1,2,3,4,5,6,0],push:true,email:false};
const parseReminder=value=>{try{return {...defaultReminder,...JSON.parse(value||'{}')}}catch{return defaultReminder}};
const defaultMailPreferences={focusTerms:[],daily:{enabled:true,time:'20:00'},late:{enabled:true,time:'00:00'}};
const validTime=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||''));
const parseMailPreferences=value=>{try{const raw=typeof value==='string'?JSON.parse(value||'{}'):(value||{}),focusTerms=(Array.isArray(raw.focusTerms)?raw.focusTerms:[]).map(x=>String(x).trim()).filter(x=>x.length>0&&x.length<=80).filter((x,index,list)=>list.findIndex(other=>other.toLowerCase()===x.toLowerCase())===index).slice(0,30);return {focusTerms,daily:{enabled:raw.daily?.enabled!==false,time:validTime(raw.daily?.time)?raw.daily.time:'20:00'},late:{enabled:raw.late?.enabled!==false,time:validTime(raw.late?.time)?raw.late.time:'00:00'}};}catch{return structuredClone(defaultMailPreferences)}};
async function session(request,env){const cookie=request.headers.get('Cookie')?.match(/(?:^|; )campus_session=([^;]+)/)?.[1];if(!cookie)return null;return env.DB.prepare('SELECT s.id,s.user_id,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>?').bind(await hash(cookie),Date.now()).first();}
async function startSession(env,user,url){const token=random(),expires=Date.now()+30*86400000;await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?)').bind(await hash(token),expires,user.id).run();return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':`campus_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${url.protocol==='https:'?'; Secure':''}`}});}
async function ownerUser(env){return env.DB.prepare('SELECT id,email FROM users WHERE email=?').bind(emailOf(env.LOGIN_EMAIL)).first();}
async function claimLegacy(env,userId){await env.DB.batch(['tasks','messages','subscriptions','jobs'].map(table=>env.DB.prepare(`UPDATE ${table} SET user_id=? WHERE user_id IS NULL`).bind(userId)));}
async function legacyOwner(env,email,password){if(email!==emailOf(env.LOGIN_EMAIL))return null;const stored=await getKV(env,'password_hash')||env.PASSWORD_HASH;if(!stored||!await verifyPassword(password,stored))return null;const id=crypto.randomUUID();await env.DB.prepare('INSERT OR IGNORE INTO users(id,email,password_hash,created) VALUES(?,?,?,?)').bind(id,email,stored,Date.now()).run();const user=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();await claimLegacy(env,user.id);return user;}
const mapTask=t=>({...t,completed:!!t.completed,reminders:JSON.parse(t.reminders)});
async function createTask(env,data,source='manual',sourceId=null,userId=null){
  if(!userId)throw new Error('无法确认任务所属账号');
  const t={...validateTask(data),id:crypto.randomUUID(),version:1,source,source_id:sourceId,created:Date.now(),updated:Date.now(),user_id:userId};
  await env.DB.prepare('INSERT INTO tasks(id,title,notes,due,priority,completed,source,source_id,reminders,version,created,updated,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(t.id,t.title,t.notes,t.due,t.priority,t.completed,t.source,t.source_id,JSON.stringify(t.reminders),t.version,t.created,t.updated,t.user_id).run();
  await scheduleTask(env,t);return t;
}
async function routes(request,env){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  const shortcutIngest=path==='/api/mail/shortcut'&&method==='POST';
  if(path.startsWith('/api/')&&!['GET','HEAD'].includes(method)&&!shortcutIngest&&request.headers.get('Origin')!==url.origin)return json({error:'请求来源无效'},403);
  if(shortcutIngest){
    if(!env.SHORTCUT_INGEST_KEY)return json({error:'iPhone 邮件转交尚未配置'},503);
    const supplied=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||'';
    if(!supplied||await hash(supplied)!==await hash(env.SHORTCUT_INGEST_KEY))return json({error:'邮件转交密钥无效'},401);
    const owner=await ownerUser(env);return json({ok:true,...await ingestShortcutEmail(env,await body(request),owner?.id)},201);
  }
  if(path==='/api/auth/config'&&method==='GET')return json({registration:'simple',passwordMin:12});
  if(path==='/api/register'&&method==='POST'){
    const data=await body(request),email=emailOf(data.email),question=String(data.question||'').trim();
    if(!validEmail(email))return json({error:'请输入有效邮箱地址'},400);
    if(question.length<4||question.length>120)return json({error:'密保问题需为 4–120 个字符'},400);
    const passwordHash=await makePasswordHash(data.password),answerHash=await makeAnswerHash(data.answer),id=crypto.randomUUID();
    try{await env.DB.prepare('INSERT INTO users(id,email,password_hash,security_question,security_answer_hash,created) VALUES(?,?,?,?,?,?)').bind(id,email,passwordHash,question,answerHash,Date.now()).run();}
    catch(error){if(/UNIQUE|constraint/i.test(String(error)))return json({error:'该邮箱已经注册，请直接登录'},409);throw error;}
    return startSession(env,{id,email},url);
  }
  if(path==='/api/recovery/question'&&method==='POST'){
    const user=await env.DB.prepare('SELECT security_question FROM users WHERE email=?').bind(emailOf((await body(request)).email)).first();
    if(!user?.security_question)return json({error:'该账号尚未设置密保问题，请登录后设置'},404);
    return json({question:user.security_question});
  }
  if(path==='/api/recovery/reset'&&method==='POST'){
    const data=await body(request),email=emailOf(data.email),user=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    if(!user?.security_answer_hash||!await verifyAnswer(data.answer,user.security_answer_hash))return json({error:'邮箱或密保答案不正确'},401);
    const next=await makePasswordHash(data.password);
    await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(next,user.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
    return json({ok:true});
  }
  if(path==='/api/login'&&method==='POST'){
    const ip=request.headers.get('CF-Connecting-IP')||'local',key='login:'+await hash(ip),attempt=JSON.parse(await getKV(env,key)||'{"count":0,"until":0}');
    if(attempt.until>Date.now()&&attempt.count>=8)return json({error:'尝试次数过多，请 15 分钟后重试'},429);
    await setKV(env,key,JSON.stringify({count:attempt.until>Date.now()?attempt.count+1:1,until:attempt.until>Date.now()?attempt.until:Date.now()+900000}));
    const data=await body(request),suppliedEmail=emailOf(data.email);let user=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(suppliedEmail).first();
    if(!user)user=await legacyOwner(env,suppliedEmail,data.password);
    if(!user||!await verifyPassword(data.password,user.password_hash))return json({error:'邮箱或密码不正确'},401);
    await setKV(env,key,'{"count":0,"until":0}');
    return startSession(env,user,url);
  }
  if(!path.startsWith('/api/')){
    // A shared link must never reopen a previous person's private screen.
    if(url.searchParams.has('view')&&!await session(request,env))return Response.redirect(url.origin+'/',302);
    return env.ASSETS.fetch(request);
  }
  const account=await session(request,env);if(!account)return json({error:'请先登录'},401);
  if(path==='/api/logout'&&method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(account.id).run();return new Response('{}',{headers:{'Set-Cookie':'campus_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0','Content-Type':'application/json'}});}
  if(path==='/api/password'&&method==='POST'){
    const data=await body(request),user=await env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(account.user_id).first(),current=user.password_hash;
    if(!await verifyPassword(data.current,current))return json({error:'当前密码不正确'},401);
    const next=await makePasswordHash(data.next);
    await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(next,account.user_id),env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND id<>?').bind(account.user_id,account.id)]);
    return json({ok:true});
  }
  if(path==='/api/security-question'&&method==='POST'){
    const data=await body(request),user=await env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(account.user_id).first();
    if(!await verifyPassword(data.password,user.password_hash))return json({error:'当前密码不正确'},401);
    const question=String(data.question||'').trim();if(question.length<4||question.length>120)return json({error:'密保问题需为 4–120 个字符'},400);
    await env.DB.prepare('UPDATE users SET security_question=?,security_answer_hash=? WHERE id=?').bind(question,await makeAnswerHash(data.answer),account.user_id).run();return json({ok:true});
  }
  if(path==='/api/profile'&&method==='GET'){
    const user=await env.DB.prepare('SELECT email,nickname,avatar,linked_email,locale,reminder_defaults,mail_preferences FROM users WHERE id=?').bind(account.user_id).first();
    return json({email:user.email,nickname:user.nickname||'',avatar:user.avatar||'',linkedEmail:user.linked_email||'',locale:user.locale||'zh-CN',reminders:parseReminder(user.reminder_defaults),mailPreferences:parseMailPreferences(user.mail_preferences)});
  }
  if(path==='/api/profile'&&method==='PATCH'){
    const data=await body(request),current=await env.DB.prepare('SELECT nickname,avatar,linked_email,locale,reminder_defaults,mail_preferences FROM users WHERE id=?').bind(account.user_id).first();
    const nickname=String(data.nickname===undefined?(current?.nickname||''):data.nickname).trim(),avatar=String(data.avatar===undefined?(current?.avatar||''):data.avatar).trim(),linkedEmail=data.linkedEmail===undefined?(current?.linked_email||''):emailOf(data.linkedEmail),locale=data.locale===undefined?(current?.locale||'zh-CN'):(['zh-CN','zh-TW','en'].includes(data.locale)?data.locale:'zh-CN');
    const avatarOk=avatar.length<=16||(/^data:image\/(?:png|jpeg|webp|gif);base64,/.test(avatar)&&avatar.length<=7*1024*1024);
    if(nickname.length>80||!avatarOk)return json({error:'昵称最多 80 个字符；图片头像需为 PNG、JPEG、WEBP 或 GIF'},400);
    if(linkedEmail&&!validEmail(linkedEmail))return json({error:'关联邮箱格式不正确'},400);
    const reminders={...defaultReminder,...parseReminder(current?.reminder_defaults),...(data.reminders||{})};
    const mailPreferences=parseMailPreferences(data.mailPreferences===undefined?current?.mail_preferences:data.mailPreferences);
    if(!Array.isArray(reminders.offsets)||reminders.offsets.some(n=>!Number.isFinite(Number(n))||Number(n)<0)||!Number.isFinite(Number(reminders.repeat))||Number(reminders.repeat)<0)return json({error:'提醒配置不正确'},400);
    if(!validTime(mailPreferences.daily.time)||!validTime(mailPreferences.late.time))return json({error:'邮件提醒时间不正确'},400);
    await env.DB.prepare('UPDATE users SET nickname=?,avatar=?,linked_email=?,locale=?,reminder_defaults=?,mail_preferences=? WHERE id=?').bind(nickname,avatar,linkedEmail,locale,JSON.stringify(reminders),JSON.stringify(mailPreferences),account.user_id).run();
    return json({ok:true,nickname,avatar,linkedEmail,locale,reminders,mailPreferences});
  }
  const isOwner=account.email===emailOf(env.LOGIN_EMAIL);
  if(path==='/api/groups'&&method==='GET')return json(await listGroups(env,account.user_id));
  if(path==='/api/groups'&&method==='POST')return json(await createGroup(env,account.user_id,await body(request)),201);
  const groupId=path.match(/^\/api\/groups\/([\w-]+)$/)?.[1];
  if(groupId&&method==='GET')return json(await groupSnapshot(env,account.user_id,groupId));
  const groupMembersId=path.match(/^\/api\/groups\/([\w-]+)\/members$/)?.[1];
  if(groupMembersId&&method==='POST')return json(await addGroupMember(env,account.user_id,groupMembersId,(await body(request)).email),201);
  const groupCandidatesId=path.match(/^\/api\/groups\/([\w-]+)\/candidates$/)?.[1];
  if(groupCandidatesId&&method==='POST')return json(await createTaskCandidate(env,account.user_id,groupCandidatesId,await body(request)),201);
  const meetingGroupId=path.match(/^\/api\/groups\/([\w-]+)\/meeting-polls$/)?.[1];
  if(meetingGroupId&&method==='POST')return json(await createMeetingPoll(env,account.user_id,meetingGroupId,await body(request)),201);
  const meetingPollId=path.match(/^\/api\/meeting-polls\/([\w-]+)$/)?.[1];
  if(meetingPollId&&method==='GET')return json(await meetingPollSnapshot(env,account.user_id,meetingPollId));
  const availabilityPollId=path.match(/^\/api\/meeting-polls\/([\w-]+)\/availability$/)?.[1];
  if(availabilityPollId&&method==='PUT')return json(await submitAvailability(env,account.user_id,availabilityPollId,await body(request)));
  const votingPollId=path.match(/^\/api\/meeting-polls\/([\w-]+)\/voting$/)?.[1];
  if(votingPollId&&method==='POST')return json(await openMeetingVote(env,account.user_id,votingPollId));
  const votePollId=path.match(/^\/api\/meeting-polls\/([\w-]+)\/vote$/)?.[1];
  if(votePollId&&method==='POST')return json(await voteMeetingProposal(env,account.user_id,votePollId,(await body(request)).start));
  const confirmPollId=path.match(/^\/api\/meeting-polls\/([\w-]+)\/confirm$/)?.[1];
  if(confirmPollId&&method==='POST')return json(await confirmMeetingProposal(env,account.user_id,confirmPollId,(await body(request)).start));
  const candidateId=path.match(/^\/api\/task-candidates\/([\w-]+)\/review$/)?.[1];
  if(candidateId&&method==='POST')return json(await reviewTaskCandidate(env,account.user_id,candidateId,await body(request)));
  const assignmentTaskId=path.match(/^\/api\/tasks\/([\w-]+)\/assignment$/)?.[1];
  if(assignmentTaskId&&method==='POST')return json(await respondToAssignment(env,account.user_id,assignmentTaskId,(await body(request)).decision));
  if(path==='/api/status'){
    const profile=await env.DB.prepare('SELECT nickname,avatar,linked_email,locale,reminder_defaults FROM users WHERE id=?').bind(account.user_id).first();
    const outlook=await outlookConnection(env,account.user_id);
    const outlookMissingConfig=outlookConfigProblems(env,url.origin);
    return json({account:{id:account.user_id,email:account.email,isOwner,userCode:String(account.user_id).replace(/-/g,'').slice(-4).toUpperCase(),nickname:profile?.nickname||'',avatar:profile?.avatar||'',locale:profile?.locale||'zh-CN'},outlook:!!outlook,outlookEmail:outlook?.email||'',outlookConfigured:outlookMissingConfig.length===0,outlookMissingConfig,mailStatus:outlook?.status||'尚未连接 Outlook',lastSync:outlook?.last_sync||null,pushReady:!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY),vapid:env.VAPID_PUBLIC_KEY||null,ai:env.ENABLE_AI==='true',appleSync:false,cronLast:await getKV(env,'cron_last'),jobErrors:(await env.DB.prepare("SELECT error,channel,at FROM jobs WHERE user_id=? AND error IS NOT NULL ORDER BY at DESC LIMIT 5").bind(account.user_id).all()).results});
  }
  if(path==='/api/tasks'&&method==='GET')return json((await env.DB.prepare("SELECT * FROM tasks WHERE user_id=? AND (group_id IS NULL OR acceptance_status='accepted') ORDER BY completed, due IS NULL, due, priority").bind(account.user_id).all()).results.map(mapTask));
  if(path==='/api/tasks'&&method==='POST')return json(await createTask(env,await body(request),'manual',null,account.user_id),201);
  const taskId=path.match(/^\/api\/tasks\/([\w-]+)$/)?.[1];
  if(taskId&&method==='PATCH'){
    const old=await env.DB.prepare('SELECT * FROM tasks WHERE id=? AND user_id=?').bind(taskId,account.user_id).first();if(!old)return json({error:'任务不存在'},404);
    if(old.acceptance_status==='pending')return json({error:'请先接受或拒绝这项分工'},409);
    if(old.acceptance_status==='declined')return json({error:'已拒绝的分工不能修改'},409);
    const input=await body(request);if(input.version!==old.version)return json({error:'任务已在其他设备更新，请刷新后重试'},409);
    const t={...old,...validateTask(input,mapTask(old)),version:old.version+1,updated:Date.now()};
    const result=await env.DB.batch([env.DB.prepare('UPDATE tasks SET title=?,notes=?,due=?,priority=?,completed=?,reminders=?,version=?,updated=? WHERE id=? AND version=?').bind(t.title,t.notes,t.due,t.priority,t.completed,JSON.stringify(t.reminders),t.version,t.updated,t.id,old.version),env.DB.prepare("UPDATE jobs SET state='cancelled' WHERE task_id=? AND version=? AND state IN ('pending','sending')").bind(t.id,old.version)]);
    if(!result[0].meta.changes)return json({error:'任务已更新，请刷新'},409);
    await scheduleTask(env,t);return json(t);
  }
  if(taskId&&method==='DELETE'){
    const old=await env.DB.prepare('SELECT completed FROM tasks WHERE id=? AND user_id=?').bind(taskId,account.user_id).first();if(!old)return json({error:'任务不存在'},404);if(!old.completed)return json({error:'只有已完成任务可以删除'},409);
    await env.DB.batch([env.DB.prepare('DELETE FROM jobs WHERE task_id=? AND user_id=?').bind(taskId,account.user_id),env.DB.prepare('DELETE FROM tasks WHERE id=? AND user_id=?').bind(taskId,account.user_id)]);return json({ok:true});
  }
  if(path==='/api/messages'&&method==='GET'){
    const messages=(await env.DB.prepare('SELECT * FROM messages WHERE user_id=? AND category<5 ORDER BY CAST((received+28800000)/86400000 AS INTEGER) DESC,category,received DESC LIMIT 200').bind(account.user_id).all()).results;
    const profile=await env.DB.prepare('SELECT locale FROM users WHERE id=?').bind(account.user_id).first();
    return json(await localizeMessages(env,account.user_id,profile?.locale||'zh-CN',messages));
  }
  const messageId=path.match(/^\/api\/messages\/(.+)$/)?.[1];
  if(messageId&&method==='DELETE'){await env.DB.prepare('DELETE FROM messages WHERE id=? AND user_id=?').bind(decodeURIComponent(messageId),account.user_id).run();return json({ok:true});}
  if(path==='/api/mail/reprocess'&&method==='POST')return json(await reprocessMail(env,account.user_id,2));
  if(path==='/api/digests'){const prefix='digest:'+account.user_id+':%';const rows=(await env.DB.prepare("SELECT value FROM kv WHERE key LIKE ? AND value!='quiet' ORDER BY key DESC LIMIT 30").bind(prefix).all()).results;return json(rows.flatMap(row=>{try{return [JSON.parse(row.value)]}catch{return []}}));}
  if(path==='/api/outlook/start'&&method==='GET'){
    const requestedEmail=emailOf(url.searchParams.get('email'));
    if(requestedEmail&&!validEmail(requestedEmail))return json({error:'请输入有效的 Outlook 邮箱'},400);
    return Response.redirect(await startOAuth(env,account,requestedEmail,url.origin));
  }
  if(path==='/api/outlook/callback'&&method==='GET'){
    await finishOAuth(env,url,account);
    try{await syncMail(env,account.user_id);}catch(error){await env.DB.prepare('UPDATE outlook_connections SET status=? WHERE user_id=?').bind(String(error.message).slice(0,300),account.user_id).run();}
    return Response.redirect(url.origin+'/?view=settings');
  }
  if(path==='/api/outlook/sync'&&method==='POST'){
    const result=await syncMail(env,account.user_id);
    return json(result||{imported:0,pages:0,more:false});
  }
  if(path==='/api/outlook'&&method==='DELETE'){
    const connection=await outlookConnection(env,account.user_id);if(!connection)return json({error:'尚未连接 Outlook'},404);
    await env.DB.prepare('DELETE FROM outlook_connections WHERE user_id=?').bind(account.user_id).run();
    return json({ok:true});
  }
  if(path==='/api/subscriptions'&&method==='POST'){
    const sub=await body(request);let endpoint;try{endpoint=new URL(sub.endpoint);}catch{return json({error:'通知订阅无效'},400);}
    const host=endpoint.hostname;
    if(endpoint.protocol!=='https:'||!(['web.push.apple.com','fcm.googleapis.com'].includes(host)||host.endsWith('.push.apple.com')||host.endsWith('.push.services.mozilla.com')||host.endsWith('.notify.windows.com'))||!sub.keys?.p256dh||!sub.keys?.auth)return json({error:'不支持的通知服务'},400);
    const id=await hash(sub.endpoint);
    await env.DB.prepare('INSERT INTO subscriptions(id,data,created,user_id) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,user_id=excluded.user_id').bind(id,JSON.stringify(sub),Date.now(),account.user_id).run();
    const {results}=await env.DB.prepare('SELECT * FROM tasks WHERE user_id=? AND completed=0').bind(account.user_id).all();for(const t of results)await scheduleTask(env,mapTask(t));
    return json({ok:true});
  }
  if(path==='/api/test-notification'&&method==='POST'){await enqueue(env,'test:'+crypto.randomUUID(),null,Date.now(),{title:'校园清单 · 测试提醒',body:'收到这条消息表示该提醒渠道已接通。',url:'/'},{push:true,email:true},account.user_id);await deliver(env);return json({ok:true});}
  return json({error:'页面不存在'},404);
}
export default {
  async fetch(request,env){
    let response;try{response=await routes(request,env);}catch(error){response=json({error:error.message||'暂时无法处理，请重试'},Number(error.status)||400);}
    const h=new Headers(response.headers);h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','same-origin');h.set('X-Frame-Options','DENY');h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if(new URL(request.url).pathname.startsWith('/api/'))h.set('Cache-Control','no-store');
    return new Response(response.body,{status:response.status,headers:h});
  },
  async email(message,env,ctx){
    if(env.MAIL_INGEST_MODE!=='forwarding')return message.setReject('Email ingestion is disabled');
    const owner=await ownerUser(env);ctx.waitUntil(ingestForwardedEmail(env,message,owner?.id));
  },
  async scheduled(controller,env){
    const now=Date.now();
    // Single worker lease prevents overlapping scheduled sends and token refreshes.
    await env.DB.prepare("INSERT OR IGNORE INTO kv VALUES('cron_lease','0')").run();
    const lock=await env.DB.prepare("UPDATE kv SET value=? WHERE key='cron_lease' AND CAST(value AS INTEGER)<? RETURNING key").bind(String(now+240000),now).first();if(!lock)return;
    try {
      await setKV(env,'cron_last',String(now));
      await repeatTasks(env,now);await deliver(env,now);
      if(env.MAIL_INGEST_MODE!=='forwarding'){
        const connections=(await env.DB.prepare('SELECT user_id,cursor,last_attempt FROM outlook_connections WHERE last_attempt IS NULL OR last_attempt<? OR cursor IS NOT NULL').bind(now-240000).all()).results;
        for(const connection of connections){
          await env.DB.prepare('UPDATE outlook_connections SET last_attempt=? WHERE user_id=?').bind(now,connection.user_id).run();
          try{await syncMail(env,connection.user_id);}catch(error){await env.DB.prepare('UPDATE outlook_connections SET status=? WHERE user_id=?').bind(String(error.message).slice(0,300),connection.user_id).run();}
        }
      }
      await makeDigest(env,Date.now());
      await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(now),env.DB.prepare('DELETE FROM oauth WHERE expires<?').bind(now)]);
    }finally{await env.DB.prepare("UPDATE kv SET value='0' WHERE key='cron_lease' AND value=?").bind(String(now+240000)).run();}
  }
};
