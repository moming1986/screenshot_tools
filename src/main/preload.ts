// @ts-ignore
import { contextBridge, ipcRenderer } from 'electron';

export type ScreenshotConfig = {
  viewport?: { width?: number; height?: number };
  selector?: string;
  delayMs?: number;
  mode?: 'sync' | 'async';
};

export type ScreenshotInputs = {
  apiKey: string;
  apiBaseUrl?: string;
  url: string;
  config?: ScreenshotConfig;
  headers?: Record<string, string>;
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
};

export type IpcOk<T> = { ok: true; data: T };
export type IpcErr = { ok: false; error?: { message: string; status?: number; body?: any }; canceled?: boolean };

export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';

export type WatermarkConfig = {
  enabled: boolean;
  text: string;
  position: WatermarkPosition;
  fontSize: number;
  opacity: number;
  color: string;
  backgroundColor: string;
  padding: number;
};

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

export type AppSettings = {
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
};

const api = {
  createScreenshot: (inputs: ScreenshotInputs) => ipcRenderer.invoke('pageops:createScreenshot', inputs) as Promise<IpcOk<any> | IpcErr>,
  getScreenshotStatus: (args: { apiKey: string; apiBaseUrl?: string; jobId: string }) =>
    ipcRenderer.invoke('pageops:getScreenshotStatus', args) as Promise<IpcOk<any> | IpcErr>,
  downloadImage: (args: { url: string; suggestedName: string }) =>
    ipcRenderer.invoke('pageops:downloadImage', args) as Promise<{ ok: true; filePath: string } | IpcErr>,
  console: {
    openWindow: () => ipcRenderer.invoke('console:openWindow') as Promise<IpcOk<null> | IpcErr>,
    getLogs: () => ipcRenderer.invoke('console:getLogs') as Promise<IpcOk<any[]> | IpcErr>,
    clearLogs: () => ipcRenderer.invoke('console:clearLogs') as Promise<IpcOk<null> | IpcErr>,
    exportLogs: () => ipcRenderer.invoke('console:exportLogs') as Promise<{ ok: true; filePath: string } | IpcErr>
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load') as Promise<IpcOk<AppSettings> | IpcErr>,
    save: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:save', settings) as Promise<IpcOk<null> | IpcErr>,
    clear: () => ipcRenderer.invoke('settings:clear') as Promise<IpcOk<null> | IpcErr>
  }
};

contextBridge.exposeInMainWorld('pageops', api);

export type PageOpsBridge = typeof api;
