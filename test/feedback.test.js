import test from 'node:test';
import assert from 'node:assert/strict';
import {requestJSON,validEmail} from '../public/feedback.js';

test('email validation rejects incomplete domains accepted by native email inputs',()=>{
  assert.equal(validEmail('kaiqiou@outlook'),false);
  assert.equal(validEmail(' person@outlook.com '),true);
  assert.equal(validEmail('person@@outlook.com'),false);
  assert.equal(validEmail('person @outlook.com'),false);
});
test('network errors explain read failure and uncertain write results',async()=>{
  const fail=async()=>{throw new TypeError('Failed to fetch');};
  await assert.rejects(requestJSON('/api/tasks',{},fail),/无法连接服务器/);
  await assert.rejects(requestJSON('/api/tasks',{method:'POST'},fail),/操作结果尚未确认/);
});
test('timeouts finish the request without retrying a mutation',async()=>{
  let calls=0;
  const hang=(_,options)=>{calls++;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));};
  await assert.rejects(requestJSON('/api/tasks',{method:'POST'},hang,5),/请求超时/);
  assert.equal(calls,1);
});
test('credential failures and expired sessions retain distinct error codes',async()=>{
  await assert.rejects(requestJSON('/api/password',{},async()=>Response.json({error:'当前密码不正确'},{status:401})),e=>e.status===401&&!e.code);
  await assert.rejects(requestJSON('/api/tasks',{},async()=>Response.json({error:'请先登录',code:'SESSION_EXPIRED'},{status:401})),e=>e.code==='SESSION_EXPIRED');
});
test('HTML error pages are never presented as raw server responses',async()=>{
  await assert.rejects(requestJSON('/api/tasks',{},async()=>new Response('<h1>server diagnostic</h1>',{status:502})),/服务返回了异常响应/);
});
