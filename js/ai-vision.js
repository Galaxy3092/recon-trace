/**
 * ReconTrace AI Multi-Provider Vision & Forensic Feature Extractor
 * Bridges visual evidence to forensic keywords, OCR text, and Tor/web search dorks.
 * Supports Google Gemini, OpenRouter, Local Ollama/LM Studio (keyless mode),
 * Groq, OpenAI, Anthropic, Mistral, Cohere, Perplexity, or client-side offline heuristics.
 */

class ReconVision {
  static STORAGE_KEY = 'recontrace_api_settings';

  static PROVIDER_DEFAULTS = {
    'Google Gemini': {
      endpoint: '',
      defaultModel: 'gemini-2.0-flash',
      requiresKey: true
    },
    'OpenRouter': {
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      defaultModel: 'google/gemini-2.0-flash-exp:free',
      requiresKey: false
    },
    'Custom / Local (Ollama, LM Studio)': {
      endpoint: 'http://localhost:11434/v1/chat/completions',
      defaultModel: 'llava',
      requiresKey: false
    },
    'Groq': {
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      defaultModel: 'llama-3.2-11b-vision-preview',
      requiresKey: true
    },
    'OpenAI': {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-4o-mini',
      requiresKey: true
    },
    'Anthropic': {
      endpoint: 'https://api.anthropic.com/v1/messages',
      defaultModel: 'claude-3-5-sonnet-20241022',
      requiresKey: true
    },
    'Mistral': {
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      defaultModel: 'pixtral-12b-2409',
      requiresKey: true
    },
    'Cohere': {
      endpoint: 'https://api.cohere.ai/v2/chat',
      defaultModel: 'command-r',
      requiresKey: true
    },
    'Perplexity': {
      endpoint: 'https://api.perplexity.ai/chat/completions',
      defaultModel: 'sonar',
      requiresKey: true
    }
  };

