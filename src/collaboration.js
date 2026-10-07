import { assignmentReminders, validateTask } from './domain.js';
import { scheduleTask } from './jobs.js';

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
  const candidates=(await env.DB.prepare('SELECT * FROM task_candidates WHERE group_id=? ORDER BY status,created DESC').bind(groupId).all()).results.map(row=>({...row,evidence:JSON.parse(row.evidence)}));
  const tasks=(await env.DB.prepare('SELECT id,title,notes,due,priority,completed,user_id,assigned_by,acceptance_status,candidate_id,version,created,updated FROM tasks WHERE group_id=? ORDER BY completed,acceptance_status,due IS NULL,due').bind(groupId).all()).results;
  return {group:{id:groupId,name:access.name,owner_user_id:access.owner_user_id,role:access.role},members,candidates,tasks};
}

export async function addGroupMember(env,actorId,groupId,email){
  const access=await membership(env,groupId,actorId);
  if(access.role!=='owner')throw new CollaborationError('只有小组创建者可以添加成员',403);
  const normalized=String(email??'').trim().toLowerCase();
  const user=await env.DB.prepare('SELECT id,email,nickname FROM users WHERE email=?').bind(normalized).first();
  if(!user)throw new CollaborationError('该同学需要先注册 Campus Companion',404);
  await env.DB.prepare("INSERT OR IGNORE INTO group_members(group_id,user_id,role,joined) VALUES(?,?,'member',?)").bind(groupId,user.id,Date.now()).run();
  return user;
}

export async function createTaskCandidate(env,actorId,groupId,input){
  await membership(env,groupId,actorId);
  const candidate=new TaskCandidate(input);
  if(candidate.proposedAssigneeId&&!await memberExists(env,groupId,candidate.proposedAssigneeId))throw new CollaborationError('建议负责人不是小组成员',400);
  const now=Date.now(),row={id:crypto.randomUUID(),group_id:groupId,creator_user_id:actorId,proposed_assignee_id:candidate.proposedAssigneeId,title:candidate.title,notes:candidate.notes,due:candidate.due,evidence:candidate.evidence,status:'pending',created:now,updated:now};
  await env.DB.prepare('INSERT INTO task_candidates(id,group_id,creator_user_id,proposed_assignee_id,title,notes,due,evidence,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(row.id,row.group_id,row.creator_user_id,row.proposed_assignee_id,row.title,row.notes,row.due,JSON.stringify(row.evidence),row.status,now,now).run();
  return row;
}

export async function reviewTaskCandidate(env,actorId,candidateId,decision){
  const row=await env.DB.prepare('SELECT c.*,g.owner_user_id FROM task_candidates c JOIN groups g ON g.id=c.group_id WHERE c.id=?').bind(candidateId).first();
  if(!row)throw new CollaborationError('候选任务不存在',404);
  if(row.owner_user_id!==actorId)throw new CollaborationError('只有小组创建者可以确认候选任务',403);
  const candidate=new TaskCandidate({...row,proposedAssigneeId:row.proposed_assignee_id,evidence:JSON.parse(row.evidence)});
  const now=Date.now();
  if(decision==='reject'){
    candidate.reject();
    await env.DB.prepare("UPDATE task_candidates SET status='rejected',updated=? WHERE id=? AND status='pending'").bind(now,candidateId).run();
    return {candidateId,status:'rejected'};
  }
  if(decision!=='confirm')throw new CollaborationError('审核操作无效');
  candidate.confirm();
  const assigneeId=candidate.proposedAssigneeId||actorId;
  if(!await memberExists(env,row.group_id,assigneeId))throw new CollaborationError('负责人不是小组成员');
  const acceptanceStatus=assigneeId===actorId?'accepted':'pending';
  const valid=validateTask({title:candidate.title,notes:candidate.notes,due:candidate.due,priority:2,reminders:assignmentReminders});
  const task={...valid,id:crypto.randomUUID(),version:1,source:'candidate',source_id:candidateId,created:now,updated:now,user_id:assigneeId,group_id:row.group_id,assigned_by:actorId,acceptance_status:acceptanceStatus,candidate_id:candidateId};
  await env.DB.batch([
    env.DB.prepare('INSERT INTO tasks(id,title,notes,due,priority,completed,source,source_id,reminders,version,created,updated,user_id,group_id,assigned_by,acceptance_status,candidate_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(task.id,task.title,task.notes,task.due,task.priority,task.completed,task.source,task.source_id,JSON.stringify(task.reminders),task.version,now,now,task.user_id,task.group_id,task.assigned_by,task.acceptance_status,task.candidate_id),
    env.DB.prepare("UPDATE task_candidates SET status='confirmed',updated=? WHERE id=? AND status='pending'").bind(now,candidateId)
  ]);
  if(acceptanceStatus==='accepted')await scheduleTask(env,task);
  return {...task,reminders:task.reminders};
}

export async function respondToAssignment(env,actorId,taskId,decision){
  const task=await env.DB.prepare("SELECT * FROM tasks WHERE id=? AND user_id=? AND group_id IS NOT NULL").bind(taskId,actorId).first();
  if(!task)throw new CollaborationError('小组任务不存在',404);
  if(task.acceptance_status!=='pending')throw new CollaborationError('该分工已经处理',409);
  if(!['accept','reject'].includes(decision))throw new CollaborationError('分工操作无效');
  const next=decision==='accept'?'accepted':'declined',now=Date.now();
  await env.DB.prepare('UPDATE tasks SET acceptance_status=?,version=version+1,updated=? WHERE id=? AND user_id=? AND acceptance_status=?').bind(next,now,taskId,actorId,'pending').run();
  const updated={...task,acceptance_status:next,version:task.version+1,updated:now,reminders:JSON.parse(task.reminders)};
  if(next==='accepted')await scheduleTask(env,updated);
  else await env.DB.prepare("UPDATE jobs SET state='cancelled' WHERE task_id=? AND user_id=? AND state IN ('pending','sending')").bind(taskId,actorId).run();
  return updated;
}
