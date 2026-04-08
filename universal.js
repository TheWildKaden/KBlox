(() => {
  "use strict";

  // Prevent double-injection if the loader runs more than once.
  if (window.__KBloxUniversalLoaded) return;
  window.__KBloxUniversalLoaded = true;

  const VERSION = "2026.04.08";
  const SESSION_ID =
    (typeof window.nanoid === "function" ? window.nanoid(6) : null) ||
    Math.random().toString(36).slice(2, 8);

  // -----------------------------
  // KBloxLib (small DOM utilities)
  // -----------------------------
  (() => {
    if (window.KBloxLib) return;

    const ROBLOX_HOST_PATTERN = /^https:\/\/(?:www|web|web\d?)\.roblox\.com/i;
    const assertRoblox = () => ROBLOX_HOST_PATTERN.test(window.location.href);

    const waitForElement = (selector, options = {}) => {
      const root = options.root || document;
      const interval = options.interval || 120;
      const timeout =
        typeof options.timeout === "number" ? options.timeout : 8000;

      return new Promise((resolve, reject) => {
        let elapsed = 0;
        const tryFind = () => {
          const found = root.querySelector(selector);
          if (found) return resolve(found);
          if (elapsed >= timeout)
            return reject(
              new Error(`Timeout waiting for selector: ${selector}`),
            );
          elapsed += interval;
          setTimeout(tryFind, interval);
        };
        tryFind();
      });
    };

    const addStyles = (css, id) => {
      if (!css) return null;
      const styleId = id || "kbloxlib-styles";
      let style = document.getElementById(styleId);
      if (style) return style;
      style = document.createElement("style");
      style.id = styleId;
      style.textContent = css;
      document.head.appendChild(style);
      return style;
    };

    const createPanel = (id, options = {}) => {
      const panelId = id || "kblox-panel";
      let container = document.getElementById(panelId);
      if (container) return container;

      container = document.createElement("div");
      container.id = panelId;
      container.className = options.className || "kblox-panel";
      container.setAttribute("role", "dialog");
      container.setAttribute("aria-label", options.ariaLabel || "KBlox panel");
      container.innerHTML = options.innerHTML || "";

      (options.parent || document.body).appendChild(container);
      if (typeof options.afterCreate === "function")
        options.afterCreate(container);
      return container;
    };

    const openWindow = (path, opts = {}) => {
      const base = opts.base || window.location.origin;
      const target = opts.target || "_blank";
      const width = opts.width || 1200;
      const height = opts.height || 900;
      const left =
        typeof opts.left === "number"
          ? opts.left
          : Math.round((screen.width - width) / 2);
      const top =
        typeof opts.top === "number"
          ? opts.top
          : Math.round((screen.height - height) / 2);
      const features = `width=${width},height=${height},left=${left},top=${top}`;
      window.open(`${base}${path}`, target, features);
    };

    const onPageChange = (callback) => {
      if (typeof callback !== "function") return () => {};

      let currentHref = window.location.href;
      const notify = () => {
        const next = window.location.href;
        if (next !== currentHref) {
          currentHref = next;
          callback(next);
        }
      };

      const observer = new MutationObserver(notify);
      observer.observe(document, { childList: true, subtree: true });

      const wrap = (original) =>
        function () {
          const result = original.apply(this, arguments);
          notify();
          return result;
        };

      // Best-effort SPA URL change detection.
      try {
        history.pushState = wrap(history.pushState);
        history.replaceState = wrap(history.replaceState);
      } catch (_) {
        // ignore
      }

      window.addEventListener("popstate", notify);
      return () => {
        observer.disconnect();
        window.removeEventListener("popstate", notify);
      };
    };

    const log = (...args) => console.log("[KBlox]", ...args);

    window.KBloxLib = {
      isRoblox: assertRoblox,
      waitForElement,
      addStyles,
      createPanel,
      openWindow,
      onPageChange,
      log,
    };
  })();

  const KBlox = window.KBloxLib;
  if (!KBlox || !KBlox.isRoblox()) return;

  // -----------------------------
  // Universal animations (all pages)
  // -----------------------------
  const UNIVERSAL_ANIM_CSS = `
    @media (prefers-reduced-motion: no-preference) {
      body {
        animation: kblox-fade-in 180ms ease-out both;
      }

      /* Keep selectors conservative to avoid breaking layouts. */
      button,
      [role="button"],
      .btn-common,
      .rbx-btn,
      a {
        transition:
          transform 120ms ease,
          box-shadow 140ms ease,
          filter 140ms ease,
          background-color 140ms ease,
          border-color 140ms ease,
          color 140ms ease,
          opacity 140ms ease;
      }

      button:hover,
      [role="button"]:hover,
      .btn-common:hover,
      .rbx-btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.03);
      }

      button:active,
      [role="button"]:active,
      .btn-common:active,
      .rbx-btn:active {
        transform: translateY(0);
        filter: brightness(0.98);
      }

      a:hover {
        filter: brightness(1.05);
      }

      @keyframes kblox-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    }
  `;
  KBlox.addStyles(UNIVERSAL_ANIM_CSS, "kblox-universal-anim-css");

  // -----------------------------
  // Tiny "website editor" (CSS)
  // -----------------------------
  const Style = (() => {
    const upsert = (id, css) => {
      const styleId = id || "kblox-style";
      let el = document.getElementById(styleId);
      if (!el) {
        el = document.createElement("style");
        el.id = styleId;
        document.head.appendChild(el);
      }
      el.textContent = css || "";
      return el;
    };

    const remove = (id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };

    return { upsert, remove };
  })();

  const storage = (() => {
    const prefix = "kblox:";
    const key = (k) => `${prefix}${k}`;
    const get = (k) => {
      try {
        return localStorage.getItem(key(k)) || "";
      } catch (_) {
        return "";
      }
    };
    const set = (k, v) => {
      try {
        localStorage.setItem(key(k), v || "");
      } catch (_) {
        // ignore
      }
    };
    return { get, set };
  })();

  // -----------------------------
  // Route detection (subpages)
  // -----------------------------
  const getRoute = (url) => {
    const path = (url && url.pathname) || window.location.pathname || "/";

    // Avatar editor pages (legacy + new)
    if (/^\/(?:my\/avatar|avatar)(?:\/|$)/i.test(path))
      return { id: "avatar", label: "Avatar Editor" };

    // Profile view (e.g. /users/123/profile)
    if (/^\/users\/\d+\/profile(?:\/|$)/i.test(path))
      return { id: "profile", label: "Profile" };

    // Home page (logged-in home)
    if (path === "/" || /^\/home(?:\/|$)/i.test(path))
      return { id: "home", label: "Home" };

    return { id: "other", label: "Other" };
  };

  // -----------------------------
  // Global UI (panel + button)
  // -----------------------------
  const UI = (() => {
    const css = `
      #kblox-fab {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        border: 0;
        border-radius: 10px;
        padding: 10px 12px;
        background: rgba(20, 22, 26, 0.92);
        color: #fff;
        font: 600 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      }
      #kblox-fab:hover { background: rgba(20, 22, 26, 0.98); }

      #kblox-panel {
        position: fixed;
        right: 16px;
        bottom: 60px;
        z-index: 2147483647;
        width: 360px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 120px);
        overflow: auto;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(16, 18, 21, 0.96);
        color: #e7edf3;
        box-shadow: 0 18px 50px rgba(0,0,0,0.5);
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
        transition: opacity 140ms ease, transform 140ms ease;
      }
      #kblox-panel.kblox-panel--open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      #kblox-panel .kblox-h {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 12px 8px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      #kblox-panel .kblox-title {
        font: 700 13px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      #kblox-panel .kblox-meta {
        font: 500 11px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        color: rgba(231, 237, 243, 0.7);
      }
      #kblox-panel .kblox-body { padding: 12px; }

      #kblox-panel textarea {
        width: 100%;
        min-height: 140px;
        resize: vertical;
        box-sizing: border-box;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.04);
        color: #e7edf3;
        padding: 10px;
        font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      }
      #kblox-panel .kblox-row { display: flex; gap: 8px; margin-top: 10px; }
      #kblox-panel .kblox-btn {
        flex: 1;
        border: 0;
        border-radius: 10px;
        padding: 10px 12px;
        background: rgba(255,255,255,0.08);
        color: #fff;
        cursor: pointer;
        font: 700 12px/1.1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      #kblox-panel .kblox-btn:hover { background: rgba(255,255,255,0.12); }
      #kblox-panel .kblox-btn.kblox-btn--primary { background: #2d6cdf; }
      #kblox-panel .kblox-btn.kblox-btn--primary:hover { background: #2b63cb; }
      #kblox-panel .kblox-note {
        margin-top: 10px;
        font: 500 11px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        color: rgba(231, 237, 243, 0.7);
      }
      #kblox-panel code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    `;

    KBlox.addStyles(css, "kblox-ui-css");

    const fabId = "kblox-fab";
    const panelId = "kblox-panel";
    const cssTextId = "kblox-css-text";
    const routeLabelId = "kblox-route-label";

    const ensure = () => {
      let fab = document.getElementById(fabId);
      if (!fab) {
        fab = document.createElement("button");
        fab.id = fabId;
        fab.type = "button";
        fab.textContent = "KBlox";
        document.body.appendChild(fab);
      }

      const panel = KBlox.createPanel(panelId, {
        innerHTML: `
          <div class="kblox-h">
            <div>
              <div class="kblox-title">KBlox Website Editor</div>
              <div class="kblox-meta">Route: <code id="${routeLabelId}">...</code> | v${VERSION}</div>
            </div>
            <button class="kblox-btn" type="button" id="kblox-close" style="flex:0; padding:8px 10px;">X</button>
          </div>
          <div class="kblox-body">
            <div class="kblox-meta">CSS for this route (saved locally in your browser)</div>
            <textarea id="${cssTextId}" spellcheck="false" placeholder="Example:\n#rbx-body { filter: saturate(1.2); }"></textarea>
            <div class="kblox-row">
              <button class="kblox-btn kblox-btn--primary" type="button" id="kblox-apply">Apply</button>
              <button class="kblox-btn" type="button" id="kblox-clear">Clear</button>
            </div>
            <div class="kblox-note">
              Tip: press <code>Ctrl</code>+<code>Shift</code>+<code>E</code> to toggle this panel.
            </div>
          </div>
        `.trim(),
      });

      const toggle = (open) => {
        const isOpen = panel.classList.contains("kblox-panel--open");
        const next = typeof open === "boolean" ? open : !isOpen;
        panel.classList.toggle("kblox-panel--open", next);
      };

      fab.addEventListener("click", () => toggle());
      panel
        .querySelector("#kblox-close")
        ?.addEventListener("click", () => toggle(false));

      document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) {
          e.preventDefault();
          toggle();
        }
      });

      document.addEventListener("click", (e) => {
        if (!panel.classList.contains("kblox-panel--open")) return;
        if (panel.contains(e.target) || fab.contains(e.target)) return;
        toggle(false);
      });

      return {
        panel,
        fab,
        setRouteLabel: (text) => {
          const el = panel.querySelector(`#${routeLabelId}`);
          if (el) el.textContent = text;
        },
        getCssTextArea: () => panel.querySelector(`#${cssTextId}`),
        onApply: (fn) =>
          panel.querySelector("#kblox-apply")?.addEventListener("click", fn),
        onClear: (fn) =>
          panel.querySelector("#kblox-clear")?.addEventListener("click", fn),
      };
    };

    return { ensure };
  })();

  // -----------------------------
  // Modules (per subpage behavior)
  // -----------------------------
  const Modules = (() => {
    const avatar = {
      id: "avatar",
      mount: () => {
        const css = `
          .kblox-avatar-chip {
            position: fixed;
            left: 16px;
            bottom: 16px;
            z-index: 2147483647;
            border-radius: 999px;
            padding: 8px 10px;
            background: rgba(45, 108, 223, 0.92);
            color: #fff;
            font: 700 12px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          }
        `;
        Style.upsert("kblox-avatar-css", css);

        let chip = document.getElementById("kblox-avatar-chip");
        if (!chip) {
          chip = document.createElement("button");
          chip.id = "kblox-avatar-chip";
          chip.type = "button";
          chip.className = "kblox-avatar-chip";
          chip.textContent = "Avatar shortcuts";
          document.body.appendChild(chip);
        }

        const actions = [
          { label: "New Avatar Editor", path: "/avatar/editor" },
          { label: "Legacy Avatar (Outfits)", path: "/my/avatar" },
          { label: "Avatar Shop", path: "/catalog/Avatar" },
        ];

        const onClick = () => {
          // Use the global KBlox panel as the "editor"; this chip just opens useful pages.
          const next = actions[(Math.random() * actions.length) | 0];
          KBlox.openWindow(next.path);
        };
        chip.addEventListener("click", onClick);

        return () => {
          chip?.removeEventListener("click", onClick);
          chip?.remove();
          Style.remove("kblox-avatar-css");
        };
      },
    };

    const home = {
      id: "home",
      mount: () => {
        const css = `
          .kblox-home-badge {
            position: fixed;
            left: 16px;
            top: 16px;
            z-index: 2147483647;
            border-radius: 10px;
            padding: 10px 12px;
            background: rgba(16, 18, 21, 0.92);
            border: 1px solid rgba(255,255,255,0.12);
            color: #e7edf3;
            font: 600 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          }
        `;
        Style.upsert("kblox-home-css", css);

        let badge = document.getElementById("kblox-home-badge");
        if (!badge) {
          badge = document.createElement("div");
          badge.id = "kblox-home-badge";
          badge.className = "kblox-home-badge";
          badge.textContent = "KBlox active on Home (Ctrl+Shift+E to edit CSS)";
          document.body.appendChild(badge);
          setTimeout(() => badge?.remove(), 4500);
        }

        return () => {
          badge?.remove();
          Style.remove("kblox-home-css");
        };
      },
    };

    const profile = {
      id: "profile",
      mount: () => {
        const m = window.location.pathname.match(/^\/users\/(\d+)\/profile/i);
        const userId = m ? m[1] : "";

        const css = `
          .kblox-profile-chip {
            position: fixed;
            left: 16px;
            bottom: 16px;
            z-index: 2147483647;
            border-radius: 999px;
            padding: 8px 10px;
            background: rgba(20, 22, 26, 0.92);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.12);
            font: 700 12px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          }
        `;
        Style.upsert("kblox-profile-css", css);

        let chip = document.getElementById("kblox-profile-chip");
        if (!chip) {
          chip = document.createElement("button");
          chip.id = "kblox-profile-chip";
          chip.type = "button";
          chip.className = "kblox-profile-chip";
          chip.textContent = userId ? `Copy userId: ${userId}` : "Copy userId";
          document.body.appendChild(chip);
        }

        const onClick = async () => {
          try {
            await navigator.clipboard.writeText(userId || "");
            chip.textContent = "Copied!";
            setTimeout(() => {
              chip.textContent = userId
                ? `Copy userId: ${userId}`
                : "Copy userId";
            }, 1200);
          } catch (_) {
            // Clipboard may be blocked; just show the value.
            chip.textContent = userId
              ? `userId: ${userId}`
              : "userId not found";
          }
        };
        chip.addEventListener("click", onClick);

        return () => {
          chip?.removeEventListener("click", onClick);
          chip?.remove();
          Style.remove("kblox-profile-css");
        };
      },
    };

    const other = { id: "other", mount: () => () => {} };

    const byId = { avatar, home, profile, other };
    return { byId };
  })();

  // -----------------------------
  // Router + editor wiring
  // -----------------------------
  const ui = UI.ensure();

  let active = { routeId: null, cleanup: null };

  const applyRouteCss = (routeId) => {
    const globalCss = storage.get("css:global");
    const routeCss = storage.get(`css:${routeId}`);
    Style.upsert("kblox-css-global", globalCss);
    Style.upsert("kblox-css-route", routeCss);
  };

  const loadCssToEditor = (routeId) => {
    const textarea = ui.getCssTextArea();
    if (!textarea) return;
    textarea.value = storage.get(`css:${routeId}`);
  };

  ui.onApply(() => {
    const route = getRoute(new URL(window.location.href));
    const textarea = ui.getCssTextArea();
    storage.set(`css:${route.id}`, textarea ? textarea.value : "");
    applyRouteCss(route.id);
  });

  ui.onClear(() => {
    const route = getRoute(new URL(window.location.href));
    const textarea = ui.getCssTextArea();
    if (textarea) textarea.value = "";
    storage.set(`css:${route.id}`, "");
    applyRouteCss(route.id);
  });

  const activate = (href) => {
    const url = new URL(href || window.location.href);
    const route = getRoute(url);

    if (active.routeId === route.id) {
      ui.setRouteLabel(route.id);
      return;
    }

    try {
      if (typeof active.cleanup === "function") active.cleanup();
    } catch (e) {
      KBlox.log("cleanup error", e);
    }

    active.routeId = route.id;
    ui.setRouteLabel(route.id);
    loadCssToEditor(route.id);
    applyRouteCss(route.id);

    const mod = Modules.byId[route.id] || Modules.byId.other;
    try {
      active.cleanup = mod.mount();
    } catch (e) {
      KBlox.log(`module mount failed (${route.id})`, e);
      active.cleanup = null;
    }
  };

  // Initial
  activate(window.location.href);

  // Re-run on SPA navigations.
  KBlox.onPageChange((href) => activate(href));
})();
