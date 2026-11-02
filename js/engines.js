/**
 * ReconTrace Search Engines Directory & Custom Engine Manager
 * Handles Surface Web engines, custom community plugins, and query formatting.
 */

class ReconEngines {
  static DEFAULT_ENGINES = [
    // General Reverse Image Engines
    {
      id: 'yandex',
      name: 'Yandex Visual Search',
      category: 'general_reverse',
      desc: 'Top engine for facial similarity, uncropped sources & deep web forums',
      enabled: true,
      type: 'reverse_url',
      urlTemplate: 'https://yandex.com/images/search?rpt=imageview&url={img_url}',
      directUploadUrl: 'https://yandex.com/images/search?rpt=imageview'
    },
    {
      id: 'google_lens',
      name: 'Google Lens',
      category: 'general_reverse',
      desc: 'Google visual graph, OCR text extraction, objects & clothing',
      enabled: true,
      type: 'reverse_url',
      urlTemplate: 'https://lens.google.com/uploadbyurl?url={img_url}',
      directUploadUrl: 'https://lens.google.com/'
    },
    {
      id: 'bing',
      name: 'Bing Visual Search',
      category: 'general_reverse',
      desc: 'Microsoft visual index, excellent for products & architectural cues',
      enabled: true,
      type: 'reverse_url',
      urlTemplate: 'https://www.bing.com/images/search?view=detailv2&iss=sbi&FORM=SBIHMP&sbisrc=UrlPaste&q=imgurl:{img_url}',
      directUploadUrl: 'https://www.bing.com/visualsearch'
    },
    {
      id: 'tineye',
      name: 'TinEye Reverse Search',
      category: 'general_reverse',
      desc: 'Exact match pixel fingerprinting, tracking earliest upload date',
      enabled: true,
      type: 'reverse_url',
      urlTemplate: 'https://tineye.com/search?url={img_url}',
      directUploadUrl: 'https://tineye.com/'
    },

    // Missing Persons & Humanitarian Registries
    {
      id: 'namus',
      name: 'NamUs Missing Persons DB',
      category: 'missing_persons',
      desc: 'US National Missing and Unidentified Persons System',
      enabled: true,
      type: 'keyword_dork',
      urlTemplate: 'https://www.namus.gov/MissingPersons/Search#/results?search={query}',
      directUploadUrl: 'https://www.namus.gov/'
    },
    {
      id: 'interpol',
      name: 'Interpol Yellow Notices',
      category: 'missing_persons',
      desc: 'Global police alerts for missing persons / children',
      enabled: true,
      type: 'keyword_dork',
      urlTemplate: 'https://www.interpol.int/How-we-work/Notices/View-Red-Notices#{query}',
      directUploadUrl: 'https://www.interpol.int/How-we-work/Notices/Yellow-Notices'
    },
    {
      id: 'doe_network',
      name: 'The Doe Network',
      category: 'missing_persons',
      desc: 'International Center for Unidentified & Missing Persons',
      enabled: true,
      type: 'keyword_dork',
      urlTemplate: 'https://www.google.com/search?q=site:doenetwork.org+{query}',
      directUploadUrl: 'https://www.doenetwork.org/'
    },

    // Stolen Goods, Vehicles & Marketplaces
    {
      id: 'ebay',
      name: 'eBay Marketplace',
      category: 'stolen_goods',
      desc: 'Major online marketplace where stolen equipment/goods are listed',
      enabled: true,
      type: 'keyword_dork',
      urlTemplate: 'https://www.ebay.com/sch/i.html?_nkw={query}&_sop=10',
      directUploadUrl: 'https://www.ebay.com'
    },
    {
      id: 'craigslist',
      name: 'Craigslist All-Cities Search',
      category: 'stolen_goods',
      desc: 'Local classifieds search via site dorking',
      enabled: true,
      type: 'keyword_dork',
      urlTemplate: 'https://www.google.com/search?q=site:craigslist.org+{query}',
      directUploadUrl: 'https://www.craigslist.org'
    },
    {
      id: 'bikeindex',
      name: 'BikeIndex (Stolen Bikes)',
      category: 'stolen_goods',
      desc: 'Global stolen bicycle and serial number registry',
      enabled: true,
      type: 'keyword_dork',
      urlTemplate: 'https://bikeindex.org/bikes?serial={query}',
      directUploadUrl: 'https://bikeindex.org'
    }
  ];

  static STORAGE_KEY = 'recontrace_custom_engines';

  /**
   * Load active engines (defaults + user customized)
   */
  static async getEngines() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(this.STORAGE_KEY);
        if (stored && stored[this.STORAGE_KEY]) {
          return stored[this.STORAGE_KEY];
        }
      } else {
        const local = localStorage.getItem(this.STORAGE_KEY);
        if (local) return JSON.parse(local);
      }
    } catch (e) {
      console.warn('Storage read failed, using defaults:', e);
    }
    return JSON.parse(JSON.stringify(this.DEFAULT_ENGINES));
  }

  /**
   * Save engines configuration
   */
  static async saveEngines(engines) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: engines });
      } else {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(engines));
      }
      return true;
    } catch (e) {
      console.error('Failed to save engines:', e);
      return false;
    }
  }

  /**
   * Add a custom community search engine (Strict HTTPS & OPSEC enforced)
   */
  static async addCustomEngine(engine) {
    const list = await this.getEngines();
    engine.id = 'custom_' + Date.now();
    engine.isCustom = true;

    // Strict protocol security: enforce HTTPS for clearweb to prevent unencrypted Wi-Fi/router leaks
    let url = (engine.urlTemplate || '').trim();
    if (url.startsWith('http://') && !url.includes('.onion')) {
      url = url.replace('http://', 'https://');
    }
    engine.urlTemplate = url;

    list.push(engine);
    await this.saveEngines(list);
    return list;
  }

  /**
   * Remove a custom engine by ID
   */
  static async removeEngine(engineId) {
    let list = await this.getEngines();
    list = list.filter(e => e.id !== engineId);
    await this.saveEngines(list);
    return list;
  }

  /**
   * Toggle enabled/disabled status of an engine
   */
  static async toggleEngine(engineId, enabled) {
    const list = await this.getEngines();
    const item = list.find(e => e.id === engineId);
    if (item) {
      item.enabled = enabled;
      await this.saveEngines(list);
    }
    return list;
  }

  /**
   * Build query URLs for an engine based on query string and/or image URL (Bug-fixed: replaceAll)
   */
  static buildSearchUrl(engine, { query = '', imgUrl = '', hash = '' } = {}) {
    let url = engine.urlTemplate;
    url = url.replaceAll('{query}', encodeURIComponent(query));
    url = url.replaceAll('{img_url}', encodeURIComponent(imgUrl));
    url = url.replaceAll('{hash}', encodeURIComponent(hash));
    return url;
  }
}

if (typeof window !== 'undefined') {
  window.ReconEngines = ReconEngines;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ReconEngines = ReconEngines;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReconEngines;
}
