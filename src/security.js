export const enc = new TextEncoder();
export const b64 = a=>btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
export const unb64 = s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export const random = ()=>b64(crypto.getRandomValues(new Uint8Array(32)));
export const hash = async s=>b64(await crypto.subtle.digest('SHA-256',enc.encode(s)));
export async function verifyPassword(password, stored) {
  if(!stored||typeof password!=='string'||password.length>256)return false;
  const [salt,expected]=stored.split('.'); if(!salt||!expected)return false;
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  const actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(salt),iterations:100000,hash:'SHA-256'},key,256));
  const target=unb64(expected); let diff=actual.length^target.length;
  for(let i=0;i<actual.length;i++)diff|=actual[i]^(target[i]??0);
  return diff===0;
}
export async function makePasswordHash(password) {
  if(typeof password!=='string'||password.length<12||password.length>256)throw new Error('新密码需为 12–256 字符');
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  const derived=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},key,256);
  return b64(salt)+'.'+b64(derived);
}
export async function makeAnswerHash(answer) {
  const normalized=String(answer||'').trim().toLocaleLowerCase('zh-CN');
  if(normalized.length<2||normalized.length>200)throw new Error('密保答案需为 2–200 个字符');
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey('raw',enc.encode(normalized),'PBKDF2',false,['deriveBits']);
  const derived=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},key,256);
  return b64(salt)+'.'+b64(derived);
}
export const verifyAnswer=(answer,stored)=>verifyPassword(String(answer||'').trim().toLocaleLowerCase('zh-CN'),stored);
async function aes(secret) {
  if(!secret||unb64(secret).length!==32)throw new Error('缺少令牌加密密钥');
  return crypto.subtle.importKey('raw',unb64(secret),'AES-GCM',false,['encrypt','decrypt']);
}
export async function seal(data,secret) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},await aes(secret),enc.encode(JSON.stringify(data))));
}
export async function unseal(data,secret) {
  const [iv,cipher]=data.split('.');
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},await aes(secret),unb64(cipher))));
}
