import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './helpers/database.js';
import {translateFullBody,setKV} from '../src/mail.js';
import {checkBriefScript,validateBrief} from '../src/mail-briefs.js';
import {messageGeneration,readMailCache,writeMailCache,deleteMailData,cleanExpiredMailCache} from '../src/mail-cache.js';
import {hash} from '../src/security.js';
import {readFileSync} from 'node:fs';
function fixture(){const {DB,sqlite}=database();for(const u of ['a','b']){sqlite.prepare("INSERT INTO users(id,email,password_hash,created) VALUES(?,?,?,0)").run(u,u+'@example.com','unused');sqlite.prepare("INSERT INTO messages(id,user_id,subject,received,sender,origin,category,summary,action,url,quality) VALUES('mail',?,'Notice',0,'Office','School',2,'Summary','','','')").run(u);}return {DB,sqlite,ENABLE_AI:'true'};}
test('T05 cached translation remains readable when another account triggers cooldown',async()=>{
 const env=fixture();let calls=0;env.AI={run:async()=>{if(++calls===1)return {response:'缓存译文'};throw Error('quota');}};
 assert.equal(await translateFullBody(env,'a','zh-CN','mail','Actual body'),'缓存译文');
 assert.equal(await translateFullBody(env,'b','zh-CN','mail','Actual body'),null);
 assert.equal(await translateFullBody(env,'a','zh-CN','mail','Actual body'),'缓存译文');assert.equal(calls,2);
});
test('T06 common characters and names do not invalidate grounded summaries',async()=>{
 for(const [locale,text] of [['zh-CN','请通过指定渠道提交报告'],['zh-TW','請通過指定渠道提交報告'],['zh-CN','道明 University 活动安排'],['zh-TW','道明 University 活動安排']]){
  const brief=validateBrief({title:text,titleEvidence:'Notice',topic:'School',points:[{text,evidence:'Summary'}],actions:[]},'Notice Summary');
  assert.equal(checkBriefScript(brief,locale).scriptWarning,false);
 }
});
test('T07 deletion during translation cannot recreate cache even after reimport',async()=>{
 const env=fixture();let finish;env.AI={run:()=>new Promise(resolve=>finish=resolve)};
 const pending=translateFullBody(env,'a','zh-CN','mail','Actual body');
 while(!finish)await new Promise(resolve=>setImmediate(resolve));
 env.sqlite.prepare("DELETE FROM messages WHERE user_id='a'").run();
 env.sqlite.prepare("INSERT INTO messages(id,user_id,subject,received,sender,origin,category,summary,action,url,quality) SELECT id,'a',subject,received,sender,origin,category,summary,action,url,quality FROM messages WHERE user_id='b'").run();
 finish({response:'Deleted translation'});assert.equal(await pending,null);
 assert.equal(env.sqlite.prepare("SELECT COUNT(*) n FROM mail_cache WHERE user_id='a'").get().n,0);
});
test('T07 expiry, scoped deletion and legacy cleanup preserve independent tasks and other accounts',async()=>{
 const env=fixture();
 for(const u of ['a','b'])await writeMailCache(env,u,'mail',await messageGeneration(env,u,'mail'),'translation','zh-CN','body','Translation');
 const generation=await messageGeneration(env,'a','mail');
 env.sqlite.prepare("UPDATE mail_cache SET expires=0 WHERE user_id='a'").run();
 assert.equal(await readMailCache(env,'a','mail',generation,'translation','zh-CN','body'),null);
 await cleanExpiredMailCache(env);assert.equal(env.sqlite.prepare("SELECT COUNT(*) n FROM mail_cache").get().n,1);
 env.sqlite.exec("INSERT INTO tasks(id,title,notes,reminders,created,updated,user_id,source,source_id) VALUES('confirmed','Accepted task','Retained evidence','{}',0,0,'a','mail','mail')");
 env.sqlite.exec("INSERT INTO message_localizations(message_id,user_id,locale,subject,sender,origin,summary,action,quality,updated) VALUES('mail','a','en','Notice','Office','School','Summary','','',0)");
 const key='fulltrans:v6:zh-CN:a:'+await hash('mail')+':body';await setKV(env,key,'Legacy translation');await setKV(env,'unrelated','Keep');
 await deleteMailData(env,'a','mail');
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) n FROM message_localizations').get().n,0);
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) n FROM tasks').get().n,1);
 assert.equal(env.sqlite.prepare("SELECT COUNT(*) n FROM messages WHERE user_id='b'").get().n,1);
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) n FROM mail_cache').get().n,1);
 assert.equal(env.sqlite.prepare('SELECT value FROM kv WHERE key=?').get(key),undefined);
 assert.equal(env.sqlite.prepare("SELECT value FROM kv WHERE key='unrelated'").get().value,'Keep');
});

test('T06 mixed script degrades to a warning instead of losing the grounded summary',()=>{const brief={title:'這是课程安排',topic:'School',points:[],actions:[]};assert.equal(checkBriefScript(brief,'zh-CN').scriptWarning,true);});
test('0015 upgrades old local data without dropping tasks or unrelated KV values',async()=>{
 const {DB,sqlite}=database(14),env={DB};
 sqlite.exec("INSERT INTO messages(id,user_id,subject,received,sender,origin,category,summary,action,url,quality) VALUES('old','a','Notice',0,'Office','School',2,'Summary','','','')");
 await setKV(env,'fulltrans:v3:zh-CN:a:hash','Old private translation');await setKV(env,'fulltrans:cooldown','0');await setKV(env,'unrelated','Keep');
 sqlite.exec(readFileSync(new URL('../migrations/0015_mail_cache_lifecycle.sql',import.meta.url),'utf8'));
 assert.ok(await messageGeneration(env,'a','old'));
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM legacy_mail_cache_expiry').get().n,1);
 sqlite.exec('UPDATE legacy_mail_cache_expiry SET expires=0');await cleanExpiredMailCache(env);
 assert.equal(sqlite.prepare("SELECT value FROM kv WHERE key='fulltrans:v3:zh-CN:a:hash'").get(),undefined);
 assert.equal(sqlite.prepare("SELECT value FROM kv WHERE key='unrelated'").get().value,'Keep');
 assert.equal(sqlite.prepare("SELECT value FROM kv WHERE key='fulltrans:cooldown'").get().value,'0');
});
