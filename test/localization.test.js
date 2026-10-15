import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {meetingTask,reminderPayload} from '../src/display.js';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const sandbox={};vm.runInNewContext(source.slice(0,source.indexOf('function translateTextNodes()'))+';this.translate=(text,language)=>{locale=language;return translateCopy(text)};this.copy=TEXTS;',sandbox);
test('all interface dictionary entries round trip through three languages; blank text stays blank',()=>{
 for(const [cn,variants] of Object.entries(sandbox.copy)){
  assert.equal(sandbox.translate(cn,'zh-CN'),cn);
  assert.equal(sandbox.translate(cn,'zh-TW'),variants.at(-2));
  assert.equal(sandbox.translate(cn,'en'),variants.at(-1));
 }
 for(const language of ['zh-CN','zh-TW','en'])assert.equal(sandbox.translate(' \n ',language),' \n ');
 assert.equal(sandbox.translate('校園清單','zh-CN'),'校园清单');
 assert.equal(sandbox.translate('截止时间（香港）','en'),'Due time (Hong Kong)');
});
test('generated meeting tasks and push labels follow the account locale',()=>{
 const original={id:'t',title:'参加会议：Demo',due:Date.UTC(2026,10,1)};
 const english=meetingTask(original,{name:'Demo'},'en');assert.equal(english.title,'Attend meeting: Demo');
 assert.equal(/[\u4e00-\u9fff]/.test(reminderPayload(english,'en').body),false);
 assert.equal(meetingTask(original,{name:'Demo'},'zh-TW').title,'參加會議：Demo');
});
