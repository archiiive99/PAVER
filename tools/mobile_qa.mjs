import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PAGE_URL || 'http://127.0.0.1:53798';
const output = process.env.QA_OUTPUT || '/tmp/paver-mobile-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const [width, height, theme] of [[320,740,'light'],[390,844,'light'],[390,844,'dark'],[430,932,'light'],[844,390,'light'],[768,1024,'light'],[1440,1000,'light']]) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(t => localStorage.setItem('paver-theme', t), theme);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.chart-host svg');
    const prefix = `${width}-${height}-${theme}`;
    await page.screenshot({ path: `${output}/${prefix}-hero.png` });
    const sections = await page.locator('main section[id]').evaluateAll(es => es.map(e => e.id));
    for (const id of sections) {
      await page.locator(`#${id}`).evaluate(e => scrollTo({ top: e.getBoundingClientRect().top + scrollY - 64, behavior: 'instant' }));
      await page.waitForTimeout(100);
      const state = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert(state.scroll <= state.width + 1, `${prefix} ${id} document overflow`);
      await page.screenshot({ path: `${output}/${prefix}-${id}.png` });
    }
    if (width <= 700) {
      const charts = await page.locator('.chart-host').evaluateAll(es => es.map(e => {
        e.scrollLeft = e.scrollWidth;
        return { id: e.id, width: e.clientWidth, scroll: e.scrollWidth, end: e.scrollLeft, overflow: getComputedStyle(e).overflowX };
      }));
      for (const c of charts) assert(c.overflow === 'auto' && (c.scroll <= c.width || c.end > 0), `${c.id} not scrollable`);
    }
    if (width < 1000) {
      await page.locator('#menu').click();
      assert(await page.locator('#nav').isVisible());
      const nav = await page.locator('#nav').boundingBox();
      assert(nav.x >= 0 && nav.x + nav.width <= width + 1);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#menu').getAttribute('aria-expanded'), 'false');
      await page.locator('#menu').click();
      await page.locator('#nav a[href="#scenes"]').click();
      assert.equal(await page.locator('#menu').getAttribute('aria-label'), 'Open navigation');
    }
    await page.locator('#qvStage').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#qvStage video')?.readyState >= 2);
    await page.locator('#qvStage video').evaluate(v => v.pause());
    await page.locator('#qvPlay').click();
    await page.waitForTimeout(400);
    assert(await page.locator('#qvStage video').evaluate(v => !v.paused && v.currentTime > 0));
    await page.locator('#qvPlay').click();
    await page.locator('#qvTrack').evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const track = await page.locator('#qvTrack').boundingBox();
    await page.mouse.click(track.x + track.width * .6, track.y + track.height / 2);
    assert(await page.locator('#qvStage video').evaluate(v => Math.abs(v.currentTime / v.duration - .6) < .08));
    const card = page.locator('.card').filter({ has: page.locator('#chartHorizon') });
    await card.getByRole('tab', { name: 'Table', exact: true }).click();
    assert(await card.locator('[data-pane="table"]').last().isVisible());
    await card.getByRole('tab', { name: 'Chart', exact: true }).click();
    if (width === 390 && theme === 'light') {
      const canvas = page.locator('.wvcanvas').first();
      await canvas.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {
        const c = document.querySelector('.wvcanvas');
        return c && c.width > 0 && c.height > 0;
      });
      if (await page.locator('#wvPlay').evaluate(e => e.classList.contains('playing'))) await page.locator('#wvPlay').click();
      await canvas.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const colors = await canvas.evaluate(c => {
        const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        const unique = new Set();
        for (let i = 0; i < pixels.length; i += 160) unique.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
        return unique.size;
      });
      assert(colors > 10, '3D canvas must contain real rendered geometry');
      const before = await canvas.evaluate(c => c.toDataURL());
      const box = await canvas.boundingBox();
      const cdp = await page.context().newCDPSession(page);
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x-30, y, id: 1 }, { x: x+30, y, id: 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x-65, y, id: 1 }, { x: x+65, y, id: 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(100);
      assert.notEqual(await canvas.evaluate(c => c.toDataURL()), before, 'pinch must change the rendered viewpoint');
      assert.equal(await canvas.evaluate(c => c.classList.contains('grabbing')), false);
      await page.screenshot({ path: `${output}/${prefix}-pinch.png` });
      await cdp.detach();
    }
    const themeBefore = await page.locator('html').getAttribute('data-theme');
    await page.locator('#theme').click();
    assert.notEqual(await page.locator('html').getAttribute('data-theme'), themeBefore);
    assert.deepEqual(errors, []);
    results.push({ width, height, theme, sections: sections.length, errors });
    console.log(prefix, 'PASS');
    await page.close();
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
