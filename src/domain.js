export const defaults = { offsets: [4320,1440,120,30], exact: [], repeat: 1440, maxCount: 0, start:'08:00', end:'23:00', days:[0,1,2,3,4,5,6], push:true, email:false };
export const assignmentReminders = {...defaults,start:'00:00',end:'00:00'};
const fail = message => { throw new Error(message); };
export function validateTask(input, previous = {}) {
  const t = {...previous, ...input};
  if(typeof t.title !== 'string' || !t.title.trim() || t.title.length>200) fail('请输入 1–200 字的任务名称');
  const due = t.due == null || t.due === '' ? null : Number(t.due);
  if(due!==null && (!Number.isFinite(due) || due<0 || due>4102444800000)) fail('截止时间无效');
  const r = {...defaults,...(typeof t.reminders==='string'?JSON.parse(t.reminders):t.reminders)};
  if(!Array.isArray(r.offsets)||r.offsets.length>12||r.offsets.some(n=>!Number.isInteger(n)||n<0||n>525600)) fail('提前提醒时间无效');
  if(!Array.isArray(r.exact)||r.exact.length>20||r.exact.some(n=>!Number.isFinite(n)||n<0||n>4102444800000)) fail('指定提醒时间无效');
  if(!Number.isInteger(r.repeat)||r.repeat<0||r.repeat>43200||(r.repeat>0&&r.repeat<30)) fail('重复提醒最少间隔 30 分钟');
  if(!Number.isInteger(r.maxCount)||r.maxCount<0||r.maxCount>100) fail('提醒总次数需为 0–100，0 表示不限制');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.end)) fail('提醒时段无效');
  if(!Array.isArray(r.days)||!r.days.length||r.days.some(n=>!Number.isInteger(n)||n<0||n>6)) fail('请选择提醒星期');
  if(typeof r.push!=='boolean'||typeof r.email!=='boolean') fail('提醒渠道无效');
  // Outlook is a read-only connector. Email delivery stays disabled until a
  // separate outbound provider is introduced and reviewed.
  r.email=false;
  const priority=Number(t.priority??2); if(![1,2,3].includes(priority)) fail('重要程度无效');
  return {title:t.title.trim(),notes:String(t.notes??'').slice(0,5000),due,priority,completed:t.completed?1:0,reminders:r};
}
export function hkParts(at) {
  const d=new Date(at+8*3600000);
  return {day:d.getUTCDay(), time:d.toISOString().slice(11,16), date:d.toISOString().slice(0,10),hour:d.getUTCHours(),minute:d.getUTCMinutes()};
}
export function allowed(at,r) {
  const p=hkParts(at);
  return r.days.includes(p.day) && (r.start===r.end || (r.start<r.end ? p.time>=r.start&&p.time<r.end : p.time>=r.start||p.time<r.end));
}
export function nextAllowed(at,r) {
  let n=Math.ceil(at/60000)*60000;
  for(let i=0;i<10081;i++,n+=60000) if(allowed(n,r)) return n;
  throw new Error('无法计算提醒时段');
}
export function initialTimes(task,now) {
  const r=task.reminders;
  const all=[...r.exact];
  if(task.due!=null) all.push(...r.offsets.map(m=>task.due-m*60000));
  const times=[...new Set(all.filter(t=>t>=now).map(t=>nextAllowed(t,r)))].sort((a,b)=>a-b);
  return r.maxCount?times.slice(0,r.maxCount):times;
}
export function digestWindow(now) {
  const p=hkParts(now), midnight=Date.parse(p.date+'T00:00:00+08:00');
  // A short catch-up window tolerates delayed scheduled invocations.
  if(p.hour===20) return {key:p.date+'-daily',start:midnight,end:midnight+20*3600000,late:false,date:p.date};
  if(p.hour===0) return {key:hkParts(midnight-1).date+'-late',start:midnight-4*3600000,end:midnight,late:true,date:hkParts(midnight-1).date};
  return null;
}
export function originalSender(body,outer,school,selfAddresses=[]) {
  const plain=body.replace(/\*\*/g,'');
  const matches=[...plain.matchAll(/(?:^|\n)\s*(?:From|发件人|寄件者)\s*[:：]\s*([^\n]+)/gi)];
  const self=new Set([school,...selfAddresses].filter(Boolean).map(s=>s.toLowerCase()));
  // A self-authored relay can wrap another forwarded message. Skip only that
  // wrapper; do not blindly take the last From from an unrelated quoted chain.
  let selected=matches[0]?.[1]?.trim();
  if(matches.length>1&&selected){
    const addresses=[...selected.matchAll(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g)].map(m=>m[0].toLowerCase());
    if(addresses.some(a=>self.has(a)))selected=matches[1][1].trim();
  }
  if(selected){
    const parts=selected.split(/\s*On Behalf Of\s*/i);
    if(parts.length===2)return `${parts[1].trim()}（由 ${parts[0].trim()} 代发）`.slice(0,400);
    return (/@/.test(selected)?selected:selected+'（邮箱未注明）').slice(0,400);
  }
  if(outer.toLowerCase().includes(school.toLowerCase())) return '原始发件人无法确认（学校账号仅为转发者）';
  return outer || '原始发件人无法确认';
}
export function classify(subject,body) {
  const text=subject+'\n'+body;
  const success=/(successfully submitted|submission (?:was )?successful|已成功提交|成功提交|you have submitted)/i.test(text)&&!/(failed|resubmit|重新提交|提交失败|late submission)/i.test(text);
  if(/scholarship|奖学金|獎學金|payroll|salary|wages|timesheet|工时|工時|薪|报酬|報酬|ITSC.*(?:assistant|助手)|payment|助学金|助學金/i.test(text))return 1;
  if(success)return 6;
  if(/assignment|homework|coursework|作业|作業|考试|考試|quiz|submission deadline/i.test(text))return 2;
  if(/ILP|course recommendation|课程推荐|課程推薦|recommended course/i.test(text))return 4;
  if(/chaplain|worship|prayer|崇拜|祈祷|祈禱|校牧|圣经|聖經/i.test(text))return 5;
  return 3;
}
