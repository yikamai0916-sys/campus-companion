import {hash} from './security.js';
// Cache writes are conditional on the exact message incarnation read before work.
export const messageGeneration=async(env,user,id)=>(await env.DB.prepare('SELECT cache_generation FROM messages WHERE user_id=? AND id=?').bind(user,id).first())?.cache_generation;
export async function readMailCache(env,user,id,generation,kind,locale,variant){
 if(!generation)return null;
 return (await env.DB.prepare('SELECT c.value FROM mail_cache c JOIN messages m ON m.user_id=c.user_id AND m.id=c.message_id AND m.cache_generation=c.generation WHERE c.user_id=? AND c.message_id=? AND c.generation=? AND c.kind=? AND c.locale=? AND c.variant=? AND c.expires>?').bind(user,id,generation,kind,locale,variant,Date.now()).first())?.value||null;
}
export async function writeMailCache(env,user,id,generation,kind,locale,variant,value){
 if(!generation)return false;
 const days=Math.min(7,Math.max(1,Number(env.MAIL_CACHE_DAYS)||7)),now=Date.now();
 const result=await env.DB.prepare('INSERT INTO mail_cache(user_id,message_id,generation,kind,locale,variant,value,created,expires) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM messages WHERE user_id=? AND id=? AND cache_generation=?) ON CONFLICT(user_id,message_id,kind,locale,variant) DO UPDATE SET generation=excluded.generation,value=excluded.value,created=excluded.created,expires=excluded.expires').bind(user,id,generation,kind,locale,variant,value,now,now+days*86400000,user,id,generation).run();
 return result.meta.changes>0;
}
export async function cleanExpiredMailCache(env){
 await env.DB.prepare('DELETE FROM kv WHERE key IN (SELECT key FROM legacy_mail_cache_expiry WHERE expires<=? LIMIT 100)').bind(Date.now()).run();
 await env.DB.prepare('DELETE FROM legacy_mail_cache_expiry WHERE key IN (SELECT e.key FROM legacy_mail_cache_expiry e LEFT JOIN kv k ON k.key=e.key WHERE k.key IS NULL LIMIT 100)').run();
 await env.DB.prepare('DELETE FROM mail_cache WHERE rowid IN (SELECT rowid FROM mail_cache WHERE expires<=? LIMIT 100)').bind(Date.now()).run();
}

export async function deleteMailData(env,user,id){
 const digest=await hash(id);
 const bases=['zh-CN','zh-TW','en'].flatMap(locale=>[1,2,3,4,5,6].map(version=>'fulltrans:v'+version+':'+locale+':'+user+':'+digest));
 const prefixes=bases.map(base=>base+':');
 const exact=[...bases,...['zh-CN','zh-TW','en'].flatMap(locale=>[1,2,3,4,5].flatMap(version=>{const key='brief-v'+version+':'+user+':'+locale+':'+digest;return [key,'brief-retry:'+key];}))];
 await env.DB.batch([
  ...prefixes.map(prefix=>env.DB.prepare('DELETE FROM kv WHERE substr(key,1,?)=?').bind(prefix.length,prefix)),
  ...exact.map(key=>env.DB.prepare('DELETE FROM kv WHERE key=?').bind(key)),
  env.DB.prepare('DELETE FROM messages WHERE user_id=? AND id=?').bind(user,id)
 ]);
}
