// @ts-ignore
import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { loadSettings, saveSettings, clearSettings, AppSettings } from './database';

const NODE_SDK_PATH = path.resolve('../../node-sdk/index.js');

// Network request/response logging for Console
type NetworkLogEntry = {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: any;
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: string;
  duration?: number;
};

const networkLogs: NetworkLogEntry[] = [];
const MAX_LOGS = 100;

function addNetworkLog(log: Omit<NetworkLogEntry, 'id' | 'timestamp'>) {
  const entry: NetworkLogEntry = {
    ...log,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now()
  };
  networkLogs.unshift(entry);
  if (networkLogs.length > MAX_LOGS) {
    networkLogs.pop();
  }
  return entry.id;
}

function updateNetworkLog(id: string, updates: Partial<NetworkLogEntry>) {
  const log = networkLogs.find(l => l.id === id);
  if (log) {
    Object.assign(log, updates);
  }
}

type ScreenshotConfig = {
  viewport?: { width?: number; height?: number };
  selector?: string;
  delayMs?: number;
  mode?: 'sync' | 'async';
};

type ScreenshotInputs = {
  apiKey: string;
  apiBaseUrl?: string;
  url: string;
  config?: ScreenshotConfig;
  headers?: Record<string, string>;
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  
  // Create custom menu
  createMenu();
  
  // Open Console window on startup for debugging
  // createConsoleWindow();
}

let consoleWindow: BrowserWindow | null = null;

function createConsoleWindow() {
  if (consoleWindow) {
    consoleWindow.focus();
    return;
  }

  consoleWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Network Console',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  consoleWindow.loadFile(path.join(__dirname, 'console.html'));

  consoleWindow.on('closed', () => {
    consoleWindow = null;
  });
}

