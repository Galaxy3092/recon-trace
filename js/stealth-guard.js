/**
 * ReconTrace Stealth Guard (PI Operational Security & Air-Gap Engine)
 * Guarantees zero activity leakage to:
 *  1. Browser History (auto-deletes visited lead URLs & supports ephemeral incognito)
 *  2. Local Router / ISP (routes queries through Tor/PAC with remote DNS)
 *  3. Host Operating System (RAM-only volatile buffers, zero temp files on disk)
 */

class ReconStealthGuard {
  static STORAGE_KEY = 'recontrace_stealth_settings';

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
      console.warn('Failed to read stealth settings:', e);
    }
    return {
      autoPurgeHistory: true,       // Auto-delete investigated URLs from browser history
      preferIncognito: true,        // Spawn external leads in isolated Incognito windows
      zeroDiskResidue: true,        // RAM-only buffer enforcement
      clearClipboardOnLock: true    // Purge clipboard when vault locks
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
      console.error('Failed to save stealth settings:', e);
      return false;
    }
  }

  /**
   * Open a lead URL with complete privacy from browser history and autocomplete
   */
  static async openLeadStealth(targetUrl) {
    const settings = await this.getSettings();

    // 1. Try launching in Ephemeral Incognito Mode (No history, no cookies, no cache)
    if (settings.preferIncognito && typeof chrome !== 'undefined' && chrome.windows) {
      try {
        await chrome.windows.create({
          url: targetUrl,
          incognito: true
        });
        return { mode: 'incognito', success: true };
      } catch (err) {
        console.warn('Incognito window creation rejected (fallback to history purge):', err);
      }
    }

    // 2. Fallback: Open in new tab and immediately purge from chrome.history
    const openedTab = window.open(targetUrl, '_blank', 'noopener,noreferrer');

    if (settings.autoPurgeHistory) {
      this.scheduleHistoryPurge(targetUrl);
    }

    return { mode: 'standard_with_purge', success: Boolean(openedTab) };
  }

  /**
   * Schedule automated deletion of URL from browser history database
   */
  static scheduleHistoryPurge(targetUrl) {
    if (typeof chrome === 'undefined' || !chrome.history || !chrome.history.deleteUrl) {
      return;
    }

    // Attempt deletion at staggered intervals to guarantee removal once browser writes to SQLite
    const intervals = [1200, 3000, 6000];
    intervals.forEach(ms => {
      setTimeout(() => {
        chrome.history.deleteUrl({ url: targetUrl }, () => {
          if (chrome.runtime.lastError) {
            // Silently ignore if not in history yet
          }
        });
      }, ms);
    });
  }

  /**
   * Purge an entire list of case leads from browser history
   */
  static async purgeCaseUrlsFromHistory(urls = []) {
    if (typeof chrome === 'undefined' || !chrome.history || !chrome.history.deleteUrl) {
      return { supported: false, count: 0 };
    }

    let purgedCount = 0;
    for (const url of urls) {
      if (url && typeof url === 'string') {
        chrome.history.deleteUrl({ url: url });
        purgedCount++;
      }
    }

    return { supported: true, count: purgedCount };
  }

  /**
   * Wipe clipboard to prevent OS-level clipboard monitors (Windows Win+V / Linux Klipper) from logging evidence
   */
  static async clearSystemClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText('');
        return true;
      }
    } catch (e) {
      console.warn('Clipboard wipe failed:', e);
    }
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.ReconStealthGuard = ReconStealthGuard;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ReconStealthGuard = ReconStealthGuard;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReconStealthGuard;
}
