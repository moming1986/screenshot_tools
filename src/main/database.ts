import path from 'path';
import os from 'os';
import fs from 'fs';

const dataDir = path.join(os.homedir(), '.pageops-screenshot-tool');
const settingsFile = path.join(dataDir, 'settings.json');

// Ensure directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  position: WatermarkPosition;
  fontSize: number;
  opacity: number;
  color: string;
  backgroundColor: string;
  padding: number;
}

export type PosterTemplateId = 'instagram-product' | 'instagram-story' | 'facebook-ad' | 'twitter-card' | 'trust-badge';
export type PosterBackgroundStyle = 'gradient' | 'solid' | 'dark';

export interface PosterConfig {
  templateId: PosterTemplateId;
  title?: string;
  subtitle?: string;
  price?: string;
  badge?: string;
  showUrl: boolean;
  showTimestamp: boolean;
  showDeviceInfo: boolean;
  showBrand: boolean;
  brandText: string;
  accentColor: string;
  backgroundStyle: PosterBackgroundStyle;
}

export interface AppSettings {
  apiKey: string;
  apiBaseUrl: string;
  targetUrl: string;
  mode: 'async' | 'sync';
  viewportW: string;
  viewportH: string;
  selector: string;
  headersJson: string;
  cookiesJson: string;
  watermark?: WatermarkConfig;
  posterConfig?: PosterConfig;
}

const defaultSettings: AppSettings = {
  apiKey: '',
  apiBaseUrl: 'https://api.page-ops.com/api/v1',
  targetUrl: '',
  mode: 'async',
  viewportW: '',
  viewportH: '',
  selector: '',
  headersJson: '',
  cookiesJson: ''
};

export function loadSettings(): AppSettings {
  try {
    if (!fs.existsSync(settingsFile)) {
      return { ...defaultSettings };
    }
    const content = fs.readFileSync(settingsFile, 'utf-8');
    const parsed = JSON.parse(content) as Partial<AppSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const current = loadSettings();
  const merged = { ...current, ...settings };
  fs.writeFileSync(settingsFile, JSON.stringify(merged, null, 2), 'utf-8');
}

export function clearSettings(): void {
  try {
    if (fs.existsSync(settingsFile)) {
      fs.unlinkSync(settingsFile);
    }
  } catch {
    // Ignore errors
  }
}
