// ==UserScript==
// @name         Kaden's Roblox Enhancer - Avatar Editor
// @namespace    http://tampermonkey.net/
// @version      2026.04.08
// @description  Adds KadensEditor quick tab + utility panel for Roblox's avatar tools.
// @author       KadenM
// @match        https://www.roblox.com/*
// @match        https://web.roblox.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const createLocalKBloxLib = () => {
        const isRoblox = () => /roblox\\.com$/i.test(window.location.hostname) || /roblox\\.com/i.test(window.location.host);

        const waitForElement = (selector, options = {}) => {
            const root = options.root || document;
            const interval = options.interval || 150;
            const timeout = typeof options.timeout === 'number' ? options.timeout : 8000;

            return new Promise((resolve, reject) => {
                let elapsed = 0;

                const tryFind = () => {
                    const element = root.querySelector(selector);
                    if (element) {
                        resolve(element);
                        return;
                    }
                    if (elapsed >= timeout) {
                        reject(new Error(`Timeout waiting for selector: ${selector}`));
                        return;
                    }
                    elapsed += interval;
                    setTimeout(tryFind, interval);
                };

                tryFind();
            });
        };

        const addStyles = (css, id) => {
            if (!css) return null;
            const styleId = id || 'kadens-enhancer-global-style';
            let style = document.getElementById(styleId);
            if (style) {
                return style;
            }
            style = document.createElement('style');
            style.id = styleId;
            style.textContent = css;
            document.head.appendChild(style);
            return style;
        };

        const createTab = (options) => {
            const tabBar = options.parent || document.querySelector('#horizontal-tabs');
            if (!tabBar) {
                throw new Error('KadensLib: horizontal tabs not found');
            }
            const tabId = options.tabId || 'kadens-editor-tab';
            const existing = tabBar.querySelector(`#${tabId}`);
            if (existing) {
                return existing;
            }
            const li = document.createElement('li');
            li.className = options.tabClass || 'rbx-tab seven-tab';
            li.id = tabId;
            li.innerHTML = options.content || `
                <button type="button" class="rbx-tab-heading" id="heading.${tabId}">
                    <span class="text-lead">
                        ${options.label || 'KadensEditor'}
                        <span class="icon-down"></span>
                    </span>
                </button>
            `.trim();

            tabBar.appendChild(li);

            const button = li.querySelector('button');
            if (button && typeof options.onClick === 'function') {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    options.onClick(event, li, button);
                });
            }

            return li;
        };

        const createPanel = (id, options = {}) => {
            const panelId = id || 'kadens-enhancer-panel';
            let container = document.getElementById(panelId);
            if (container) {
                return container;
            }

            container = document.createElement('div');
            container.id = panelId;
            container.className = options.className || 'kadens-panel';
            container.setAttribute('role', 'dialog');
            container.setAttribute('aria-label', options.ariaLabel || 'Kadens enhancer panel');
            container.innerHTML = options.innerHTML || '';

            if (options.parent) {
                options.parent.appendChild(container);
            } else {
                document.body.appendChild(container);
            }

            if (typeof options.afterCreate === 'function') {
                options.afterCreate(container);
            }

            return container;
        };

        const openWindow = (path, opts = {}) => {
            const base = opts.base || window.location.origin;
            const target = opts.target || '_blank';
            const width = opts.width || 1100;
            const height = opts.height || 800;
            const left = typeof opts.left === 'number' ? opts.left : Math.round((screen.width - width) / 2);
            const top = typeof opts.top === 'number' ? opts.top : Math.round((screen.height - height) / 2);
            const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes`;
            window.open(`${base}${path}`, target, features);
        };

        const onPageChange = (callback) => {
            if (typeof callback !== 'function') return () => {};
            const handle = () => callback(window.location.href);
            window.addEventListener('popstate', handle);
            window.addEventListener('pushstate', handle);
            window.addEventListener('replacestate', handle);
            return () => {
                window.removeEventListener('popstate', handle);
                window.removeEventListener('pushstate', handle);
                window.removeEventListener('replacestate', handle);
            };
        };

        const log = (...args) => console.log('[KadensEnhancer]', ...args);

        return {
            isRoblox,
            waitForElement,
            addStyles,
            createTab,
            createPanel,
            openWindow,
            onPageChange,
            log,
        };
    };

    const KBlox = window.KBloxLib || createLocalKBloxLib();
    if (!KBlox.isRoblox()) {
        KBlox.log('Not running outside of Roblox.');
        return;
    }

    const panelCSS = `
        #kadens-enhancer-panel {
            position: absolute;
            top: 70px;
            right: 40px;
            width: 280px;
            background: #23282d;
            color: #f3f3f3;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.35);
            padding: 14px;
            font-family: 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-12px);
            transition: transform 0.22s ease, opacity 0.22s ease, visibility 0.22s ease;
            z-index: 999;
        }

        #kadens-enhancer-panel.kadens-panel--visible {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }

        .kadens-panel h3 {
            margin: 0 0 8px;
            font-size: 16px;
            font-weight: 600;
        }

        .kadens-panel-status {
            margin: 0 0 12px;
            font-size: 13px;
            color: #95a2ad;
        }

        .kadens-action-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: grid;
            gap: 8px;
        }

        .kadens-action-item {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            cursor: pointer;
            transition: border 0.15s ease, background 0.15s ease;
        }

        .kadens-action-item:hover {
            border-color: rgba(255, 255, 255, 0.35);
            background: rgba(255, 255, 255, 0.05);
        }

        .kadens-action-item span {
            font-size: 11px;
            color: #9ba7b5;
        }

        .kadens-panel-footer {
            margin-top: 14px;
            font-size: 11px;
            color: #7b8a97;
            text-align: center;
        }
    `;

    KBlox.addStyles(panelCSS, 'kadens-enhancer-panel-css');

    const quickActions = [
        { label: 'Legacy Avatar Editor', path: '/avatar', hint: 'Classic editor & outfits' },
        { label: 'New Avatar Editor', path: '/avatar/editor', hint: 'Canvas-style editor' },
        { label: 'Avatar Shop', path: '/catalog/Avatar', hint: 'Browse new gear' },
        { label: 'Outfits', path: '/my/avatar', hint: 'Save & load outfits' },
    ];

    const buildPanel = () => {
        const actions = quickActions
            .map(
                (action, index) => `
            <li class="kadens-action-item" data-action-index="${index}">
                <div>
                    ${action.label}
                    <span>${action.hint}</span>
                </div>
                <span aria-hidden="true">→</span>
            </li>
        `
            )
            .join('');

        const html = `
            <div class="kadens-panel">
                <h3>Kadens Avatar Tools</h3>
                <p class="kadens-panel-status">Current path: <strong data-kblox-status>...</strong></p>
                <ul class="kadens-action-list">
                    ${actions}
                </ul>
                <p class="kadens-panel-footer">Click any shortcut to open it in a new tab.</p>
            </div>
        `;

        return html;
    };

    const panel = KBlox.createPanel('kadens-enhancer-panel', {
        innerHTML: buildPanel(),
        afterCreate: (container) => {
            const list = container.querySelector('.kadens-action-list');
            const status = container.querySelector('[data-kblox-status]');

            const updateStatus = (href) => {
                const path = href.replace(window.location.origin, '') || '/';
                if (status) {
                    status.textContent = path;
                }
            };

            updateStatus(window.location.href);

            if (list) {
                list.addEventListener('click', (event) => {
                    const item = event.target.closest('[data-action-index]');
                    if (!item) {
                        return;
                    }
                    const action = quickActions[Number(item.dataset.actionIndex)];
                    if (action) {
                        KBlox.openWindow(action.path);
                    }
                });
            }

            KBlox.onPageChange((href) => updateStatus(href));
        },
    });

    let tabButton;

    KBlox.waitForElement('#horizontal-tabs', { timeout: 12000 })
        .then((tabBar) => {
            const tab = KBlox.createTab({
                parent: tabBar,
                tabId: 'kadens-editor-tab',
                label: 'KadensEditor <span class="icon-down"></span>',
                onClick: () => {
                    panel.classList.toggle('kadens-panel--visible');
                },
            });
            tabButton = tab.querySelector('button');
        })
        .catch((error) => {
            KBlox.log('Failed to insert Kadens tab', error);
        });

    document.addEventListener('click', (event) => {
        if (!panel || !tabButton) {
            return;
        }
        if (panel.classList.contains('kadens-panel--visible')) {
            if (!panel.contains(event.target) && !tabButton.contains(event.target)) {
                panel.classList.remove('kadens-panel--visible');
            }
        }
    });

    window.addEventListener('resize', () => {
        panel && panel.classList.remove('kadens-panel--visible');
    });
})();
