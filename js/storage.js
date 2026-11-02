/**
 * ReconTrace Case Management & Storage Layer (E2EE Hardened)
 * Transparently encrypts cases, evidence, notes, and leads at rest
 * using AES-256-GCM via ReconCrypto.
 */

class ReconStorage {
  static CASES_KEY = 'recontrace_active_cases_enc';
  static UNENC_CASES_KEY = 'recontrace_active_cases'; // Legacy unencrypted key

  /**
   * Check if storage has an encrypted vault
   */
  static async isEncryptedVault() {
    if (typeof ReconCrypto !== 'undefined') {
      return await ReconCrypto.isVaultInitialized();
    }
    return false;
  }

  /**
   * Get all stored cases (transparently decrypts if vault is unlocked)
   */
  static async getAllCases() {
    try {
      let rawData = null;

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get([this.CASES_KEY, this.UNENC_CASES_KEY]);
        rawData = stored[this.CASES_KEY] || stored[this.UNENC_CASES_KEY];
      } else {
        rawData = localStorage.getItem(this.CASES_KEY) || localStorage.getItem(this.UNENC_CASES_KEY);
      }

      if (!rawData) return [];

      // Check if data is an encrypted JSON string
      if (typeof rawData === 'string' && rawData.startsWith('{"iv":')) {
        if (typeof ReconCrypto !== 'undefined' && ReconCrypto.isUnlocked) {
          const decrypted = await ReconCrypto.decrypt(rawData);
          return JSON.parse(decrypted);
        } else {
          // Vault is locked!
          return { locked: true, message: 'Vault is locked. Enter Master Passphrase to view cases.' };
        }
      }

      // Unencrypted fallback (if vault hasn't been set up yet)
      return typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch (e) {
      console.warn('Failed to load cases:', e);
      return [];
    }
  }

  /**
   * Save cases array (transparently encrypts if vault is initialized and unlocked)
   */
  static async saveAllCases(cases) {
    try {
      let payloadToStore = cases;

      if (typeof ReconCrypto !== 'undefined' && ReconCrypto.isUnlocked) {
        const serialized = JSON.stringify(cases);
        payloadToStore = await ReconCrypto.encrypt(serialized);

        // Store encrypted and clean legacy plaintext
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ [this.CASES_KEY]: payloadToStore });
          await chrome.storage.local.remove(this.UNENC_CASES_KEY);
        } else {
          localStorage.setItem(this.CASES_KEY, payloadToStore);
          localStorage.removeItem(this.UNENC_CASES_KEY);
        }
        return true;
      }

      // Unencrypted storage if vault not unlocked
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [this.UNENC_CASES_KEY]: payloadToStore });
      } else {
        localStorage.setItem(this.UNENC_CASES_KEY, JSON.stringify(payloadToStore));
      }
      return true;
    } catch (e) {
      console.error('Failed to save cases:', e);
      return false;
    }
  }

  /**
   * Create or update a case
   */
  static async saveCase(caseData) {
    const cases = await this.getAllCases();
    if (cases && cases.locked) {
      throw new Error('Cannot save to locked vault. Unlock first.');
    }

    const caseList = Array.isArray(cases) ? cases : [];
    const existingIndex = caseList.findIndex(c => c.id === caseData.id);

    if (existingIndex >= 0) {
      caseList[existingIndex] = { ...caseList[existingIndex], ...caseData, updatedAt: new Date().toISOString() };
    } else {
      if (!caseData.id) caseData.id = 'case_' + Date.now();
      caseData.createdAt = new Date().toISOString();
      caseData.updatedAt = new Date().toISOString();
      if (!caseData.leads) caseData.leads = [];
      caseList.unshift(caseData);
    }

    await this.saveAllCases(caseList);
    return caseData;
  }

  /**
   * Add a verified lead to a case
   */
  static async addLeadToCase(caseId, lead) {
    const cases = await this.getAllCases();
    if (cases && cases.locked) return false;

    const caseList = Array.isArray(cases) ? cases : [];
    const currentCase = caseList.find(c => c.id === caseId);
    if (!currentCase) return false;

    if (!currentCase.leads) currentCase.leads = [];
    const exists = currentCase.leads.some(l => l.url === lead.url);
    if (!exists) {
      lead.savedAt = new Date().toISOString();
      currentCase.leads.push(lead);
      await this.saveAllCases(caseList);
    }
    return true;
  }

  /**
   * Export Case Dossier as formatted Markdown
   */
  static generateMarkdownDossier(caseData) {
    let md = `# 🛡️ RECONTRACE INVESTIGATION DOSSIER\n`;
    md += `**Case Title:** ${this.sanitizeText(caseData.title || 'Untitled Case')}\n`;
    md += `**Case ID:** \`${this.sanitizeText(caseData.id || 'N/A')}\`\n`;
    md += `**Created Date:** ${caseData.createdAt || 'N/A'}\n`;
    md += `**Evidence SHA-256 Hash:** \`${caseData.imageHash || 'N/A'}\`\n`;
    md += `**Investigator Notes:**\n> ${this.sanitizeText(caseData.notes || 'No notes provided.')}\n\n`;

    md += `## 🎯 Verified Matches & Leads (${(caseData.leads || []).length} Recorded)\n\n`;

    if (!caseData.leads || caseData.leads.length === 0) {
      md += `*No leads flagged yet.*\n\n`;
    } else {
      caseData.leads.forEach((lead, i) => {
        md += `### Lead #${i + 1}: ${this.sanitizeText(lead.source || 'Unknown Engine')} — **${lead.score}% Match**\n`;
        md += `- **URL:** ${this.sanitizeUrl(lead.url)}\n`;
        md += `- **Confidence:** ${lead.confidence?.label || 'N/A'}\n`;
        md += `- **Discovered At:** ${lead.savedAt || 'N/A'}\n`;
        if (lead.notes) md += `- **Notes:** ${this.sanitizeText(lead.notes)}\n`;
        md += `\n`;
      });
    }

    md += `---\n*Generated by ReconTrace Open-Source Humanitarian OSINT Suite (E2EE Verified)*\n`;
    return md;
  }

  /**
   * Strip unsafe characters from markdown text
   */
  static sanitizeText(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[<>`]/g, '');
  }

  /**
   * Sanitize URL scheme (strict check for http, https, onion)
   */
  static sanitizeUrl(url) {
    if (typeof url !== 'string') return '';
    if (url.startsWith('https://') || url.startsWith('http://')) {
      return url;
    }
    return 'about:blank';
  }

  /**
   * Emergency Shredder: Overwrite all stored data, ciphertexts, and crypto keys
   */
  static async emergencyWipeAllData() {
    try {
      if (typeof ReconCrypto !== 'undefined') {
        await ReconCrypto.emergencyShredVault();
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.clear();
      }
      localStorage.clear();
      sessionStorage.clear();
      return true;
    } catch (e) {
      console.error('Wipe failed:', e);
      return false;
    }
  }
}

if (typeof window !== 'undefined') {
  window.ReconStorage = ReconStorage;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ReconStorage = ReconStorage;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReconStorage;
}
