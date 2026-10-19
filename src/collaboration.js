import { assignmentReminders, validateTask } from './domain.js';
import { scheduleTask } from './jobs.js';
import { meetingTask } from './display.js';

export class CollaborationError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}

const requiredText=(value,label,max)=>{
  const text=String(value??'').trim();
  if(!text||text.length>max)throw new CollaborationError(`${label}需为 1–${max} 个字符`);
  return text;
};

const optionalDue=value=>{
  if(value===null||value===undefined||value==='')return null;
  const due=Number(value);
  if(!Number.isFinite(due)||due<0||due>4102444800000)throw new CollaborationError('截止时间无效');
  return due;
};

const evidenceOf=value=>{
  const source=value&&typeof value==='object'?value:{};
  const entries=Object.entries(source).slice(0,8).map(([key,text])=>[String(key).slice(0,40),String(text??'').trim().slice(0,1000)]).filter(([,text])=>text);
  return Object.fromEntries(entries);
};

export class TaskCandidate {
  constructor(input){
    this.title=requiredText(input.title,'候选任务标题',200);
    this.notes=String(input.notes??'').slice(0,5000);
    this.due=optionalDue(input.due);
    this.proposedAssigneeId=input.proposedAssigneeId?String(input.proposedAssigneeId):null;
    this.evidence=evidenceOf(input.evidence);
    this.status=input.status||'pending';
  }

  confirm(){
    if(this.status!=='pending')throw new CollaborationError('候选任务已经处理',409);
    this.status='confirmed';
    return this.status;
  }

  reject(){
    if(this.status!=='pending')throw new CollaborationError('候选任务已经处理',409);
    this.status='rejected';
    return this.status;
  }
}

async function membership(env,groupId,userId){
  const row=await env.DB.prepare('SELECT gm.role,g.name,g.owner_user_id FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.group_id=? AND gm.user_id=?').bind(groupId,userId).first();
  if(!row)throw new CollaborationError('小组不存在或你不是成员',404);
  return row;
}

const memberExists=(env,groupId,userId)=>env.DB.prepare('SELECT 1 AS ok FROM group_members WHERE group_id=? AND user_id=?').bind(groupId,userId).first();

export async function createGroup(env,actorId,input){
  const now=Date.now(),group={id:crypto.randomUUID(),name:requiredText(input.name,'小组名称',80),owner_user_id:actorId,created:now,updated:now};
  await env.DB.batch([
    env.DB.prepare('INSERT INTO groups(id,name,owner_user_id,created,updated) VALUES(?,?,?,?,?)').bind(group.id,group.name,actorId,now,now),
    env.DB.prepare("INSERT INTO group_members(group_id,user_id,role,joined) VALUES(?,?,'owner',?)").bind(group.id,actorId,now)
  ]);
  return group;
}

export async function listGroups(env,actorId){
  const {results}=await env.DB.prepare(`SELECT g.id,g.name,g.owner_user_id,g.created,g.updated,gm.role,
    (SELECT COUNT(*) FROM group_members all_members WHERE all_members.group_id=g.id) AS member_count,
    (SELECT COUNT(*) FROM tasks t WHERE t.group_id=g.id AND t.completed=0) AS open_task_count
    FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.user_id=? ORDER BY g.updated DESC`).bind(actorId).all();
  return results;
}

