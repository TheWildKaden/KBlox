// ==UserScript==
// @name         KBlox - Roblox Colors + Animations (Smart)
// @namespace    https://tampermonkey.net/
// @version      2026.04.08
// @description  Smart theme that fetches Roblox CSS, rewrites colors, and improves animations.
// @author       Kaden
// @match        https://www.roblox.com/*
// @match        https://web.roblox.com/*
// @match        https://web1.roblox.com/*
// @match        https://web2.roblox.com/*
// @run-at       document-start
//
// Libraries (pinned versions) loaded from unpkg CDN.
// @require      https://unpkg.com/css-tree@2.3.1/dist/csstree.min.js
// @require      https://unpkg.com/tinycolor2@1.6.0/dist/tinycolor-min.js
//
// NOTE: This script loads and rewrites CSS at runtime. Keep @connect broad enough for CSS hosts.
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      roblox.com
// @connect      *.roblox.com
// @connect      rbxcdn.com
// @connect      *.rbxcdn.com
// @connect      unpkg.com
// ==/UserScript==

(() => {
  "use strict";

  // -----------------------------
  // Webpage-specific config (e.g. link rewrites, feature toggles, etc)
  // -----------------------------
  let TargetPages = {
    Profile: "https://www.roblox.com/users/*",
    Charts: "https://www.roblox.com/charts",
    Avatar: "https://www.roblox.com/my/avatar",
    Shop: "https://www.roblox.com/upgrades/robux",
    Contact: "https://www.roblox.com/contact-us",
  };

  // -----------------------------
  // Settings
  // -----------------------------

  const SETTINGS_KEY = "kblox:settings:v1";

  const DEFAULTS = {
    enabled: true,
    theme: "auto", // "auto" | "dark" | "light"
    accent: "#ff9800", // warm accent instead of blue

    // Dark palette (used when theme="dark" or auto picks dark)
    bgDark: "#1e1e1e",
    surfaceDark: "#2c2c2c",
    surface2Dark: "#333333",
    textDark: "#e0e0e0",
    mutedDark: "rgba(224, 224, 224, 0.72)",
    borderDark: "rgba(255, 255, 255, 0.12)",

    // Light palette (used when theme="light" or auto picks light)
    bgLight: "#fafafa",
    surfaceLight: "#ffffff",
    surface2Light: "#f5f5f5",
    textLight: "#212121", // dark grey text
    mutedLight: "rgba(33, 33, 33, 0.62)",
    borderLight: "rgba(0, 0, 0, 0.12)",

    rewriteStylesheets: true,
    rewriteInlineStyles: true,
    rewriteStyleAttributes: true,
    maxStylesheets: 12,
    maxCssBytesPerSheet: 2_000_000,
    maxAttrNodesInitial: 2500,
    maxAttrRewritesPerBatch: 250,
    cacheHours: 12,
  };

  const getSettings = () => {
    const raw = GM_getValue(SETTINGS_KEY, null);
    if (!raw || typeof raw !== "object") return { ...DEFAULTS };
    return { ...DEFAULTS, ...raw };
  };

  const setSettings = (next) => {
    GM_setValue(SETTINGS_KEY, { ...getSettings(), ...next });
  };

  const s = getSettings();

  GM_registerMenuCommand("KBlox: Toggle (reload)", () => {
    setSettings({ enabled: !getSettings().enabled });
    location.reload();
  });

  GM_registerMenuCommand("KBlox: Toggle CSS rewrite (reload)", () => {
    setSettings({ rewriteStylesheets: !getSettings().rewriteStylesheets });
    location.reload();
  });

  GM_registerMenuCommand(
    "KBlox: Toggle inline <style> rewrite (reload)",
    () => {
      setSettings({ rewriteInlineStyles: !getSettings().rewriteInlineStyles });
      location.reload();
    },
  );

  GM_registerMenuCommand("KBlox: Theme (auto/dark/light) (reload)", () => {
    const cur = getSettings().theme || "auto";
    const next = cur === "auto" ? "dark" : cur === "dark" ? "light" : "auto";
    setSettings({ theme: next });
    location.reload();
  });

  GM_registerMenuCommand("KBlox: Accent (cycle) (reload)", () => {
    const presets = [
      "#2d6cdf", // blue
      "#7c3aed", // purple
      "#16a34a", // green
      "#ea580c", // orange
      "#dc2626", // red
      "#0ea5e9", // sky
    ];
    const cur = (getSettings().accent || "").toLowerCase();
    const idx = Math.max(
      0,
      presets.findIndex((c) => c.toLowerCase() === cur),
    );
    const next = presets[(idx + 1) % presets.length];
    setSettings({ accent: next });
    location.reload();
  });

  GM_registerMenuCommand("KBlox: Reset settings (reload)", () => {
    GM_setValue(SETTINGS_KEY, { ...DEFAULTS });
    location.reload();
  });

  const resolveTheme = (cfg) => {
    const want = cfg.theme || "auto";
    const prefersDark = (() => {
      try {
        return !!window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      } catch (_) {
        return false;
      }
    })();

    const mode = want === "auto" ? (prefersDark ? "dark" : "light") : want;
    const isDark = mode === "dark";

    return {
      mode,
      isDark,
      accent: cfg.accent,
      bg: isDark ? cfg.bgDark : cfg.bgLight,
      surface: isDark ? cfg.surfaceDark : cfg.surfaceLight,
      surface2: isDark ? cfg.surface2Dark : cfg.surface2Light,
      text: isDark ? cfg.textDark : cfg.textLight,
      muted: isDark ? cfg.mutedDark : cfg.mutedLight,
      border: isDark ? cfg.borderDark : cfg.borderLight,
    };
  };

  // -----------------------------
  // Core CSS (animations + base theme vars)
  // -----------------------------
  const ROOT_CLASS = "kblox-enhanced";
  const CORE_STYLE_ID = "kblox-core-style";

  const coreCss = (cfg) => `
    html.${ROOT_CLASS} {
      color-scheme: ${cfg.isDark ? "dark" : "light"};
      --kblox-accent: ${cfg.accent};
      --kblox-bg: ${cfg.bg};
      --kblox-surface: ${cfg.surface};
      --kblox-surface2: ${cfg.surface2};
      --kblox-text: ${cfg.text};
      --kblox-muted: ${cfg.muted};
      --kblox-border: ${cfg.border};
      --kblox-shadow: ${cfg.isDark ? "0 14px 45px rgba(0,0,0,0.35)" : "0 14px 45px rgba(2,6,23,0.14)"};
    }

    html.${ROOT_CLASS} body,
    html.${ROOT_CLASS} #rbx-body {
      background:
        radial-gradient(1200px 800px at 20% 0%, color-mix(in srgb, var(--kblox-accent) 18%, transparent), transparent 55%),
        radial-gradient(900px 700px at 90% 20%, rgba(160, 88, 255, ${cfg.isDark ? "0.12" : "0.08"}), transparent 55%),
        var(--kblox-bg) !important;
      color: var(--kblox-text) !important;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif !important;
    }

    /* Broad "everything feels nicer" restyle (kept safe, but intentionally wide coverage). */
    html.${ROOT_CLASS} a { color: color-mix(in srgb, var(--kblox-accent) 82%, ${cfg.isDark ? "white" : "black"} 18%) !important; }
    html.${ROOT_CLASS} a:hover { color: color-mix(in srgb, var(--kblox-accent) 92%, ${cfg.isDark ? "white" : "black"} 8%) !important; }

    html.${ROOT_CLASS} .rbx-navbar,
    html.${ROOT_CLASS} .navbar,
    html.${ROOT_CLASS} header,
    html.${ROOT_CLASS} .nav-container {
      background: ${cfg.isDark ? "rgba(10, 12, 18, 0.75)" : "rgba(246, 247, 251, 0.78)"} !important;
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--kblox-border) !important;
    }

    html.${ROOT_CLASS} .section,
    html.${ROOT_CLASS} .rbx-section,
    html.${ROOT_CLASS} .container-main,
    html.${ROOT_CLASS} .content,
    html.${ROOT_CLASS} .card,
    html.${ROOT_CLASS} .rbx-card,
    html.${ROOT_CLASS} .item-card,
    html.${ROOT_CLASS} .game-card,
    html.${ROOT_CLASS} .profile-header,
    html.${ROOT_CLASS} .dropdown-menu,
    html.${ROOT_CLASS} .modal-content,
    html.${ROOT_CLASS} .rbx-popover-content {
      background: ${cfg.isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.82)"} !important;
      border: 1px solid var(--kblox-border) !important;
      border-radius: 14px !important;
      box-shadow: var(--kblox-shadow) !important;
    }

    html.${ROOT_CLASS} input,
    html.${ROOT_CLASS} textarea,
    html.${ROOT_CLASS} select {
      background: ${cfg.isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.92)"} !important;
      color: var(--kblox-text) !important;
      border: 1px solid var(--kblox-border) !important;
      border-radius: 12px !important;
    }
    html.${ROOT_CLASS} ::placeholder { color: ${cfg.isDark ? "rgba(231, 237, 243, 0.45)" : "rgba(11, 18, 32, 0.45)"} !important; }

    html.${ROOT_CLASS} button,
    html.${ROOT_CLASS} [role="button"],
    html.${ROOT_CLASS} .btn-common,
    html.${ROOT_CLASS} .rbx-btn {
      border-radius: 12px !important;
    }

    html.${ROOT_CLASS} *:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--kblox-accent) 70%, white 30%);
      outline-offset: 2px;
    }

    html.${ROOT_CLASS} ::-webkit-scrollbar { width: 12px; height: 12px; }
    html.${ROOT_CLASS} ::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.14);
      border: 3px solid rgba(0,0,0,0);
      background-clip: padding-box;
      border-radius: 999px;
    }
    html.${ROOT_CLASS} ::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.20);
      border: 3px solid rgba(0,0,0,0);
      background-clip: padding-box;
    }

    @media (prefers-reduced-motion: no-preference) {
      html.${ROOT_CLASS} body { animation: kblox-fade-in 180ms ease-out both; }

      html.${ROOT_CLASS} button,
      html.${ROOT_CLASS} [role="button"],
      html.${ROOT_CLASS} .btn-common,
      html.${ROOT_CLASS} .rbx-btn,
      html.${ROOT_CLASS} a {
        transition:
          transform 120ms ease,
          box-shadow 140ms ease,
          filter 140ms ease,
          background-color 140ms ease,
          border-color 140ms ease,
          color 140ms ease,
          opacity 140ms ease;
      }

      html.${ROOT_CLASS} button:hover,
      html.${ROOT_CLASS} [role="button"]:hover,
      html.${ROOT_CLASS} .btn-common:hover,
      html.${ROOT_CLASS} .rbx-btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.03);
      }

      html.${ROOT_CLASS} button:active,
      html.${ROOT_CLASS} [role="button"]:active,
      html.${ROOT_CLASS} .btn-common:active,
      html.${ROOT_CLASS} .rbx-btn:active {
        transform: translateY(0);
        filter: brightness(0.98);
      }

      @keyframes kblox-fade-in { from { opacity: 0; } to { opacity: 1; } }
    }
  `;

  const upsertStyle = (id, cssText) => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      el.type = "text/css";
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = cssText || "";
    return el;
  };

  const enableCore = () => {
    document.documentElement.classList.add(ROOT_CLASS);
    upsertStyle(CORE_STYLE_ID, coreCss(resolveTheme(getSettings())));
  };

  const disableAll = () => {
    document.documentElement.classList.remove(ROOT_CLASS);
    document.getElementById(CORE_STYLE_ID)?.remove();
    document
      .querySelectorAll('style[data-kblox-rewrite="1"]')
      .forEach((n) => n.remove());
  };

  if (!s.enabled) {
    disableAll();
    return;
  }

  enableCore();

  // -----------------------------
  // Smart rewrite: fetch Roblox CSS, rewrite colors, inject after originals
  // -----------------------------
  const REWRITE_CACHE_PREFIX = "kblox:csscache:v1:";
  const nowMs = () => Date.now();

  const cacheKeyFor = (href, themeSig) => {
    return REWRITE_CACHE_PREFIX + (themeSig || "t0") + ":" + href;
  };

  const cacheGet = (href, themeSig) => {
    try {
      const key = cacheKeyFor(href, themeSig);
      const entry = GM_getValue(key, null);
      if (!entry || typeof entry !== "object") return null;
      const ageMs = nowMs() - (entry.t || 0);
      if (ageMs > (getSettings().cacheHours || 12) * 3600 * 1000) return null;
      if (typeof entry.css !== "string") return null;
      return entry.css;
    } catch (_) {
      return null;
    }
  };

  const cacheSet = (href, cssText, themeSig) => {
    try {
      const key = cacheKeyFor(href, themeSig);
      GM_setValue(key, { t: nowMs(), css: cssText || "" });
    } catch (_) {
      // ignore
    }
  };

  const isLikelyRobloxCss = (href) => {
    if (!href) return false;
    try {
      const u = new URL(href, location.href);
      const host = u.hostname.toLowerCase();
      if (host.endsWith("roblox.com")) return true;
      if (host.endsWith("rbxcdn.com")) return true;
      return false;
    } catch (_) {
      return false;
    }
  };

  const fetchText = (url) =>
    new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: { "Cache-Control": "no-cache" },
        timeout: 20000,
        onload: (res) => resolve(res.responseText || ""),
        onerror: (err) => reject(err),
        ontimeout: () => reject(new Error("timeout")),
      });
    });

  const hashHref = (href) => {
    // Small stable hash for DOM ids (not cryptographic).
    let h = 2166136261;
    for (let i = 0; i < href.length; i++) {
      h ^= href.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  };

  const colorProps = new Set([
    "color",
    "background",
    "background-color",
    "border",
    "border-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline",
    "outline-color",
    "fill",
    "stroke",
    "box-shadow",
    "text-shadow",
    "caret-color",
    "text-decoration-color",
  ]);

  const rewriteColor = (tc, prop, cfg) => {
    // Preserve alpha.
    const a = tc.getAlpha();
    const lum = tc.getLuminance();
    const sat = tc.toHsl().s || 0;

    // Transparent -> keep as-is.
    if (a === 0) return tc;

    // Borders / outlines get normalized.
    if (prop.includes("border") || prop.includes("outline")) {
      const b = tinycolor(cfg.border);
      b.setAlpha(
        cfg.isDark
          ? Math.min(0.9, Math.max(0.12, a))
          : Math.min(0.35, Math.max(0.08, a)),
      );
      return b;
    }

    // Text-ish colors.
    if (prop === "color" || prop.includes("text") || prop.includes("caret")) {
      if (cfg.isDark) {
        if (lum < 0.55) return tinycolor(cfg.text).setAlpha(a);
        return tc.brighten(5).setAlpha(a);
      }

      // Light theme: keep text dark/readable.
      if (lum > 0.55) return tinycolor(cfg.text).setAlpha(a);
      return tc.darken(8).setAlpha(a);
    }

    // Background-ish colors.
    if (prop.includes("background")) {
      if (cfg.isDark) {
        if (lum > 0.86) return tinycolor(cfg.surface).setAlpha(a);
        if (lum > 0.7) return tinycolor(cfg.surface2).setAlpha(a);
        if (lum < 0.08) return tinycolor(cfg.bg).setAlpha(a);
        // Midtones -> darken a bit for dark theme.
        return tc.darken(18).desaturate(8).setAlpha(a);
      }

      // Light theme: avoid dark/inky panels; lift them up.
      if (lum < 0.12) return tinycolor(cfg.surface2).setAlpha(a);
      if (lum < 0.22) return tinycolor(cfg.surface).setAlpha(a);
      if (lum > 0.95) return tinycolor(cfg.bg).setAlpha(a);
      return tc.brighten(14).desaturate(10).setAlpha(a);
    }

    // Shadows: normalize so they look softer.
    if (prop.includes("shadow")) {
      if (cfg.isDark) return tc.darken(22).setAlpha(Math.min(0.55, a));
      return tc.darken(10).setAlpha(Math.min(0.22, Math.max(0.08, a)));
    }

    // Accent-ish colors: keep saturation but shift brightness.
    if (sat > 0.35 && lum > 0.12) {
      if (cfg.isDark) return tc.darken(10).saturate(6).setAlpha(a);
      return tc.brighten(10).saturate(6).setAlpha(a);
    }

    // Fallback.
    if (cfg.isDark) {
      if (lum > 0.75) return tinycolor(cfg.surface).setAlpha(a);
      return tc.darken(10).setAlpha(a);
    }

    if (lum < 0.15) return tinycolor(cfg.surface2).setAlpha(a);
    return tc.brighten(8).setAlpha(a);
  };

  const toCssColor = (tc) => {
    const a = tc.getAlpha();
    if (a >= 0.999) return tc.toHexString();
    const rgb = tc.toRgb();
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.round(a * 1000) / 1000})`;
  };

  const replaceColorsInValue = (valueStr, prop, cfg) => {
    // This is intentionally conservative: only rewrite obvious color tokens.
    const patterns = [
      /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
      /\b(?:rgba?|hsla?)\(\s*[^)]+\)/gi,
      /\b(?:white|black|transparent|currentcolor)\b/gi,
    ];

    let out = valueStr;
    for (const re of patterns) {
      out = out.replace(re, (m) => {
        const tc = tinycolor(m);
        if (!tc.isValid()) return m;
        const rewritten = rewriteColor(tc, prop, cfg);
        return toCssColor(rewritten);
      });
    }
    return out;
  };

  const rewriteCssText = (cssText, cfg) => {
    // Use csstree to safely iterate declarations, but perform color replacement
    // on each declaration value as a string (more robust across weird syntax).
    const csstree = window.csstree;
    if (!csstree || !window.tinycolor) return cssText;

    let ast;
    try {
      ast = csstree.parse(cssText, {
        parseValue: true,
        parseCustomProperty: true,
      });
    } catch (_) {
      return cssText;
    }

    const shouldRewriteProp = (prop) => {
      if (!prop) return false;
      if (prop.startsWith("--")) return true; // CSS variables are a huge part of Roblox's theme system.
      if (colorProps.has(prop)) return true;
      if (prop.includes("color")) return true;
      if (prop.includes("background")) return true;
      if (prop.includes("shadow")) return true;
      if (prop.includes("border")) return true;
      if (prop.includes("outline")) return true;
      if (prop === "fill" || prop === "stroke") return true;
      return false;
    };

    csstree.walk(ast, {
      visit: "Declaration",
      enter(node) {
        const prop = String(node.property || "").toLowerCase();
        if (!prop) return;
        if (!shouldRewriteProp(prop)) return;

        let oldValue;
        try {
          oldValue = csstree.generate(node.value);
        } catch (_) {
          return;
        }

        const nextValue = replaceColorsInValue(oldValue, prop, cfg);
        if (!nextValue || nextValue === oldValue) return;

        try {
          node.value = csstree.parse(nextValue, { context: "value" });
        } catch (_) {
          // If parse fails, keep original.
        }
      },
    });

    try {
      return csstree.generate(ast);
    } catch (_) {
      return cssText;
    }
  };

  const injectRewrittenCss = (href, rewrittenCss) => {
    const id = `kblox-rewrite-${hashHref(href)}`;
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      style.type = "text/css";
      style.dataset.kbloxRewrite = "1";
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = rewrittenCss || "";
  };

  const inFlight = new Set();

  const rewriteOneStylesheet = async (href) => {
    const settings = getSettings();
    const cfg = resolveTheme(settings);
    const themeSig = hashHref(
      `${cfg.mode}|${cfg.accent}|${cfg.bg}|${cfg.surface}|${cfg.surface2}|${cfg.text}|${cfg.border}`,
    );
    if (inFlight.has(href)) return;
    inFlight.add(href);
    const cached = cacheGet(href, themeSig);
    if (cached) {
      injectRewrittenCss(href, cached);
      inFlight.delete(href);
      return;
    }

    const text = await fetchText(href);
    if (!text) {
      inFlight.delete(href);
      return;
    }
    if (
      text.length >
      (settings.maxCssBytesPerSheet || DEFAULTS.maxCssBytesPerSheet)
    ) {
      inFlight.delete(href);
      return;
    }

    const rewritten = rewriteCssText(text, cfg);
    cacheSet(href, rewritten, themeSig);
    injectRewrittenCss(href, rewritten);
    inFlight.delete(href);
  };

  const getStylesheetHrefs = () => {
    const links = Array.from(
      document.querySelectorAll('link[rel="stylesheet"][href]'),
    );
    const hrefs = links.map((l) => l.href).filter((h) => isLikelyRobloxCss(h));
    // Stable order, avoid duplicates.
    const seen = new Set();
    const out = [];
    for (const h of hrefs) {
      if (!h || seen.has(h)) continue;
      seen.add(h);
      out.push(h);
    }
    return out;
  };

  const runRewrite = () => {
    const settings = getSettings();
    if (!settings.rewriteStylesheets) return;

    const hrefs = getStylesheetHrefs().slice(
      0,
      settings.maxStylesheets || DEFAULTS.maxStylesheets,
    );
    for (const href of hrefs) {
      rewriteOneStylesheet(href).catch(() => {});
    }
  };

  // Inline <style> rewriting (covers CSS that isn't in external link tags).
  let inlineSeq = 0;
  const inlineIdFor = (styleEl) => {
    if (styleEl.dataset.kbloxInlineId) return styleEl.dataset.kbloxInlineId;
    inlineSeq += 1;
    styleEl.dataset.kbloxInlineId = `i${inlineSeq}`;
    return styleEl.dataset.kbloxInlineId;
  };

  const isOurStyle = (el) => {
    if (!el) return false;
    if (el.id === CORE_STYLE_ID) return true;
    if (
      el.dataset &&
      (el.dataset.kbloxRewrite === "1" || el.dataset.kbloxInline === "1")
    )
      return true;
    return false;
  };

  const rewriteInlineStyleTag = (styleEl) => {
    const settings = getSettings();
    if (!settings.rewriteInlineStyles) return;
    if (!styleEl || styleEl.tagName !== "STYLE") return;
    if (isOurStyle(styleEl)) return;

    const text = styleEl.textContent || "";
    if (!text) return;
    if (
      text.length >
      (settings.maxCssBytesPerSheet || DEFAULTS.maxCssBytesPerSheet)
    )
      return;

    const cfg = resolveTheme(settings);
    const rewritten = rewriteCssText(text, cfg);

    const sid = inlineIdFor(styleEl);
    const id = `kblox-inline-${sid}`;
    let out = document.getElementById(id);
    if (!out) {
      out = document.createElement("style");
      out.id = id;
      out.type = "text/css";
      out.dataset.kbloxRewrite = "1";
      out.dataset.kbloxInline = "1";
      out.dataset.kbloxInlineFor = sid;
      // Insert immediately after the source <style> so the cascade order is predictable.
      styleEl.parentNode?.insertBefore(out, styleEl.nextSibling);
    }
    out.textContent = rewritten;
  };

  // Inline style="" attribute rewriting.
  const rewriteStyleAttribute = (el) => {
    const settings = getSettings();
    if (!settings.rewriteStyleAttributes) return;
    if (!el || el.nodeType !== 1) return;

    // Don't rewrite our injected elements/styles.
    if (el.id === CORE_STYLE_ID) return;

    const styleText = el.getAttribute("style");
    if (!styleText) return;

    // Prevent repeated rewrites from ballooning the attribute.
    // If the page rewrites style="", we rewrite again based on that new source.
    if (el.dataset && el.dataset.kbloxStyled === "1") {
      // If it already looks rewritten, skip unless it contains raw color tokens.
      if (
        !/[#]|rgba?\(|hsla?\(|\b(?:white|black|transparent|currentcolor)\b/i.test(
          styleText,
        )
      )
        return;
    }

    const cfg = resolveTheme(settings);

    const shouldRewriteProp = (prop) => {
      if (!prop) return false;
      const p = prop.toLowerCase().trim();
      if (p.startsWith("--")) return true;
      if (p.includes("color")) return true;
      if (p.includes("background")) return true;
      if (p.includes("shadow")) return true;
      if (p.includes("border")) return true;
      if (p.includes("outline")) return true;
      if (p === "fill" || p === "stroke") return true;
      return false;
    };

    const parts = styleText.split(";");
    let changed = false;
    const outParts = [];
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const idx = trimmed.indexOf(":");
      if (idx === -1) {
        outParts.push(trimmed);
        continue;
      }
      const prop = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!shouldRewriteProp(prop)) {
        outParts.push(`${prop}: ${val}`);
        continue;
      }
      const nextVal = replaceColorsInValue(val, prop.toLowerCase(), cfg);
      if (nextVal !== val) changed = true;
      outParts.push(`${prop}: ${nextVal}`);
    }

    if (changed) {
      el.setAttribute("style", outParts.join("; "));
      if (el.dataset) el.dataset.kbloxStyled = "1";
    }
  };

  // Run when head links are present; also watch for new ones (SPA / lazy loads).
  const start = () => {
    runRewrite();

    // Rewrite any inline styles already present.
    if (getSettings().rewriteInlineStyles) {
      document
        .querySelectorAll("style")
        .forEach((st) => rewriteInlineStyleTag(st));
    }

    // Rewrite inline style="" attributes in batches to avoid freezing.
    const attrQueue = [];
    let attrScheduled = false;

    const scheduleAttrWork = () => {
      if (attrScheduled) return;
      attrScheduled = true;
      setTimeout(() => {
        attrScheduled = false;
        const settings = getSettings();
        const limit =
          settings.maxAttrRewritesPerBatch ||
          DEFAULTS.maxAttrRewritesPerBatch ||
          250;
        let n = 0;
        while (attrQueue.length && n < limit) {
          const el = attrQueue.shift();
          rewriteStyleAttribute(el);
          n += 1;
        }
        if (attrQueue.length) scheduleAttrWork();
      }, 0);
    };

    const enqueueAttr = (el) => {
      if (!el) return;
      attrQueue.push(el);
      scheduleAttrWork();
    };

    if (getSettings().rewriteStyleAttributes) {
      const all = document.querySelectorAll("[style]");
      const cap =
        getSettings().maxAttrNodesInitial ||
        DEFAULTS.maxAttrNodesInitial ||
        2500;
      for (let i = 0; i < all.length && i < cap; i++) enqueueAttr(all[i]);
    }

    const head = document.head || document.documentElement;
    const mo = new MutationObserver((mutations) => {
      let changed = false;
      for (const m of mutations) {
        for (const n of m.addedNodes || []) {
          if (!n || n.nodeType !== 1) continue;
          const el = /** @type {HTMLElement} */ (n);
          if (
            el.tagName === "LINK" &&
            el.getAttribute("rel") === "stylesheet"
          ) {
            const href = el.getAttribute("href");
            if (href && isLikelyRobloxCss(href)) changed = true;
          }

          if (el.tagName === "STYLE") {
            rewriteInlineStyleTag(el);
          } else {
            // Styles can be nested inside fragments/templates.
            el.querySelectorAll?.("style")?.forEach((st) =>
              rewriteInlineStyleTag(st),
            );
          }
        }
      }
      if (changed) runRewrite();
    });
    mo.observe(head, { childList: true, subtree: true });

    // Whole-document observer for inline style="" attributes + any late style tags outside <head>.
    const mo2 = new MutationObserver((mutations) => {
      const settings = getSettings();

      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "style") {
          enqueueAttr(m.target);
          continue;
        }

        for (const n of m.addedNodes || []) {
          if (!n || n.nodeType !== 1) continue;
          const el = /** @type {HTMLElement} */ (n);

          if (settings.rewriteInlineStyles) {
            if (el.tagName === "STYLE") rewriteInlineStyleTag(el);
            el.querySelectorAll?.("style")?.forEach((st) =>
              rewriteInlineStyleTag(st),
            );
          }

          if (settings.rewriteStyleAttributes) {
            if (el.hasAttribute?.("style")) enqueueAttr(el);
            // Pull in descendants with inline styles (can be expensive, but user asked for coverage).
            el.querySelectorAll?.("[style]")?.forEach((x) => enqueueAttr(x));
          }
        }
      }
    });

    mo2.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  };

  const refreshAll = () => {
    // Re-apply core vars + restyle and re-run rewrites using the current theme decision.
    upsertStyle(CORE_STYLE_ID, coreCss(resolveTheme(getSettings())));
    runRewrite();
    if (getSettings().rewriteInlineStyles) {
      document
        .querySelectorAll("style")
        .forEach((st) => rewriteInlineStyleTag(st));
    }
    if (getSettings().rewriteStyleAttributes) {
      const all = document.querySelectorAll("[style]");
      const cap = Math.min(
        getSettings().maxAttrNodesInitial ||
          DEFAULTS.maxAttrNodesInitial ||
          2500,
        1200,
      );
      for (let i = 0; i < all.length && i < cap; i++)
        rewriteStyleAttribute(all[i]);
    }
  };

  // document-start: head might not exist yet.
  if (document.readyState === "loading") {
    const mo = new MutationObserver(() => {
      if (document.head) {
        mo.disconnect();
        start();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    start();
  }

  // Smart adapt: if theme=auto, follow system theme changes without needing a reload.
  try {
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (mql && typeof mql.addEventListener === "function") {
      mql.addEventListener("change", () => {
        if (!getSettings().enabled) return;
        if ((getSettings().theme || "auto") !== "auto") return;
        setTimeout(refreshAll, 0);
      });
    }
  } catch (_) {
    // ignore
  }
})();
