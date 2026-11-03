# 🛡️ ReconTrace — Humanitarian Visual OSINT Suite

> **An open-source, non-profit visual investigation tool designed to help search for missing persons, identify recovered trafficking victims, and locate stolen property across the Surface Web and Tor.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Chromium%20%7C%20Brave%20%7C%20Edge%20%7C%20Firefox-emerald)]()
[![Zero Telemetry](https://img.shields.io/badge/Telemetry-Zero%20(100%25%20Local)-brightgreen)]()
[![Security Audit](https://img.shields.io/badge/Security%20Audit-14%2F14%20Passed%20(100%25)-brightgreen)](tests/audit.py)

---

## 🌟 Mission & Purpose

When searching for missing loved ones, victims of trafficking, or stolen property, investigators and families face major hurdles:
* **Commercial Paywalls:** Commercial search tools charge high subscriptions or lock evidence behind credit systems.
* **Tab & Clutter Spam:** Traditional reverse-search browser extensions spawn 10 slow browser tabs at once.
* **Dark Web Isolation:** Trafficking networks and illicit black-markets intentionally operate on hidden `.onion` networks where Google and Yandex cannot index them.
* **PI Personal Bleed:** Professional investigative searches bleed into personal browser history, autocomplete suggestions, and router logs.

**ReconTrace** was built to solve these problems in a **single, utilitarian, uBlock Origin-inspired Side Panel**.

---

## 🗂️ Utilitarian 4-Tab Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🛡️ ReconTrace v1.0.0                      [Surface] [Tor: Off] [Vault] │
├───────────────┬───────────────┬───────────────┬────────────────────────┤
│     Panel     │     Filter    │      API      │        Settings        │
└───────────────┴───────────────┴───────────────┴────────────────────────┘
```

1. **Panel (Investigation Workspace):**
   * Upload, drop, or paste target evidence images (`Ctrl+V`).
   * Visual similarity score matching (0% to 100%) with live **Threshold Filter Slider**.
   * One-click **Interactive Canvas Region Cropper** (crop faces, tattoos, serial numbers).
   * Two-stage execution: Fast Surface Web scan with secondary on-demand Tor sweep.
   * `↗ Open Stealth` buttons that launch leads without recording to browser history.

2. **Filter (uBlock-Style Filter Lists):**
   * Pre-configured registry packs with individual checkboxes and counters:
     * ☑️ **General Visual Engines (4/4):** Yandex, Google Lens, Bing, TinEye
     * ☑️ **Missing Persons Registries (3/3):** NamUs DB, Interpol Yellow Notices, Doe Network
     * ☑️ **Stolen Property & Marketplaces (3/3):** eBay, Craigslist, BikeIndex
   * **My Custom Filters:** Add custom police database or auction search templates with `{query}` or `{img_url}`.

3. **API (Multi-Provider Intelligence & Auto-Fetched Models):**
   * **Multi-Provider Flexibility:** Connect to **Google Gemini**, **OpenRouter**, **Groq**, **OpenAI**, **Anthropic**, **Mistral**, **Cohere**, or **Perplexity**.
   * **Keyless Local AI & Privacy Mode:** Seamless zero-telemetry local inference using **Ollama** (`http://localhost:11434/v1`) or **LM Studio** (`http://localhost:1234/v1`) without needing an API key or sending data outside your machine.
   * **Live Auto-Fetched Models:** Dynamic connection to selected provider endpoints that automatically queries and loads the live model catalog (no manual guessing or forced keys).
   * **Real-Time Response Metrics & Connection Testing:** Round-trip latency (<kbd>ms</kbd>), token count, and connection health diagnostics.
   * **Encrypted at Rest:** API keys stored locally inside the AES-256-GCM cryptographic vault. Zero telemetry.

4. **Settings (OPSEC & Air-Gap Controls):**
   * **Zero-Knowledge Cryptographic Vault:** AES-256-GCM + PBKDF2 (600k iterations).
   * **Tor SOCKS5 Proxy:** Auto-discovery for ports `9050` and `9150` with remote DNS PAC script.
   * **PI Air-Gap:** Auto-history purge, incognito sandbox, and OS clipboard shredder.
   * **Case Dossier Export:** Structured Markdown and JSON exports.

---

## 🛡️ Hardened Security & Anti-Interception Architecture

### 1. PI Air-Gap: Zero Browser History & Autocomplete Leakage
* Investigated lead URLs are opened in an **ephemeral incognito sandbox** or immediately expunged from the browser's SQLite history database.
* Typing in the browser address bar later will **never suggest or autocomplete** your confidential investigation URLs.

### 2. Anti-Interception: Zero Router & ISP Visibility
* **Remote DNS Resolution via PAC (socks5h):** Prevents cleartext UDP port 53 DNS leaks to local home routers or ISPs.
* **Master Stealth Shield:** Optionally routes 100% of all outbound traffic (clearweb + Tor) through an opaque encrypted Tor tunnel.

### 3. Client-Side EXIF / GPS Metadata Scrubber
* All photos dropped into ReconTrace are repainted onto an offscreen canvas raster client-side.
* Strips 100% of EXIF GPS coordinates, camera serial numbers, and device tags before hashing or searching.

### 4. Zero OS-Level Bleed (RAM-Only Containment)
* Photos and crops are held strictly in volatile memory buffers. Zero unencrypted temporary image files are ever written to the host operating system disk.

---

## 🛠️ Quick Installation (Chrome, Brave, Edge, Opera)

1. Clone this repository:
   ```bash
   git clone https://github.com/Galaxy3092/recon-trace.git
   ```
2. Open your browser and navigate to:
   * Chrome / Brave: `chrome://extensions/`
   * Edge: `edge://extensions/`
3. Toggle on **"Developer mode"** in the top-right corner.
4. Click **"Load unpacked"** and select the `recon-trace` directory.
5. Click the **ReconTrace (🛡️)** icon in your toolbar to open the docked Side Panel!

### Testing Standalone (In Any Browser)
```bash
cd recon-trace
python3 -m http.server 8080
```
Then open [`http://localhost:8080`](http://localhost:8080) in your browser.

---

## 🧪 Automated Security Verification Suite

Run the 14-point automated audit anytime:
```bash
python3 tests/audit.py
```

**Verification Results:**
```
======================================================================
🎯 RECONTRACE DEEP VERIFICATION & PI AIR-GAP AUDIT SUITE
======================================================================

[+] Passed Security Controls (14/14):
  🟢 DOM XSS Protection: Clean. All dynamic elements use safe DOM nodes and textContent.
  🟢 Tor OPSEC: Hardened PAC script active. Remote DNS (socks5h) delegates resolution to Tor.
  🟢 Tor Discovery: Automated probe scans ports 9050 (Daemon) and 9150 (Tor Browser).
  🟢 Zero-Knowledge Storage: AES-256-GCM authenticated encryption + PBKDF2 (600k iterations) active.
  🟢 Context Transfer Security: In-memory chrome.storage.session (RAM only) used with self-destruct.
  🟢 Payload Boundary: Safe 15MB file size limit enforced to protect against memory exhaustion.
  🟢 EXIF Privacy: Client-side canvas re-encoding strips GPS coordinates, camera IDs, and metadata.
  🟢 Query Formatting: replaceAll handles multi-parameter search URL templates correctly.
  🟢 Referrer Protection: <meta name='referrer' content='no-referrer'> stops HTTP Referer leaks.
  🟢 Content Security Policy: Strict manifest CSP restricts script execution and network boundaries.
  🟢 PI History Air-Gap: Investigated URLs auto-purged from browser history & spawned in isolated incognito.
  🟢 PI OS Containment: RAM-only processing enforced, zero temp files written to OS, and clipboard purge ready.
  🟢 Zero External Dependencies: 100% self-contained local assets. Zero third-party CDN tracking.
  🟢 Dork Stealth Routing: Darknet indexer clicks routed through Stealth Guard to prevent browser history leakage.

🏆 ALL 14/14 ADVANCED OPSEC, ANTI-INTERCEPTION & PI AIR-GAP AUDITS PASSED 100%!
```

---

## 📜 License
This project is licensed under the **GNU General Public License v3.0 (GPLv3)** — ensuring this humanitarian tool and any derivatives remain free, open-source, and accessible to everyone.