export async function groupSnapshot(env,actorId,groupId){
  const access=await membership(env,groupId,actorId);
  const members=(await env.DB.prepare('SELECT gm.user_id,gm.role,gm.joined,u.email,u.nickname FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=? ORDER BY gm.joined').bind(groupId).all()).results;
  const tasks=(await env.DB.prepare('SELECT id,title,notes,due,priority,completed,user_id,assigned_by,acceptance_status,candidate_id,source,source_id,version,created,updated FROM tasks WHERE group_id=? ORDER BY completed,acceptance_status,due IS NULL,due').bind(groupId).all()).results;
  const taskByCandidate=new Map(tasks.filter(task=>task.candidate_id).map(task=>[task.candidate_id,task]));
  const candidates=(await env.DB.prepare('SELECT * FROM task_candidates WHERE group_id=? ORDER BY status,created DESC').bind(groupId).all()).results.map(row=>{
    const task=taskByCandidate.get(row.id),nextAction=row.status==='pending'?'owner_review':task?.acceptance_status==='pending'?'assignee_accept':task?.acceptance_status==='accepted'?(task.completed?'completed':'in_progress'):task?.acceptance_status==='declined'?'declined':'done';
    return {...row,evidence:JSON.parse(row.evidence),next_action:nextAction,next_actor_user_id:nextAction==='owner_review'?access.owner_user_id:nextAction==='assignee_accept'?task.user_id:null};
  });
  const meetingPolls=(await env.DB.prepare('SELECT id,name,range_start,range_end,duration_minutes,buffer_minutes,status,phase,confirmed_start,confirmed_end,created FROM meeting_polls WHERE group_id=? ORDER BY status,created DESC').bind(groupId).all()).results;
  // Meeting-derived tasks were stored per member locale from 2026-10; older
  // rows still carry Simplified Chinese titles, so re-render them for the
  // viewer's language when the poll is known.
  const actorLocale=(await env.DB.prepare('SELECT locale FROM users WHERE id=?').bind(actorId).first())?.locale||'zh-CN';
  const pollNames=new Map(meetingPolls.map(poll=>[poll.id,poll.name]));
  const visibleTasks=tasks.map(task=>({...task,next_action:task.acceptance_status==='pending'?'assignee_accept':task.acceptance_status==='accepted'?(task.completed?'completed':'in_progress'):'declined',can_respond:task.user_id===actorId&&task.acceptance_status==='pending',...(task.source==='meeting'&&pollNames.has(task.source_id)?meetingTask(task,{name:pollNames.get(task.source_id)},actorLocale):{})}));
  const announcements=(await env.DB.prepare('SELECT * FROM group_announcements WHERE group_id=? ORDER BY created DESC LIMIT 30').bind(groupId).all()).results;
  return {group:{id:groupId,name:access.name,owner_user_id:access.owner_user_id,role:access.role},members,candidates,tasks:visibleTasks,meetingPolls,announcements};
}

export async function addGroupMember(env,actorId,groupId,email){
  const access=await membership(env,groupId,actorId);
  if(access.role!=='owner')throw new CollaborationError('只有小组创建者可以添加成员',403);
  const normalized=String(email??'').trim().toLowerCase();
  const user=await env.DB.prepare('SELECT id,email,nickname FROM users WHERE email=?').bind(normalized).first();
  if(!user)throw new CollaborationError('该同学需要先注册 Campus Companion',404);
  if(await memberExists(env,groupId,user.id))throw new CollaborationError('该用户已经是成员',409);
  const invitation={id:crypto.randomUUID(),group_id:groupId,user_id:user.id,invited_by:actorId,created:Date.now()};
  await env.DB.prepare("INSERT INTO group_invitations(id,group_id,user_id,invited_by,created) VALUES(?,?,?,?,?) ON CONFLICT(group_id,user_id) DO UPDATE SET status='pending',invited_by=excluded.invited_by,created=excluded.created").bind(invitation.id,groupId,user.id,actorId,invitation.created).run();
  return {ok:true,status:'pending'};
}

