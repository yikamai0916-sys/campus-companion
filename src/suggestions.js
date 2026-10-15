import { CollaborationError } from './collaboration.js';
import { validateTask, assignmentReminders } from './domain.js';
import { taskJobRows } from './jobs.js';
export async function saveMailSuggestion(env,userId,messageId,analysis){
 if(!analysis.assignment)return;
 await env.DB.prepare("INSERT OR IGNORE INTO mail_suggestions(id,user_id,message_id,title,notes,due,evidence,created) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),userId,messageId,analysis.title,analysis.action||'',analysis.due??null,JSON.stringify(analysis.evidence||{}),Date.now()).run();
}
export async function listMailSuggestions(env,userId){
 return (await env.DB.prepare("SELECT * FROM mail_suggestions WHERE user_id=? AND status='pending' ORDER BY created DESC").bind(userId).all()).results.map(row=>({...row,evidence:JSON.parse(row.evidence)}));
}
export async function reviewMailSuggestion(env,userId,id,input){
 const row=await env.DB.prepare("SELECT * FROM mail_suggestions WHERE id=? AND user_id=? AND status='pending'").bind(id,userId).first();
 if(!row)throw new CollaborationError('建议不存在或已经处理',404);
 if(!['confirm','reject'].includes(input.decision))throw new CollaborationError('操作无效');
 if(input.decision==='reject'){await env.DB.prepare("UPDATE mail_suggestions SET status='rejected' WHERE id=? AND user_id=? AND status='pending'").bind(id,userId).run();return {ok:true};}
 const valid=validateTask({title:input.title??row.title,notes:input.notes??row.notes,due:input.due===undefined?row.due:input.due,reminders:{...assignmentReminders,email:false}});
 const now=Date.now(),task={...valid,id:crypto.randomUUID(),user_id:userId,version:1,acceptance_status:'accepted'};
 const jobs=await taskJobRows(env,task,now);
 const results=await env.DB.batch([
 env.DB.prepare("UPDATE mail_suggestions SET status='confirmed' WHERE id=? AND user_id=? AND status='pending'").bind(id,userId),
 env.DB.prepare("INSERT INTO tasks(id,title,notes,due,priority,completed,source,source_id,reminders,version,created,updated,user_id) SELECT ?,?,?,?,?,0,'email',?,?,1,?,?,? WHERE changes()=1").bind(task.id,task.title,task.notes,task.due,task.priority,'mail-suggestion:'+id,JSON.stringify(task.reminders),now,now,userId),
 ...jobs.map(job=>env.DB.prepare("INSERT OR IGNORE INTO jobs(id,task_id,version,at,channel,payload,user_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM tasks WHERE id=? AND user_id=?)").bind(job.id,task.id,1,job.at,job.channel,job.payload,userId,task.id,userId))
 ]);
 if(!results[0].meta.changes)throw new CollaborationError('建议已经处理',409);
 return {ok:true,taskId:task.id};
}
