import { CollaborationError } from './collaboration.js';
import { AvailabilityCalendar,MeetingPlanner } from './meeting-planner.js';

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
  if(poll.status!=='open')throw new CollaborationError('会议时间收集已经结束',409);
  const calendar=new AvailabilityCalendar(input.intervals,{rangeStart:poll.range_start,rangeEnd:poll.range_end});
  const avoid=new AvailabilityCalendar(input.avoidIntervals||[],{rangeStart:poll.range_start,rangeEnd:poll.range_end});
  const now=Date.now();
  await env.DB.prepare('INSERT INTO meeting_availability(poll_id,user_id,intervals,avoid_intervals,updated) VALUES(?,?,?,?,?) ON CONFLICT(poll_id,user_id) DO UPDATE SET intervals=excluded.intervals,avoid_intervals=excluded.avoid_intervals,updated=excluded.updated').bind(pollId,actorId,JSON.stringify(calendar.intervals),JSON.stringify(avoid.intervals),now).run();
  return {pollId,userId:actorId,intervals:calendar.intervals,avoidIntervals:avoid.intervals,updated:now};
}

export async function meetingPollSnapshot(env,actorId,pollId){
  const poll=await pollAccess(env,pollId,actorId);
  const members=(await env.DB.prepare('SELECT user_id FROM group_members WHERE group_id=? ORDER BY joined').bind(poll.group_id).all()).results.map(row=>String(row.user_id));
  const submissions=(await env.DB.prepare('SELECT user_id,intervals,avoid_intervals,updated FROM meeting_availability WHERE poll_id=?').bind(pollId).all()).results.map(row=>({userId:String(row.user_id),intervals:JSON.parse(row.intervals),avoidIntervals:JSON.parse(row.avoid_intervals),updated:row.updated}));
  return {poll,result:plannerFor(poll).recommend(members,submissions),submissions};
}

export async function confirmMeetingProposal(env,actorId,pollId,start){
  const snapshot=await meetingPollSnapshot(env,actorId,pollId),poll=snapshot.poll;
  if(poll.role!=='owner')throw new CollaborationError('只有小组创建者可以确认会议时间',403);
  if(poll.status!=='open')throw new CollaborationError('会议时间已经处理',409);
  const selected=snapshot.result.proposals.find(proposal=>proposal.start===Number(start));
  if(!selected)throw new CollaborationError('该时间不在当前推荐结果中',409);
  if(!selected.allAvailable)throw new CollaborationError('仍有成员未提交或冲突，请明确调整成员范围后再确认',409);
  const changed=await env.DB.prepare("UPDATE meeting_polls SET status='confirmed',confirmed_start=?,confirmed_end=?,updated=? WHERE id=? AND status='open' RETURNING id").bind(selected.start,selected.end,Date.now(),pollId).first();
  if(!changed)throw new CollaborationError('会议时间已经处理',409);
  return {...selected,status:'confirmed'};
}
