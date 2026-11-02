/**
 * Headless DOM regression test for the frontend.
 * Executes index.html's inline script against a minimal DOM stub, then drives
 * the wallet button, demo buttons and network toggle.
 *
 * Run: node tests/ui.test.cjs [path-to-index.html]
 * No browser or network required.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = process.argv[2] || path.join(__dirname, '..', 'frontend', 'index.html');
const html = fs.readFileSync(path.resolve(file), 'utf8');

const results = [];
async function check(name, fn) {
  try { const detail = await fn(); results.push({ name, ok: true, detail }); }
  catch (e) { results.push({ name, ok: false, detail: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

/* ---------------- DOM stub ---------------- */
class El {
  constructor(id, tag) {
    this.id = id || '';
    this.tagName = (tag || 'div').toUpperCase();
    this._classes = new Set();
    this._text = '';
    this._html = '';
    this.children = [];
    this.dataset = {};
    this.attrs = {};
    this.style = {};
    this.listeners = {};
    this.disabled = false;
    this.hidden = false;
    this.parent = null;
    this.section = null;
  }
  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    const self = this;
    return {
      add(...c) { c.forEach(x => self._classes.add(x)); },
      remove(...c) { c.forEach(x => self._classes.delete(x)); },
      contains(c) { return self._classes.has(c); },
      toggle(c, force) {
        const on = force === undefined ? !self._classes.has(c) : !!force;
        if (on) self._classes.add(c); else self._classes.delete(c);
        return on;
      }
    };
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this._html = ''; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  click() { (this.listeners.click || []).forEach(fn => fn({ target: this, preventDefault() {} })); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  closest(sel) { return sel === 'section' ? this.section : null; }
  scrollIntoView() { this.scrolled = true; }
  appendChild(c) { this.children.push(c); c.parent = this; return c; }
  remove() { this.removed = true; }
}

function buildContext(opts) {
  const timers = [];
  let timerId = 1;
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const byId = {};
  ids.forEach(id => { byId[id] = new El(id); });
  // seed the text/state that the real HTML ships with
  if (byId['walletBtn']) byId['walletBtn'].textContent = 'Connect wallet';
  if (byId['cid']) byId['cid'].textContent = 'Mainnet 677';
  if (byId['cp']) byId['cp'].disabled = true;
  ['stat-premiums', 'stat-payouts', 'stat-balance'].forEach(id => { if (byId[id]) byId[id].textContent = '—'; });

  // containers that need a parent <section>
  ['pn', 'lg'].forEach(id => {
    const section = new El('', 'section');
    byId[id].section = section;
  });

  const net677 = new El('', 'button'); net677.dataset.n = '677';
  const net968 = new El('', 'button'); net968.dataset.n = '968';
  const main = new El('', 'main'); main._classes.add('main'); main._classes.add('lay-a');
  const body = new El('', 'body');
  const docListeners = {};

  const document = {
    readyState: 'loading',
    body,
    getElementById: id => byId[id] || null,
    querySelector(sel) {
      if (sel === 'main.main') return main;
      if (sel.startsWith('#')) return byId[sel.slice(1)] || null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel.includes('data-n')) return [net677, net968];
      return [];
    },
    createElement(tag) { return new El('', tag); },
    addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); }
  };
  document.addEventListener; // no-op keep

  const downloads = [];
  const toasts = () => (byId['bc-toast'] ? byId['bc-toast'].textContent : '');
  const toastClass = () => (byId['bc-toast'] ? byId['bc-toast'].className : '');

  const consoleLines = [];
  const sandbox = {
    console: {
      log: (...a) => consoleLines.push(a.join(' ')),
      warn: (...a) => consoleLines.push('WARN ' + a.join(' ')),
      error: (...a) => consoleLines.push('ERROR ' + a.join(' '))
    },
    document,
    location: { protocol: 'https:', origin: 'https://demo.local' },
    matchMedia: () => ({ matches: false }),
    setTimeout: (fn, ms) => { timers.push({ id: timerId, fn, ms }); return timerId++; },
    clearTimeout: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    Blob: class Blob { constructor(parts, opts) { this.parts = parts; this.opts = opts; } },
    URL: {
      createObjectURL(b) { sandbox.__blob = b; return 'blob:demo-trace'; },
      revokeObjectURL() {}
    },
    navigator: { clipboard: { writeText: async () => {} } },
    BigInt, Number, Object, String, JSON, Promise, Error, Math, Date
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  // ethers stub with deterministic reads
  sandbox.ethers = {
    JsonRpcProvider: class {
      constructor(url) { this.url = url; }
      async getBalance() { return 1200000000000000n; }
    },
    BrowserProvider: class {
      constructor(p) { this.provider = p; }
      async getSigner() { return { address: opts.account || '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01' }; }
      async getBalance() { return 1200000000000000n; }
    },
    Contract: class {
      constructor(ca, abi, runner) { this.target = ca; this.abi = abi; this.runner = runner; this.calls = []; }
      async totalPremiums() { this.calls.push('totalPremiums'); return 4200000000000000n; }
      async totalPayouts() { this.calls.push('totalPayouts'); return 0n; }
      async premiumBps() { this.calls.push('premiumBps'); return 300n; }
      connect() { return this; }
    }
  };

  if (opts.provider) {
    sandbox.ethereum = {
      requests: [],
      async request({ method }) {
        this.requests.push(method);
        if (method === 'eth_chainId') return '0x2a5';
        if (method === 'eth_requestAccounts') {
          if (opts.reject) { const e = new Error('User rejected the request'); e.code = 4001; throw e; }
          return [opts.account || '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'];
        }
        if (method === 'wallet_switchEthereumChain') return null;
        return null;
      },
      on() {}
    };
  }

  const ctx = vm.createContext(sandbox);
  const script = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)][0];
  if (!script) throw new Error('no inline script found');

  const api = {
    byId, main, net677, net968, downloads, timers, consoleLines, toasts, toastClass, document,
    get walletBtn() { return byId['walletBtn']; },
    fireReady() { (docListeners['DOMContentLoaded'] || []).forEach(fn => fn({})); },
    flush() { return new Promise(r => setTimeout(r, 5)); },
    runTimer(ms) {
      const due = timers.filter(t => t.ms <= ms);
      due.forEach(t => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); try { t.fn(); } catch (e) { throw e; } });
      return due.length;
    }
  };
  return { ctx, api, script: script[1] };
}

