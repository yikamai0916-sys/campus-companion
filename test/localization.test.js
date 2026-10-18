import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {meetingTask,reminderPayload} from '../src/display.js';
import {serverMessage,normalizeLocale} from '../src/errors.js';
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
test('server error messages localize per request locale',()=>{
 assert.equal(serverMessage('邮箱或密码不正确','zh-CN'),'邮箱或密码不正确');
 assert.equal(serverMessage('邮箱或密码不正确','zh-TW'),'電郵或密碼不正確');
 assert.equal(serverMessage('邮箱或密码不正确','en'),'Incorrect email or password');
 assert.equal(serverMessage('邮箱或密码不正确',undefined),'邮箱或密码不正确');
 // Hong Kong wording is used for Traditional: 電郵 / 帳戶 / 用戶, never 郵箱/帳號/使用者
 assert.equal(serverMessage('该账号尚未设置密保问题，请登录后设置','zh-TW'),'該帳戶尚未設定密保問題，請登入後設定');
 assert.equal(serverMessage('请先完成或拒绝该成员的未完成分工','zh-TW'),'請先完成或拒絕該成員的未完成分工');
 // parameterized templates
 assert.equal(serverMessage('小组名称需为 1–80 个字符','en'),'Group name must be 1–80 characters');
 assert.equal(serverMessage('会议名称需为 1–120 个字符','zh-TW'),'會議名稱需為 1–120 個字元');
 assert.equal(serverMessage('Outlook 请求失败（401），稍后重试或重新连接','en'),'Outlook request failed (401). Retry later or reconnect.');
 // unknown messages pass through
 assert.equal(serverMessage('some internal error','en'),'some internal error');
 assert.equal(normalizeLocale('fr'),'zh-CN');
});