export async function createTaskCandidate(env,actorId,groupId,input){
  await membership(env,groupId,actorId);
  const candidate=new TaskCandidate(input);
  if(candidate.proposedAssigneeId&&!await memberExists(env,groupId,candidate.proposedAssigneeId))throw new CollaborationError('建议负责人不是小组成员',400);
  const now=Date.now(),row={id:crypto.randomUUID(),group_id:groupId,creator_user_id:actorId,proposed_assignee_id:candidate.proposedAssigneeId,title:candidate.title,notes:candidate.notes,due:candidate.due,evidence:candidate.evidence,status:'pending',created:now,updated:now};
  await env.DB.prepare('INSERT INTO task_candidates(id,group_id,creator_user_id,proposed_assignee_id,title,notes,due,evidence,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(row.id,row.group_id,row.creator_user_id,row.proposed_assignee_id,row.title,row.notes,row.due,JSON.stringify(row.evidence),row.status,now,now).run();
  return row;
}

export async function reviewTaskCandidate(env,actorId,candidateId,review){
  const row=await env.DB.prepare('SELECT c.*,g.owner_user_id FROM task_candidates c JOIN groups g ON g.id=c.group_id WHERE c.id=? AND g.owner_user_id=?').bind(candidateId,actorId).first();
  if(!row)throw new CollaborationError('候选任务不存在',404);
  const changes=review?.changes&&typeof review.changes==='object'?review.changes:{};
  const candidate=new TaskCandidate({...row,...changes,proposedAssigneeId:changes.proposedAssigneeId===undefined?row.proposed_assignee_id:changes.proposedAssigneeId,evidence:changes.evidence===undefined?JSON.parse(row.evidence):changes.evidence});
  const now=Date.now();
  if(review?.decision==='reject'){
    candidate.reject();
    const rejected=await env.DB.prepare("UPDATE task_candidates SET status='rejected',updated=? WHERE id=? AND status='pending' RETURNING id").bind(now,candidateId).first();
    if(!rejected)throw new CollaborationError('候选任务已经处理',409);
    return {candidateId,status:'rejected'};
  }
  if(review?.decision!=='confirm')throw new CollaborationError('审核操作无效');
  candidate.confirm();
  const assigneeId=candidate.proposedAssigneeId||actorId;
  if(!await memberExists(env,row.group_id,assigneeId))throw new CollaborationError('负责人不是小组成员');
  const acceptanceStatus='pending';
  const valid=validateTask({title:candidate.title,notes:candidate.notes,due:candidate.due,priority:2,reminders:assignmentReminders});
  const task={...valid,id:crypto.randomUUID(),version:1,source:'candidate',source_id:candidateId,created:now,updated:now,user_id:assigneeId,group_id:row.group_id,assigned_by:actorId,acceptance_status:acceptanceStatus,candidate_id:candidateId};
  let claimed;
  try{[claimed]=await env.DB.batch([
    env.DB.prepare("UPDATE task_candidates SET title=?,notes=?,due=?,proposed_assignee_id=?,evidence=?,status='confirmed',updated=? WHERE id=? AND status='pending'").bind(candidate.title,candidate.notes,candidate.due,assigneeId,JSON.stringify(candidate.evidence),now,candidateId),
    env.DB.prepare('INSERT INTO tasks(id,title,notes,due,priority,completed,source,source_id,reminders,version,created,updated,user_id,group_id,assigned_by,acceptance_status,candidate_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1').bind(task.id,task.title,task.notes,task.due,task.priority,task.completed,task.source,task.source_id,JSON.stringify(task.reminders),task.version,now,now,task.user_id,task.group_id,task.assigned_by,task.acceptance_status,task.candidate_id)
  ]);}catch(error){if(/UNIQUE|constraint/i.test(String(error)))throw new CollaborationError('候选任务无法重复创建',409);throw error;}
  if(!claimed.meta?.changes)throw new CollaborationError('候选任务已经处理',409);
  return {...task,reminders:task.reminders};
}

export async function respondToAssignment(env,actorId,taskId,decision){
  const task=await env.DB.prepare("SELECT * FROM tasks WHERE id=? AND user_id=? AND group_id IS NOT NULL").bind(taskId,actorId).first();
  if(!task)throw new CollaborationError('小组任务不存在',404);
  if(task.acceptance_status!=='pending')throw new CollaborationError('该分工已经处理',409);
  if(!['accept','reject'].includes(decision))throw new CollaborationError('分工操作无效');
  const next=decision==='accept'?'accepted':'declined',now=Date.now();
  const changed=await env.DB.prepare('UPDATE tasks SET acceptance_status=?,version=version+1,updated=? WHERE id=? AND user_id=? AND acceptance_status=? RETURNING *').bind(next,now,taskId,actorId,'pending').first();
  if(!changed)throw new CollaborationError('该分工已经处理',409);
  const updated={...changed,reminders:JSON.parse(changed.reminders)};
  if(next==='accepted')await scheduleTask(env,updated);
  else await env.DB.prepare("UPDATE jobs SET state='cancelled' WHERE task_id=? AND user_id=? AND state IN ('pending','sending')").bind(taskId,actorId).run();
  return updated;
}

export async function listInvitations(env,actorId){
 return (await env.DB.prepare("SELECT i.id,i.group_id,g.name FROM group_invitations i JOIN groups g ON g.id=i.group_id WHERE i.user_id=? AND i.status='pending'").bind(actorId).all()).results;
}
export async function respondInvitation(env,actorId,id,decision){
 if(!['accept','reject'].includes(decision))throw new CollaborationError('操作无效');
 const invitation=await env.DB.prepare("SELECT * FROM group_invitations WHERE id=? AND user_id=? AND status='pending'").bind(id,actorId).first();
 if(!invitation)throw new CollaborationError('邀请不存在或已经处理',404);
 const statements=[env.DB.prepare("UPDATE group_invitations SET status=? WHERE id=? AND user_id=? AND status='pending'").bind(decision==='accept'?'accepted':'declined',id,actorId)];
 if(decision==='accept')statements.push(env.DB.prepare("INSERT OR IGNORE INTO group_members(group_id,user_id,role,joined) SELECT ?,?,'member',? WHERE changes()=1").bind(invitation.group_id,actorId,Date.now()));
 const result=await env.DB.batch(statements);if(!result[0].meta.changes)throw new CollaborationError('邀请已经处理',409);
 return {ok:true};
}
export async function manageMember(env,actorId,groupId,input){
 const access=await membership(env,groupId,actorId),target=String(input.userId||actorId);
 if(input.action==='transfer'){
  if(access.role!=='owner'||target===actorId||!await memberExists(env,groupId,target))throw new CollaborationError('请选择另一位成员接任组长',403);
  await env.DB.batch([
   env.DB.prepare("UPDATE group_members SET role='member' WHERE group_id=? AND user_id=?").bind(groupId,actorId),
   env.DB.prepare("UPDATE group_members SET role='owner' WHERE group_id=? AND user_id=?").bind(groupId,target),
   env.DB.prepare('UPDATE groups SET owner_user_id=?,updated=? WHERE id=?').bind(target,Date.now(),groupId)
  ]);return {ok:true};
 }
 if(input.action!=='remove')throw new CollaborationError('操作无效');
 if(target!==actorId&&access.role!=='owner')throw new CollaborationError('只有组长可以移除成员',403);
 if(target===access.owner_user_id)throw new CollaborationError('请先转让组长，再退出小组',409);
 // Keep frozen electorates and confirmed meetings consistent. Close them first.
 const active=await env.DB.prepare("SELECT 1 FROM meeting_polls WHERE group_id=? AND status IN ('open','confirmed') LIMIT 1").bind(groupId).first();
 if(active)throw new CollaborationError('请先让组长取消小组会议，再变更成员',409);
 const assigned=await env.DB.prepare("SELECT 1 FROM tasks WHERE group_id=? AND user_id=? AND completed=0 AND acceptance_status IN ('pending','accepted') LIMIT 1").bind(groupId,target).first();
 if(assigned)throw new CollaborationError('请先完成或拒绝该成员的未完成分工',409);
 await env.DB.batch([
  env.DB.prepare('DELETE FROM group_members WHERE group_id=? AND user_id=?').bind(groupId,target),
  env.DB.prepare('DELETE FROM group_invitations WHERE group_id=? AND user_id=?').bind(groupId,target)
 ]);return {ok:true};
}
