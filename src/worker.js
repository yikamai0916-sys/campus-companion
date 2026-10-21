import {attachBriefs,generateBrief,readBrief,preGenerateBriefs} from './mail-briefs.js';
import { meetingTask,wording } from './display.js';
import { serverMessage,normalizeLocale } from './errors.js';
import { buildAliasRules,normalizeName,suggestAliasVariants } from './names.js';
import { listMailSuggestions,reviewMailSuggestion } from './suggestions.js';
import { validateTask } from './domain.js';
import { normalizePresets } from '../public/reminder-logic.js';
import { random,hash,verifyPassword,makePasswordHash,makeAnswerHash,verifyAnswer } from './security.js';
import { getKV,setKV,startOAuth,finishOAuth,syncMail,reprocessMail,ingestForwardedEmail,ingestShortcutEmail,localizeMessages,outlookConnection,outlookConfigProblems,fetchMessageOriginal,translateFullBody,summarizeLink } from './mail.js';
import { applyNameAliases,applyPreferredNameToFields } from './names.js';
import { normalizeDigestRecord } from './digest-format.js';
import { scheduleTask,repeatTasks,deliver,makeDigest,enqueue } from './jobs.js';
import { listInvitations,respondInvitation,manageMember,addGroupMember,createGroup,createTaskCandidate,groupSnapshot,listGroups,respondToAssignment,reviewTaskCandidate } from './collaboration.js';
import { changeMeeting,confirmMeetingProposal,createMeetingPoll,meetingPollSnapshot,openMeetingVote,submitAvailability,voteMeetingProposal } from './meetings.js';
const json=(data,status=200)=>Response.json(data,{status});
async function body(request){if(Number(request.headers.get('content-length'))>7*1024*1024)throw new Error('请求过大');const text=await request.text();if(text.length>7*1024*1024)throw new Error('请求过大');return JSON.parse(text);}
const emailOf=value=>String(value||'').trim().toLowerCase();
async function nameAliasRules(env,userId,preferredZhName=''){
  const aliases=(await env.DB.prepare('SELECT id,alias,zh_name AS zhName FROM name_aliases WHERE user_id=? ORDER BY created').bind(userId).all()).results;
  return buildAliasRules(aliases,preferredZhName||'');
}
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254;
const defaultReminder={presets:[],offsets:[4320,1440,120,30],repeat:1440,maxCount:0,start:'08:00',end:'23:00',days:[1,2,3,4,5,6,0],push:true,email:false};
const parseReminder=value=>{try{return {...defaultReminder,...JSON.parse(value||'{}')}}catch{return defaultReminder}};
const defaultMailPreferences={focusTerms:[],daily:{enabled:true,time:'20:00'},late:{enabled:true,time:'00:00'},translateZh:true,englishSummary:false};
const validTime=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||''));
const parseMailPreferences=value=>{try{const raw=typeof value==='string'?JSON.parse(value||'{}'):(value||{}),focusTerms=(Array.isArray(raw.focusTerms)?raw.focusTerms:[]).map(x=>String(x).trim()).filter(x=>x.length>0&&x.length<=80).filter((x,index,list)=>list.findIndex(other=>other.toLowerCase()===x.toLowerCase())===index).slice(0,30);return {focusTerms,daily:{enabled:raw.daily?.enabled!==false,time:validTime(raw.daily?.time)?raw.daily.time:'20:00'},late:{enabled:raw.late?.enabled!==false,time:validTime(raw.late?.time)?raw.late.time:'00:00'},translateZh:raw.translateZh!==false,englishSummary:raw.englishSummary===true};}catch{return structuredClone(defaultMailPreferences)}};
async function session(request,env){const cookie=request.headers.get('Cookie')?.match(/(?:^|; )campus_session=([^;]+)/)?.[1];if(!cookie)return null;return env.DB.prepare('SELECT s.id,s.user_id,u.email,u.locale FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>?').bind(await hash(cookie),Date.now()).first();}
async function startSession(env,user,url){const token=random(),expires=Date.now()+30*86400000;await env.DB.prepare('INSERT INTO sessions(id,expires,user_id) VALUES(?,?,?)').bind(await hash(token),expires,user.id).run();return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':`campus_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${url.protocol==='https:'?'; Secure':''}`}});}
async function ownerUser(env){return env.DB.prepare('SELECT id,email FROM users WHERE email=?').bind(emailOf(env.LOGIN_EMAIL)).first();}
async function claimLegacy(env,userId){await env.DB.batch(['tasks','messages','subscriptions','jobs'].map(table=>env.DB.prepare(`UPDATE ${table} SET user_id=? WHERE user_id IS NULL`).bind(userId)));}
async function legacyOwner(env,email,password){if(email!==emailOf(env.LOGIN_EMAIL))return null;const stored=await getKV(env,'password_hash')||env.PASSWORD_HASH;if(!stored||!await verifyPassword(password,stored))return null;const id=crypto.randomUUID();await env.DB.prepare('INSERT OR IGNORE INTO users(id,email,password_hash,created) VALUES(?,?,?,?)').bind(id,email,stored,Date.now()).run();const user=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();await claimLegacy(env,user.id);return user;}
const mapTask=t=>({...t,completed:!!t.completed,reminders:JSON.parse(t.reminders)});
async function createTask(env,data,source='manual',sourceId=null,userId=null){
  if(!userId)throw new Error('无法确认任务所属账号');
  if(data.reminders?.email)throw new Error('邮件提醒暂不可用，请选择手机通知');
  const t={...validateTask(data),id:crypto.randomUUID(),version:1,source,source_id:sourceId,created:Date.now(),updated:Date.now(),user_id:userId};
  await env.DB.prepare('INSERT INTO tasks(id,title,notes,due,priority,completed,source,source_id,reminders,version,created,updated,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(t.id,t.title,t.notes,t.due,t.priority,t.completed,t.source,t.source_id,JSON.stringify(t.reminders),t.version,t.created,t.updated,t.user_id).run();
  await scheduleTask(env,t);return t;
}
async function routes(request,env){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  const uiLocale=normalizeLocale(request.headers.get('X-Locale'));
  const shortcutIngest=path==='/api/mail/shortcut'&&method==='POST';
  if(path.startsWith('/api/')&&!['GET','HEAD'].includes(method)&&!shortcutIngest&&request.headers.get('Origin')!==url.origin)return json({error:serverMessage('请求来源无效',uiLocale)},403);
  if(shortcutIngest){
    if(!env.SHORTCUT_INGEST_KEY)return json({error:serverMessage('iPhone 邮件转交尚未配置',uiLocale)},503);
    const supplied=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||'';
    if(!supplied||await hash(supplied)!==await hash(env.SHORTCUT_INGEST_KEY))return json({error:serverMessage('邮件转交密钥无效',uiLocale)},401);
    const owner=await ownerUser(env);return json({ok:true,...await ingestShortcutEmail(env,await body(request),owner?.id)},201);
  }
  if(path==='/api/auth/config'&&method==='GET')return json({registration:'simple',passwordMin:12});
  if(path==='/api/register'&&method==='POST'){
    const data=await body(request),email=emailOf(data.email),question=String(data.question||'').trim();
    if(!validEmail(email))return json({error:serverMessage('请输入有效邮箱地址',uiLocale)},400);
    if(question.length<4||question.length>120)return json({error:serverMessage('密保问题需为 4–120 个字符',uiLocale)},400);
    const passwordHash=await makePasswordHash(data.password),answerHash=await makeAnswerHash(data.answer),id=crypto.randomUUID();
    try{await env.DB.prepare('INSERT INTO users(id,email,password_hash,security_question,security_answer_hash,created) VALUES(?,?,?,?,?,?)').bind(id,email,passwordHash,question,answerHash,Date.now()).run();}
    catch(error){if(/UNIQUE|constraint/i.test(String(error)))return json({error:serverMessage('该邮箱已经注册，请直接登录',uiLocale)},409);throw error;}
    return startSession(env,{id,email},url);
  }
  if(path==='/api/recovery/question'&&method==='POST'){
    const user=await env.DB.prepare('SELECT security_question FROM users WHERE email=?').bind(emailOf((await body(request)).email)).first();
    if(!user?.security_question)return json({error:serverMessage('该账号尚未设置密保问题，请登录后设置',uiLocale)},404);
    return json({question:user.security_question});
  }
  if(path==='/api/recovery/reset'&&method==='POST'){
    const data=await body(request),email=emailOf(data.email),user=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    if(!user?.security_answer_hash||!await verifyAnswer(data.answer,user.security_answer_hash))return json({error:serverMessage('邮箱或密保答案不正确',uiLocale)},401);
    const next=await makePasswordHash(data.password);
    await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(next,user.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
    return json({ok:true});
  }
  if(path==='/api/login'&&method==='POST'){
    const ip=request.headers.get('CF-Connecting-IP')||'local',key='login:'+await hash(ip),attempt=JSON.parse(await getKV(env,key)||'{"count":0,"until":0}');
    if(attempt.until>Date.now()&&attempt.count>=8)return json({error:serverMessage('尝试次数过多，请 15 分钟后重试',uiLocale)},429);
    await setKV(env,key,JSON.stringify({count:attempt.until>Date.now()?attempt.count+1:1,until:attempt.until>Date.now()?attempt.until:Date.now()+900000}));
    const data=await body(request),suppliedEmail=emailOf(data.email);let user=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(suppliedEmail).first();
    if(!user)user=await legacyOwner(env,suppliedEmail,data.password);
    if(!user||!await verifyPassword(data.password,user.password_hash))return json({error:serverMessage('邮箱或密码不正确',uiLocale)},401);
    await setKV(env,key,'{"count":0,"until":0}');
    return startSession(env,user,url);
  }
  if(!path.startsWith('/api/')){
    // A shared link must never reopen a previous person's private screen.
    if(url.searchParams.has('view')&&!await session(request,env))return Response.redirect(url.origin+'/',302);
    return env.ASSETS.fetch(request);
  }
  const account=await session(request,env);if(!account)return json({error:serverMessage('请先登录',uiLocale)},401);
  if(path==='/api/logout'&&method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(account.id).run();return new Response('{}',{headers:{'Set-Cookie':'campus_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0','Content-Type':'application/json'}});}
  if(path==='/api/password'&&method==='POST'){
    const data=await body(request),user=await env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(account.user_id).first(),current=user.password_hash;
    if(!await verifyPassword(data.current,current))return json({error:serverMessage('当前密码不正确',uiLocale)},401);
    const next=await makePasswordHash(data.next);
    await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(next,account.user_id),env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND id<>?').bind(account.user_id,account.id)]);
    return json({ok:true});
  }
  if(path==='/api/security-question'&&method==='POST'){
    const data=await body(request),user=await env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(account.user_id).first();
    if(!await verifyPassword(data.password,user.password_hash))return json({error:serverMessage('当前密码不正确',uiLocale)},401);
    const question=String(data.question||'').trim();if(question.length<4||question.length>120)return json({error:serverMessage('密保问题需为 4–120 个字符',uiLocale)},400);
    await env.DB.prepare('UPDATE users SET security_question=?,security_answer_hash=? WHERE id=?').bind(question,await makeAnswerHash(data.answer),account.user_id).run();return json({ok:true});
  }
  if(path==='/api/profile'&&method==='GET'){
    const user=await env.DB.prepare('SELECT email,nickname,avatar,linked_email,locale,reminder_defaults,mail_preferences,preferred_zh_name FROM users WHERE id=?').bind(account.user_id).first();
    const nameAliases=(await env.DB.prepare('SELECT id,alias,zh_name AS zhName FROM name_aliases WHERE user_id=? ORDER BY created').bind(account.user_id).all()).results;
    return json({email:user.email,nickname:user.nickname||'',avatar:user.avatar||'',linkedEmail:user.linked_email||'',locale:user.locale||'zh-CN',preferredZhName:user.preferred_zh_name||'',nameAliases,reminders:parseReminder(user.reminder_defaults),mailPreferences:parseMailPreferences(user.mail_preferences)});
  }
  if(path==='/api/profile'&&method==='PATCH'){
    const data=await body(request),current=await env.DB.prepare('SELECT nickname,avatar,linked_email,locale,reminder_defaults,mail_preferences,preferred_zh_name FROM users WHERE id=?').bind(account.user_id).first();
    const nickname=String(data.nickname===undefined?(current?.nickname||''):data.nickname).trim(),avatar=String(data.avatar===undefined?(current?.avatar||''):data.avatar).trim(),linkedEmail=data.linkedEmail===undefined?(current?.linked_email||''):emailOf(data.linkedEmail),locale=data.locale===undefined?(current?.locale||'zh-CN'):(['zh-CN','zh-TW','en'].includes(data.locale)?data.locale:'zh-CN');
    const preferredZhName=String(data.preferredZhName===undefined?(current?.preferred_zh_name||''):data.preferredZhName).trim();
    const avatarOk=avatar.length<=16||(/^data:image\/(?:png|jpeg|webp|gif);base64,/.test(avatar)&&avatar.length<=7*1024*1024);
    if(nickname.length>80||!avatarOk)return json({error:serverMessage('昵称最多 80 个字符；图片头像需为 PNG、JPEG、WEBP 或 GIF',uiLocale)},400);
    if(preferredZhName.length>40)return json({error:serverMessage('偏好中文译名最多 40 个字符',uiLocale)},400);
    if(linkedEmail&&!validEmail(linkedEmail))return json({error:serverMessage('关联邮箱格式不正确',uiLocale)},400);
    const reminders={...defaultReminder,...parseReminder(current?.reminder_defaults),...(data.reminders||{})};
    const mailPreferences=parseMailPreferences(data.mailPreferences===undefined?current?.mail_preferences:data.mailPreferences);
    // presets = the user's saved custom "截止前提醒" chips (minutes). Clean them instead of rejecting.
    reminders.presets=normalizePresets(reminders.presets);
    if(!Array.isArray(reminders.offsets)||reminders.offsets.length>12||reminders.offsets.some(n=>!Number.isInteger(n)||n<0||n>525600)||!Number.isFinite(Number(reminders.repeat))||Number(reminders.repeat)<0)return json({error:serverMessage('提醒配置不正确',uiLocale)},400);
    if(!validTime(mailPreferences.daily.time)||!validTime(mailPreferences.late.time))return json({error:serverMessage('邮件提醒时间不正确',uiLocale)},400);
    await env.DB.prepare('UPDATE users SET nickname=?,avatar=?,linked_email=?,locale=?,reminder_defaults=?,mail_preferences=?,preferred_zh_name=? WHERE id=?').bind(nickname,avatar,linkedEmail,locale,JSON.stringify(reminders),JSON.stringify(mailPreferences),preferredZhName,account.user_id).run();
    if(data.nameAliases!==undefined){
      const raw=Array.isArray(data.nameAliases)?data.nameAliases:[];
      const seen=new Set(),aliases=[];
      for(const item of raw){
        const alias=String(item?.alias||'').trim(),zhName=String(item?.zhName||'').trim();
        if(!alias||alias.length>80||!zhName||zhName.length>40)return json({error:serverMessage('别名配置不正确',uiLocale)},400);
        const key=normalizeName(alias);
        if(!key||seen.has(key))continue;
        seen.add(key);aliases.push({alias,zhName});
      }
      await env.DB.prepare('DELETE FROM name_aliases WHERE user_id=?').bind(account.user_id).run();
      const now=Date.now();
      for(const a of aliases)await env.DB.prepare('INSERT INTO name_aliases(id,user_id,alias,zh_name,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),account.user_id,a.alias,a.zhName,now).run();
    }
    return json({ok:true,nickname,avatar,linkedEmail,locale,preferredZhName,reminders,mailPreferences});
  }
  if(path==='/api/name-alias-suggestions'&&method==='GET'){
    const profile=await env.DB.prepare('SELECT preferred_zh_name FROM users WHERE id=?').bind(account.user_id).first();
    const nameAliases=(await env.DB.prepare('SELECT id,alias,zh_name AS zhName FROM name_aliases WHERE user_id=? ORDER BY created').bind(account.user_id).all()).results;
    const senders=(await env.DB.prepare('SELECT sender,MAX(received) AS last FROM messages WHERE user_id=? GROUP BY sender ORDER BY last DESC LIMIT 300').bind(account.user_id).all()).results.map(r=>r.sender);
    return json({suggestions:suggestAliasVariants(senders,nameAliases,profile?.preferred_zh_name||'')});
  }
  const isOwner=account.email===emailOf(env.LOGIN_EMAIL);
  if(path==='/api/invitations'&&method==='GET')return json(await listInvitations(env,account.user_id));
  const invitationId=path.match(/^\/api\/invitations\/([\w-]+)$/)?.[1];
  if(invitationId&&method==='POST')return json(await respondInvitation(env,account.user_id,invitationId,(await body(request)).decision));
  const manageGroupId=path.match(/^\/api\/groups\/([\w-]+)\/membership$/)?.[1];
  if(manageGroupId&&method==='POST')return json(await manageMember(env,account.user_id,manageGroupId,await body(request)));
  const changePollId=path.match(/^\/api\/meeting-polls\/([\w-]+)\/lifecycle$/)?.[1];
  if(changePollId&&method==='POST')return json(await changeMeeting(env,account.user_id,changePollId,await body(request)));
  if(path==='/api/mail-suggestions'&&method==='GET')return json(await listMailSuggestions(env,account.user_id));
  const suggestionId=path.match(/^\/api\/mail-suggestions\/([\w-]+)$/)?.[1];
  if(suggestionId&&method==='POST')return json(await reviewMailSuggestion(env,account.user_id,suggestionId,await body(request)));

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
    return json({account:{id:account.user_id,email:account.email,isOwner,userCode:String(account.user_id).replace(/-/g,'').slice(-4).toUpperCase(),nickname:profile?.nickname||'',avatar:profile?.avatar||'',locale:profile?.locale||'zh-CN'},outlook:!!outlook,outlookEmail:outlook?.email||'',outlookConfigured:outlookMissingConfig.length===0,outlookMissingConfig,mailStatus:outlook?.status||'尚未连接 Outlook',lastSync:outlook?.last_sync||null,emailReady:false,pushReady:!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY),vapid:env.VAPID_PUBLIC_KEY||null,ai:env.ENABLE_AI==='true',appleSync:false,cronLast:await getKV(env,'cron_last'),jobErrors:(await env.DB.prepare("SELECT error,channel,at FROM jobs WHERE user_id=? AND error IS NOT NULL ORDER BY at DESC LIMIT 5").bind(account.user_id).all()).results});
  }
  if(path==='/api/tasks'&&method==='GET'){
 const rows=(await env.DB.prepare("SELECT * FROM tasks WHERE user_id=? AND (group_id IS NULL OR acceptance_status='accepted') ORDER BY completed, due IS NULL, due, priority").bind(account.user_id).all()).results;
 return json(await Promise.all(rows.map(async row=>{const task=mapTask(row);return task.source==='meeting'?meetingTask(task,await env.DB.prepare('SELECT name FROM meeting_polls WHERE id=?').bind(task.source_id).first(),account.locale):task;})));
 }
  if(path==='/api/tasks'&&method==='POST')return json(await createTask(env,await body(request),'manual',null,account.user_id),201);
  const taskId=path.match(/^\/api\/tasks\/([\w-]+)$/)?.[1];
  if(taskId&&method==='PATCH'){
    const old=await env.DB.prepare('SELECT * FROM tasks WHERE id=? AND user_id=?').bind(taskId,account.user_id).first();if(!old)return json({error:serverMessage('任务不存在',uiLocale)},404);
    if(old.acceptance_status==='pending')return json({error:serverMessage('请先接受或拒绝这项分工',uiLocale)},409);
    if(old.acceptance_status==='declined')return json({error:serverMessage('已拒绝的分工不能修改',uiLocale)},409);
    const input=await body(request);if(input.reminders?.email)throw new Error('邮件提醒暂不可用，请选择手机通知');if(input.version!==old.version)return json({error:serverMessage('任务已在其他设备更新，请刷新后重试',uiLocale)},409);
    const t={...old,...validateTask(input,mapTask(old)),version:old.version+1,updated:Date.now()};
    const result=await env.DB.batch([env.DB.prepare('UPDATE tasks SET title=?,notes=?,due=?,priority=?,completed=?,reminders=?,version=?,updated=? WHERE id=? AND version=?').bind(t.title,t.notes,t.due,t.priority,t.completed,JSON.stringify(t.reminders),t.version,t.updated,t.id,old.version),env.DB.prepare("UPDATE jobs SET state='cancelled' WHERE task_id=? AND version=? AND state IN ('pending','sending')").bind(t.id,old.version)]);
    if(!result[0].meta.changes)return json({error:serverMessage('任务已更新，请刷新',uiLocale)},409);
    await scheduleTask(env,t);return json(t);
  }
  if(taskId&&method==='DELETE'){
    const old=await env.DB.prepare('SELECT completed FROM tasks WHERE id=? AND user_id=?').bind(taskId,account.user_id).first();if(!old)return json({error:serverMessage('任务不存在',uiLocale)},404);if(!old.completed)return json({error:serverMessage('只有已完成任务可以删除',uiLocale)},409);
    await env.DB.batch([env.DB.prepare('DELETE FROM jobs WHERE task_id=? AND user_id=?').bind(taskId,account.user_id),env.DB.prepare('DELETE FROM tasks WHERE id=? AND user_id=?').bind(taskId,account.user_id)]);return json({ok:true});
  }
  if(path==='/api/messages'&&method==='GET'){
    const limit=Math.min(80,Math.max(1,Number(url.searchParams.get('limit'))||40));
    const before=Number(url.searchParams.get('before'));
    const q=String(url.searchParams.get('q')||'').trim().replace(/[\\%_]/g,'');
    const binds=[account.user_id];
    let sql='SELECT id,subject,received,sender,origin,category,summary,action,url,quality FROM messages WHERE user_id=? AND category<5';
    if(q){sql+=' AND (subject LIKE ? OR sender LIKE ? OR summary LIKE ? OR action LIKE ? OR origin LIKE ?)';const like='%'+q+'%';binds.push(like,like,like,like,like);}
    if(Number.isFinite(before)&&before>0){sql+=' AND received<?';binds.push(before);}
    sql+=' ORDER BY received DESC LIMIT ?';binds.push(limit);
    const messages=(await env.DB.prepare(sql).bind(...binds).all()).results;
    const profile=await env.DB.prepare('SELECT locale,preferred_zh_name,mail_preferences FROM users WHERE id=?').bind(account.user_id).first();
    const prefs=parseMailPreferences(profile?.mail_preferences);
    const locale=profile?.locale||'zh-CN';
    const aliasRules=await nameAliasRules(env,account.user_id,profile?.preferred_zh_name||'');
    const localized=await localizeMessages(env,account.user_id,locale,messages,{allowAi:false,translate:locale==='en'?true:prefs.translateZh!==false,nameAliases:aliasRules});
    return json({messages:await attachBriefs(env,account.user_id,locale,localized),nextBefore:messages.length===limit?messages[messages.length-1].received:null});
  }
  if(path==='/api/mail/briefs'&&method==='POST'){
    const data=await body(request),ids=[...new Set(Array.isArray(data.ids)?data.ids:[])].filter(id=>typeof id==='string').slice(0,2);
    const profile=await env.DB.prepare('SELECT locale FROM users WHERE id=?').bind(account.user_id).first();
    const results=[];
    for(const id of ids){
      if(!await env.DB.prepare('SELECT id FROM messages WHERE id=? AND user_id=?').bind(id,account.user_id).first())continue;
      try{results.push({id,brief:await generateBrief(env,account.user_id,profile?.locale||'zh-CN',id)})}catch(error){console.warn('brief-failure',error.name, /Ungrounded|supported|language|JSON|Original|AI summary/.test(error.message)?error.message.slice(0,100):'generation failed');results.push({id,error:true})}
    }
    return json({results});
  }
  const messageId=path.match(/^\/api\/messages\/(.+)$/)?.[1];
  if(messageId&&method==='GET'){
    const id=decodeURIComponent(messageId);
    const profile=await env.DB.prepare('SELECT locale,preferred_zh_name,mail_preferences FROM users WHERE id=?').bind(account.user_id).first();
    const prefs=parseMailPreferences(profile?.mail_preferences);
    const locale=profile?.locale||'zh-CN';
    const aliasRules=await nameAliasRules(env,account.user_id,profile?.preferred_zh_name||'');
    const fetched=await fetchMessageOriginal(env,account.user_id,id,{rich:true});
    if(!fetched)return json({error:serverMessage('邮件不存在',uiLocale)},404);
    const {row,englishSubject,englishBody,recipients}=fetched;
    const wantZh=locale.startsWith('zh')&&prefs.translateZh!==false;
    const localizedRows=await localizeMessages(env,account.user_id,locale,[row],{allowAi:env.ENABLE_AI==='true',translate:wantZh||locale==='en',nameAliases:aliasRules});
    const localized=applyPreferredNameToFields(localizedRows[0]||row,aliasRules);
    // 全文翻译：中文页显示英文原文的完整逐句翻译
    // 获取用户偏好中文名，确保翻译中使用正确的名字（如马艺恺而非 AI 猜测）
    let fullTranslation=null;
    if(wantZh&&englishBody){
      try{
        const userProfile=await env.DB.prepare('SELECT preferred_zh_name FROM users WHERE id=?').bind(account.user_id).first();
        const preferredName=userProfile?.preferred_zh_name||'';
        fullTranslation=await translateFullBody(env,account.user_id,locale,id,englishBody,preferredName);
      }catch{}
    }
    return json({
      id:row.id,
      received:row.received,
      category:row.category,
      url:row.url||'',
      quality:localized.quality||row.quality,
      chinese:wantZh?{subject:localized.subject,sender:localized.sender,origin:localized.origin,summary:localized.summary,action:localized.action,fullBody:applyNameAliases(fullTranslation,aliasRules)}:null,
      english:{subject:englishSubject,body:englishBody,html:fetched.englishHtml,images:fetched.images,recipients:recipients||[],summary:prefs.englishSummary&&locale.startsWith('zh')?String(row.summary||''):undefined},
      display:{...localized,brief:await readBrief(env,account.user_id,locale,id)},
      translationEnabled:wantZh,
      englishSummaryEnabled:prefs.englishSummary===true&&locale.startsWith('zh')
    });
  }
  if(messageId&&method==='DELETE'){await env.DB.batch([env.DB.prepare('DELETE FROM messages WHERE id=? AND user_id=?').bind(decodeURIComponent(messageId),account.user_id),env.DB.prepare('DELETE FROM mail_suggestions WHERE message_id=? AND user_id=?').bind(decodeURIComponent(messageId),account.user_id)]);return json({ok:true});}
  if(path==='/api/mail/reprocess'&&method==='POST')return json(await reprocessMail(env,account.user_id,2));
  if(path==='/api/mail/link-summary'&&method==='POST'){
    const data=await body(request),url=String(data.url||'').trim();
    if(!url||!/^https?:\/\//.test(url))return json({error:'无效链接'},400);
    const profile=await env.DB.prepare('SELECT locale FROM users WHERE id=?').bind(account.user_id).first();
    const summary=await summarizeLink(env,profile?.locale||'zh-CN',url);
    return json({summary:summary||null});
  }
  if(path==='/api/digests'){
    const prefix='digest:'+account.user_id+':%';
    const rows=(await env.DB.prepare("SELECT value FROM kv WHERE key LIKE ? AND value!='quiet' ORDER BY key DESC LIMIT 30").bind(prefix).all()).results;
    const aliasRules=await nameAliasRules(env,account.user_id,(await env.DB.prepare('SELECT preferred_zh_name FROM users WHERE id=?').bind(account.user_id).first())?.preferred_zh_name||'');
    const records=rows.flatMap(row=>{try{
      const normalized=normalizeDigestRecord(JSON.parse(row.value));
      if(!normalized)return [];
      if(aliasRules.length&&normalized.items)normalized.items=normalized.items.map(item=>applyPreferredNameToFields(item,aliasRules));
      if(aliasRules.length)normalized.body=applyPreferredNameToFields({body:normalized.body},aliasRules).body;
      return [normalized];
    }catch{return []}});
    for(const record of records)record.items=await attachBriefs(env,account.user_id,account.locale||'zh-CN',record.items||[]);
    return json(records);
  }
  if(path==='/api/outlook/start'&&method==='GET'){
    const requestedEmail=emailOf(url.searchParams.get('email'));
    if(requestedEmail&&!validEmail(requestedEmail))return json({error:serverMessage('请输入有效的 Outlook 邮箱',uiLocale)},400);
    return Response.redirect(await startOAuth(env,account,requestedEmail,url.origin));
  }
  if(path==='/api/outlook/callback'&&method==='GET'){
    await finishOAuth(env,url,account);
    try{await syncMail(env,account.user_id);}catch(error){await env.DB.prepare('UPDATE outlook_connections SET status=? WHERE user_id=?').bind(String(error.message).slice(0,300),account.user_id).run();}
    // 后台预生成新邮件的 AI 摘要（不阻塞跳转）
    try{preGenerateBriefs(env,account.user_id).catch(()=>{});}catch{}
    return Response.redirect(url.origin+'/?view=settings');
  }
  if(path==='/api/outlook/sync'&&method==='POST'){
    const result=await syncMail(env,account.user_id);
    // 后台预生成新邮件的 AI 摘要（不阻塞响应）
    try{preGenerateBriefs(env,account.user_id).catch(()=>{});}catch{}
    return json(result||{imported:0,pages:0,more:false});
  }
  if(path==='/api/outlook'&&method==='DELETE'){
    const connection=await outlookConnection(env,account.user_id);if(!connection)return json({error:serverMessage('尚未连接 Outlook',uiLocale)},404);
    await env.DB.prepare('DELETE FROM outlook_connections WHERE user_id=?').bind(account.user_id).run();
    return json({ok:true});
  }
  if(path==='/api/subscriptions'&&method==='POST'){
    const sub=await body(request);let endpoint;try{endpoint=new URL(sub.endpoint);}catch{return json({error:serverMessage('通知订阅无效',uiLocale)},400);}
    const host=endpoint.hostname;
    if(endpoint.protocol!=='https:'||!(['web.push.apple.com','fcm.googleapis.com'].includes(host)||host.endsWith('.push.apple.com')||host.endsWith('.push.services.mozilla.com')||host.endsWith('.notify.windows.com'))||!sub.keys?.p256dh||!sub.keys?.auth)return json({error:serverMessage('不支持的通知服务',uiLocale)},400);
    const id=await hash(sub.endpoint);
    await env.DB.prepare('INSERT INTO subscriptions(id,data,created,user_id) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,user_id=excluded.user_id').bind(id,JSON.stringify(sub),Date.now(),account.user_id).run();
    const {results}=await env.DB.prepare('SELECT * FROM tasks WHERE user_id=? AND completed=0').bind(account.user_id).all();for(const t of results)await scheduleTask(env,mapTask(t));
    return json({ok:true});
  }
  if(path==='/api/test-notification'&&method==='POST'){
 if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY)return json({error:wording(account.locale,'系统通知尚未配置','系統通知尚未設定','Push notifications are not configured.')},400);
 if(!await env.DB.prepare('SELECT id FROM subscriptions WHERE user_id=? LIMIT 1').bind(account.user_id).first())return json({error:wording(account.locale,'请先在此设备启用通知','請先在此裝置啟用通知','Enable notifications on this device first.')},400);
 await enqueue(env,'test:'+crypto.randomUUID(),null,Date.now(),{title:wording(account.locale,'校园清单 · 测试提醒','校園清單 · 測試提醒','Campus Companion · Test'),body:wording(account.locale,'收到这条消息表示推送已接通。','收到此訊息表示推送已接通。','Receiving this confirms that push works.'),url:'/'},{push:true,email:false},account.user_id);await deliver(env);return json({ok:true});
 }
  return json({error:serverMessage('页面不存在',uiLocale)},404);
}
export default {
  async fetch(request,env){
    const uiLocale=normalizeLocale(request.headers.get('X-Locale'));
    let response;try{response=await routes(request,env);}catch(error){response=json({error:serverMessage(error.message||'暂时无法处理，请重试',uiLocale)},Number(error.status)||400);}
    const h=new Headers(response.headers);h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','same-origin');h.set('X-Frame-Options','DENY');h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
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
          try{
            await syncMail(env,connection.user_id);
            // 定时任务中预生成摘要（等待完成，因为是后台任务）
            try{await preGenerateBriefs(env,connection.user_id,3);}catch{}
          }catch(error){await env.DB.prepare('UPDATE outlook_connections SET status=? WHERE user_id=?').bind(String(error.message).slice(0,300),connection.user_id).run();}
        }
      }
      await makeDigest(env,Date.now());
      await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(now),env.DB.prepare('DELETE FROM oauth WHERE expires<?').bind(now)]);
    }finally{await env.DB.prepare("UPDATE kv SET value='0' WHERE key='cron_lease' AND value=?").bind(String(now+240000)).run();}
  }
};
