const fail=message=>{throw new Error(message);};

const asTime=(value,label)=>{
  const time=Number(value);
  if(!Number.isFinite(time)||time<0||time>4102444800000)fail(`${label}无效`);
  return time;
};

export class AvailabilityCalendar {
  constructor(intervals,{rangeStart=0,rangeEnd=4102444800000,bufferMinutes=0}={}){
    const buffer=bufferMinutes*60000;
    const normalized=(Array.isArray(intervals)?intervals:[]).map((interval,index)=>{
      if(!Array.isArray(interval)||interval.length!==2)fail(`第 ${index+1} 个时间段格式无效`);
      const rawStart=asTime(interval[0],'开始时间'),rawEnd=asTime(interval[1],'结束时间');
      if(rawEnd<=rawStart)fail(`第 ${index+1} 个时间段结束时间必须晚于开始时间`);
      const start=Math.max(rangeStart,rawStart+buffer);
      const end=Math.min(rangeEnd,rawEnd-buffer);
      if(end<=start)return null;
      return [start,end];
    }).filter(Boolean).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    this.intervals=[];
    for(const current of normalized){
      const previous=this.intervals.at(-1);
      if(previous&&current[0]<=previous[1])previous[1]=Math.max(previous[1],current[1]);
      else this.intervals.push([...current]);
    }
  }

  contains(start,end){
    return this.intervals.some(interval=>interval[0]<=start&&interval[1]>=end);
  }

  overlaps(start,end){
    return this.intervals.some(interval=>interval[0]<end&&interval[1]>start);
  }
}

export class MeetingPlanner {
  constructor({rangeStart,rangeEnd,durationMinutes,slotMinutes=15,bufferMinutes=0}){
    this.rangeStart=asTime(rangeStart,'日期范围开始');
    this.rangeEnd=asTime(rangeEnd,'日期范围结束');
    this.durationMinutes=Number(durationMinutes);
    this.slotMinutes=Number(slotMinutes);
    this.bufferMinutes=Number(bufferMinutes);
    if(this.rangeEnd<=this.rangeStart||this.rangeEnd-this.rangeStart>31*86400000)fail('会议日期范围需在 31 天以内');
    if(!Number.isInteger(this.durationMinutes)||this.durationMinutes<15||this.durationMinutes>480)fail('会议时长需为 15–480 分钟');
    if(![5,10,15,30,60].includes(this.slotMinutes))fail('时间粒度无效');
    if(!Number.isInteger(this.bufferMinutes)||this.bufferMinutes<0||this.bufferMinutes>120)fail('缓冲时间需为 0–120 分钟');
  }

  recommend(memberIds,submissions,limit=3){
    const uniqueMembers=[...new Set(memberIds.map(String))];
    if(!uniqueMembers.length)fail('会议至少需要一名成员');
    const byUser=new Map(submissions.map(item=>[String(item.userId),item]));
    const calendars=new Map(),avoid=new Map(),calendarCursor=new Map(),avoidCursor=new Map();
    for(const userId of uniqueMembers){
      const submission=byUser.get(userId);
      if(!submission)continue;
      calendars.set(userId,new AvailabilityCalendar(submission.intervals,{rangeStart:this.rangeStart,rangeEnd:this.rangeEnd,bufferMinutes:this.bufferMinutes}));
      avoid.set(userId,new AvailabilityCalendar(submission.avoidIntervals||[],{rangeStart:this.rangeStart,rangeEnd:this.rangeEnd}));
      calendarCursor.set(userId,0);avoidCursor.set(userId,0);
    }
    const duration=this.durationMinutes*60000,step=this.slotMinutes*60000,candidates=[];
    for(let start=this.rangeStart;start+duration<=this.rangeEnd;start+=step){
      const end=start+duration,availableMemberIds=[];let preferencePenalty=0;
      for(const userId of uniqueMembers){
        const calendar=calendars.get(userId);
        if(!calendar)continue;
        let cursor=calendarCursor.get(userId),interval=calendar.intervals[cursor];
        while(interval&&interval[1]<=start){cursor++;interval=calendar.intervals[cursor];}
        calendarCursor.set(userId,cursor);
        if(interval&&interval[0]<=start&&interval[1]>=end){
          availableMemberIds.push(userId);
          const avoided=avoid.get(userId);let avoidedCursor=avoidCursor.get(userId),avoidedInterval=avoided.intervals[avoidedCursor];
          while(avoidedInterval&&avoidedInterval[1]<=start){avoidedCursor++;avoidedInterval=avoided.intervals[avoidedCursor];}
          avoidCursor.set(userId,avoidedCursor);
          if(avoidedInterval&&avoidedInterval[0]<end&&avoidedInterval[1]>start)preferencePenalty++;
        }
      }
      if(availableMemberIds.length){const availableSet=new Set(availableMemberIds);candidates.push({start,end,availableMemberIds,unavailableMemberIds:uniqueMembers.filter(id=>!availableSet.has(id)),availableCount:availableMemberIds.length,memberCount:uniqueMembers.length,submittedCount:calendars.size,preferencePenalty,allAvailable:availableMemberIds.length===uniqueMembers.length&&calendars.size===uniqueMembers.length});}
    }
    candidates.sort((a,b)=>b.availableCount-a.availableCount||a.preferencePenalty-b.preferencePenalty||a.start-b.start);
    const proposals=[];
    for(const candidate of candidates){
      if(proposals.every(existing=>Math.abs(existing.start-candidate.start)>=duration))proposals.push(candidate);
      if(proposals.length>=limit)break;
    }
    return {proposals,submittedCount:calendars.size,memberCount:uniqueMembers.length,missingMemberIds:uniqueMembers.filter(id=>!calendars.has(id)),hasAllMemberOption:proposals.some(item=>item.allAvailable)};
  }
}
