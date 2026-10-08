import { CollaborationError } from './collaboration.js';
import { AvailabilityCalendar,MeetingPlanner } from './meeting-planner.js';
import { taskJobRows } from './jobs.js';

const text=(value,label,max)=>{const result=String(value??'').trim();if(!result||result.length>max)throw new CollaborationError(`${label}需为 1–${max} 个字符`);return result;};

async function groupAccess(env,groupId,userId){
  const row=await env.DB.prepare('SELECT gm.role FROM group_members gm WHERE gm.group_id=? AND gm.user_id=?').bind(groupId,userId).first();
  if(!row)throw new CollaborationError('小组不存在或你不是成员',404);
  return row;
}

async function pollAccess(env,pollId,userId){
  const row=await env.DB.prepare('SELECT p.*,gm.role FROM meeting_polls p JOIN group_members gm ON gm.group_id=p.group_id WHERE p.id=? AND gm.user_id=?').bind(pollId,userId).first();
  if(!row)throw new CollaborationError('会议收集不存在或你不是小组成员',404);
  return row;
}

const plannerFor=poll=>new MeetingPlanner({rangeStart:poll.range_start,rangeEnd:poll.range_end,durationMinutes:poll.duration_minutes,slotMinutes:poll.slot_minutes,bufferMinutes:poll.buffer_minutes});

