// ==UserScript==
// @name         KBlox - Roblox Website Editor (Loader)
// @namespace    https://tampermonkey.net/
// @version      2026.04.08
// @description  Loads KBlox universal.js + unpkg libraries and injects them into roblox.com pages.
// @match        https://www.roblox.com/*
// @match        https://web.roblox.com/*
// @match        https://web1.roblox.com/*
// @match        https://web2.roblox.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
  "use strict";

  // 1) Host your repo somewhere that serves raw JS (GitHub raw, your own site, etc.)
  // 2) Paste the raw URL to `universal.js` here.
  const MAIN_JS_URL =
    "https://raw.githubusercontent.com/TheWildKaden/KBlox/refs/heads/main/universal.js";

  // Unpkg libraries (downloaded by the loader to bypass Roblox CSP).
  // If you don't want a library, remove it from this list.
  const UNPKG_LIBS = [
    // Small utility: https://www.npmjs.com/package/nanoid
    "https://unpkg.com/nanoid@5.0.7/index.browser.js",
  ];

  const fetchText = (url) =>
    new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: { "Cache-Control": "no-cache" },
        onload: (res) => resolve(res.responseText || ""),
        onerror: (err) => reject(err),
        ontimeout: () => reject(new Error("timeout")),
        timeout: 20000,
      });
    });

  const inject = (code) => {
    const el = document.createElement("script");
    el.type = "text/javascript";
    el.textContent = code;
    document.documentElement.appendChild(el);
    el.remove();
  };

  // Cache-bust so edits to universal.js apply instantly.
  const url = `${MAIN_JS_URL}${MAIN_JS_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;

  Promise.all([
    ...UNPKG_LIBS.map((libUrl) =>
      fetchText(libUrl).then((code) => {
        if (!code) throw new Error(`Empty unpkg response: ${libUrl}`);
        return `\n;/* KBlox unpkg: ${libUrl} */\n${code}\n`;
      })
    ),
    fetchText(url).then((code) => {
      if (!code || typeof code !== "string")
        throw new Error("Empty universal.js response");
      return `\n;/* KBlox main: ${MAIN_JS_URL} */\n${code}\n`;
    }),
  ])
    .then((parts) => inject(parts.join("\n")))
    .catch((err) => {
      // Keep it quiet; you can inspect console for details.
      console.warn("[KBlox Loader] Failed to load universal.js", err);
    });
})();
