/**
 * ReconTrace Matcher Engine (Privacy Hardened)
 * Features:
 *  - Client-side EXIF/GPS Metadata Sanitization & Stripping
 *  - SHA-256 cryptographic evidence hashing
 *  - Difference Hash (dHash) & Color Profiling
 *  - Resilient cross-origin handling & zero-memory leaks
 */

class ReconMatcher {
  /**
   * Client-Side EXIF / GPS Metadata Scrubber
   * Renders the image onto an HTML5 canvas and re-encodes it.
   * Completely strips EXIF, GPS location tags, camera serial numbers, and device models.
   */
  static async sanitizeImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            
            // Draw raw pixel raster (discards all metadata headers)
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((cleanBlob) => {
              if (cleanBlob) {
                resolve({
                  cleanBlob: cleanBlob,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                  scrubbed: true
                });
              } else {
                resolve({ cleanBlob: file, scrubbed: false });
              }
            }, file.type || 'image/png');
          } catch (e) {
            console.warn('Canvas sanitization fallback:', e);
            resolve({ cleanBlob: file, scrubbed: false });
          }
        };
        img.onerror = () => reject(new Error('Invalid or corrupted image format.'));
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Compute SHA-256 evidence hash of an image Blob / File
   */
  static async computeSHA256(blob) {
    const buffer = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Load an image source (data URL, blob, or image element) into an HTMLImageElement
   */
  static loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error('Failed to load image for comparison: ' + err));
      img.src = src;
    });
  }

  /**
   * Compute a 64-bit Difference Hash (dHash)
   * Resizes image to 9x8 grayscale, compares adjacent horizontal pixels.
   */
  static computeDHash(imageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imageElement, 0, 0, 9, 8);
    const imgData = ctx.getImageData(0, 0, 9, 8).data;

    // Convert to grayscale row by row
    const grays = [];
    for (let i = 0; i < imgData.length; i += 4) {
      const gray = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
      grays.push(gray);
    }

    // Compare adjacent horizontal pixels (8 rows of 8 comparisons = 64 bits)
    let hashBits = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = grays[row * 9 + col];
        const right = grays[row * 9 + col + 1];
        hashBits += left < right ? '1' : '0';
      }
    }
    return hashBits;
  }

  /**
   * Compute average color and luminance distribution for auxiliary matching
   */
  static computeColorProfile(imageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imageElement, 0, 0, 16, 16);
    const data = ctx.getImageData(0, 0, 16, 16).data;

    let rTotal = 0, gTotal = 0, bTotal = 0;
    const pixels = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      rTotal += data[i];
      gTotal += data[i + 1];
      bTotal += data[i + 2];
    }
    return {
      avgR: rTotal / pixels,
      avgG: gTotal / pixels,
      avgB: bTotal / pixels
    };
  }

  /**
   * Calculate Hamming Distance between two binary bitstrings of equal length
   */
  static hammingDistance(hash1, hash2) {
    let dist = 0;
    const len = Math.min(hash1.length, hash2.length);
    for (let i = 0; i < len; i++) {
      if (hash1[i] !== hash2[i]) dist++;
    }
    dist += Math.abs(hash1.length - hash2.length);
    return dist;
  }

  /**
   * Compare two images and return a similarity score 0 - 100%
   */
  static async compareImages(targetImgSrc, candidateImgSrc) {
    try {
      const [targetImg, candidateImg] = await Promise.all([
        typeof targetImgSrc === 'string' ? this.loadImage(targetImgSrc) : targetImgSrc,
        typeof candidateImgSrc === 'string' ? this.loadImage(candidateImgSrc) : candidateImgSrc
      ]);

      const hashA = this.computeDHash(targetImg);
      const hashB = this.computeDHash(candidateImg);
      const distance = this.hammingDistance(hashA, hashB);
      const maxBits = 64;

      // Primary structural match
      const structuralScore = (1 - distance / maxBits) * 100;

      // Secondary color profile match
      const colorA = this.computeColorProfile(targetImg);
      const colorB = this.computeColorProfile(candidateImg);
      const rDiff = Math.abs(colorA.avgR - colorB.avgR) / 255;
      const gDiff = Math.abs(colorA.avgG - colorB.avgG) / 255;
      const bDiff = Math.abs(colorA.avgB - colorB.avgB) / 255;
      const colorScore = (1 - (rDiff + gDiff + bDiff) / 3) * 100;

      // Weighted final similarity score (85% structure, 15% color)
      const combinedScore = Math.round(structuralScore * 0.85 + colorScore * 0.15);
      const finalScore = Math.max(0, Math.min(100, combinedScore));

      return {
        score: finalScore,
        confidence: this.getConfidenceLevel(finalScore),
        hammingDistance: distance
      };
    } catch (e) {
      console.warn('Comparison failed (fallback to baseline):', e);
      return {
        score: 50,
        confidence: 'Unknown',
        hammingDistance: 32,
        error: e.message
      };
    }
  }

  /**
   * Determine confidence level and badge styling from score
   */
  static getConfidenceLevel(score) {
    if (score >= 85) {
      return { label: 'High Confidence', class: 'badge-high', color: '#10b981' };
    } else if (score >= 65) {
      return { label: 'Medium Match', class: 'badge-med', color: '#f59e0b' };
    } else {
      return { label: 'Low / Inconclusive', class: 'badge-low', color: '#ef4444' };
    }
  }
}

if (typeof window !== 'undefined') {
  window.ReconMatcher = ReconMatcher;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ReconMatcher = ReconMatcher;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReconMatcher;
}
