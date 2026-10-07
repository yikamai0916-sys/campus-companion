import test from 'node:test';
import assert from 'node:assert/strict';
import { AvailabilityCalendar,MeetingPlanner } from '../src/meeting-planner.js';

const minute=60000;

test('AvailabilityCalendar validates, sorts, and merges half-open intervals',()=>{
  const calendar=new AvailabilityCalendar([[60*minute,120*minute],[0,60*minute],[90*minute,180*minute]]);
  assert.deepEqual(calendar.intervals,[[0,180*minute]]);
  assert.equal(calendar.contains(0,180*minute),true);
  assert.equal(calendar.overlaps(180*minute,200*minute),false);
  assert.throws(()=>new AvailabilityCalendar([[10,10]]),/结束时间必须晚于开始时间/);
});

test('MeetingPlanner returns three meaningfully separated full-group proposals',()=>{
  const planner=new MeetingPlanner({rangeStart:0,rangeEnd:4*60*minute,durationMinutes:60,slotMinutes:15});
  const result=planner.recommend(['a','b','c'],[
    {userId:'a',intervals:[[0,4*60*minute]]},
    {userId:'b',intervals:[[0,4*60*minute]],avoidIntervals:[[0,60*minute]]},
    {userId:'c',intervals:[[0,4*60*minute]]}
  ]);
  assert.equal(result.proposals.length,3);
  assert.equal(result.proposals.every(item=>item.allAvailable),true);
  assert.equal(result.proposals[0].preferencePenalty,0);
  assert.ok(result.proposals.slice(1).every((item,index)=>Math.abs(item.start-result.proposals[index].start)>=60*minute));
});

test('missing submissions remain unknown and cannot produce an all-member option',()=>{
  const planner=new MeetingPlanner({rangeStart:0,rangeEnd:3*60*minute,durationMinutes:60});
  const result=planner.recommend(['a','b'],[{userId:'a',intervals:[[0,3*60*minute]]}]);
  assert.deepEqual(result.missingMemberIds,['b']);
  assert.equal(result.hasAllMemberOption,false);
  assert.equal(result.proposals[0].availableCount,1);
});

test('buffer time shrinks availability before scoring',()=>{
  const planner=new MeetingPlanner({rangeStart:0,rangeEnd:120*minute,durationMinutes:60,slotMinutes:15,bufferMinutes:15});
  const result=planner.recommend(['a'],[{userId:'a',intervals:[[0,120*minute]]}]);
  assert.equal(result.proposals[0].start,15*minute);
  assert.equal(result.proposals[0].end,75*minute);
});
