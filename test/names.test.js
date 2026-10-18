import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName,tokenKey,nameFormKeys,buildAliasRules,applyNameAliases,applyPreferredName,applyPreferredNameToFields,extractSenderName,suggestAliasVariants } from '../src/names.js';

test('normalization is case-, order- and spacing-insensitive',()=>{
  assert.equal(normalizeName('MA Yikai'),'ma yikai');
  assert.equal(tokenKey('MA Yikai'),tokenKey('Yikai MA'));
  assert.equal(tokenKey('MAYIKAI'),tokenKey('mayikai'));
  assert.equal(normalizeName('Yikai.MA'),'yikai ma');
});

test('nameFormKeys covers reversed and compacted spellings',()=>{
  const keys=nameFormKeys('MA Yikai');
  assert.ok(keys.has('ma yikai'));
  assert.ok(keys.has('mayikai'));
  assert.ok(keys.has('yikai ma'));
  assert.ok(keys.has('yikaima'));
});

test('buildAliasRules merges user aliases and the legacy preferred name',()=>{
  const rules=buildAliasRules([{alias:'MA Yikai',zhName:'马艺恺'},{alias:'YIKAI MA',zhName:'馬藝愷'}],'');
  assert.equal(rules.length,2);
  const ma=rules.find(r=>r.zhName==='马艺恺');
  assert.ok(ma.patterns.includes('ma yikai'));
  assert.ok(ma.patterns.includes('mayikai'));
  assert.ok(ma.patterns.includes('yikai ma'));
  // legacy preferred name contributes known variants (Ma Yi Kai etc.)
  const legacy=buildAliasRules('马艺恺');
  assert.ok(legacy.some(r=>r.patterns.includes('ma yi kai')));
});

test('applyNameAliases rewrites every written variant but never the mailbox prefix',()=>{
  const rules=buildAliasRules([{alias:'MA Yikai',zhName:'马艺恺'}]);
  assert.equal(applyNameAliases('From MA Yikai <mayikai@ln.edu.hk>',rules),'From 马艺恺 <mayikai@ln.edu.hk>');
  assert.equal(applyNameAliases('Yikai Ma sent it',rules),'马艺恺 sent it');
  assert.equal(applyNameAliases('sent by yikaima',rules),'sent by 马艺恺');
  assert.equal(applyNameAliases('MAYIKAI signed',rules),'马艺恺 signed');
  assert.equal(applyNameAliases('no alias here',rules),'no alias here');
});

test('applyPreferredNameToFields accepts rules arrays and legacy strings',()=>{
  const rules=buildAliasRules([{alias:'Yikai Ma',zhName:'马艺恺'}]);
  const row=applyPreferredNameToFields({subject:'Hi from Yikai Ma',sender:'Yikai Ma <yikaima@x.com>'},rules);
  assert.equal(row.subject,'Hi from 马艺恺');
  assert.equal(row.sender,'马艺恺 <yikaima@x.com>');
  const legacy=applyPreferredNameToFields({subject:'Ma Yi Kai wins'},'马艺恺');
  assert.equal(legacy.subject,'马艺恺 wins');
});

test('applyPreferredName keeps the single-value behaviour',()=>{
  assert.equal(applyPreferredName('contact 马毅凯 today','马艺恺'),'contact 马艺恺 today');
});

test('extractSenderName pulls the human name out of a sender field',()=>{
  assert.equal(extractSenderName('MA Yikai <mayikai@ln.edu.hk>'),'MA Yikai');
  assert.equal(extractSenderName('<mayikai@ln.edu.hk>'),'mayikai');
  assert.equal(extractSenderName('"Yikai Ma" <yikaima@x.com>'),'Yikai Ma');
  assert.equal(extractSenderName('mayikai@ln.edu.hk'),'mayikai');
});

test('suggestAliasVariants finds differently-written senders that match a known alias',()=>{
  const senders=['MA Yikai <ma@x.com>','Yikai Ma <yk@x.com>','mayikai <mk@x.com>','Someone Else <se@x.com>'];
  const suggestions=suggestAliasVariants(senders,[{alias:'MA Yikai',zhName:'马艺恺'}],'');
  const variants=suggestions.map(s=>s.variant.toLowerCase());
  assert.ok(variants.includes('yikai ma'));
  assert.ok(variants.includes('mayikai'));
  assert.ok(!variants.includes('someone else'));
  assert.ok(suggestions.every(s=>s.zhName==='马艺恺'));
});

test('no false positives on unrelated names',()=>{
  const rules=buildAliasRules([{alias:'MA Yikai',zhName:'马艺恺'}]);
  assert.equal(applyNameAliases('From Zhang Wei',rules),'From Zhang Wei');
  assert.equal(applyNameAliases('Mai Yika bookstore',rules),'Mai Yika bookstore');
});
