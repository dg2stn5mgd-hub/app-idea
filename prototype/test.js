// Walks through the whole prototype in a browser: every tab, a planned ride with the meet-up, and sign-up.
// Run:  NODE_PATH=$(npm root -g) node prototype/test.js   (needs Playwright)
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const txt = async sel => (await p.textContent(sel)).replace(/\s+/g, ' ').trim();
  // Existing user: every tab
  await p.goto('' + require('url').pathToFileURL(__dirname).href + '/index.html');
  assert.match(await txt('.map-meta'), /min/);
  await p.click('[data-tab="4"]'); assert.match(await txt('main'), /Waved at you/);
  await p.click('[data-sec="ride"]'); assert.ok(await p.$('.fold.open.anim'), 'fold opens with animation');
  await p.click('[data-tab="12"]'); assert.match(await txt('main'), /Met before/);
  await p.click('[data-chat]'); await p.fill('.composer input', 'hello'); await p.click('.send-btn');
  await p.waitForTimeout(1900); assert.ok((await p.$$('.bubble')).length >= 3, 'message sent and replied');
  await p.click('[data-tab="8"]'); assert.match(await txt('main'), /rides/);
  await p.click('[data-mfold="friends"]'); assert.match(await txt('main'), /Zhi Hao/);
  await p.click('[data-tab="10"]'); assert.match(await txt('.stats'), /rides.*friends.*on your ride/);
  await p.click('.set-row[data-go="2"]'); assert.match(await txt('main'), /What do you like talking about/);
  // Tab bubble sits in the current tab
  await p.click('[data-tab="0"]'); assert.ok(await p.$('.tab[aria-current="page"] .tab-bubble'));
  // Plan a ride and run the whole meet-up in navigation
  const name = await p.evaluate(() => { const m = findMatches(state.commute).out[0]; state.waves[m.p.n] = 'mutual'; state.planFor = m.p.n; state.plan = null; go(5); return m.p.n; });
  await p.fill('#spot', 'Blue cap'); await p.click('[data-confirm]');
  assert.match(await txt('.ticket'), new RegExp(name.split(' ')[0]));
  await p.click('[data-startride]');
  for (let k = 0; k < 40 && !(await p.$('[data-navmet]')); k++) await p.waitForTimeout(300);
  await p.click('[data-navmet]'); await p.waitForTimeout(2200);
  for (let k = 0; k < 60 && !(await p.$('[data-navrate]')); k++) await p.waitForTimeout(300);
  await p.click('[data-navrate]'); assert.match(await txt('main h2'), /How did it go/);
  await p.click('[data-fb="rate"][data-val="great"]'); await p.click('[data-submit]');
  // New user: sign-up ends in a full demo
  await p.goto('' + require('url').pathToFileURL(__dirname).href + '/new-user.html');
  await p.click('text=Create my account');
  await p.fill('#ob-phone', '91234567'); await p.click('[data-obnext="21"]');
  await p.fill('#ob-otp', '123456'); await p.click('[data-obnext="22"]');
  await p.fill('#ob-name', 'Issac'); await p.fill('#ob-birthday', '1993-03-14'); await p.dispatchEvent('#ob-birthday', 'change');
  await p.selectOption('#ob-schoolType', 'Working'); await p.click('[data-obnext="23"]');
  await p.click('[data-obnext="24"]');
  for (const x of ['K-drama', 'Fitness', 'Reading']) await p.click(`[data-interest="${x}"]`);
  await p.click('[data-obnext="25"]'); await p.click('[data-obnext="26"]'); await p.check('#ob-agree'); await p.click('[data-obnext="27"]'); await p.click('[data-finish]');
  assert.match(await txt('main'), /Waved at you/);
  await p.click('[data-tab="10"]'); assert.match(await txt('main'), /Issac/);
  assert.deepEqual(errors, []);
  console.log('All app checks passed.');
  await b.close();
})().catch(e => { console.log('FAILED:', e.message); process.exit(1); });
