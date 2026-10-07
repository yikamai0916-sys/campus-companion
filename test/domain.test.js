import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults,assignmentReminders,validateTask,initialTimes,nextAllowed,allowed,digestWindow,originalSender,classify } from '../src/domain.js';
import { explicitDeadline,plain } from '../src/mail.js';
test('deadline offsets respect Hong Kong quiet hours',()=>{
  const due=Date.parse('2026-10-05T09:00:00+08:00'),now=Date.parse('2026-10-01T00:00:00+08:00');
  const t=validateTask({title:'作业',due});const times=initialTimes(t,now);
  assert.deepEqual(times.map(x=>new Date(x).toISOString()),['2026-10-02T01:00:00.000Z','2026-10-04T01:00:00.000Z','2026-10-05T00:00:00.000Z','2026-10-05T00:30:00.000Z']);
});
test('automatic assignment reminders keep exact late-night offsets',()=>{
  const due=Date.parse('2026-10-02T23:59:00+08:00'),now=Date.parse('2026-09-28T00:00:00+08:00');
  const task=validateTask({title:'Assignment 2',due,reminders:assignmentReminders});
  assert.deepEqual(initialTimes(task,now).map(x=>new Date(x).toISOString()),['2026-09-29T15:59:00.000Z','2026-10-01T15:59:00.000Z','2026-10-02T13:59:00.000Z','2026-10-02T15:29:00.000Z']);
});
test('weekends skip to selected weekday, overnight intervals supported',()=>{
  const fridayNight=Date.parse('2026-10-02T23:30:00+08:00');
  assert.equal(new Date(nextAllowed(fridayNight,{...defaults,days:[1,2,3,4,5]})).toISOString(),'2026-10-05T00:00:00.000Z');
  assert.equal(allowed(fridayNight,{...defaults,start:'22:00',end:'07:00'}),true);
});
test('20:00 and midnight partition the Hong Kong day exactly',()=>{
  const daily=digestWindow(Date.parse('2026-10-02T20:03:00+08:00'));
  const late=digestWindow(Date.parse('2026-10-03T00:03:00+08:00'));
  assert.equal(daily.end,late.start);assert.equal(late.date,'2026-10-02');assert.equal(late.end-daily.start,86400000);
});
test('forwarding sender is not mistaken for original author',()=>{
  assert.equal(originalSender('From: Teacher <teacher@ln.edu.hk>\nTo: student@university.example','student@university.example','student@university.example'),'Teacher <teacher@ln.edu.hk>');
  assert.match(originalSender('no headers','student@university.example','student@university.example'),/无法确认/);
});
test('nested self-forward identifies the author and keeps unrelated quotes out',()=>{
  const body='From: Me <me@example.com> On Behalf Of My Account <mine@example.com>\nTo: student@ln.hk\nSubject: Assignment\n---\nFrom: Dr. Wong <wong@example.edu>\nTo: student@ln.hk\nSubject: Assignment\nDear student, submit by 2 October 2026 at 11:59 PM.\nFrom: Old Author <old@example.org>';
  assert.equal(originalSender(body,'student@ln.hk','student@ln.hk',['mine@example.com']),'Dr. Wong <wong@example.edu>');
  assert.equal(originalSender('From: Alice <alice@example.edu> On Behalf Of Chair <chair@example.edu>','student@ln.hk','student@ln.hk'),'Chair <chair@example.edu>（由 Alice <alice@example.edu> 代发）');
});
test('explicit assignment deadline excludes forwarding Sent header',()=>{
  const body='From: Me <me@example.com>\nSent: 23 September 2026 at 1:30 PM\nSubject: Assignment Deadline\nPlease submit the essay before\n\n2 October 2026 at 11:59 PM.';
  assert.deepEqual(explicitDeadline(body),{due:Date.parse('2026-10-02T23:59:00+08:00'),evidence:'2 October 2026 at 11:59 PM'});
});
test('message text preserves angle-bracket email addresses',()=>{
  const html=plain({body:{contentType:'html',content:'<p>From: Teacher &lt;teacher@example.edu&gt;</p><p>Body</p>'}});
  assert.match(html,/Teacher <teacher@example.edu>/);
  const text=plain({body:{contentType:'text',content:'From: Teacher <teacher@example.edu>'}});
  assert.equal(text,'From: Teacher <teacher@example.edu>');
});
test('receipt ignored but resubmission and scholarships retained',()=>{
  assert.equal(classify('Moodle','you have successfully submitted assignment'),6);
  assert.equal(classify('Assignment','failed, please resubmit'),2);
  assert.equal(classify('Scholarship','chaplain invitation'),1);
  assert.equal(classify('ILP course recommendation','join us'),4);
});
test('invalid schedules rejected; explicit reminders work without deadline',()=>{
  assert.throws(()=>validateTask({title:'x',reminders:{days:[]}}));
  assert.throws(()=>validateTask({title:'x',reminders:{repeat:1}}));
  assert.throws(()=>validateTask({title:'x',due:'bad'}));
  const at=Date.parse('2026-10-02T15:00:00+08:00');
  assert.deepEqual(initialTimes(validateTask({title:'x',reminders:{exact:[at]}}),at-1000),[at]);
});
