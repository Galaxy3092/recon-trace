# 🎯 ReconTrace — Humanitarian Visual OSINT Suite

> **An open-source, non-profit visual investigation tool designed to help search for missing persons, identify recovered trafficking victims, and locate stolen property across the Surface Web and Tor.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Chromium%20%7C%20Brave%20%7C%20Edge%20%7C%20Firefox-emerald)]()
[![Zero Telemetry](https://img.shields.io/badge/Telemetry-Zero%20(100%25%20Local)-brightgreen)]()
[![Security Audit](https://img.shields.io/badge/Security%20Audit-100%25%20Passed-brightgreen)](tests/audit.py)

---

## 🌟 Mission & Purpose

When searching for missing loved ones, victims of trafficking, or stolen property, investigators and families face major hurdles:
* **Commercial Paywalls:** Commercial search tools charge high subscriptions or lock evidence behind credit systems.
* **Tab & Clutter Spam:** Traditional reverse-search browser extensions spawn 10 slow browser tabs at once.
* **Lack of Deep Web Coverage:** Trafficking networks and illicit black-markets intentionally operate on hidden `.onion` networks where Google and Yandex cannot index them.
* **OPSEC & Privacy Risks:** Searching sensitive cases on public platforms without proxy routing can expose the investigator's IP address and location.

**ReconTrace** was built to solve these problems in a **single, unified, privacy-first Side Panel**.

---

## 🚀 Key Features & Hardened Security Architecture

### 1. Unified Side Panel (Zero Tab Spam)
* All search operations and results live in a docked browser side panel (`Manifest V3`).
* No more opening 10 separate browser tabs.

### 2. Tiered Two-Stage Pipeline (Resource Saver)
* **Stage 1 (Surface Web Fast Scan):** Queries public reverse engines (Google Lens, Yandex Visual, Bing, TinEye) and public registries (NamUs, Interpol Yellow Notices, Doe Network, BikeIndex, Craigslist, eBay) in ~1 to 2 seconds.
* **Stage 2 (Deep Tor Search):** Because Tor circuits are high-latency and resource-heavy, Tor runs on-demand as a secondary deep tier (scanning Ahmia, Torch, and darknet indexers).

### 3. Client-Side Match Percentage & Interactive Threshold
* Every lead displays a mathematical **0% to 100% Match Confidence** calculated locally in the browser via Perceptual Difference Hashing (dHash) and color profile analysis.
* An interactive **Threshold Slider** lets you dynamically filter out false positives (e.g., set to $80\%+$ to only see high-confidence hits).

### 4. Zero-Knowledge Cryptographic Vault (AES-256-GCM + PBKDF2)
* Built directly on the native browser **Web Crypto API**.
* All investigation cases, evidence hashes, notes, leads, and API keys are encrypted at rest with **AES-256-GCM** using keys derived from a user Master Passphrase via **PBKDF2** (600,000 SHA-256 iterations).
* Active keys are kept strictly in ephemeral RAM and never touch disk. Includes auto-lock timers and an instant **Panic Shredder**.

### 5. Tor Auto-Discovery & Zero-DNS-Leak OPSEC
* **Automated Tor Detection:** Probes whether a system Tor daemon (port `9050`) or Tor Browser (port `9150`) is actively listening, and automatically attaches without manual port configuration.
* **Zero-DNS-Leak PAC Proxy Routing:** Uses a Proxy Auto-Configuration (PAC) script configured with `SOCKS5` remote resolution (`socks5h` behavior). Resolves `.onion` hostnames remotely through Tor to eliminate ISP DNS leaks.

### 6. Ephemeral Context Transfer (Zero Disk Trace)
* Right-click context menu searches pass image targets via in-memory ephemeral session storage (`chrome.storage.session`) with immediate self-destruct upon delivery, leaving zero plaintext residual data on disk.

### 7. Interactive Forensic Region Cropper
* Easily select a specific region of an image (e.g., just the face, a distinguishing tattoo, or a serial number stamped on a bicycle frame) before searching.

### 8. Automated Forensic Bridging (Visual $\rightarrow$ Dork)
* Automatically extracts forensic markers and generates search dorks for text registries and darknet forums.
* Optional support for free **Google Gemini API** keys for deep AI vision and OCR.

---

## 🛠️ Quick Installation (Chrome, Brave, Edge, Opera)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/recon-trace.git
   ```
2. Open your browser and navigate to:
   * Chrome / Brave: `chrome://extensions/`
   * Edge: `edge://extensions/`
3. Toggle on **"Developer mode"** in the top-right corner.
4. Click **"Load unpacked"** and select the `recon-trace` directory.
5. Pin the **ReconTrace (🎯)** icon to your browser toolbar.
6. Click the icon to open the docked **ReconTrace Side Panel**!

### Testing Standalone (In Any Browser)
You can also run ReconTrace as a standalone web app without installing an extension:
```bash
cd recon-trace
python3 -m http.server 8080
```
Then visit `http://localhost:8080` in your web browser.

---

## 🧪 Security & Penetration Audit Suite

To verify the security controls and run the automated pentest suite:
```bash
python3 tests/audit.py
```
This tests:
* DOM XSS immunization & safe DOM tree construction
* Zero-DNS-leak PAC proxy routing
* Tor listener auto-discovery
* AES-256-GCM authenticated storage encryption
* Ephemeral IPC session storage
* 15MB file upload memory limits

---

## 📜 License
This project is licensed under the **GNU General Public License v3.0 (GPLv3)** — ensuring this humanitarian tool and any derivatives remain free, open-source, and accessible to everyone.
