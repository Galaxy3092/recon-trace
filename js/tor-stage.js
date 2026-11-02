/**
 * ReconTrace Stage 2: Tor & Dark Web Search Engine
 * Manages Tor routing settings, Ahmia / Onion indexers, and on-demand deep scans.
 */

class ReconTor {
  static STORAGE_KEY = 'recontrace_tor_settings';

  static TOR_ENGINES = [
    {
      id: 'ahmia_onion',
      name: 'Ahmia (Hidden Service .onion)',
      onionUrl: 'http://juhanurmih5wu7dgsvft2authqqgah6aehmrsxdgrflvdla2gahunemba.onion/search/?q={query}',
      clearwebMirror: 'https://ahmia.fi/search/?q={query}',
      desc: 'Top verified open-source darknet search engine (collaborates with Europol/safety researchers)'
    },
    {
      id: 'torch_onion',
      name: 'Torch Search',
      onionUrl: 'http://xmh57jrknzkhv6y3ls3ubitzfqnkrwxhopf5aygthi7d6rfdvd466tid.onion/cgi-bin/omega/omega?P={query}',
      clearwebMirror: null,
      desc: 'One of the oldest indexed Tor databases'
    },
    {
      id: 'haystak_onion',
      name: 'Haystak Darknet Engine',
      onionUrl: 'http://haystak5nwoamrvq2rflm6nvhnvdhiqlfdxdspdaonq3sluptprimitive.onion/?q={query}',
      clearwebMirror: null,
      desc: 'Fast crawler indexing billions of onion pages'
    }
  ];

  static async getSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(this.STORAGE_KEY);
        if (stored && stored[this.STORAGE_KEY]) return stored[this.STORAGE_KEY];
      } else {
        const local = localStorage.getItem(this.STORAGE_KEY);
        if (local) return JSON.parse(local);
      }
    } catch (e) {
      console.warn('Could not read Tor settings:', e);
    }
    return {
      torProxyHost: '127.0.0.1',
      torProxyPort: 9050,
      proxyType: 'socks5',
      routeAllThroughTor: false,
      autoEscalateIfLowMatch: false,
      autoEscalateThreshold: 75,
      preferClearwebMirrors: false // if true, uses ahmia.fi when no local tor is running
    };
  }

  static async saveSettings(settings) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: settings });
      } else {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
      }
      return true;
    } catch (e) {
      console.error('Failed to save Tor settings:', e);
      return false;
    }
  }

  /**
   * Configure chrome.proxy API if user enables Tor routing
   */
  static async configureBrowserProxy(enable = false) {
    if (typeof chrome === 'undefined' || !chrome.proxy) {
      return { supported: false, message: 'Chrome Proxy API not available in this context.' };
    }

    const settings = await this.getSettings();

    if (!enable) {
      // Clear proxy, return to direct connection
      return new Promise((resolve) => {
        chrome.proxy.settings.clear({ scope: 'regular' }, () => {
          resolve({ supported: true, enabled: false, message: 'Proxy deactivated. Direct connection.' });
        });
      });
    }

    // Set SOCKS5 proxy config
    const config = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: 'socks5',
          host: settings.torProxyHost,
          port: parseInt(settings.torProxyPort, 10)
        },
        bypassList: ['localhost', '127.0.0.1']
      }
    };

    return new Promise((resolve) => {
      chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
        if (chrome.runtime.lastError) {
          resolve({ supported: true, enabled: false, error: chrome.runtime.lastError.message });
        } else {
          resolve({
            supported: true,
            enabled: true,
            message: `Routing active via Tor (${settings.torProxyHost}:${settings.torProxyPort})`
          });
        }
      });
    });
  }

  /**
   * Build targeted Tor queries from extracted forensic dorks
   */
  static generateTorQueries(dorks = [], customKeywords = '') {
    const list = [...dorks];
    if (customKeywords && customKeywords.trim()) {
      list.unshift(customKeywords.trim());
    }

    const queries = [];
    for (const dork of list) {
      for (const engine of this.TOR_ENGINES) {
        const queryUrl = engine.onionUrl.replace('{query}', encodeURIComponent(dork));
        const mirrorUrl = engine.clearwebMirror ? engine.clearwebMirror.replace('{query}', encodeURIComponent(dork)) : null;

        queries.push({
          engineId: engine.id,
          engineName: engine.name,
          dork: dork,
          onionUrl: queryUrl,
          mirrorUrl: mirrorUrl,
          desc: engine.desc
        });
      }
    }
    return queries;
  }
}

if (typeof window !== 'undefined') {
  window.ReconTor = ReconTor;
}
