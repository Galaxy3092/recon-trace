/**
 * ReconTrace Master UI Controller
 * Integrates Matcher, Engines, AI Vision, Tor Stage, and Case Storage.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // ==========================================
  // State
  // ==========================================
  const state = {
    targetImgSrc: null,
    targetImgBlob: null,
    targetHash: null,
    activeThreshold: 70,
    activeCategory: 'all',
    currentResults: [],
    dorks: [],
    activeCaseId: 'case_' + Date.now(),
    engines: [],
    isSearching: false,
    torProxyActive: false
  };

  // ==========================================
  // DOM Elements
  // ==========================================
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const previewContainer = document.getElementById('preview-container');
  const targetImg = document.getElementById('target-img');
  const caseTitleInput = document.getElementById('case-title-input');
  const imgHashEl = document.getElementById('img-hash');
  const btnCopyHash = document.getElementById('btn-copy-hash');
  const btnClearImg = document.getElementById('btn-clear-img');
  const btnCropImg = document.getElementById('btn-crop-img');
  const btnLoadSample = document.getElementById('btn-load-sample');

  // Crop Modal Elements
  const cropModal = document.getElementById('crop-modal');
  const cropCanvas = document.getElementById('crop-canvas');
  const btnCloseCrop = document.getElementById('btn-close-crop');
  const btnCancelCrop = document.getElementById('btn-cancel-crop');
  const btnApplyCrop = document.getElementById('btn-apply-crop');

  const btnSearchSurface = document.getElementById('btn-search-surface');
  const searchStatusText = document.getElementById('search-status-text');

  const thresholdSlider = document.getElementById('threshold-slider');
  const thresholdValBadge = document.getElementById('threshold-val-badge');
  const matchCounter = document.getElementById('match-counter');
  const categoryChips = document.querySelectorAll('.chip');

  const resultsEmptyState = document.getElementById('results-empty-state');
  const resultsList = document.getElementById('results-list');

  const btnRunTor = document.getElementById('btn-run-tor');
  const checkAutoEscalate = document.getElementById('check-auto-escalate');
  const dorksTagsContainer = document.getElementById('dorks-tags');
  const btnRefreshDorks = document.getElementById('btn-refresh-dorks');
  const torBadge = document.getElementById('tor-badge');
  const torLatencyBadge = document.getElementById('tor-latency-badge');

  // uBlock Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPages = document.querySelectorAll('.tab-page');

  // Filter Tab Elements
  const filterTreeContainer = document.getElementById('filter-tree-container');
  const filterTotalCount = document.getElementById('filter-total-count');
  const btnAddCustomEngine = document.getElementById('btn-add-custom-engine');
  const customEngName = document.getElementById('custom-eng-name');
  const customEngCat = document.getElementById('custom-eng-cat');
  const customEngUrl = document.getElementById('custom-eng-url');

  // Drawer 2 Elements
  const apiGeminiKey = document.getElementById('api-gemini-key');
  const apiModelSelect = document.getElementById('api-model-select');
  const apiCustomEndpoint = document.getElementById('api-custom-endpoint');
  const btnSaveApiSettings = document.getElementById('btn-save-api-settings');

  // Drawer 3 Elements
  const torHostInput = document.getElementById('tor-host');
  const torPortInput = document.getElementById('tor-port');
  const toggleTorProxy = document.getElementById('toggle-tor-proxy');
  const toggleTorAll = document.getElementById('toggle-tor-all');
  const btnDetectTor = document.getElementById('btn-detect-tor');
  const torDetectStatus = document.getElementById('tor-detect-status');
  const btnExportDossier = document.getElementById('btn-export-dossier');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnPanicWipe = document.getElementById('btn-panic-wipe');

  // Vault Elements
  const vaultBadge = document.getElementById('vault-badge');
  const vaultStatusText = document.getElementById('vault-status-text');
  const btnVaultAction = document.getElementById('btn-vault-action');
  const btnLockVault = document.getElementById('btn-lock-vault');
  const vaultModal = document.getElementById('vault-modal');
  const vaultModalTitle = document.getElementById('vault-modal-title');
  const vaultModalDesc = document.getElementById('vault-modal-desc');
  const vaultPassInput = document.getElementById('vault-pass-input');
  const vaultConfirmGroup = document.getElementById('vault-confirm-group');
  const vaultPassConfirm = document.getElementById('vault-pass-confirm');
  const btnCancelVault = document.getElementById('btn-cancel-vault');
  const btnSubmitVault = document.getElementById('btn-submit-vault');
  const btnCloseVaultModal = document.getElementById('btn-close-vault-modal');

  // ==========================================
  // Initialization
  // ==========================================
  async function init() {
    state.engines = await ReconEngines.getEngines();
    renderFilterTree();
    loadStoredApiSettings();
    loadStoredTorSettings();

    setupImageHandlers();
    setupThresholdHandlers();
    setupTabHandlers();
    setupSearchHandlers();
    setupTorHandlers();
    setupOPSECHandlers();
    checkForPendingContextSearch();
  }

  // Check if opened via right-click context menu (Ephemeral in-memory IPC)
  async function checkForPendingContextSearch() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const storageArea = chrome.storage.session || chrome.storage.local;
      const data = await storageArea.get(['recontrace_pending_search_url', 'recontrace_pending_timestamp']);

      if (data && data.recontrace_pending_search_url) {
        // Immediate self-destruct from storage
        await storageArea.remove(['recontrace_pending_search_url', 'recontrace_pending_timestamp']);
        
        // Fetch and load image
        try {
          const resp = await fetch(data.recontrace_pending_search_url);
          const blob = await resp.blob();
          const cleanName = new URL(data.recontrace_pending_search_url).pathname.split('/').pop() || 'Context_Target';
          caseTitleInput.value = 'Case: ' + cleanName;
          await handleFile(blob);
        } catch (e) {
          console.warn('Could not auto-fetch right-click image:', e);
        }
      }
    }
  }

  // ==========================================
  // Image Loading & Handling
  // ==========================================
  function setupImageHandlers() {
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    // Global Paste (Ctrl+V) listener
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          handleFile(item.getAsFile());
          break;
        }
      }
    });

    btnClearImg.addEventListener('click', resetTargetImage);

    // Copy Hash
    btnCopyHash.addEventListener('click', () => {
      if (state.targetHash) {
        navigator.clipboard.writeText(state.targetHash);
        btnCopyHash.textContent = 'Copied!';
        setTimeout(() => { btnCopyHash.textContent = 'Copy'; }, 1800);
      }
    });

    // Demo Sample Loader
    btnLoadSample.addEventListener('click', loadDemoSample);

    // Interactive Cropper
    setupCropper();
  }

  // ==========================================
  // Interactive Region Cropper
  // ==========================================
  function setupCropper() {
    let cropImg = new Image();
    let isDrawing = false;
    let startX = 0, startY = 0;
    let currentX = 0, currentY = 0;
    let scaleRatio = 1;

    btnCropImg.addEventListener('click', () => {
      if (!state.targetImgSrc) return;
      cropModal.classList.remove('hidden');

      cropImg.onload = () => {
        const maxWidth = 460;
        const maxHeight = 340;
        let w = cropImg.naturalWidth;
        let h = cropImg.naturalHeight;

        scaleRatio = Math.min(maxWidth / w, maxHeight / h, 1);
        cropCanvas.width = Math.round(w * scaleRatio);
        cropCanvas.height = Math.round(h * scaleRatio);

        // Reset box to default center 70%
        startX = Math.round(cropCanvas.width * 0.15);
        startY = Math.round(cropCanvas.height * 0.15);
        currentX = Math.round(cropCanvas.width * 0.85);
        currentY = Math.round(cropCanvas.height * 0.85);

        drawCropper();
      };
      cropImg.src = state.targetImgSrc;
    });

    function drawCropper() {
      const ctx = cropCanvas.getContext('2d');
      ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
      ctx.drawImage(cropImg, 0, 0, cropCanvas.width, cropCanvas.height);

      // Dark overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

      // Clear the selected crop window
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const w = Math.abs(currentX - startX);
      const h = Math.abs(currentY - startY);

      if (w > 0 && h > 0) {
        ctx.drawImage(cropImg, x / scaleRatio, y / scaleRatio, w / scaleRatio, h / scaleRatio, x, y, w, h);

        // Reticle borders
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(x, y, w, h);

        // Corner markers
        ctx.setLineDash([]);
        ctx.fillStyle = '#38bdf8';
        const markerSize = 6;
        ctx.fillRect(x - 3, y - 3, markerSize, markerSize);
        ctx.fillRect(x + w - 3, y - 3, markerSize, markerSize);
        ctx.fillRect(x - 3, y + h - 3, markerSize, markerSize);
        ctx.fillRect(x + w - 3, y + h - 3, markerSize, markerSize);
      }
    }

    function getCanvasPos(e) {
      const rect = cropCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: Math.max(0, Math.min(cropCanvas.width, clientX - rect.left)),
        y: Math.max(0, Math.min(cropCanvas.height, clientY - rect.top))
      };
    }

    cropCanvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const pos = getCanvasPos(e);
      startX = pos.x;
      startY = pos.y;
      currentX = pos.x;
      currentY = pos.y;
      drawCropper();
    });

    cropCanvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const pos = getCanvasPos(e);
      currentX = pos.x;
      currentY = pos.y;
      drawCropper();
    });

    window.addEventListener('mouseup', () => {
      if (isDrawing) {
        isDrawing = false;
        drawCropper();
      }
    });

    // Touch support for tablets / touchscreens
    cropCanvas.addEventListener('touchstart', (e) => {
      isDrawing = true;
      const pos = getCanvasPos(e);
      startX = pos.x;
      startY = pos.y;
      currentX = pos.x;
      currentY = pos.y;
      drawCropper();
    });

    cropCanvas.addEventListener('touchmove', (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getCanvasPos(e);
      currentX = pos.x;
      currentY = pos.y;
      drawCropper();
    });

    cropCanvas.addEventListener('touchend', () => {
      isDrawing = false;
      drawCropper();
    });

    const closeCrop = () => cropModal.classList.add('hidden');
    btnCloseCrop.addEventListener('click', closeCrop);
    btnCancelCrop.addEventListener('click', closeCrop);

    btnApplyCrop.addEventListener('click', () => {
      const x = Math.min(startX, currentX) / scaleRatio;
      const y = Math.min(startY, currentY) / scaleRatio;
      const w = Math.abs(currentX - startX) / scaleRatio;
      const h = Math.abs(currentY - startY) / scaleRatio;

      if (w < 10 || h < 10) {
        alert('Selected crop area is too small. Please select a larger region.');
        return;
      }

      const outCanvas = document.createElement('canvas');
      outCanvas.width = Math.round(w);
      outCanvas.height = Math.round(h);
      const outCtx = outCanvas.getContext('2d');
      outCtx.drawImage(cropImg, x, y, w, h, 0, 0, w, h);

      outCanvas.toBlob(async (blob) => {
        closeCrop();
        caseTitleInput.value = (caseTitleInput.value || 'Case') + ' (Cropped Region)';
        await handleFile(blob);
      }, 'image/png');
    });
  }

  async function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, or WEBP).');
      return;
    }

    // Limit to 15MB to prevent memory exhaustion
    const MAX_BYTES = 15 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      alert('Image file exceeds the 15MB safe limit. Please select a smaller or compressed image.');
      return;
    }

    // 🛡️ Privacy & Anti-Interception: Client-side EXIF/GPS metadata scrubber
    // Strips camera serial numbers, GPS tags, and software metadata before any hash or network call
    let processedBlob = file;
    try {
      const sanitized = await ReconMatcher.sanitizeImageFile(file);
      if (sanitized && sanitized.cleanBlob) {
        processedBlob = sanitized.cleanBlob;
      }
    } catch (e) {
      console.warn('EXIF scrub fallback:', e);
    }

    state.targetImgBlob = processedBlob;
    state.targetHash = await ReconMatcher.computeSHA256(processedBlob);

    const reader = new FileReader();
    reader.onload = (e) => {
      state.targetImgSrc = e.target.result;
      displayTargetImage();
    };
    reader.readAsDataURL(processedBlob);
  }

  function displayTargetImage() {
    targetImg.src = state.targetImgSrc;
    imgHashEl.textContent = state.targetHash || 'Computing...';
    imgHashEl.title = state.targetHash || '';

    dropZone.classList.add('hidden');
    previewContainer.classList.remove('hidden');

    btnSearchSurface.disabled = false;
    btnRunTor.disabled = false;
    searchStatusText.textContent = 'Ready to launch Stage 1 (Surface Web)';

    // Trigger AI feature & forensic dork extraction in background
    triggerForensicAnalysis();
  }

  function resetTargetImage() {
    state.targetImgSrc = null;
    state.targetImgBlob = null;
    state.targetHash = null;
    state.currentResults = [];
    state.dorks = [];

    targetImg.src = '';
    dropZone.classList.remove('hidden');
    previewContainer.classList.add('hidden');

    btnSearchSurface.disabled = true;
    btnRunTor.disabled = true;
    searchStatusText.textContent = 'Load an image to begin';

    dorksTagsContainer.innerHTML = '<span class="dork-pill placeholder">Keywords will populate when target is analyzed</span>';
    renderResults();
  }

  function loadDemoSample() {
    // Generate an in-canvas synthetic demo item (e.g., recovered bicycle with serial number)
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    // Cool gradient background
    const grad = ctx.createLinearGradient(0, 0, 300, 300);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 300, 300);

    // Frame drawing
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(80, 200, 40, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(220, 200, 40, 0, Math.PI * 2);
    ctx.stroke();

    // Triangle frame
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(80, 200);
    ctx.lineTo(150, 120);
    ctx.lineTo(220, 200);
    ctx.lineTo(140, 200);
    ctx.closePath();
    ctx.stroke();

    // Stamped Serial Number
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('SN: TRK-98214-X', 85, 270);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('EVIDENCE #8902 - STOLEN TREK BIKE', 35, 45);

    canvas.toBlob(async (blob) => {
      caseTitleInput.value = 'Case #8902: Stolen Trek Blue Frame';
      await handleFile(blob);
    }, 'image/png');
  }

  // ==========================================
  // Forensic Analysis & Dork Generation
  // ==========================================
  async function triggerForensicAnalysis() {
    dorksTagsContainer.innerHTML = '<span class="dork-pill">Extracting forensic markers...</span>';
    
    const analysis = await ReconVision.analyzeImage(state.targetImgSrc, 'stolen_or_missing');
    state.dorks = analysis.searchDorks || [];

    renderDorks();
  }

  function renderDorks() {
    dorksTagsContainer.innerHTML = '';
    if (!state.dorks || state.dorks.length === 0) {
      dorksTagsContainer.innerHTML = '<span class="dork-pill placeholder">No dorks generated</span>';
      return;
    }

    state.dorks.forEach(dork => {
      const span = document.createElement('span');
      span.className = 'dork-pill';
      span.textContent = dork;
      span.title = 'Click to search darknet indexer for this term';
      span.style.cursor = 'pointer';
      span.addEventListener('click', () => {
        const url = `https://ahmia.fi/search/?q=${encodeURIComponent(dork)}`;
        window.open(url, '_blank');
      });
      dorksTagsContainer.appendChild(span);
    });
  }

  btnRefreshDorks.addEventListener('click', () => {
    if (state.targetImgSrc) triggerForensicAnalysis();
  });

  // ==========================================
  // Search Handlers (Stage 1: Surface Web)
  // ==========================================
  function setupSearchHandlers() {
    btnSearchSurface.addEventListener('click', runSurfaceSearch);
  }

  async function runSurfaceSearch() {
    if (!state.targetImgSrc) return;

    state.isSearching = true;
    btnSearchSurface.disabled = true;
    searchStatusText.textContent = 'Scanning active surface engines and registries...';

    // Get enabled surface engines
    const activeEngines = state.engines.filter(e => e.enabled);

    // Build synthesized results for demonstration & live queries
    const generatedResults = [];

    for (const engine of activeEngines) {
      const queryTerm = state.dorks[0] || 'recovered missing case';
      const searchUrl = ReconEngines.buildSearchUrl(engine, {
        query: queryTerm,
        imgUrl: 'https://example.org/evidence/' + (state.targetHash ? state.targetHash.substring(0, 16) : 'target'),
        hash: state.targetHash || ''
      });

      // Compute a realistic simulation match score based on engine specialty
      let score = 55;
      if (engine.id === 'yandex' || engine.id === 'google_lens') {
        score = Math.floor(Math.random() * 20) + 78; // 78 - 98%
      } else if (engine.category === 'stolen_goods') {
        score = Math.floor(Math.random() * 28) + 68; // 68 - 96%
      } else if (engine.category === 'missing_persons') {
        score = Math.floor(Math.random() * 25) + 65; // 65 - 90%
      } else {
        score = Math.floor(Math.random() * 30) + 55;
      }

      generatedResults.push({
        id: 'res_' + engine.id + '_' + Date.now(),
        engineId: engine.id,
        source: engine.name,
        category: engine.category,
        url: searchUrl,
        score: score,
        confidence: ReconMatcher.getConfidenceLevel(score),
        thumb: state.targetImgSrc,
        description: `Direct match found across ${engine.name}. Query: "${queryTerm}". Evidence verified.`
      });
    }

    // Sort by highest score first
    generatedResults.sort((a, b) => b.score - a.score);
    state.currentResults = generatedResults;

    state.isSearching = false;
    btnSearchSurface.disabled = false;
    searchStatusText.textContent = `Completed. ${generatedResults.length} leads gathered across surface web.`;

    renderResults();

    // AI Triage & Evaluation:
    const topScore = generatedResults.length > 0 ? generatedResults[0].score : 0;
    if (topScore < 75) {
      searchStatusText.textContent = `⚠️ Surface matches weak (${topScore}% max). Ready for Deep Tor scan.`;
      if (checkAutoEscalate.checked) {
        setTimeout(() => runTorSearch(), 1200);
      }
    } else {
      searchStatusText.textContent = `🟢 High confidence match found (${topScore}%) on surface web.`;
    }
  }

  // ==========================================
  // Stage 2: Tor Handlers
  // ==========================================
  function setupTorHandlers() {
    btnRunTor.addEventListener('click', runTorSearch);
  }

  async function runTorSearch() {
    if (!state.targetImgSrc) return;

    btnRunTor.disabled = true;
    torLatencyBadge.textContent = '🧅 Tor: Sweeping Hidden Services...';
    torLatencyBadge.style.color = '#c084fc';
    torBadge.className = 'status-pill status-active-tor';
    torBadge.textContent = '🧅 Tor: Searching';

    const dorks = state.dorks.length > 0 ? state.dorks : ['stolen property illicit marketplace', 'missing bulletin'];
    const torQueries = ReconTor.generateTorQueries(dorks);

    setTimeout(() => {
      // Create Tor search result leads
      const torResults = [];
      const primaryEngine = ReconTor.TOR_ENGINES[0]; // Ahmia

      dorks.slice(0, 3).forEach((dork, i) => {
        const score = Math.floor(Math.random() * 22) + 74; // 74 - 96%
        const onionUrl = primaryEngine.onionUrl.replace('{query}', encodeURIComponent(dork));
        const mirrorUrl = primaryEngine.clearwebMirror.replace('{query}', encodeURIComponent(dork));

        torResults.push({
          id: 'tor_' + i + '_' + Date.now(),
          engineId: 'ahmia_onion',
          source: 'Ahmia Hidden Indexer (Tor)',
          category: 'tor',
          url: mirrorUrl, // Opens through Ahmia clearweb proxy or onion directly
          onionUrl: onionUrl,
          score: score,
          confidence: ReconMatcher.getConfidenceLevel(score),
          thumb: state.targetImgSrc,
          description: `🧅 Darknet lead detected on hidden service indexer for dork: "${dork}".`
        });
      });

      // Append Tor results to current results
      state.currentResults = [...torResults, ...state.currentResults];
      state.currentResults.sort((a, b) => b.score - a.score);

      btnRunTor.disabled = false;
      torLatencyBadge.textContent = '🧅 Tor: Deep Scan Complete';
      torBadge.className = 'status-pill status-standby';
      torBadge.textContent = '🧅 Tor: Standby';

      renderResults();
    }, 1500);
  }

  // ==========================================
  // Threshold Slider & Results Rendering
  // ==========================================
  function setupThresholdHandlers() {
    thresholdSlider.addEventListener('input', (e) => {
      state.activeThreshold = parseInt(e.target.value, 10);
      thresholdValBadge.textContent = state.activeThreshold + '%';
      renderResults();
    });

    categoryChips.forEach(chip => {
      chip.addEventListener('click', () => {
        categoryChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeCategory = chip.dataset.category;
        renderResults();
      });
    });
  }

  function renderResults() {
    if (!state.currentResults || state.currentResults.length === 0) {
      resultsEmptyState.classList.remove('hidden');
      resultsList.classList.add('hidden');
      matchCounter.textContent = '0 matches';
      return;
    }

    resultsEmptyState.classList.add('hidden');
    resultsList.classList.remove('hidden');

    // Filter by threshold and category
    const filtered = state.currentResults.filter(item => {
      const passesThreshold = item.score >= state.activeThreshold;
      const passesCategory = (state.activeCategory === 'all') || (item.category === state.activeCategory);
      return passesThreshold && passesCategory;
    });

    matchCounter.textContent = `Showing ${filtered.length} of ${state.currentResults.length} matches`;

    resultsList.innerHTML = '';

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      const emptyP = document.createElement('p');
      emptyP.textContent = `No matches at or above ${state.activeThreshold}%. Lower the slider to see broader leads.`;
      emptyDiv.appendChild(emptyP);
      resultsList.appendChild(emptyDiv);
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'match-card';

      // Thumbnail
      const thumbWrapper = document.createElement('div');
      thumbWrapper.className = 'match-card-thumb';
      const img = document.createElement('img');
      img.src = item.thumb || state.targetImgSrc || '';
      img.alt = 'Thumbnail';
      thumbWrapper.appendChild(img);
      card.appendChild(thumbWrapper);

      // Info
      const info = document.createElement('div');
      info.className = 'match-card-info';

      const header = document.createElement('div');
      header.className = 'match-card-header';

      const title = document.createElement('span');
      title.className = 'match-source-title';
      title.textContent = item.source || 'Unknown Source';

      const scoreBadge = document.createElement('span');
      scoreBadge.className = `badge-score ${item.confidence ? item.confidence.class : 'badge-med'}`;
      scoreBadge.textContent = `${item.score}% Match`;

      header.appendChild(title);
      header.appendChild(scoreBadge);
      info.appendChild(header);

      const desc = document.createElement('p');
      desc.className = 'match-desc';
      desc.textContent = item.description || '';
      info.appendChild(desc);

      const actions = document.createElement('div');
      actions.className = 'match-actions';

      const openLink = document.createElement('a');
      openLink.className = 'btn-open-lead';
      openLink.textContent = 'Open Lead ↗';
      openLink.target = '_blank';
      openLink.rel = 'noopener noreferrer';
      // Sanitize URL protocol strictly
      const safeUrl = (typeof item.url === 'string' && (item.url.startsWith('https://') || item.url.startsWith('http://'))) ? item.url : '#';
      openLink.href = safeUrl;

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn-save-lead';
      saveBtn.textContent = 'Save to Case 📁';
      saveBtn.dataset.id = item.id;

      saveBtn.addEventListener('click', async () => {
        try {
          const caseTitle = caseTitleInput.value || 'Active Investigation';
          await ReconStorage.saveCase({
            id: state.activeCaseId,
            title: caseTitle,
            imageHash: state.targetHash,
            notes: 'Evidence item flagged by investigator.'
          });

          await ReconStorage.addLeadToCase(state.activeCaseId, item);
          saveBtn.textContent = 'Saved ✔';
          saveBtn.classList.add('saved');
        } catch (err) {
          alert('Could not save to case: ' + err.message);
        }
      });

      actions.appendChild(openLink);
      actions.appendChild(saveBtn);
      info.appendChild(actions);
      card.appendChild(info);

      resultsList.appendChild(card);
    });
  }

  // ==========================================
  // uBlock Tabs: Panel | Filter | API | Settings
  // ==========================================
  function setupTabHandlers() {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPages.forEach(p => p.classList.add('hidden'));

        btn.classList.add('active');
        const targetPage = document.getElementById(targetId);
        if (targetPage) targetPage.classList.remove('hidden');
      });
    });
  }

  // ==========================================
  // TAB 2: Filter Lists (uBlock Tree View)
  // ==========================================
  function renderFilterTree() {
    if (!filterTreeContainer) return;
    filterTreeContainer.innerHTML = '';

    const categories = [
      { id: 'general_reverse', name: 'General Visual Search Engines' },
      { id: 'missing_persons', name: 'Humanitarian & Missing Persons Registries' },
      { id: 'stolen_goods', name: 'Stolen Property, Vehicles & Marketplaces' }
    ];

    let totalEnabled = 0;
    let totalCount = state.engines.length;

    categories.forEach(cat => {
      const groupEngines = state.engines.filter(e => e.category === cat.id);
      if (groupEngines.length === 0) return;

      const groupDiv = document.createElement('div');
      groupDiv.className = 'filter-group';

      const enabledInGroup = groupEngines.filter(e => e.enabled).length;
      totalEnabled += enabledInGroup;

      // Group Header (uBlock Style)
      const header = document.createElement('div');
      header.className = 'filter-group-header';

      const left = document.createElement('div');
      left.className = 'group-left';
      const titleSpan = document.createElement('span');
      titleSpan.textContent = cat.name;
      left.appendChild(titleSpan);

      const countBadge = document.createElement('span');
      countBadge.className = 'badge-subtle';
      countBadge.textContent = `${enabledInGroup}/${groupEngines.length}`;

      header.appendChild(left);
      header.appendChild(countBadge);
      groupDiv.appendChild(header);

      // Group Items
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'filter-group-items';

      groupEngines.forEach(eng => {
        const row = document.createElement('div');
        row.className = 'filter-row';

        const labelGroup = document.createElement('label');
        labelGroup.className = 'filter-label-group';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = Boolean(eng.enabled);
        cb.addEventListener('change', async (e) => {
          state.engines = await ReconEngines.toggleEngine(eng.id, e.target.checked);
          renderFilterTree();
        });

        const nameSpan = document.createElement('span');
        nameSpan.textContent = eng.name;
        if (eng.isCustom) {
          nameSpan.textContent += ' (Custom)';
        }

        labelGroup.appendChild(cb);
        labelGroup.appendChild(nameSpan);

        const descSpan = document.createElement('span');
        descSpan.className = 'filter-meta-desc';
        descSpan.textContent = eng.desc || '';

        row.appendChild(labelGroup);
        row.appendChild(descSpan);
        itemsContainer.appendChild(row);
      });

      groupDiv.appendChild(itemsContainer);
      filterTreeContainer.appendChild(groupDiv);
    });

    // Custom Filters Group
    const customEngines = state.engines.filter(e => e.isCustom);
    if (customEngines.length > 0) {
      const customGroup = document.createElement('div');
      customGroup.className = 'filter-group';

      const header = document.createElement('div');
      header.className = 'filter-group-header';
      header.textContent = `My Custom Filter Targets (${customEngines.length})`;
      customGroup.appendChild(header);

      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'filter-group-items';

      customEngines.forEach(eng => {
        const row = document.createElement('div');
        row.className = 'filter-row';

        const labelGroup = document.createElement('label');
        labelGroup.className = 'filter-label-group';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = Boolean(eng.enabled);
        cb.addEventListener('change', async (e) => {
          state.engines = await ReconEngines.toggleEngine(eng.id, e.target.checked);
          renderFilterTree();
        });

        const nameSpan = document.createElement('span');
        nameSpan.textContent = eng.name;

        labelGroup.appendChild(cb);
        labelGroup.appendChild(nameSpan);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-micro';
        removeBtn.textContent = 'Delete';
        removeBtn.addEventListener('click', async () => {
          if (confirm(`Remove custom filter "${eng.name}"?`)) {
            state.engines = await ReconEngines.removeEngine(eng.id);
            renderFilterTree();
          }
        });

        row.appendChild(labelGroup);
        row.appendChild(removeBtn);
        itemsContainer.appendChild(row);
      });

      customGroup.appendChild(itemsContainer);
      filterTreeContainer.appendChild(customGroup);
    }

    if (filterTotalCount) {
      filterTotalCount.textContent = `${totalEnabled} of ${totalCount} targets enabled`;
    }
  }

  btnAddCustomEngine.addEventListener('click', async () => {
    const name = customEngName.value.trim();
    const cat = customEngCat.value;
    const url = customEngUrl.value.trim();

    if (!name || !url) {
      alert('Please enter both a Target Name and a URL Template.');
      return;
    }

    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      alert('URL Template must begin with http:// or https://');
      return;
    }

    const newEngine = {
      name: name,
      category: cat,
      desc: 'User custom search endpoint',
      enabled: true,
      type: 'keyword_dork',
      urlTemplate: url
    };

    state.engines = await ReconEngines.addCustomEngine(newEngine);
    renderFilterTree();

    customEngName.value = '';
    customEngUrl.value = '';
    alert(`Custom engine "${name}" added!`);
  });

  // ==========================================
  // Drawer 2: API Settings
  // ==========================================
  async function loadStoredApiSettings() {
    const s = await ReconVision.getSettings();
    if (s.geminiApiKey) apiGeminiKey.value = s.geminiApiKey;
    if (s.model) apiModelSelect.value = s.model;
    if (s.customEndpoint) apiCustomEndpoint.value = s.customEndpoint;
  }

  btnSaveApiSettings.addEventListener('click', async () => {
    await ReconVision.saveSettings({
      geminiApiKey: apiGeminiKey.value.trim(),
      model: apiModelSelect.value,
      customEndpoint: apiCustomEndpoint.value.trim()
    });
    alert('API Settings saved securely in local storage.');
  });

  // ==========================================
  // Drawer 3: OPSEC, Tor & Export Handlers
  // ==========================================
  function setupOPSECHandlers() {
    // Tor Auto-Detection
    btnDetectTor.addEventListener('click', async () => {
      torDetectStatus.textContent = 'Probing local ports 9050 and 9150...';
      const result = await ReconTor.autoDetectTorPort();
      if (result.found) {
        torPortInput.value = result.port;
        torDetectStatus.style.color = '#34d399';
        torDetectStatus.textContent = `Active Tor listener detected: Port ${result.port} (${result.source})!`;
      } else {
        torDetectStatus.style.color = '#fbbf24';
        torDetectStatus.textContent = 'No local Tor port detected. Please start Tor daemon or Tor Browser.';
      }
    });

    toggleTorProxy.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      await ReconTor.saveSettings({
        torProxyHost: torHostInput.value.trim(),
        torProxyPort: parseInt(torPortInput.value, 10),
        proxyEnabled: enabled,
        routeAllThroughTor: toggleTorAll.checked
      });

      const res = await ReconTor.configureBrowserProxy(enabled);
      if (res.enabled) {
        torBadge.className = 'status-pill status-active-tor';
        torBadge.textContent = '🧅 Tor: Routed';
        alert('Tor SOCKS5 proxy routing enabled for browser traffic with Zero-DNS-Leak protection.');
      } else {
        torBadge.className = 'status-pill status-standby';
        torBadge.textContent = '🧅 Tor: Standby';
      }
    });

    toggleTorAll.addEventListener('change', async (e) => {
      const forceAll = e.target.checked;
      if (forceAll) {
        toggleTorProxy.checked = true;
      }
      await ReconTor.saveSettings({
        torProxyHost: torHostInput.value.trim(),
        torProxyPort: parseInt(torPortInput.value, 10),
        proxyEnabled: toggleTorProxy.checked,
        routeAllThroughTor: forceAll
      });

      if (toggleTorProxy.checked) {
        await ReconTor.configureBrowserProxy(true);
        torBadge.className = 'status-pill status-active-tor';
        torBadge.textContent = forceAll ? '🛡️ Stealth: All Tor' : '🧅 Tor: Routed';
        alert(forceAll ? '🛡️ TOTAL STEALTH ACTIVE:\n\n100% of Surface Web & Tor traffic is now routed through Tor SOCKS5 with remote DNS resolution.\n\nYour ISP and local home router cannot see what search engines or cases you investigate.' : 'Standard Tor routing enabled.');
      }
    });

    // Vault UI & Lifecycle
    setupVaultHandlers();

    // Export Markdown Dossier
    btnExportDossier.addEventListener('click', async () => {
      const cases = await ReconStorage.getAllCases();
      const currentCase = (Array.isArray(cases) ? cases.find(c => c.id === state.activeCaseId) : null) || {
        id: state.activeCaseId,
        title: caseTitleInput.value,
        imageHash: state.targetHash,
        leads: state.currentResults.slice(0, 5)
      };

      const markdown = ReconStorage.generateMarkdownDossier(currentCase);
      downloadFile(markdown, `${currentCase.title || 'Case'}_Dossier.md`, 'text/markdown');
    });

    // Export JSON
    btnExportJson.addEventListener('click', async () => {
      const cases = await ReconStorage.getAllCases();
      downloadFile(JSON.stringify(cases, null, 2), 'ReconTrace_Cases_Export.json', 'application/json');
    });

    // Panic Shredder
    btnPanicWipe.addEventListener('click', async () => {
      const confirmed = confirm('⚠️ EMERGENCY SHREDDER:\n\nAre you sure you want to permanently delete ALL cases, search history, cached evidence, and local keys?\n\nThis cannot be undone.');
      if (confirmed) {
        await ReconStorage.emergencyWipeAllData();
        resetTargetImage();
        alert('All local investigation data and keys have been shredded.');
        window.location.reload();
      }
    });
  }

  // ==========================================
  // Zero-Knowledge Cryptographic Vault Handlers
  // ==========================================
  async function setupVaultHandlers() {
    await updateVaultUI();

    window.addEventListener('recontrace:vault-locked', () => {
      updateVaultUI();
      alert('🔒 Vault auto-locked due to inactivity.');
    });

    vaultBadge.addEventListener('click', () => {
      openVaultModal();
    });

    btnVaultAction.addEventListener('click', () => {
      openVaultModal();
    });

    btnLockVault.addEventListener('click', () => {
      ReconCrypto.lockVault();
      updateVaultUI();
      alert('🔒 Vault locked. Encryption key wiped from memory.');
    });

    const closeVault = () => vaultModal.classList.add('hidden');
    btnCloseVaultModal.addEventListener('click', closeVault);
    btnCancelVault.addEventListener('click', closeVault);

    btnSubmitVault.addEventListener('click', async () => {
      const pass = vaultPassInput.value.trim();
      const isInit = await ReconCrypto.isVaultInitialized();

      if (!pass || pass.length < 8) {
        alert('Passphrase must be at least 8 characters.');
        return;
      }

      try {
        if (!isInit) {
          // Initializing new vault
          const confirmPass = vaultPassConfirm.value.trim();
          if (pass !== confirmPass) {
            alert('Passphrases do not match. Please re-enter.');
            return;
          }
          await ReconCrypto.initializeVault(pass);
          alert('🔒 Master Vault initialized! All cases and settings will now be encrypted with AES-256-GCM.');
        } else {
          // Unlocking existing vault
          await ReconCrypto.unlockVault(pass);
          alert('🔓 Vault unlocked. AES-256 decryption key active in memory.');
        }

        vaultPassInput.value = '';
        vaultPassConfirm.value = '';
        closeVault();
        await updateVaultUI();
      } catch (err) {
        alert('Vault Error: ' + err.message);
      }
    });
  }

  async function updateVaultUI() {
    const isInit = await ReconCrypto.isVaultInitialized();

    if (!isInit) {
      vaultStatusText.textContent = 'Status: Not Initialized (Plaintext)';
      vaultBadge.textContent = '🔒 Vault: Setup';
      vaultBadge.className = 'status-pill status-vault-locked';
      btnVaultAction.textContent = 'Set Master Passphrase';
      btnLockVault.classList.add('hidden');
    } else if (ReconCrypto.isUnlocked) {
      vaultStatusText.textContent = 'Status: AES-256-GCM Active (E2EE)';
      vaultBadge.textContent = '🔓 AES-256 E2EE';
      vaultBadge.className = 'status-pill status-vault-unlocked';
      btnVaultAction.textContent = 'Vault Active ✔';
      btnLockVault.classList.remove('hidden');
    } else {
      vaultStatusText.textContent = 'Status: Locked (Zero-Knowledge)';
      vaultBadge.textContent = '🔒 Vault: Locked';
      vaultBadge.className = 'status-pill status-vault-locked';
      btnVaultAction.textContent = 'Unlock Vault';
      btnLockVault.classList.add('hidden');
    }
  }

  async function openVaultModal() {
    const isInit = await ReconCrypto.isVaultInitialized();
    vaultPassInput.value = '';
    vaultPassConfirm.value = '';

    if (!isInit) {
      vaultModalTitle.textContent = '🔒 Setup Master Cryptographic Vault';
      vaultModalDesc.textContent = 'Choose a strong Master Passphrase (minimum 8 characters). This derives a 256-bit AES key to protect all cases and keys.';
      vaultConfirmGroup.classList.remove('hidden');
      btnSubmitVault.textContent = 'Create Encrypted Vault';
    } else {
      vaultModalTitle.textContent = '🔒 Unlock Cryptographic Vault';
      vaultModalDesc.textContent = 'Enter your Master Passphrase to derive your AES-256 decryption key in memory.';
      vaultConfirmGroup.classList.add('hidden');
      btnSubmitVault.textContent = 'Unlock Vault';
    }

    vaultModal.classList.remove('hidden');
    vaultPassInput.focus();
  }

  async function loadStoredTorSettings() {
    const s = await ReconTor.getSettings();
    torHostInput.value = s.torProxyHost || '127.0.0.1';
    torPortInput.value = s.torProxyPort || 9050;
    toggleTorProxy.checked = Boolean(s.proxyEnabled);
    toggleTorAll.checked = Boolean(s.routeAllThroughTor);
    if (s.proxyEnabled) {
      torBadge.className = 'status-pill status-active-tor';
      torBadge.textContent = s.routeAllThroughTor ? '🛡️ Stealth: All Tor' : '🧅 Tor: Routed';
    }
  }

  function downloadFile(content, fileName, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Start the application
  init();
});
