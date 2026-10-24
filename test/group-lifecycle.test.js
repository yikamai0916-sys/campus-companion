import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './helpers/database.js';
import {manageMember,groupSnapshot} from '../src/collaboration.js';
function fixture(phase='voting'){
 const {DB,sqlite}=database(),env={DB};
 sqlite.exec("INSERT INTO groups(id,name,owner_user_id,created,updated) VALUES('g','Team','a',0,0),('other','Other','c',0,0);INSERT INTO group_members(group_id,user_id,role,joined) VALUES('g','a','owner',0),('g','b','member',1),('g','c','member',2)");
 sqlite.prepare("INSERT INTO meeting_polls(id,group_id,creator_user_id,name,range_start,range_end,duration_minutes,status,phase,eligible_user_ids,created,updated) VALUES('poll','g','a','Meeting',1,100,1,?,?,'[\"a\",\"b\",\"c\"]',0,0)").run(phase==='confirmed'?'confirmed':'open',phase);
 sqlite.exec("INSERT INTO meeting_availability(poll_id,user_id,intervals,updated) VALUES('poll','b','[]',0);INSERT INTO meeting_votes(poll_id,user_id,proposal_start,updated) VALUES('poll','a',1,0),('poll','b',1,0)");
 for(const [id,user,source,completed] of [['work','b','candidate',0],['done','b','candidate',1],['meeting','b','meeting',0],['remaining','a','meeting',0]]){
  sqlite.prepare("INSERT INTO tasks(id,title,reminders,created,updated,user_id,group_id,source,source_id,acceptance_status,completed) VALUES(?,'Task','{}',0,0,?,'g',?,?,'accepted',?)").run(id,user,source,id,completed);
  sqlite.prepare("INSERT INTO jobs(id,task_id,at,channel,payload,user_id) VALUES(?,?,0,'push','{}',?)").run(id,id,user);
 }
 return {env,sqlite};
}
for(const phase of ['collecting','voting','confirmed'])test(`member can leave during ${phase} with unfinished work`,async()=>{
 const {env,sqlite}=fixture(phase);await manageMember(env,'b','g',{action:'remove'});
 assert.equal(sqlite.prepare("SELECT * FROM group_members WHERE group_id='g' AND user_id='b'").get(),undefined);
 assert.equal(sqlite.prepare("SELECT acceptance_status FROM tasks WHERE id='work'").get().acceptance_status,'declined');
 assert.equal(sqlite.prepare("SELECT * FROM tasks WHERE id='meeting'").get(),undefined);
 assert.equal(sqlite.prepare("SELECT group_id FROM tasks WHERE id='done'").get().group_id,null);
 assert.equal(sqlite.prepare("SELECT state FROM jobs WHERE id='work'").get().state,'cancelled');
 assert.equal(sqlite.prepare("SELECT state FROM jobs WHERE id='remaining'").get().state,'pending');
 const poll=sqlite.prepare("SELECT * FROM meeting_polls WHERE id='poll'").get();
 assert.equal(poll.phase,phase==='confirmed'?'confirmed':'collecting');assert.ok(!JSON.parse(poll.eligible_user_ids).includes('b'));
 await assert.rejects(()=>groupSnapshot(env,'b','g'),e=>e.status===404);
});
for(const phase of ['collecting','voting','confirmed'])test(`only owner can dissolve during ${phase} with unfinished assignments`,async()=>{
 const {env,sqlite}=fixture(phase);await assert.rejects(()=>manageMember(env,'b','g',{action:'dissolve'}),e=>e.status===403);
 assert.ok(sqlite.prepare("SELECT * FROM groups WHERE id='g'").get());
 await manageMember(env,'a','g',{action:'dissolve'});
 for(const table of ['group_members','meeting_polls','task_candidates','group_invitations','group_announcements'])assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM ${table} WHERE group_id='g'`).get().n,0);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM meeting_votes').get().n,0);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM meeting_availability').get().n,0);
 assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM jobs WHERE state='pending'").get().n,0);
 assert.equal(sqlite.prepare("SELECT group_id FROM tasks WHERE id='done'").get().group_id,null);
 assert.ok(sqlite.prepare("SELECT * FROM groups WHERE id='other'").get());
});
