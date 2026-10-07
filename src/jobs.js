import webpush from 'web-push';
import { initialTimes,nextAllowed,allowed } from './domain.js';
import { getKV,setKV,outlookConnection } from './mail.js';
const time=n=>new Date(n).toLocaleString('zh-CN',{timeZone:'Asia/Hong_Kong',hour12:false});
export async function enqueue(env,key,task,at,payload,reminders,userId=task?.user_id) {
  const channels=[];
  if(reminders.push){const {results}=await env.DB.prepare('SELECT id FROM subscriptions WHERE user_id=?').bind(userId).all();channels.push(...results.map(s=>'push:'+s.id));}
  if(!channels.length)return;
  await env.DB.batch(channels.map(channel=>env.DB.prepare('INSERT OR IGNORE INTO jobs(id,task_id,version,at,channel,payload,user_id) VALUES(?,?,?,?,?,?,?)').bind(key+':'+channel,task?.id??null,task?.version??null,at,channel,JSON.stringify(payload),userId)));
}
const taskPayload=t=>({title:'待办提醒：'+t.title,body:(t.due?'截止：'+time(t.due):'自定义提醒')+'。完成后请在清单打勾，后续提醒会停止。',url:'/?task='+encodeURIComponent(t.id)});
export async function scheduleTask(env,task,now=Date.now()) {
  if(task.completed||task.acceptance_status&&task.acceptance_status!=='accepted')return;
  for(const at of initialTimes(task,now))await enqueue(env,`task:${task.id}:v${task.version}:${at}`,task,at,taskPayload(task),task.reminders);
}
export async function repeatTasks(env,now) {
  const {results}=await env.DB.prepare("SELECT * FROM tasks WHERE completed=0 AND acceptance_status='accepted'").all();
  for(const row of results){
    const t={...row,reminders:JSON.parse(row.reminders)},r=t.reminders;
    if(r.maxCount){const sent=await env.DB.prepare("SELECT COUNT(*) AS n FROM jobs WHERE task_id=? AND version=? AND state IN ('sent','pending','sending')").bind(t.id,t.version).first();if(Number(sent?.n||0)>=r.maxCount)continue;}
    const anchor=t.due??(r.exact.length?Math.min(...r.exact):null);
    if(!r.repeat||anchor===null||anchor>now)continue;
    const step=r.repeat*60000;
    const index=Math.floor((now-anchor)/step),at=nextAllowed(anchor+index*step,r);
    if(t.due===null&&index===0)continue;
    if(at>now+60000)continue;
    await enqueue(env,`repeat:${t.id}:v${t.version}:${at}`,t,at,taskPayload(t),r);
  }
}
export async function deliver(env,now=Date.now()) {
  const {results}=await env.DB.prepare("SELECT * FROM jobs WHERE (state='pending' OR (state='sending' AND lease<?)) AND at<=? ORDER BY at LIMIT 30").bind(now,now).all();
  for(const candidate of results){
    const claimTime=Date.now();
    const job=await env.DB.prepare("UPDATE jobs SET state='sending',lease=?,attempts=attempts+1 WHERE id=? AND (state='pending' OR (state='sending' AND lease<?)) RETURNING *").bind(claimTime+90000,candidate.id,claimTime).first();
    if(!job)continue;
    try {
      if(job.task_id){const t=await env.DB.prepare('SELECT completed,version,reminders FROM tasks WHERE id=? AND user_id=?').bind(job.task_id,job.user_id).first();if(!t||t.completed||t.version!==job.version){await env.DB.prepare("UPDATE jobs SET state='cancelled' WHERE id=?").bind(job.id).run();continue;}const r=JSON.parse(t.reminders);if(!allowed(now,r)){await env.DB.prepare("UPDATE jobs SET state='pending',at=? WHERE id=?").bind(nextAllowed(now,r),job.id).run();continue;}}
      const payload=JSON.parse(job.payload);
      if(job.channel.startsWith('push:')) {
        const id=job.channel.slice(5),sub=await env.DB.prepare('SELECT data FROM subscriptions WHERE id=? AND user_id=?').bind(id,job.user_id).first();
        if(!sub){await env.DB.prepare("UPDATE jobs SET state='cancelled' WHERE id=?").bind(job.id).run();continue;}
        if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY)throw new Error('系统通知尚未配置');
        const details=webpush.generateRequestDetails(JSON.parse(sub.data),JSON.stringify({...payload,title:payload.title.slice(0,100),body:payload.body.slice(0,400),tag:job.task_id||job.id}),{TTL:300,vapidDetails:{subject:'mailto:'+env.OWNER_EMAIL,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY}});
        const res=await fetch(details.endpoint,{method:details.method,headers:details.headers,body:details.body,signal:AbortSignal.timeout(15000)});
        if(res.status===404||res.status===410){await env.DB.prepare('DELETE FROM subscriptions WHERE id=? AND user_id=?').bind(id,job.user_id).run();throw new Error('通知订阅已过期，请在手机重新启用通知');}
        if(!res.ok)throw new Error('推送服务暂不可用（'+res.status+'）');
      } else {await env.DB.prepare("UPDATE jobs SET state='cancelled',error='不支持的提醒渠道' WHERE id=?").bind(job.id).run();continue;}
      await env.DB.prepare("UPDATE jobs SET state='sent',error=NULL WHERE id=?").bind(job.id).run();
    } catch(error){
      await env.DB.prepare('UPDATE jobs SET state=?,at=?,error=? WHERE id=?').bind(job.attempts>=6?'failed':'pending',now+Math.min(3600000,60000*2**job.attempts),String(error.message).slice(0,300),job.id).run();
    }
  }
}
const defaultMailPreferences={focusTerms:[],daily:{enabled:true,time:'20:00'},late:{enabled:true,time:'00:00'}};
const validTime=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||''));
const mailPreferences=value=>{try{const raw=typeof value==='string'?JSON.parse(value||'{}'):(value||{}),focusTerms=(Array.isArray(raw.focusTerms)?raw.focusTerms:[]).map(x=>String(x).trim()).filter(x=>x.length>0&&x.length<=80).filter((x,index,list)=>list.findIndex(other=>other.toLowerCase()===x.toLowerCase())===index).slice(0,30);return {focusTerms,daily:{enabled:raw.daily?.enabled!==false,time:validTime(raw.daily?.time)?raw.daily.time:'20:00'},late:{enabled:raw.late?.enabled!==false,time:validTime(raw.late?.time)?raw.late.time:'00:00'}};}catch{return structuredClone(defaultMailPreferences)}};
const hkStart=now=>Date.parse(new Date(now+8*3600000).toISOString().slice(0,10)+'T00:00:00+08:00');
const atTime=(day,time)=>{const [hour,minute]=time.split(':').map(Number);return day+(hour*60+minute)*60000;};
const dateOf=day=>new Date(day+8*3600000).toISOString().slice(0,10);
const digestWindows=(day,prefs)=>{
  const dailyEnd=atTime(day,prefs.daily.time),lateBase=atTime(day,prefs.late.time);
  // The supplement covers the period after the daily digest. A time earlier
  // than the daily time is understood as the following calendar day.
  const lateEnd=lateBase<=dailyEnd?lateBase+86400000:lateBase;
  return [
    prefs.daily.enabled?{key:`daily:${dateOf(day)}:${prefs.daily.time}`,date:dateOf(day),start:day,end:dailyEnd,late:false}:null,
    prefs.late.enabled?{key:`late:${dateOf(day)}:${prefs.late.time}`,date:dateOf(day),start:dailyEnd,end:lateEnd,late:true}:null
  ].filter(Boolean);
};
async function oneDigest(env,now,w,userId,prefs) {
  const digestKey='digest:'+userId+':'+w.key;
  if(!w||await getKV(env,digestKey))return;
  const forwarding=env.MAIL_INGEST_MODE==='forwarding';
  const connection=await outlookConnection(env,userId);
  if(!forwarding&&!connection)return;
  if(!forwarding){const since=Date.parse(connection?.since||'');if(!Number.isFinite(since)||since<w.end)return;}
  const {results}=await env.DB.prepare('SELECT * FROM messages WHERE user_id=? AND received>=? AND received<? ORDER BY category,received').bind(userId,w.start,w.end).all();
  const visible=results.filter(m=>!prefs.focusTerms.length||prefs.focusTerms.some(term=>`${m.subject} ${m.sender} ${m.origin} ${m.summary} ${m.action}`.toLowerCase().includes(term.toLowerCase())));
  if(w.late&&!visible.length){await setKV(env,digestKey,'quiet');return;}
  const body=visible.map(m=>`${m.subject}\n发件人：${m.sender}\n来源：${m.origin}\n${m.summary}\n${m.action}\n${m.url}`).join('\n\n')||(prefs.focusTerms.length?'在这个时段没有匹配你的关注词的学校邮件。':'这个时段没有需要总结的学校邮件。');
  const title=w.date+(w.late?' 晚间补充':' 学校邮件日报');
  await enqueue(env,'digest:'+userId+':'+w.key,null,now,{title,body,url:'/?view=digests'},{push:true,email:true},userId);
  await setKV(env,digestKey,JSON.stringify({title,body,created:now}));
}
export async function makeDigest(env,now) {
  const day=hkStart(now),forwarding=env.MAIL_INGEST_MODE==='forwarding';
  const users=forwarding?(await env.DB.prepare('SELECT id,mail_preferences FROM users WHERE email=?').bind(String(env.LOGIN_EMAIL||'').trim().toLowerCase()).all()).results:(await env.DB.prepare('SELECT u.id,u.mail_preferences FROM users u JOIN outlook_connections c ON c.user_id=u.id').all()).results;
  for(const user of users){
    const start=Number(await getKV(env,'digest_start:'+user.id)||await getKV(env,'digest_start')||now),prefs=mailPreferences(user.mail_preferences);
    for(let d=2;d>=0;d--)for(const w of digestWindows(day-d*86400000,prefs))if(w.end>=start&&w.end<=now)await oneDigest(env,now,w,user.id,prefs);
  }
}