(async () => {
  /* ---------- scenario A: no wallet, no AppKit ---------- */
  const A = buildContext({});
  let loadError = null;
  try { vm.runInContext(A.script, A.ctx, { filename: 'inline.js' }); }
  catch (e) { loadError = e; }

  await check('loads without throwing', () => {
    assert(!loadError, loadError ? `${loadError.name}: ${loadError.message}` : '');
    return 'no exception';
  });

  await check('every getElementById reference resolves (with documented #cid fallback)', () => {
    const refs = [...new Set([...html.matchAll(/getElementById\("([^"]+)"\)/g)].map(m => m[1]))];
    const missing = refs.filter(id => !A.api.byId[id]);
    assert(missing.length === 0 || (missing.length === 1 && missing[0] === 'netpill'),
      'unresolved ids: ' + missing.join(', '));
    return missing.length ? 'netpill optional; #cid fallback used' : 'all resolved';
  });

  await check('wallet button has a click listener', () => {
    assert(A.api.walletBtn.listeners.click && A.api.walletBtn.listeners.click.length === 1,
      'listener count = ' + ((A.api.walletBtn.listeners.click || []).length));
    return '1 listener';
  });

  A.api.fireReady();
  await A.api.flush();

  await check('DOMContentLoaded hands over without throwing', () => {
    assert(!/^ERROR/.test(A.api.consoleLines.join(' ')), A.api.consoleLines.join(' | '));
    return 'ready';
  });

  await check('empty Core/Ledger sections are hidden instead of rendering blank cards', () => {
    assert(A.api.byId['pn'].section.hidden === true, 'core section not hidden');
    assert(A.api.byId['lg'].section.hidden === true, 'ledger section not hidden');
    assert(A.api.main.classList.contains('single'), 'main did not switch to single column');
    return 'hidden + single column';
  });

  await check('network chip resolves to a real network label', () => {
    assert(A.api.byId['cid'].textContent === 'Mainnet 677', 'chip = ' + A.api.byId['cid'].textContent);
    return A.api.byId['cid'].textContent;
  });

  await check('live stats read from the contract', async () => {
    await A.ctx.refreshReads();
    const p = A.api.byId['stat-premiums'].textContent;
    const b = A.api.byId['stat-balance'].textContent;
    assert(p === '0.0042 BOT', 'premiums = ' + p);
    assert(b === '0.0012 BOT', 'balance = ' + b);
    return p + ' / ' + b;
  });

  await check('wallet click with no provider shows a visible toast, not silence', async () => {
    A.api.walletBtn.click();
    await A.api.flush();
    const txt = A.api.toasts();
    assert(/No wallet found/.test(txt), 'toast = ' + txt);
    assert(A.api.toastClass().includes('toast'), 'base .toast class lost: ' + A.api.toastClass());
    assert(A.api.toastClass().includes('on'), 'toast not shown: ' + A.api.toastClass());
    return txt;
  });

  await check('demo button renders the 7-transaction trace', () => {
    A.api.byId['rd2'].click();
    const table = A.api.byId['dt'].innerHTML;
    const rows = (table.match(/<tr>/g) || []).length; // 1 header + 7 body rows
    assert(rows === 8, 'row count = ' + rows);
    assert(table.includes('0xf1d416fb'), 'first tx hash missing');
    assert(table.includes('BOT premium'), 'premium column missing');
    return rows + ' <tr> (1 header + 7 txs)';
  });

  await check('download button is enabled only after the demo runs', () => {
    assert(A.api.byId['cp'].disabled === false, 'download still disabled');
    return 'enabled';
  });

  await check('download produces the 7-tx JSON payload', () => {
    A.api.byId['cp'].click();
    const blob = A.ctx.__blob;
    assert(blob, 'no blob created');
    const data = JSON.parse(blob.parts.join(''));
    assert(data.txCount === 7, 'txCount = ' + data.txCount);
    assert(data.txs.length === 7, 'txs = ' + data.txs.length);
    assert(data.txs[1].fromAddress && data.txs[1].to === data.contract, 'tx enrichment missing');
    return data.txCount + ' txs, ' + Object.keys(data.wallets).length + ' wallets';
  });

  /* ---------- scenario B: injected wallet ---------- */
  const B = buildContext({ provider: true });
  let bError = null;
  try { vm.runInContext(B.script, B.ctx, { filename: 'inline.js' }); } catch (e) { bError = e; }
  B.api.fireReady();
  await B.api.flush();

  await check('injected wallet: connect updates the button to the short address', async () => {
    assert(!bError, bError && bError.message);
    B.api.walletBtn.click();
    await B.api.flush();
    const label = B.api.walletBtn.textContent;
    assert(/^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/.test(label), 'label = ' + label);
    assert(B.ctx.ethereum.requests.includes('eth_requestAccounts'), 'eth_requestAccounts not called');
    assert(B.api.toastClass().includes('toast'), 'toast lost base class');
    return label;
  });

  await check('injected wallet: network toggle asks the wallet and updates the chip', async () => {
    B.api.net968.click();
    await B.api.flush();
    assert(B.ctx.ethereum.requests.includes('wallet_switchEthereumChain'), 'switch not requested');
    assert(B.api.byId['cid'].textContent === 'Testnet 968', 'chip = ' + B.api.byId['cid'].textContent);
    assert(B.api.net968.getAttribute('aria-pressed') === 'true', 'aria-pressed not updated');
    return 'Testnet 968';
  });

  /* ---------- scenario C: user rejects the connection ---------- */
  const C = buildContext({ provider: true, reject: true });
  let cError = null;
  try { vm.runInContext(C.script, C.ctx, { filename: 'inline.js' }); } catch (e) { cError = e; }
  C.api.fireReady();
  await C.api.flush();

  await check('rejected connection leaves the button unchanged and explains why', async () => {
    assert(!cError, cError && cError.message);
    C.api.walletBtn.click();
    await C.api.flush();
    assert(C.api.walletBtn.textContent === 'Connect wallet', 'button = ' + C.api.walletBtn.textContent);
    const txt = C.api.toasts();
    assert(/rejected/i.test(txt), 'toast = ' + txt);
    assert(C.api.toastClass().includes('on'), 'toast not shown');
    return txt;
  });

  await check('loads the UMD ethers build, not the ESM bundle', () => {
    assert(/ethers@6\.13\.4\/dist\/ethers\.umd\.min\.js/.test(html), 'UMD ethers build not referenced');
    assert(!/appkit.*\.min\.js/.test(html), 'stale AppKit script tag still present');
    assert(!/window\.createAppKit/.test(html), 'dead AppKit init still present');
    return 'ethers.umd + no AppKit';
  });

  const failed = results.filter(r => !r.ok);
  console.log(JSON.stringify({
    file,
    passed: results.length - failed.length,
    failed: failed.length,
    results
  }, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS CRASH', e); process.exit(2); });