function createMenu() {
  // @ts-ignore
  const template: any[] = [
    {
      label: 'PageOps Screenshot Tool',
      submenu: [
        {
          label: 'Console',
          accelerator: 'F12',
          click: () => {
            createConsoleWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'How to Use',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'How to Use - PageOps Screenshot Tool',
              message: 'How to Copy Cookies from Browser',
              detail: `Chrome/Edge:
Method 1 - Console (Recommended):
1. Press F12 > Console tab
2. Paste: document.cookie.split(';').map(c=>c.trim()).join('\\n')
3. Copy the output (name=value format)

Method 2 - Network:
1. Press F12 > Network tab
2. Refresh page or make request
3. Click any request > Headers > Cookie
4. Copy the Cookie header value

Firefox:
Method 1 - Console (Recommended):
1. Press F12 > Console tab
2. Paste: document.cookie.split(';').map(c=>c.trim()).join('\\n')
3. Copy the output (name=value format)

Method 2 - Storage:
1. Press F12 > Storage tab > Cookies
2. Right-click each cookie > Copy
3. Manually combine as name=value pairs

Paste in the tool:
- Headers format: {"Cookie": "name1=value1; name2=value2"}
- Cookies JSON format: [{"name":"session","value":"abc123"}]

Tips:
- Console method is fastest for all cookies
- Network method gives you the exact Cookie header format
- For Authorization, copy from Network > Headers > Authorization`,
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About',
              message: 'PageOps Screenshot Tool',
              detail: 'Version 0.1.0\n\nA desktop tool for capturing web screenshots using PageOps SDK.\n\nBuilt with Electron + React + TypeScript.',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Inline PageOps SDK implementation to avoid module resolution issues
// @ts-ignore
const axios = require('axios');

const PageOpsClient: any = class {
  apiKey: string;
  apiBaseUrl: string;
  client: any;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.apiBaseUrl = 'https://api.page-ops.com/api/v1';
    this.client = axios.create({
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config: any) => {
        const logId = addNetworkLog({
          method: config.method?.toUpperCase() || 'GET',
          url: config.url,
          requestHeaders: { ...config.headers },
          requestBody: config.data
        });
        // Attach logId to config for response interceptor
        config._logId = logId;
        config._startTime = Date.now();
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response: any) => {
        const logId = response.config._logId;
        const duration = Date.now() - (response.config._startTime || 0);
        if (logId) {
          updateNetworkLog(logId, {
            statusCode: response.status,
            responseHeaders: response.headers ? { ...response.headers } : {},
            responseBody: response.data,
            duration
          });
        }
        return response;
      },
      (error: any) => {
        const logId = error.config?._logId;
        const duration = Date.now() - (error.config?._startTime || 0);
        if (logId) {
          updateNetworkLog(logId, {
            statusCode: error.response?.status,
            responseHeaders: error.response?.headers ? { ...error.response.headers } : {},
            responseBody: error.response?.data,
            error: error.message,
            duration
          });
        }
        return Promise.reject(error);
      }
    );
  }

  async createScreenshot(request: any) {
    const url = `${this.apiBaseUrl}/screenshots`;
    const response = await this.client.post(url, request);
    return response.data;
  }

  async getScreenshotStatus(jobId: string) {
    const url = `${this.apiBaseUrl}/screenshots/${jobId}`;
    const response = await this.client.get(url);
    return response.data;
  }
};

const ScreenshotRequest: any = class {
  url: string;
  mode: string;
  timeoutMs?: number;
  fullPage: boolean;
  viewport?: any;
  format?: string;
  quality?: number;
  waitUntil?: string;
  delayMs?: number;
  selector?: string;
  headers?: any;
  cookies?: any;
  javascript?: string;
  css?: string;
  device?: string;
  strictDevice?: boolean;
  colorScheme?: string;
  proxy?: any;
  trace?: boolean;
  har?: boolean;
  returnDom?: boolean;
  returnNetwork?: boolean;
  priority?: string;

  constructor(url: string, options: any = {}) {
    this.url = url;
    this.mode = options.mode || 'async';
    this.timeoutMs = options.timeoutMs;
    this.fullPage = options.fullPage || false;
    this.viewport = options.viewport;
    this.format = options.format;
    this.quality = options.quality;
    this.waitUntil = options.waitUntil;
    this.delayMs = options.delayMs;
    this.selector = options.selector;
    this.headers = options.headers;
    this.cookies = options.cookies;
    this.javascript = options.javascript;
    this.css = options.css;
    this.device = options.device;
    this.strictDevice = options.strictDevice;
    this.colorScheme = options.colorScheme;
    this.proxy = options.proxy;
    this.trace = options.trace;
    this.har = options.har;
    this.returnDom = options.returnDom;
    this.returnNetwork = options.returnNetwork;
    this.priority = options.priority;
  }
};

async function createScreenshot(inputs: ScreenshotInputs) {

  const client = new PageOpsClient(inputs.apiKey);
  if (inputs.apiBaseUrl) {
    client.apiBaseUrl = inputs.apiBaseUrl.replace(/\/+$/, '');
  }

  const requestPayload: any = {
    ...(inputs.config ?? {}),
    headers: inputs.headers,
    cookies: inputs.cookies
  };

  const request = new ScreenshotRequest(inputs.url, requestPayload);
  return client.createScreenshot(request);
}

async function getScreenshotStatus(apiKey: string, apiBaseUrl: string | undefined, jobId: string) {
  // @ts-ignore
  const axios = require('axios');

  const client = new PageOpsClient(apiKey);
  if (apiBaseUrl) {
    client.apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
  }
  return client.getScreenshotStatus(jobId);
}

async function downloadImageToFile(url: string, targetPath: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(targetPath, buf);
}

app.whenReady().then(() => {
  createWindow();

  // @ts-ignore
  ipcMain.handle('pageops:createScreenshot', async (_evt: any, inputs: ScreenshotInputs) => {
    try {
      return { ok: true, data: await createScreenshot(inputs) };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      const status = e?.response?.status;
      const body = e?.response?.data;
      return { ok: false, error: { message, status, body } };
    }
  });

  // @ts-ignore
  ipcMain.handle(
    'pageops:getScreenshotStatus',
    async (_evt: any, args: { apiKey: string; apiBaseUrl?: string; jobId: string }) => {
      try {
        return { ok: true, data: await getScreenshotStatus(args.apiKey, args.apiBaseUrl, args.jobId) };
      } catch (e: any) {
        const message = typeof e?.message === 'string' ? e.message : String(e);
        const status = e?.response?.status;
        const body = e?.response?.data;
        return { ok: false, error: { message, status, body } };
      }
    }
  );

  // @ts-ignore
  ipcMain.handle('pageops:downloadImage', async (_evt: any, args: { url: string; suggestedName: string }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: args.suggestedName,
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
      ]
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    try {
      await downloadImageToFile(args.url, filePath);
      return { ok: true, filePath };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      return { ok: false, error: { message } };
    }
  });

  // Console IPC handlers
  // @ts-ignore
  ipcMain.handle('console:openWindow', () => {
    createConsoleWindow();
    return { ok: true };
  });

  // @ts-ignore
  ipcMain.handle('console:getLogs', () => {
    return { ok: true, data: networkLogs };
  });

  // @ts-ignore
  ipcMain.handle('console:clearLogs', () => {
    networkLogs.length = 0;
    return { ok: true };
  });

  // @ts-ignore
  ipcMain.handle('console:exportLogs', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `pageops-logs-${Date.now()}.json`,
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ]
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    try {
      const content = JSON.stringify(networkLogs, null, 2);
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return { ok: true, filePath };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      return { ok: false, error: { message } };
    }
  });

  // Settings IPC handlers
  // @ts-ignore
  ipcMain.handle('settings:load', () => {
    try {
      const settings = loadSettings();
      return { ok: true, data: settings };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      return { ok: false, error: { message } };
    }
  });

  // @ts-ignore
  ipcMain.handle('settings:save', (_, settings: Partial<AppSettings>) => {
    try {
      saveSettings(settings);
      return { ok: true };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      return { ok: false, error: { message } };
    }
  });

  // @ts-ignore
  ipcMain.handle('settings:clear', () => {
    try {
      clearSettings();
      return { ok: true };
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : String(e);
      return { ok: false, error: { message } };
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
