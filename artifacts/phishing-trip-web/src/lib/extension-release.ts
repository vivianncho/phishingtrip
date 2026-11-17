import release from '../../../../extensions/stillwater/release.json';

export type ExtensionBrowser = 'chrome' | 'edge' | 'safari';
const hosts: Record<ExtensionBrowser, string> = {
  chrome: 'chromewebstore.google.com',
  edge: 'microsoftedge.microsoft.com',
  safari: 'apps.apple.com',
};

function storeUrl(browser: ExtensionBrowser): string | null {
  try {
    const url = new URL(release.stores[browser]);
    if (url.protocol !== 'https:' || url.hostname !== hosts[browser] ||
        url.username || url.password || url.search || url.hash) return null;
    if (browser === 'chrome' && !/^\/detail\/(?:[^/]+\/)?[a-p]{32}\/?$/.test(url.pathname)) return null;
    if (browser === 'edge' && !/^\/addons\/detail\/(?:[^/]+\/)?[a-p]{32}\/?$/.test(url.pathname)) return null;
    if (browser === 'safari' && !/^\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id\d+\/?$/.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

// Blank values mean the listing has not been published. Never link a search
// result or a made-up listing as if the extension were available to install.
export const extensionStores = (['chrome', 'edge', 'safari'] as const).map(browser => ({
  browser,
  label: browser === 'chrome' ? 'Chrome' : browser === 'edge' ? 'Microsoft Edge' : 'Safari on iPhone',
  url: storeUrl(browser),
}));
