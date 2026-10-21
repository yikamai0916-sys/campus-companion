import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSubject,validateBrief,attachBriefs,parseBriefResponse,isEnglishBrief} from '../src/mail-briefs.js';
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
