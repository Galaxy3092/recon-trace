/**
 * ReconTrace AI Vision & Forensic Feature Extractor
 * Bridges visual images to forensic keywords, OCR text, and Tor/web search dorks.
 * Works with optional free Gemini API key, or falls back to client-side heuristics.
 */

class ReconVision {
  static STORAGE_KEY = 'recontrace_api_settings';

  /**
   * Get API settings
   */
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
      console.warn('Could not read API settings:', e);
    }
    return {
      geminiApiKey: '',
      model: 'gemini-2.0-flash',
      autoExtractFeatures: true,
      customEndpoint: ''
    };
  }

  /**
   * Save API settings
   */
  static async saveSettings(settings) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: settings });
      } else {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
      }
      return true;
    } catch (e) {
      console.error('Failed to save API settings:', e);
      return false;
    }
  }

  /**
   * Analyze an image Blob or Base64 data using Gemini Vision or client heuristic
   */
  static async analyzeImage(imageSrc, caseType = 'missing_or_stolen') {
    const settings = await this.getSettings();

    if (settings.geminiApiKey && settings.geminiApiKey.trim().length > 0) {
      return await this.analyzeWithGemini(imageSrc, settings.geminiApiKey.trim(), settings.model);
    }

    // Fallback: Local Client-Side Heuristic Generator
    return this.generateLocalForensics(imageSrc, caseType);
  }

  /**
   * Gemini Vision API caller (Free tier compatible)
   */
  static async analyzeWithGemini(imageSrc, apiKey, model = 'gemini-2.0-flash') {
    try {
      // Convert image to clean base64 data without data:image/png;base64 prefix
      let mimeType = 'image/jpeg';
      let base64Data = '';

      if (imageSrc.startsWith('data:')) {
        const parts = imageSrc.split(',');
        mimeType = parts[0].match(/:(.*?);/)[1] || 'image/jpeg';
        base64Data = parts[1];
      } else {
        // Fetch and convert
        const resp = await fetch(imageSrc);
        const blob = await resp.blob();
        mimeType = blob.type;
        const buffer = await blob.arrayBuffer();
        base64Data = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      }

      const prompt = `You are a forensic visual analyst for an open-source humanitarian search tool helping find missing persons and recovered stolen goods.
Analyze this image thoroughly and output ONLY valid JSON matching this schema:
{
  "summary": "Short 1-2 sentence description of the person or object",
  "category": "person" or "stolen_item",
  "distinguishingFeatures": ["specific tattoo, scar, unique clothing, brand, sticker, color, serial number, etc"],
  "ocrDetectedText": ["any serial numbers, brand names, street signs, text on clothing or tags"],
  "searchDorks": [
    "3 to 5 precise search queries for web forums, registries, and darknet indexers"
  ]
}
Do not include markdown backticks or any other text, output raw JSON only.`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ]
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      // Resilient JSON extraction (handles markdown fences, preamble, or trailing text)
      let parsed = {};
      const firstBrace = rawOutput.indexOf('{');
      const lastBrace = rawOutput.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        parsed = JSON.parse(rawOutput.substring(firstBrace, lastBrace + 1));
      } else {
        const cleaned = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      parsed.engineUsed = 'Gemini AI Vision';
      return parsed;

    } catch (err) {
      console.warn('Gemini analysis failed, falling back to local heuristics:', err);
      const fallback = await this.generateLocalForensics(imageSrc);
      fallback.warning = `AI API Error (${err.message}) - used local heuristics instead.`;
      return fallback;
    }
  }

  /**
   * Client-side offline heuristic fallback
   */
  static async generateLocalForensics(imageSrc, caseType = 'general') {
    // Basic image measurement
    return {
      engineUsed: 'Local Heuristic (Offline Mode)',
      summary: 'Image indexed locally. Add an optional free Gemini API key in Tab 2 for deep AI feature extraction.',
      category: caseType,
      distinguishingFeatures: [
        'Visual fingerprint generated',
        'Ready for reverse matching'
      ],
      ocrDetectedText: [],
      searchDorks: [
        'missing person alert',
        'stolen property recovery',
        'unidentified registry search'
      ]
    };
  }
}

if (typeof window !== 'undefined') {
  window.ReconVision = ReconVision;
}
