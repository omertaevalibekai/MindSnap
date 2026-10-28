const { chromium } = require('playwright');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

(async () => {
  require('node:fs').mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});
  const extension = path.resolve(__dirname, '../dist');
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end('<!doctype html><title>Cell biology study</title><article><h1>Cell biology study</h1><h2>Cells and DNA</h2><p>Cells are the basic units of life. DNA carries genetic information. The nucleus protects the genome and coordinates cellular processes.</p><h2>Energy</h2><p>Mitochondria convert nutrients into usable energy. Cells use ATP to power transport, repair and growth. Membranes control exchange with the environment.</p></article>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let context;
  try {
    context = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    const sw = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = sw.url().split('/')[2];
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/article`);
    const parsed = await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return chrome.tabs.sendMessage(tabs[0].id, { type: 'PARSE_PAGE' });
    });
    assert.match(parsed.text, /DNA/);
    const panel = await context.newPage();
    const errors=[];
    panel.on('pageerror', e => errors.push(e.message));
    await panel.goto(`chrome-extension://${id}/src/sidepanel/index.html`);
    await panel.waitForFunction(() => document.body.innerText.trim().length > 20);
    assert.ok((await panel.locator('body').innerText()).length > 20);
    const result = await panel.evaluate(async parsedPage => chrome.runtime.sendMessage({type:'SNAP_PAGE',payload:{outputMode:'mindmap',depth:2,parsedPage}}), parsed);
    assert.equal(result.ok,true,JSON.stringify(result));
    const state = await panel.evaluate(() => chrome.runtime.sendMessage({type:'GET_STORAGE'}));
    assert.equal(state.ok,true);
    console.log('Storage collections:', Object.keys(state.result));
    assert.ok(JSON.stringify(state.result).includes('Cell biology study'));
    await panel.reload();
    const persisted = await panel.evaluate(() => chrome.runtime.sendMessage({type:'GET_STORAGE'}));
    assert.ok(JSON.stringify(persisted.result).includes('Cell biology study'));
    await panel.screenshot({path:path.resolve(__dirname,'../test-results/extension.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({browser:context.browser().version(),extension:id,checks:['MV3 service worker','content script parsing','sidepanel document rendering','local mindmap generation','chrome.storage persistence after reload'],pageErrors:errors}));
  } finally {
    if(context) await context.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
