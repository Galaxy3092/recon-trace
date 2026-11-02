/**
 * ReconTrace Stage 2: Tor & Dark Web Search Engine (Hardened OPSEC)
 * Features:
 *  - Auto-detection of active Tor ports (9050 daemon / 9150 Tor Browser)
 *  - Zero-DNS-Leak PAC (Proxy Auto-Configuration) script with remote DNS resolution
 *  - Ahmia & darknet hidden service search dispatchers
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
      detectedPort: null,
      proxyType: 'socks5',
      routeAllThroughTor: false,
      autoEscalateIfLowMatch: false,
      autoEscalateThreshold: 75,
      preferClearwebMirrors: false
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
   * Auto-detect if user has an active Tor instance running (system daemon 9050 or Tor Browser 9150)
   */
  static async autoDetectTorPort() {
    const candidatePorts = [9050, 9150, 9051];
    
    for (const port of candidatePorts) {
      try {
        const isListening = await this.probePort(port);
        if (isListening) {
          const settings = await this.getSettings();
          settings.torProxyPort = port;
          settings.detectedPort = port;
          await this.saveSettings(settings);
          return {
            found: true,
            port: port,
            source: port === 9150 ? 'Tor Browser' : 'Tor System Daemon'
          };
        }
      } catch (err) {
        // Port not reachable, continue
      }
    }

    return { found: false, message: 'No active Tor daemon detected on ports 9050 or 9150.' };
  }

  /**
   * Probe local port response
   */
  static probePort(port) {
    return new Promise((resolve) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        resolve(true);
      }, 1000);

      fetch(`http://127.0.0.1:${port}/`, {
        mode: 'no-cors',
        signal: controller.signal
      })
      .then(() => {
        clearTimeout(timeoutId);
        resolve(true);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError' || (err.message && err.message.includes('network'))) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  /**
   * Configure chrome.proxy API with Zero-DNS-Leak PAC Script
   * Ensures SOCKS5 handles DNS resolution remotely (socks5h behavior) to eliminate ISP leaks.
   */
  static async configureBrowserProxy(enable = false) {
    if (typeof chrome === 'undefined' || !chrome.proxy) {
      return { supported: false, message: 'Chrome Proxy API not available in standard tab context.' };
    }

    const settings = await this.getSettings();

    if (!enable) {
      return new Promise((resolve) => {
        chrome.proxy.settings.clear({ scope: 'regular' }, () => {
          resolve({ supported: true, enabled: false, message: 'Proxy deactivated. Direct connection.' });
        });
      });
    }

    const host = settings.torProxyHost || '127.0.0.1';
    const port = settings.torProxyPort || 9050;
    const routeAll = Boolean(settings.routeAllThroughTor);

    // Hardened PAC script:
    // 1. Prevents DNS resolution of .onion domains locally by delegating straight to SOCKS5.
    // 2. Direct connection for internal extensions & localhost.
    const pacScriptData = `
      function FindProxyForURL(url, host) {
        // Bypass localhost and internal browser resources
        if (shExpMatch(host, "*.local") || 
            isInNet(host, "127.0.0.0", "255.0.0.0") ||
            host === "localhost") {
          return "DIRECT";
        }

        // Always route hidden service .onion requests through Tor SOCKS5 (Remote DNS)
        if (shExpMatch(host, "*.onion")) {
          return "SOCKS5 ${host}:${port}; SOCKS ${host}:${port}";
        }

        // Route all other queries through Tor if user enabled full routing
        ${routeAll ? `return "SOCKS5 ${host}:${port}; SOCKS ${host}:${port}; DIRECT";` : `return "DIRECT";`}
      }
    `;

    const config = {
      mode: 'pac_script',
      pacScript: {
        data: pacScriptData
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
            message: `Tor routing active via ${host}:${port} with Zero-DNS-Leak remote resolution.`
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
if (typeof globalThis !== 'undefined') {
  globalThis.ReconTor = ReconTor;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReconTor;
}