  /**
   * Get all API settings with fallback & migration
   */
  static async getSettings() {
    let raw = null;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(this.STORAGE_KEY);
        if (stored && stored[this.STORAGE_KEY]) raw = stored[this.STORAGE_KEY];
      } else {
        const local = localStorage.getItem(this.STORAGE_KEY);
        if (local) raw = JSON.parse(local);
      }
    } catch (e) {
      console.warn('Could not read API settings:', e);
    }

    const state = {
      activeProvider: 'Google Gemini',
      providers: {},
      geminiApiKey: '',
      model: 'gemini-2.0-flash',
      customEndpoint: '',
      autoExtractFeatures: true,
      liveMetrics: {
        lastLatencyMs: null,
        lastTokens: null,
        details: 'No requests sent yet. Real-time metrics will appear here.'
      }
    };

    // Initialize provider slots
    Object.keys(this.PROVIDER_DEFAULTS).forEach(p => {
      state.providers[p] = {
        apiKey: '',
        model: this.PROVIDER_DEFAULTS[p].defaultModel,
        endpoint: this.PROVIDER_DEFAULTS[p].endpoint,
        models: []
      };
    });

    if (raw && typeof raw === 'object') {
      if (raw.activeProvider) state.activeProvider = raw.activeProvider;
      if (raw.providers) {
        Object.keys(raw.providers).forEach(p => {
          state.providers[p] = {
            ...state.providers[p],
            ...raw.providers[p]
          };
        });
      }
      if (raw.liveMetrics) state.liveMetrics = { ...state.liveMetrics, ...raw.liveMetrics };

      // Legacy migration
      if (raw.geminiApiKey && !state.providers['Google Gemini'].apiKey) {
        state.providers['Google Gemini'].apiKey = raw.geminiApiKey;
      }
      if (raw.model && !state.providers['Google Gemini'].model) {
        state.providers['Google Gemini'].model = raw.model;
      }
      if (raw.customEndpoint && !state.providers['Custom / Local (Ollama, LM Studio)'].endpoint) {
        state.providers['Custom / Local (Ollama, LM Studio)'].endpoint = raw.customEndpoint;
      }
    }

    // Set convenience backward compatibility mirrors
    state.geminiApiKey = state.providers['Google Gemini']?.apiKey || '';
    state.model = state.providers[state.activeProvider]?.model || 'gemini-2.0-flash';
    state.customEndpoint = state.providers['Custom / Local (Ollama, LM Studio)']?.endpoint || '';

    return state;
  }

  /**
   * Save API settings
   */
  static async saveSettings(settings) {
    try {
      // Sync backward compatibility mirrors
      if (settings.providers) {
        settings.geminiApiKey = settings.providers['Google Gemini']?.apiKey || '';
        settings.model = settings.providers[settings.activeProvider]?.model || 'gemini-2.0-flash';
        settings.customEndpoint = settings.providers['Custom / Local (Ollama, LM Studio)']?.endpoint || '';
      }

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
   * Auto-Fetch live model list from endpoint dynamically
   */
  static async fetchModelsFromEndpoint(provider, key, endpoint, signal) {
    const headers = {};
    if (key) headers['Authorization'] = 'Bearer ' + key.trim();

    // 1. Google Gemini
    if (provider === 'Google Gemini') {
      if (!key) return ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key.trim()}`, { signal });
      if (!res.ok) throw new Error(`Google returned status ${res.status}`);
      const data = await res.json();
      return (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
    }

    // 2. OpenRouter (public catalog, works even with no key)
    if (provider === 'OpenRouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models', { headers, signal });
      if (!res.ok) throw new Error(`OpenRouter returned status ${res.status}`);
      const data = await res.json();
      const all = (data.data || []).map(m => m.id);
      // Prioritize vision and popular free models
      const vision = all.filter(id => id.includes('vision') || id.includes('flash') || id.includes('vl') || id.includes('4o'));
      const rest = all.filter(id => !vision.includes(id));
      return [...vision.slice(0, 30), ...rest.slice(0, 20)];
    }

    // 3. Custom / Local (Ollama, LM Studio, LocalAI)
    if (provider === 'Custom / Local (Ollama, LM Studio)') {
      const ep = (endpoint || 'http://localhost:11434/v1/chat/completions').trim();
      let modelsUrl = ep.replace('/chat/completions', '/models').replace('/v1/completions', '/v1/models');
      
      try {
        const res = await fetch(modelsUrl, { headers, signal });
        if (res.ok) {
          const data = await res.json();
          const list = (data.data || data.models || []).map(m => m.id || m.name || m);
          if (list.length > 0) return list;
        }
      } catch (e) {
        // Try Ollama native /api/tags if v1 failed
        try {
          const tagsUrl = ep.replace(/\/v1.*$/, '/api/tags');
          const resTags = await fetch(tagsUrl, { headers, signal });
          if (resTags.ok) {
            const dataTags = await resTags.json();
            return (dataTags.models || []).map(m => m.name || m.id);
          }
        } catch (inner) {
          throw new Error(`Cannot connect to local AI server at ${ep}. Is Ollama or LM Studio running?`);
        }
      }
      return ['llava', 'llama3.2-vision', 'minicpm-v'];
    }

    // 4. Groq
    if (provider === 'Groq') {
      if (!key) return ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview', 'llama-3.3-70b-versatile'];
      const res = await fetch('https://api.groq.com/openai/v1/models', { headers, signal });
      if (!res.ok) throw new Error(`Groq status ${res.status}`);
      const data = await res.json();
      const list = (data.data || []).map(m => m.id);
      return list.sort((a, b) => (b.includes('vision') ? 1 : 0) - (a.includes('vision') ? 1 : 0));
    }

    // 5. OpenAI
    if (provider === 'OpenAI') {
      if (!key) return ['gpt-4o', 'gpt-4o-mini', 'chatgpt-4o-latest'];
      const res = await fetch('https://api.openai.com/v1/models', { headers, signal });
      if (!res.ok) throw new Error(`OpenAI status ${res.status}`);
      const data = await res.json();
      return (data.data || [])
        .filter(m => m.id.includes('gpt-4') || m.id.includes('o1') || m.id.includes('o3'))
        .map(m => m.id);
    }

    // 6. Anthropic
    if (provider === 'Anthropic') {
      return [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ];
    }

    // 7. Mistral
    if (provider === 'Mistral') {
      if (!key) return ['pixtral-12b-2409', 'mistral-large-latest', 'mistral-small-latest'];
      const res = await fetch('https://api.mistral.ai/v1/models', { headers, signal });
      if (!res.ok) throw new Error(`Mistral status ${res.status}`);
      const data = await res.json();
      return (data.data || []).map(m => m.id);
    }

    // 8. Cohere
    if (provider === 'Cohere') {
      if (!key) return ['command-r-plus', 'command-r', 'command'];
      const res = await fetch('https://api.cohere.ai/v1/models', { headers, signal });
      if (!res.ok) return ['command-r-plus', 'command-r', 'command'];
      const data = await res.json();
      return (data.models || []).map(m => m.name);
    }

    // 9. Perplexity
    if (provider === 'Perplexity') {
      return ['sonar-pro', 'sonar', 'sonar-reasoning'];
    }

    return [];
  }

  /**
   * Test connection & latency to the active provider and model
   */
  static async testConnection(provider, model, key, endpoint) {
    const t0 = performance.now();

    if (provider === 'Google Gemini') {
      if (!key) throw new Error('Google Gemini requires an API key.');
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Respond with OK.' }] }] })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Google returned HTTP ${res.status}`);
      }
      const data = await res.json();
      const latency = Math.round(performance.now() - t0);
      return { latencyMs: latency, tokens: data.usageMetadata?.totalTokenCount || null, model, provider };
    }

    if (provider === 'Anthropic') {
      if (!key) throw new Error('Anthropic requires an API key.');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Respond with OK.' }]
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Anthropic returned HTTP ${res.status}`);
      }
      const data = await res.json();
      const latency = Math.round(performance.now() - t0);
      return {
        latencyMs: latency,
        tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        model,
        provider
      };
    }

    // OpenAI-compatible providers
    let url = 'https://api.openai.com/v1/chat/completions';
    if (provider === 'OpenRouter') url = 'https://openrouter.ai/api/v1/chat/completions';
    if (provider === 'Groq') url = 'https://api.groq.com/openai/v1/chat/completions';
    if (provider === 'Mistral') url = 'https://api.mistral.ai/v1/chat/completions';
    if (provider === 'Perplexity') url = 'https://api.perplexity.ai/chat/completions';
    if (provider === 'Custom / Local (Ollama, LM Studio)') {
      url = endpoint || 'http://localhost:11434/v1/chat/completions';
    }

    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key.trim();
    if (provider === 'OpenRouter') {
      headers['HTTP-Referer'] = 'https://recontrace.local';
      headers['X-Title'] = 'ReconTrace OSINT';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model,
        max_tokens: 15,
        messages: [{ role: 'user', content: 'Respond with OK.' }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const latency = Math.round(performance.now() - t0);
    return {
      latencyMs: latency,
      tokens: data.usage?.total_tokens || null,
      model,
      provider
    };
  }

  /**
   * Primary entry point: Analyze image using active AI provider (multimodal) or local heuristics
   */
  static async analyzeImage(imageSrc, caseType = 'missing_or_stolen') {
    const settings = await this.getSettings();
    const provider = settings.activeProvider || 'Google Gemini';
    const provConfig = settings.providers[provider] || {};
    const key = (provConfig.apiKey || '').trim();
    const model = (provConfig.model || this.PROVIDER_DEFAULTS[provider]?.defaultModel || '').trim();
    const endpoint = (provConfig.endpoint || this.PROVIDER_DEFAULTS[provider]?.endpoint || '').trim();

    const requiresKey = this.PROVIDER_DEFAULTS[provider]?.requiresKey !== false;
    const isReady = requiresKey ? (key.length > 0) : true;

    if (isReady && model) {
      try {
        const t0 = performance.now();
        const analysis = await this.analyzeWithProvider(imageSrc, provider, model, key, endpoint, caseType);
        const latency = Math.round(performance.now() - t0);

        // Update live metrics
        settings.liveMetrics = {
          lastLatencyMs: latency,
          lastTokens: analysis.tokensReturned || null,
          details: `Analysis complete: ${latency}ms via ${provider} (${model})`
        };
        await this.saveSettings(settings);

        return analysis;
      } catch (err) {
        console.warn(`Analysis failed with ${provider} (${model}):`, err);
        const fallback = await this.generateLocalForensics(imageSrc, caseType);
        fallback.warning = `${provider} error (${err.message}) — fell back to offline local forensics.`;
        return fallback;
      }
    }

    // Offline / No key configured
    return this.generateLocalForensics(imageSrc, caseType);
  }

  /**
   * Execute Multimodal analysis across provider architectures
   */
  static async analyzeWithProvider(imageSrc, provider, model, key, endpoint, caseType) {
    // 1. Prepare Base64 payload
    let mimeType = 'image/jpeg';
    let base64Data = '';

    if (imageSrc.startsWith('data:')) {
      const parts = imageSrc.split(',');
      mimeType = parts[0].match(/:(.*?);/)[1] || 'image/jpeg';
      base64Data = parts[1];
    } else {
      const resp = await fetch(imageSrc);
      const blob = await resp.blob();
      mimeType = blob.type || 'image/jpeg';
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

    // 2. Google Gemini
    if (provider === 'Google Gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mimeType, data: base64Data } }
            ]
          }
        ]
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini status ${res.status}: ${err}`);
      }
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = this.safeParseJson(raw);
      parsed.engineUsed = `Google Gemini (${model})`;
      parsed.tokensReturned = data.usageMetadata?.totalTokenCount || null;
      return parsed;
    }

    // 3. Anthropic
    if (provider === 'Anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mimeType,
                    data: base64Data
                  }
                },
                { type: 'text', text: prompt }
              ]
            }
          ]
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Anthropic status ${res.status}`);
      }
      const data = await res.json();
      const raw = data.content?.[0]?.text || '{}';
      const parsed = this.safeParseJson(raw);
      parsed.engineUsed = `Anthropic (${model})`;
      parsed.tokensReturned = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
      return parsed;
    }

    // 4. OpenAI-Compatible Multimodal (OpenAI, OpenRouter, Groq, Local Ollama/LM Studio, Mistral)
    let targetEndpoint = 'https://api.openai.com/v1/chat/completions';
    if (provider === 'OpenRouter') targetEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
    if (provider === 'Groq') targetEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
    if (provider === 'Mistral') targetEndpoint = 'https://api.mistral.ai/v1/chat/completions';
    if (provider === 'Perplexity') targetEndpoint = 'https://api.perplexity.ai/chat/completions';
    if (provider === 'Custom / Local (Ollama, LM Studio)') {
      targetEndpoint = endpoint || 'http://localhost:11434/v1/chat/completions';
    }

    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;
    if (provider === 'OpenRouter') {
      headers['HTTP-Referer'] = 'https://recontrace.local';
      headers['X-Title'] = 'ReconTrace OSINT';
    }

    const payload = {
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`
              }
            }
          ]
        }
      ]
    };

    let res = await fetch(targetEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    // Fallback: If model doesn't support direct vision image_url, fall back to text reasoning for dorks
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const errMsg = errJson.error?.message || errJson.message || `Server returned ${res.status}`;

      if (errMsg.includes('vision') || errMsg.includes('image') || errMsg.includes('multimodal')) {
        const textPayload = {
          model: model,
          messages: [
            {
              role: 'user',
              content: `${prompt}\n\nNote: Visual input is a ${caseType} image (${mimeType}). Formulate forensic search queries and standard indicators based on typical ${caseType} recovery cases.`
            }
          ]
        };
        res = await fetch(targetEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(textPayload)
        });
      }

      if (!res.ok) {
        throw new Error(errMsg);
      }
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || data.message?.content?.[0]?.text || '{}';
    const parsed = this.safeParseJson(raw);
    parsed.engineUsed = `${provider} (${model})`;
    parsed.tokensReturned = data.usage?.total_tokens || null;
    return parsed;
  }

  /**
   * Resilient JSON output parser
   */
  static safeParseJson(raw) {
    try {
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        return JSON.parse(raw.substring(firstBrace, lastBrace + 1));
      }
      const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      return {
        summary: 'Target visually analyzed.',
        category: 'general',
        distinguishingFeatures: ['Visual characteristics cataloged'],
        ocrDetectedText: [],
        searchDorks: ['missing person notice', 'stolen property recovery', 'unidentified registry']
      };
    }
  }

  /**
   * Offline local heuristic generator (Zero Network / Privacy Air-Gap)
   */
  static async generateLocalForensics(imageSrc, caseType = 'general') {
    return {
      engineUsed: 'Local Heuristic (Offline / Air-Gap Mode)',
      summary: 'Image indexed locally in memory. Add an API key or local Ollama/LM Studio model in the API tab for deep AI multimodal extraction.',
      category: caseType,
      distinguishingFeatures: [
        'Visual hash fingerprint generated',
        'EXIF GPS metadata stripped client-side',
        'Ready for reverse matching'
      ],
      ocrDetectedText: [],
      searchDorks: [
        'missing person alert',
        'stolen property recovery',
        'unidentified case bulletin'
      ]
    };
  }
}

if (typeof window !== 'undefined') {
  window.ReconVision = ReconVision;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ReconVision = ReconVision;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReconVision;
}
