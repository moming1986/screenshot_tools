import { useState, useEffect, useCallback } from 'react';

// Default English translations (embedded fallback)
const defaultTranslations = {
  "app": {
    "title": "PageOps Screenshot Tool",
    "inputPanel": "Input",
    "displayPanel": "Display & Download",
    "capture": "Capture",
    "cancel": "Cancel",
    "clearSettings": "Clear Settings",
    "historyCount": "History: {{count}}"
  },
  "fields": {
    "apiKey": "PageOps API Key",
    "apiBaseUrl": "API Base URL",
    "targetUrl": "Target URL",
    "batchMode": "Batch Mode",
    "batchUrlsPlaceholder": "https://example.com/product/1\nhttps://example.com/product/2\nhttps://example.com/product/3\n(Max 20 URLs)",
    "mode": "Mode",
    "modeAsync": "async (returns jobId, auto polling)",
    "modeSync": "sync (wait for result directly)",
    "viewport": "Viewport",
    "viewportWidth": "Width",
    "viewportHeight": "Height",
    "selector": "Selector (capture specific element)",
    "delay": "Delay (ms)",
    "headers": "Headers JSON (Authorization, etc.)",
    "cookies": "Cookies JSON (array)"
  },
  "config": {
    "screenshotConfig": "Screenshot Config (Optional)",
    "cookieTokenInput": "Cookie / Token Input",
    "presets": "Config Presets",
    "showPresetPanel": "Show Preset Panel",
    "loadPreset": "Load Preset",
    "savePreset": "Save Current Config as Preset",
    "presetNamePlaceholder": "e.g. Mobile + Login",
    "save": "Save",
    "clearAllPresets": "Clear All Presets",
    "watermark": "Watermark Config",
    "enableWatermark": "Enable Download Watermark",
    "watermarkText": "Watermark Text",
    "watermarkPosition": "Position",
    "watermarkFontSize": "Font Size",
    "watermarkOpacity": "Opacity",
    "watermarkColor": "Text Color",
    "watermarkBgColor": "Background Color",
    "watermarkPadding": "Padding",
    "poster": "Poster Config",
    "showPosterPanel": "Show Poster Panel",
    "posterTemplate": "Template",
    "posterTitle": "Title",
    "posterSubtitle": "Subtitle",
    "posterPrice": "Price",
    "posterBadge": "Badge Text",
    "posterShowUrl": "Show URL",
    "posterShowTimestamp": "Show Timestamp",
    "posterShowDevice": "Show Device Info",
    "posterShowBrand": "Show Brand",
    "posterBrandText": "Brand Text",
    "posterAccentColor": "Accent Color",
    "posterBgStyle": "Background Style"
  },
  "history": {
    "noImage": "No image",
    "jobId": "jobId",
    "status": "status",
    "download": {
      "png": "PNG",
      "jpeg": "JPEG",
      "watermarkPng": "WaterPrint",
      "watermarkJpeg": "WaterPrint",
      "poster": "Poster",
      "posterGenerating": "Generating..."
    }
  },
  "errors": {
    "apiKeyRequired": "Please enter PageOps API Key",
    "urlRequired": "Please enter target URL",
    "batchUrlsRequired": "Please enter batch URLs (one per line)",
    "headersParseFailed": "Headers JSON parse failed",
    "cookiesParseFailed": "Cookies parse failed",
    "cookiesMustBeArray": "Cookies JSON must be an array",
    "downloadFailed": "Download failed"
  },
  "progress": {
    "batch": "Progress: {{current}} / {{total}}"
  },
  "confirm": {
    "clearPresets": "Are you sure you want to clear all presets?"
  }
};

// Type for translations
export type Translations = typeof defaultTranslations;

// Deep merge two objects
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// Get nested value from object by path
function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return undefined;
    }
  }
  return typeof result === 'string' ? result : undefined;
}

// Replace template variables like {{count}}
function replaceVars(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? String(vars[key]) : match;
  });
}

// Hook for using translations
export function useLocale() {
  const [translations, setTranslations] = useState<Translations>(defaultTranslations);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Try to load locale from directory
    const loadLocale = async () => {
      try {
        // Check if zh.json exists by trying to fetch it
        const response = await fetch('./locale/zh.json');
        if (response.ok) {
          const zhTranslations = await response.json();
          setTranslations(deepMerge(defaultTranslations, zhTranslations));
        }
      } catch {
        // If fetch fails (file doesn't exist), keep default English
        console.log('No locale file found, using default English');
      } finally {
        setLoaded(true);
      }
    };

    loadLocale();
  }, []);

  // Translation function
  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    const value = getNestedValue(translations, key);
    if (value === undefined) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
    return replaceVars(value, vars);
  }, [translations]);

  return { t, loaded };
}

// Standalone translate function (for non-React usage)
let cachedTranslations: Translations | null = null;

export async function initLocale(): Promise<void> {
  if (cachedTranslations) return;
  
  try {
    const response = await fetch('./locale/zh.json');
    if (response.ok) {
      const zhTranslations = await response.json();
      cachedTranslations = deepMerge(defaultTranslations, zhTranslations);
      return;
    }
  } catch {
    // Ignore error
  }
  
  cachedTranslations = defaultTranslations;
}

export function translate(key: string, vars?: Record<string, string | number>): string {
  if (!cachedTranslations) {
    // Fallback to default if not initialized
    const value = getNestedValue(defaultTranslations, key);
    if (value === undefined) return key;
    return replaceVars(value, vars);
  }
  
  const value = getNestedValue(cachedTranslations, key);
  if (value === undefined) {
    // Fallback to default
    const defaultValue = getNestedValue(defaultTranslations, key);
    if (defaultValue === undefined) return key;
    return replaceVars(defaultValue, vars);
  }
  return replaceVars(value, vars);
}