export async function createMeetingPoll(env,actorId,groupId,input){
  await groupAccess(env,groupId,actorId);
  const planner=new MeetingPlanner(input),now=Date.now(),poll={id:crypto.randomUUID(),group_id:groupId,creator_user_id:actorId,name:text(input.name,'会议名称',120),range_start:planner.rangeStart,range_end:planner.rangeEnd,duration_minutes:planner.durationMinutes,slot_minutes:planner.slotMinutes,buffer_minutes:planner.bufferMinutes,status:'open',created:now,updated:now};
  await env.DB.prepare('INSERT INTO meeting_polls(id,group_id,creator_user_id,name,range_start,range_end,duration_minutes,slot_minutes,buffer_minutes,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(poll.id,poll.group_id,poll.creator_user_id,poll.name,poll.range_start,poll.range_end,poll.duration_minutes,poll.slot_minutes,poll.buffer_minutes,poll.status,now,now).run();
  return poll;
}

export async function submitAvailability(env,actorId,pollId,input){
  const poll=await pollAccess(env,pollId,actorId);
  if(poll.status!=='open'||poll.phase!=='collecting')throw new CollaborationError('可用时间收集已经结束',409);
  const calendar=new AvailabilityCalendar(input.intervals,{rangeStart:poll.range_start,rangeEnd:poll.range_end});
  const avoid=new AvailabilityCalendar(input.avoidIntervals||[],{rangeStart:poll.range_start,rangeEnd:poll.range_end});
  const now=Date.now();
  await env.DB.prepare('INSERT INTO meeting_availability(poll_id,user_id,intervals,avoid_intervals,updated) VALUES(?,?,?,?,?) ON CONFLICT(poll_id,user_id) DO UPDATE SET intervals=excluded.intervals,avoid_intervals=excluded.avoid_intervals,updated=excluded.updated').bind(pollId,actorId,JSON.stringify(calendar.intervals),JSON.stringify(avoid.intervals),now).run();
  return {pollId,userId:actorId,intervals:calendar.intervals,avoidIntervals:avoid.intervals,updated:now};
}

export async function meetingPollSnapshot(env,actorId,pollId){
  const poll=await pollAccess(env,pollId,actorId);
  const currentMembers=(await env.DB.prepare('SELECT user_id FROM group_members WHERE group_id=? ORDER BY joined').bind(poll.group_id).all()).results.map(row=>String(row.user_id));
  const frozenMembers=JSON.parse(poll.eligible_user_ids||'[]'),members=poll.phase==='collecting'?currentMembers:frozenMembers;
  const submissions=(await env.DB.prepare('SELECT user_id,intervals,avoid_intervals,updated FROM meeting_availability WHERE poll_id=?').bind(pollId).all()).results.map(row=>({userId:String(row.user_id),intervals:JSON.parse(row.intervals),avoidIntervals:JSON.parse(row.avoid_intervals),updated:row.updated}));
  const submitted=new Set(submissions.map(item=>item.userId)),memberStatuses=members.map(userId=>({userId,submitted:submitted.has(userId)}));
  const result=plannerFor(poll).recommend(members,submissions),options=poll.phase==='voting'||poll.status==='confirmed'?JSON.parse(poll.proposal_options||'[]'):[];
  const rawVotes=(await env.DB.prepare('SELECT user_id,proposal_start,updated FROM meeting_votes WHERE poll_id=?').bind(pollId).all()).results;
  const counts=new Map(options.map(option=>[Number(option.start),0]));for(const vote of rawVotes)counts.set(Number(vote.proposal_start),(counts.get(Number(vote.proposal_start))||0)+1);
  const votes=options.map(option=>({...option,count:counts.get(Number(option.start))||0})),voters=new Set(rawVotes.map(vote=>String(vote.user_id)));
  return {poll,result,submissions,memberStatuses,options,votes,ownVote:rawVotes.find(vote=>String(vote.user_id)===String(actorId))?.proposal_start??null,missingVoterIds:members.filter(userId=>!voters.has(userId))};
}

export async function openMeetingVote(env,actorId,pollId){
  const snapshot=await meetingPollSnapshot(env,actorId,pollId),poll=snapshot.poll;
  if(poll.role!=='owner')throw new CollaborationError('只有小组创建者可以开启投票',403);
  if(poll.status!=='open'||poll.phase!=='collecting')throw new CollaborationError('会议投票已经开启或结束',409);
  if(snapshot.result.missingMemberIds.length)throw new CollaborationError('仍有成员未提交可用时间',409);
  const options=snapshot.result.proposals.filter(proposal=>proposal.allAvailable);
  if(!options.length)throw new CollaborationError('当前没有全员可参加的候选时间',409);
  const eligibleUserIds=snapshot.memberStatuses.map(item=>item.userId);
  const changed=await env.DB.prepare("UPDATE meeting_polls SET phase='voting',proposal_options=?,eligible_user_ids=?,updated=? WHERE id=? AND status='open' AND phase='collecting' RETURNING id").bind(JSON.stringify(options),JSON.stringify(eligibleUserIds),Date.now(),pollId).first();
  if(!changed)throw new CollaborationError('会议投票已经开启或结束',409);
  return {pollId,phase:'voting',options};
}

export async function voteMeetingProposal(env,actorId,pollId,start){
  const poll=await pollAccess(env,pollId,actorId);
  if(poll.status!=='open'||poll.phase!=='voting')throw new CollaborationError('会议投票尚未开启或已经结束',409);
  if(!JSON.parse(poll.eligible_user_ids||'[]').map(String).includes(String(actorId)))throw new CollaborationError('你不在本次会议的投票名单中',403);
  const selected=JSON.parse(poll.proposal_options||'[]').find(option=>Number(option.start)===Number(start));
  if(!selected)throw new CollaborationError('该时间不在投票选项中',400);
  const changed=await env.DB.prepare("INSERT INTO meeting_votes(poll_id,user_id,proposal_start,updated) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM meeting_polls WHERE id=? AND status='open' AND phase='voting') ON CONFLICT(poll_id,user_id) DO UPDATE SET proposal_start=excluded.proposal_start,updated=excluded.updated").bind(pollId,actorId,selected.start,Date.now(),pollId).run();
  if(!changed.meta.changes)throw new CollaborationError('会议投票已经结束',409);
  return {pollId,userId:actorId,start:selected.start};
}

export async function confirmMeetingProposal(env,actorId,pollId,start){
  const snapshot=await meetingPollSnapshot(env,actorId,pollId),poll=snapshot.poll;
  if(poll.role!=='owner')throw new CollaborationError('只有小组创建者可以确认会议时间',403);
  if(poll.status!=='open'||poll.phase!=='voting')throw new CollaborationError('请先完成会议投票',409);
  if(snapshot.missingVoterIds.length)throw new CollaborationError('仍有成员未投票',409);
  const selected=snapshot.votes.find(proposal=>Number(proposal.start)===Number(start)),highest=Math.max(...snapshot.votes.map(option=>option.count));
  if(!selected||selected.count!==highest)throw new CollaborationError('只能确认当前得票最高的时间',409);
  const members=JSON.parse(poll.eligible_user_ids||'[]').map(String),claimToken=crypto.randomUUID();
  const now=Date.now(),reminders={offsets:[1440,60,15],exact:[],repeat:0,maxCount:0,start:'08:00',end:'23:00',days:[0,1,2,3,4,5,6],push:true,email:false};
  const tasks=members.map(userId=>({id:crypto.randomUUID(),userId,title:'参加会议：'+poll.name,notes:`小组会议已由全员投票确定。\n时间：${new Date(selected.start).toLocaleString('zh-CN',{timeZone:'Asia/Hong_Kong',hour12:false})}`,due:selected.start}));
  const announcement={id:crypto.randomUUID(),title:'会议时间已确认：'+poll.name,body:`${new Date(selected.start).toLocaleString('zh-CN',{timeZone:'Asia/Hong_Kong',hour12:false})}，时长 ${poll.duration_minutes} 分钟。`};
  const jobRows=(await Promise.all(tasks.map(task=>taskJobRows(env,{...task,user_id:task.userId,completed:0,acceptance_status:'accepted',version:1,reminders},now)))).flat();
  let results;try{results=await env.DB.batch([
    env.DB.prepare("UPDATE meeting_polls SET status='confirmed',phase='confirmed',confirmed_start=?,confirmed_end=?,confirmation_token=?,updated=? WHERE id=? AND status='open' AND phase='voting' AND NOT EXISTS (SELECT 1 FROM json_each(meeting_polls.eligible_user_ids) eligible WHERE NOT EXISTS (SELECT 1 FROM meeting_votes required_vote WHERE required_vote.poll_id=meeting_polls.id AND required_vote.user_id=CAST(eligible.value AS TEXT))) AND NOT EXISTS (SELECT proposal_start FROM meeting_votes rival WHERE rival.poll_id=meeting_polls.id GROUP BY proposal_start HAVING COUNT(*)>(SELECT COUNT(*) FROM meeting_votes chosen WHERE chosen.poll_id=meeting_polls.id AND chosen.proposal_start=?))").bind(selected.start,selected.end,claimToken,now,pollId,selected.start),
    ...tasks.map(task=>env.DB.prepare("INSERT INTO tasks(id,title,notes,due,priority,completed,source,source_id,reminders,version,created,updated,user_id,group_id,assigned_by,acceptance_status,candidate_id) SELECT ?,?,?,?,?,0,'meeting',?,?,1,?,?,?,?,?,'accepted',NULL WHERE EXISTS (SELECT 1 FROM meeting_polls WHERE id=? AND confirmation_token=?)").bind(task.id,task.title,task.notes,task.due,2,pollId,JSON.stringify(reminders),now,now,task.userId,poll.group_id,actorId,pollId,claimToken)),
    env.DB.prepare("INSERT INTO group_announcements(id,group_id,kind,title,body,source_id,created_by,created) SELECT ?,?,'meeting',?,?,?,?,? WHERE EXISTS (SELECT 1 FROM meeting_polls WHERE id=? AND confirmation_token=?)").bind(announcement.id,poll.group_id,announcement.title,announcement.body,pollId,actorId,now,pollId,claimToken),
    ...jobRows.map(job=>env.DB.prepare("INSERT OR IGNORE INTO jobs(id,task_id,version,at,channel,payload,user_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM tasks WHERE id=? AND source='meeting' AND source_id=? AND user_id=?)").bind(job.id,job.taskId,job.version,job.at,job.channel,job.payload,job.userId,job.taskId,pollId,job.userId))
  ]);}catch(error){if(/UNIQUE|constraint/i.test(String(error)))throw new CollaborationError('会议时间已经处理',409);throw error;}
  if(!results[0]?.meta?.changes)throw new CollaborationError('投票结果已变化或会议时间已经处理，请刷新后重试',409);
  return {...selected,status:'confirmed',tasksCreated:tasks.length,announcement};
}
