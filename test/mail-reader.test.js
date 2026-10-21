import test from 'node:test';
import assert from 'node:assert/strict';
import {safeMailUrl,compactPlainBody} from '../public/mail-reader.js';
test('mail links reject active content and allow only safe image formats',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,test','http://example.com/a','data:image/svg+xml;base64,AA','https://user:pass@example.com/a'])assert.equal(safeMailUrl(url,true),'');
 assert.equal(safeMailUrl('https://example.com/poster.png',true),'https://example.com/poster.png');
});
test('plain reader strips a leading forwarding header but keeps later discussion',()=>{
 const body='From: Staff\nSent: Monday\nTo: Student\nSubject: Event\n\n\nJoin us.\n\nFrom: historical note';
 assert.equal(compactPlainBody(body),'Join us.\n\nFrom: historical note');
 assert.equal(compactPlainBody('Please read this.\nFrom: A\nSent: Monday\nTo: B\nSubject: C\nBody'),'Please read this.\nFrom: A\nSent: Monday\nTo: B\nSubject: C\nBody');
});

test('translated forwarding headers are removed',()=>{assert.equal(compactPlainBody('从：Department <a@example.com>\n发送：Monday\n收件人：Student\n主题：Talk\n\nWelcome'),'Welcome');});
