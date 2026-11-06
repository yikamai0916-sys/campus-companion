import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPreferredName, nameAliases, applyPreferredNameToFields } from '../src/names.js';
import { extractiveSummary, shapeDigestItem, shapeDigestRecord, normalizeDigestRecord, stripUrls, stripMailHeaders } from '../src/digest-format.js';

test('preferred name replaces known wrong transliterations', () => {
  assert.equal(applyPreferredName('用户马毅凯参与交流项目', '马艺恺'), '用户马艺恺参与交流项目');
  assert.equal(applyPreferredName('通知 Ma Yikai 同学', '马艺恺'), '通知 马艺恺 同学');
  assert.ok(nameAliases('马艺恺').includes('马毅凯'));
  assert.equal(applyPreferredName('保持原样', ''), '保持原样');
  assert.equal(applyPreferredName('没有错误名字', '马艺恺'), '没有错误名字');
});

test('preferred name applies across digest fields', () => {
  const row = applyPreferredNameToFields({
    subject: '给马毅凯的通知',
    summary: '马艺凯请留意截止时间',
    action: '无需操作'
  }, '马艺恺');
  assert.equal(row.subject, '给马艺恺的通知');
  assert.equal(row.summary, '马艺恺请留意截止时间');
});

test('extractive summary stays short and drops URLs', () => {
  const summary = extractiveSummary(
    'FW: Seminar',
    '心理学系举办讲座。https://outlook.live.com/owa/?ItemID=ABC123&exlong=1 请有兴趣的同学参加。更多细节见附件。'
  );
  assert.ok(!summary.includes('http'));
  assert.ok(summary.length <= 140);
  assert.match(summary, /讲座/);
});

test('extractive summary removes forwarded mail headers before showing quick view', () => {
  const body='________________________________\nFrom: Finance Office <finance@example.edu>\nSent: Wednesday, October 21, 2026 9:22 AM\nTo: Student <student@example.edu>\nSubject: Reminder\n\nPlease submit the form by 5 November.';
  const summary=extractiveSummary('Reminder',body);
  assert.match(summary,/Please submit the form/);
  assert.doesNotMatch(summary,/From:|Sent:|Subject:|finance@example/);
  assert.equal(stripMailHeaders(body),'Please submit the form by 5 November.');
  const legacyHeader='________________________ From: Career News <career@example.edu> Sent: Thursday, October 29, 2026 8:06 PM';
  assert.equal(stripMailHeaders(legacyHeader),'');
  assert.equal(extractiveSummary('Career news',legacyHeader), 'Career news');
  const legacy=normalizeDigestRecord({title:'2026-10-29 晚间补充',created:1,items:[{subject:legacyHeader,summary:legacyHeader}]});
  assert.equal(legacy.items[0].subject,'邮件内容暂不可用');
  assert.equal(legacy.items[0].summary,'邮件内容暂不可用');
});

test('digest items never include raw outlook URLs', () => {
  const item = shapeDigestItem({
    id: 'm1',
    subject: 'Timesheet reminder',
    sender: 'hr@ln.edu.hk',
    origin: 'HR',
    category: 1,
    received: 1,
    summary: '请在周五前提交工时表 https://outlook.live.com/owa/?ItemID=xyz',
    action: '请提交',
    url: 'https://outlook.live.com/owa/?ItemID=xyz'
  });
  assert.equal(item.id, 'm1');
  assert.ok(!JSON.stringify(item).includes('outlook.live.com'));
  const record = shapeDigestRecord({ title: '2026-10-16 学校邮件日报', created: 2, items: [item] });
  assert.equal(record.items.length, 1);
  assert.ok(!record.body.includes('http'));
});

test('legacy digest bodies are normalised into cards without URLs', () => {
  const legacy = normalizeDigestRecord({
    title: '2026-10-16 晚间补充',
    created: 3,
    body: 'FW: Seminar\n发件人：psy@ln.edu.hk\n来源：心理学系\n心理学系举办讲座\n无需操作\nhttps://outlook.live.com/owa/?ItemID=LONG\n\nAnother mail\n发件人：a@b.c\n来源：未知\n简短摘要\n请查看\nhttps://outlook.live.com/owa/?ItemID=2'
  });
  assert.equal(legacy.items.length, 2);
  assert.ok(legacy.items.every(item => !stripUrls(item.summary).includes('http')));
  assert.ok(!legacy.body.includes('outlook.live.com'));
});
