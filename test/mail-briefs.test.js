import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSubject,validateBrief,attachBriefs,parseBriefResponse,isEnglishBrief,fallbackBrief,correctLingnanBrief,readBrief} from '../src/mail-briefs.js';
test('forward and reply chains are removed, internal colons preserved',()=>{
 assert.equal(cleanSubject('FW: Re: Fwd: Budget: update'),'Budget: update');
});
test('summary retains only points/actions supported by source excerpts',()=>{
 const source='Your exchange plan is still under review. Please send the revised plan by Friday.';
 const b=validateBrief({title:'Exchange plan needs revision',titleEvidence:'Your exchange plan is still under review.',topic:'Exchange planning',points:[{text:'Review is pending.',evidence:'plan is still under review'},{text:'Approved!',evidence:'approved by the dean'}],actions:[{text:'Send revised plan by Friday.',evidence:'send the revised plan by Friday'},{text:'Pay 500 dollars',evidence:'Pay 500 dollars'}]},source);
 assert.equal(b.points.length,1);assert.equal(b.actions.length,1);assert.equal(b.topic,'Exchange planning');
 assert.throws(()=>validateBrief({title:'Approved',titleEvidence:'approved',points:[]},source));
});
test('brief cache is scoped to account and language',async()=>{
 const keys=[];const env={DB:{prepare(){return {bind(k){keys.push(k);return this},async first(){return null}}}}};
 await attachBriefs(env,'alice','en',[{id:'same',subject:'FW: update'}]);
 await attachBriefs(env,'bob','en',[{id:'same',subject:'FW: update'}]);
 await attachBriefs(env,'alice','zh-CN',[{id:'same',subject:'FW: update'}]);
 assert.equal(new Set(keys).size,3);
});

test('AI responses support structured objects and fenced JSON',()=>{
 const value={title:'Update'};assert.equal(parseBriefResponse(value),value);assert.deepEqual(parseBriefResponse('```json\n'+JSON.stringify(value)+'\n```'),value);
});

test('English brief cache rejects Chinese content',()=>{
 const valid={title:'Registration closes Friday',topic:'Registration',points:[{text:'Submit the form by Friday.'}],actions:[]};
 assert.equal(isEnglishBrief(valid),true);
 assert.equal(isEnglishBrief({...valid,title:'报名周五截止'}),false);
 assert.equal(isEnglishBrief({...valid,points:[{text:'请周五前提交。'}]}),false);
});

test('brief fallback uses localized stored summary and removes forwarded headers',()=>{
 const brief=fallbackBrief({englishSubject:'FW: Vaccination campaign',englishBody:'________________________________\nFrom: Student Affairs\nSent: Today\nTo: Student\nSubject: Campaign\n\nThe event takes place on 5 November.',row:{summary:'疫苗接种活动将于11月5日在校园举行。'}},'zh-CN');
 assert.equal(brief.fallback,true);
 assert.match(brief.points[0].text,/疫苗接种活动/);
 assert.doesNotMatch(brief.points[0].text,/From:|Sent:/);
 assert.ok(isEnglishBrief(fallbackBrief({englishSubject:'Reminder',englishBody:'Please submit the form by Friday.'},'en')));
});


test('Lingnan brief names are corrected only with original-source context',()=>{
 const brief={title:'凌云大学图书馆安排',topic:'凌雲大學',points:[{text:'凌云大学师生可预约',evidence:'Lingnan University Library'}],actions:[{text:'联系凌雲大學',evidence:'Contact the library'}]};
 const cn=correctLingnanBrief(brief,'zh-CN');
 assert.equal(cn.title,'岭南大学图书馆安排');assert.equal(cn.points[0].text,'岭南大学师生可预约');assert.equal(cn.actions[0].text,'联系岭南大学');assert.equal(cn.points[0].evidence,'Lingnan University Library');
 assert.equal(correctLingnanBrief(brief,'zh-TW').title,'嶺南大學图书馆安排');
 const unrelated={...brief,points:[{text:'凌云大学师生',evidence:'A different university'}]};
 assert.equal(correctLingnanBrief(unrelated,'zh-CN').title,unrelated.title);
 assert.equal(correctLingnanBrief(brief,'en').title,brief.title);
 assert.equal(correctLingnanBrief(brief,'zh-CN','原文提到凌云大学').title,brief.title);
});

test('cached brief corrects a school name using account-scoped original metadata',async()=>{
 const brief={title:'凌云大学图书馆安排',topic:'通知',points:[{text:'凌云大学师生',evidence:'Library access during examinations'}],actions:[]};let metadataArgs=[];
 const env={DB:{prepare(sql){return {bind(...args){this.args=args;return this},async all(){return {results:[]}},async first(){if(sql.includes('FROM kv'))return {value:JSON.stringify(brief)};if(sql.includes('FROM users'))return {};if(sql.includes('FROM messages')){metadataArgs=this.args;return {sender:'Lingnan University Library',subject:'Library access',origin:''}}return null}}}}};
 const result=await readBrief(env,'user1','zh-CN','mail1');assert.equal(result.title,'岭南大学图书馆安排');assert.deepEqual(metadataArgs,['mail1','user1']);
});
