/**
 * Image cache for efficient rendering
 */
class ImageCache {
  private cache: Map<string, HTMLImageElement> = new Map();
  private loading: Set<string> = new Set();

  get(src: string): HTMLImageElement | null {
    // Already cached and loaded
    if (this.cache.has(src)) {
      const img = this.cache.get(src)!;
      if (img.complete && img.naturalWidth > 0) {
        return img;
      }
    }

    // Currently loading
    if (this.loading.has(src)) {
      return null;
    }

    // Start loading
    this.loading.add(src);
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      this.cache.set(src, img);
      this.loading.delete(src);
      // Trigger re-render
      window.dispatchEvent(new CustomEvent('imageLoaded'));
    };
    
    img.onerror = () => {
      console.error('Failed to load image:', src);
      this.loading.delete(src);
    };

    return null;
  }

  has(src: string): boolean {
    const img = this.cache.get(src);
    return img !== undefined && img.complete && img.naturalWidth > 0;
  }

  clear() {
    this.cache.clear();
    this.loading.clear();
  }
}

export const imageCache = new ImageCache();
