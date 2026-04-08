// ==UserScript==
// @name         KBlox - Roblox Website Editor (Loader)
// @namespace    https://tampermonkey.net/
// @version      2026.04.08
// @description  Loads KBlox main.js (remote) and injects it into roblox.com pages.
// @match        https://www.roblox.com/*
// @match        https://web.roblox.com/*
// @match        https://web1.roblox.com/*
// @match        https://web2.roblox.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  // 1) Host your repo somewhere that serves raw JS (GitHub raw, your own site, etc.)
  // 2) Paste the raw URL to `main.js` here.
  const MAIN_JS_URL = 'https://example.com/main.js';

  const fetchText = (url) =>
    new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { 'Cache-Control': 'no-cache' },
        onload: (res) => resolve(res.responseText || ''),
        onerror: (err) => reject(err),
        ontimeout: () => reject(new Error('timeout')),
        timeout: 20000,
      });
    });

  const inject = (code) => {
    const el = document.createElement('script');
    el.type = 'text/javascript';
    el.textContent = code;
    document.documentElement.appendChild(el);
    el.remove();
  };

  // Cache-bust so edits to main.js apply instantly.
  const url = `${MAIN_JS_URL}${MAIN_JS_URL.includes('?') ? '&' : '?'}t=${Date.now()}`;

  fetchText(url)
    .then((code) => {
      if (!code || typeof code !== 'string') throw new Error('Empty main.js response');
      inject(code);
    })
    .catch((err) => {
      // Keep it quiet; you can inspect console for details.
      console.warn('[KBlox Loader] Failed to load main.js', err);
    });
})();

