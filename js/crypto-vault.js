/**
 * ReconTrace Cryptographic Vault (Zero-Knowledge E2EE)
 * Implements AES-256-GCM authenticated encryption and PBKDF2 key derivation
 * using the browser's native Web Crypto API.
 */

class ReconCrypto {
  static PBKDF2_ITERATIONS = 600000;
  static SALT_KEY = 'recontrace_crypto_salt';
  static VERIFY_KEY = 'recontrace_crypto_verifier';

  // Ephemeral in-memory key (never written to disk)
  static activeKey = null;
  static isUnlocked = false;
  static lockTimeout = null;
  static autoLockMinutes = 15;

  /**
   * Check if a master vault has been initialized on this device
   */
  static async isVaultInitialized() {
    try {
      const salt = await this.getStorageItem(this.SALT_KEY);
      const verifier = await this.getStorageItem(this.VERIFY_KEY);
      return Boolean(salt && verifier);
    } catch {
      return false;
    }
  }

  /**
   * Initialize a new master vault with user password
   */
  static async initializeVault(masterPassword) {
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error('Master Passphrase must be at least 8 characters long.');
    }

    // Generate fresh cryptographically secure random 16-byte salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = this.buf2b64(salt);

    // Derive AES-256-GCM key
    const key = await this.deriveKey(masterPassword, salt);

    // Encrypt a known verification token to validate password in the future
    const verificationPayload = JSON.stringify({ verified: true, timestamp: Date.now() });
    const encryptedVerifier = await this.encryptWithKey(verificationPayload, key);

    // Save salt and verifier to storage
    await this.setStorageItem(this.SALT_KEY, saltB64);
    await this.setStorageItem(this.VERIFY_KEY, encryptedVerifier);

    this.activeKey = key;
    this.isUnlocked = true;
    this.resetAutoLockTimer();

    return true;
  }

  /**
   * Unlock the vault with master password
   */
  static async unlockVault(masterPassword) {
    const saltB64 = await this.getStorageItem(this.SALT_KEY);
    const encryptedVerifier = await this.getStorageItem(this.VERIFY_KEY);

    if (!saltB64 || !encryptedVerifier) {
      throw new Error('Vault not initialized.');
    }

    const salt = this.b642buf(saltB64);
    const key = await this.deriveKey(masterPassword, salt);

    try {
      const decrypted = await this.decryptWithKey(encryptedVerifier, key);
      const parsed = JSON.parse(decrypted);

      if (parsed && parsed.verified) {
        this.activeKey = key;
        this.isUnlocked = true;
        this.resetAutoLockTimer();
        return true;
      }
      throw new Error('Invalid verification token.');
    } catch {
      throw new Error('Incorrect Master Passphrase. Decryption failed.');
    }
  }

  /**
   * Lock vault and wipe active key from RAM immediately
   */
  static lockVault() {
    this.activeKey = null;
    this.isUnlocked = false;
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
      this.lockTimeout = null;
    }
  }

  /**
   * Reset auto-lock inactivity timer
   */
  static resetAutoLockTimer() {
    if (this.lockTimeout) clearTimeout(this.lockTimeout);
    this.lockTimeout = setTimeout(() => {
      this.lockVault();
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('recontrace:vault-locked'));
      }
    }, this.autoLockMinutes * 60 * 1000);
  }

  /**
   * Derive AES-GCM 256-bit key from password using PBKDF2 (SHA-256)
   */
  static async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable from RAM
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt plaintext string or JSON using active key (or passed key)
   */
  static async encrypt(plaintext) {
    if (!this.isUnlocked || !this.activeKey) {
      throw new Error('Vault is locked. Unlock to encrypt data.');
    }
    this.resetAutoLockTimer();
    return await this.encryptWithKey(plaintext, this.activeKey);
  }

  static async encryptWithKey(plaintext, key) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV standard for AES-GCM
    const encodedData = enc.encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedData
    );

    // Combine IV (12 bytes) + Ciphertext + Auth Tag into single payload
    return JSON.stringify({
      iv: this.buf2b64(iv),
      ct: this.buf2b64(ciphertext),
      v: 1
    });
  }

  /**
   * Decrypt ciphertext JSON object using active key
   */
  static async decrypt(encryptedPayloadStr) {
    if (!this.isUnlocked || !this.activeKey) {
      throw new Error('Vault is locked. Unlock to decrypt data.');
    }
    this.resetAutoLockTimer();
    return await this.decryptWithKey(encryptedPayloadStr, this.activeKey);
  }

  static async decryptWithKey(encryptedPayloadStr, key) {
    const payload = JSON.parse(encryptedPayloadStr);
    const iv = this.b642buf(payload.iv);
    const ciphertext = this.b642buf(payload.ct);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  }

  /**
   * Emergency Shredder: Overwrite cryptographic salt and verifier
   */
  static async emergencyShredVault() {
    this.lockVault();
    await this.removeStorageItem(this.SALT_KEY);
    await this.removeStorageItem(this.VERIFY_KEY);
  }

  // Storage helpers
  static async getStorageItem(key) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get(key);
      return data[key];
    }
    return localStorage.getItem(key);
  }

  static async setStorageItem(key, val) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [key]: val });
    } else {
      localStorage.setItem(key, val);
    }
  }

  static async removeStorageItem(key) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(key);
    } else {
      localStorage.removeItem(key);
    }
  }

  // Base64 / Buffer conversions
  static buf2b64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static b642buf(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

if (typeof window !== 'undefined') {
  window.ReconCrypto = ReconCrypto;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ReconCrypto = ReconCrypto;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReconCrypto;
}
