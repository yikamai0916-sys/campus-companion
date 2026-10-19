// Read-only deployment smoke test. Never send account cookies or create records.
import assert from 'node:assert/strict';
const origin = new URL(process.argv[2] || 'https://campus-companion.campus-companion.workers.dev').origin;
const checks = [
  ['/', 200],
  ...['settings','tasks','mail','groups'].map(view => [`/?view=${view}`, 302]),
  ...['profile','tasks','messages','groups','invitations','mail-suggestions'].map(path => [`/api/${path}`, 401]),
];
for (const [path, expected] of checks) {
  const response = await fetch(origin + path, {redirect: 'manual', signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, expected, `${path}: unexpected status`);
  if (expected === 302) assert.equal(response.headers.get('location'), origin + '/');
  if (expected === 401) {
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Object.keys(await response.json()), ['error']);
  }
  console.log(`PASS ${path} (${expected})`);
}
