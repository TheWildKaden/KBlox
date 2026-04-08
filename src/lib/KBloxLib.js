;(function () {
    'use strict';

    if (window.KBloxLib) {
        return;
    }

    const ROBLOX_HOST_PATTERN = /^https:\/\/(?:www|web|web\d?)\.roblox\.com/i;

    const assertRoblox = () => ROBLOX_HOST_PATTERN.test(window.location.href);

    const waitForElement = (selector, options = {}) => {
        const root = options.root || document;
        const interval = options.interval || 120;
        const timeout = typeof options.timeout === 'number' ? options.timeout : 8000;

        return new Promise((resolve, reject) => {
            let elapsed = 0;

            const tryFind = () => {
                const found = root.querySelector(selector);
                if (found) {
                    return resolve(found);
                }

                if (elapsed >= timeout) {
                    return reject(new Error(`Timeout waiting for selector: ${selector}`));
                }

                elapsed += interval;
                setTimeout(tryFind, interval);
            };

            tryFind();
        });
    };

    const addStyles = (css, id) => {
        if (!css) return null;
        const styleId = id || 'kbloxlib-styles';
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
            throw new Error('KBloxLib: tab bar not found');
        }

        const tabId = options.tabId || 'kblox-tab';
        let existingTab = tabBar.querySelector(`#${tabId}`);
        if (existingTab) {
            return existingTab;
        }

        const tab = document.createElement('li');
        tab.className = options.tabClass || 'rbx-tab seven-tab';
        tab.id = tabId;
        tab.innerHTML = options.content || `
            <button type="button" class="rbx-tab-heading" id="heading.${tabId}">
                <span class="text-lead">
                    ${options.label || 'KBlox'}
                    <span class="icon-down"></span>
                </span>
            </button>
        `.trim();

        if (options.insertBefore) {
            tabBar.insertBefore(tab, options.insertBefore);
        } else if (options.insertAfter) {
            tabBar.insertBefore(tab, options.insertAfter.nextElementSibling);
        } else {
            tabBar.appendChild(tab);
        }

        const button = tab.querySelector('button');
        if (button && typeof options.onClick === 'function') {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                options.onClick(event, tab, button);
            });
        }

        return tab;
    };

    const createPanel = (id, options = {}) => {
        const panelId = id || 'kblox-panel';
        let container = document.getElementById(panelId);
        if (container) {
            return container;
        }

        container = document.createElement('div');
        container.id = panelId;
        container.className = options.className || 'kblox-panel';
        container.setAttribute('role', 'dialog');
        container.setAttribute('aria-label', options.ariaLabel || 'KBlox panel');
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
        const width = opts.width || 1200;
        const height = opts.height || 900;
        const left = typeof opts.left === 'number' ? opts.left : Math.round((screen.width - width) / 2);
        const top = typeof opts.top === 'number' ? opts.top : Math.round((screen.height - height) / 2);
        const features = `width=${width},height=${height},left=${left},top=${top}`;
        window.open(`${base}${path}`, target, features);
    };

    const onPageChange = (callback) => {
        if (typeof callback !== 'function') return () => {};

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

        const wrap = (original) => function () {
            const result = original.apply(this, arguments);
            notify();
            return result;
        };

        history.pushState = wrap(history.pushState);
        history.replaceState = wrap(history.replaceState);
        window.addEventListener('popstate', notify);
        window.addEventListener('replacestate', notify);
        window.addEventListener('pushstate', notify);

        return () => {
            observer.disconnect();
            window.removeEventListener('popstate', notify);
        };
    };

    const log = (...args) => console.log('[KBloxLib]', ...args);

    window.KBloxLib = {
        isRoblox: assertRoblox,
        waitForElement,
        addStyles,
        createTab,
        createPanel,
        openWindow,
        onPageChange,
        log,
    };
})();
