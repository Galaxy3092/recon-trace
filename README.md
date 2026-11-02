# 🎯 ReconTrace — Humanitarian Visual OSINT Suite

> **An open-source, non-profit visual investigation tool designed to help search for missing persons, identify recovered trafficking victims, and locate stolen property across the Surface Web and Tor.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Chromium%20%7C%20Brave%20%7C%20Edge%20%7C%20Firefox-emerald)]()
[![Zero Telemetry](https://img.shields.io/badge/Telemetry-Zero%20(100%25%20Local)-brightgreen)]()

---

## 🌟 Mission & Purpose

When searching for missing loved ones, victims of trafficking, or stolen property, investigators and families face major hurdles:
* **Commercial Paywalls:** Commercial search tools charge high subscriptions or lock evidence behind credit systems.
* **Tab & Clutter Spam:** Traditional reverse-search browser extensions spawn 10 slow browser tabs at once.
* **Lack of Deep Web Coverage:** Trafficking networks and illicit black-markets intentionally operate on hidden `.onion` networks where Google and Yandex cannot index them.
* **OPSEC & Privacy Risks:** Searching sensitive cases on public platforms without proxy routing can expose the investigator's IP address and location.

**ReconTrace** was built to solve these problems in a **single, unified, privacy-first Side Panel**.

---

## 🚀 Key Features

### 1. Unified Side Panel (Zero Tab Spam)
* All search operations and results live in a docked browser side panel (`Manifest V3`).
* No more having 10 tabs open at once.

### 2. Tiered Two-Stage Pipeline (Resource Saver)
* **Stage 1 (Surface Web Fast Scan):** Queries public reverse engines (Google Lens, Yandex Visual, Bing, TinEye) and public registries (NamUs, Interpol Yellow Notices, Doe Network, BikeIndex, Craigslist, eBay) in ~1 to 2 seconds.
* **Stage 2 (Deep Tor Search):** Because Tor circuits are high-latency and resource-heavy, Tor runs on-demand as a secondary deep tier (scanning Ahmia, Torch, and darknet indexers).

### 3. Client-Side Match Percentage & Interactive Threshold
* Every lead displays a mathematical **0% to 100% Match Confidence** calculated locally in the browser via Perceptual Difference Hashing (dHash) and color profile analysis.
* An interactive **Threshold Slider** lets you dynamically filter out false positives (e.g., set to $80\%+$ to only see high-confidence hits).

### 4. Interactive Forensic Cropper
* Easily select a specific region of an image (e.g., just the face, a distinguishing tattoo, or a serial number stamped on a bicycle frame) before searching.

### 5. Automated Forensic Bridging (Visual $\rightarrow$ Dork)
* Automatically extracts forensic markers and generates search dorks for text registries and darknet forums.
* Optional support for free **Google Gemini API** keys for deep AI vision and OCR.

### 6. The 3 Clean Configuration Drawers
* 🌐 **Websites & Custom Targets:** Toggle active engines or add custom police bulletin URLs with `{query}` or `{img_url}` templates.
* 🔑 **APIs & AI:** Configure Gemini Vision keys or custom local OSINT endpoints. Zero telemetry.
* 🛡️ **OPSEC & Controls:** Configure SOCKS5 Tor proxy routing (`127.0.0.1:9050`), export timestamped Case Dossiers in Markdown/JSON, or hit the **Emergency Panic Shredder** to permanently wipe all local data.

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

## 🛡️ OPSEC & Tor Routing Setup

To route your investigative queries through Tor:
1. Ensure the Tor daemon or Tor Browser is running locally:
   * Standard Tor service: `127.0.0.1:9050`
   * Tor Browser bundle: `127.0.0.1:9150`
2. In ReconTrace, click the **🛡️ Controls** tab at the bottom.
3. Verify host/port (`127.0.0.1:9050`) and check **"Route Searches through Tor SOCKS5"**.
4. The status pill at the top will switch to `🧅 Tor: Routed`.

---

## 📜 License
This project is licensed under the **GNU General Public License v3.0 (GPLv3)** — ensuring this humanitarian tool and any derivatives remain free, open-source, and accessible to everyone.
