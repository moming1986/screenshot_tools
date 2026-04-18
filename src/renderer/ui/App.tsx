import React, { useEffect, useMemo, useRef, useState } from 'react';
import { generatePoster, posterTemplates, PosterConfig, PosterTemplateId, PosterBackgroundStyle, defaultPosterConfig } from '../utils/posterGenerator';
import { useLocale } from '../locale';

type JobStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | string;

type HistoryItem = {
  id: string;
  createdAt: number;
  url: string;
  jobId?: string;
  status: JobStatus;
  imageUrl?: string;
  error?: string;
};

type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';

interface WatermarkConfig {
  enabled: boolean;
  text: string;
  position: WatermarkPosition;
  fontSize: number;
  opacity: number;
  color: string;
  backgroundColor: string;
  padding: number;
}

function safeJsonParse<T>(input: string): { ok: true; value: T } | { ok: false; error: string } {
  if (!input.trim()) return { ok: true, value: {} as T };
  try {
    return { ok: true, value: JSON.parse(input) as T };
  } catch (e: any) {
    return { ok: false, error: e?.message ? String(e.message) : 'Invalid JSON' };
  }
}

function parseCookieString(cookieString: string, targetUrl?: string): { ok: true; value: string } | { ok: false; error: string } {
  if (!cookieString.trim()) return { ok: true, value: '' };

  // Check if it's already JSON format
  if (cookieString.trim().startsWith('[') || cookieString.trim().startsWith('{')) {
    return { ok: false, error: 'Already in JSON format' };
  }

  // Extract domain from target URL
  let defaultDomain: string | undefined;
  let defaultPath = '/';
  if (targetUrl) {
    try {
      const url = new URL(targetUrl);
      defaultDomain = url.hostname;
      defaultPath = url.pathname || '/';
      if (!defaultPath.endsWith('/')) {
        defaultPath = defaultPath.substring(0, defaultPath.lastIndexOf('/') + 1) || '/';
      }
    } catch {
      // Invalid URL, use defaults
    }
  }

  if (!cookieString.includes('=')) {
    return { ok: false, error: 'Invalid cookie format. Expected "name=value" pairs.' };
  }

  const parts = cookieString.split(';').map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length === 0) {
    return { ok: false, error: 'Invalid cookie format' };
  }

  // Detect format: Set-Cookie has attributes like "Secure", "HttpOnly", "Path=", "Expires="
  const cookieAttributeNames = ['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly'];
  const hasAttributeName = (part: string): boolean => {
    const name = part.split('=')[0].trim().toLowerCase();
    return cookieAttributeNames.includes(name);
  };
  const isBooleanAttribute = (part: string): boolean => {
    const lower = part.toLowerCase();
    return lower === 'secure' || lower === 'httponly';
  };

  // Check if any part (except first) is a cookie attribute → Set-Cookie format (single cookie)
  const isSetCookieFormat = parts.slice(1).some(p => isBooleanAttribute(p) || hasAttributeName(p));

  if (isSetCookieFormat) {
    // Parse as Set-Cookie format (single cookie with attributes)
    const firstEq = parts[0].indexOf('=');
    if (firstEq === -1) {
      return { ok: false, error: 'Invalid cookie format' };
    }

    const name = parts[0].substring(0, firstEq).trim();
    const value = parts[0].substring(firstEq + 1).trim();
    if (!name) {
      return { ok: false, error: 'Invalid cookie format: missing name' };
    }

    const result: Record<string, any> = { name, value };

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const eqIdx = part.indexOf('=');

      if (eqIdx === -1) {
        const attr = part.toLowerCase();
        if (attr === 'secure') result.secure = true;
        if (attr === 'httponly') result.httpOnly = true;
      } else {
        const attrName = part.substring(0, eqIdx).trim().toLowerCase();
        const attrValue = part.substring(eqIdx + 1).trim();

        if (attrName === 'path') result.path = attrValue;
        else if (attrName === 'domain') result.domain = attrValue;
        else if (attrName === 'expires') {
          const date = new Date(attrValue);
          if (!isNaN(date.getTime())) {
            result.expires = Math.floor(date.getTime() / 1000);
          }
        } else if (attrName === 'max-age') {
          result.expires = Math.floor(Date.now() / 1000) + parseInt(attrValue, 10);
        } else if (attrName === 'samesite') {
          result.sameSite = attrValue.toLowerCase();
        }
      }
    }

    if (!result.domain && defaultDomain) result.domain = defaultDomain;
    if (!result.path) result.path = defaultPath;

    return { ok: true, value: JSON.stringify([result], null, 2) };
  } else {
    // Parse as Request Headers Cookie format (multiple name=value pairs)
    const cookies: Record<string, any>[] = [];

    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue; // Skip invalid parts

      const name = part.substring(0, eqIdx).trim();
      const value = part.substring(eqIdx + 1).trim();
      if (!name) continue;

      const cookie: Record<string, any> = { name, value };
      if (defaultDomain) cookie.domain = defaultDomain;
      cookie.path = defaultPath;
      cookies.push(cookie);
    }

    if (cookies.length === 0) {
      return { ok: false, error: 'Invalid cookie format: no valid name=value pairs found' };
    }

    return { ok: true, value: JSON.stringify(cookies, null, 2) };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function mapError(status?: number, message?: string) {
  if (status === 401) return `401 Unauthorized: API Key Invalid or missing\n${message ?? ''}`.trim();
  if (status === 402) return `402 Payment Required: quota limit/required subscription\n${message ?? ''}`.trim();
  if (status === 429) return `429 Too Many Requests: get rate limited, try again later\n${message ?? ''}`.trim();
  if (status) return `${status} Error\n${message ?? ''}`.trim();
  return message ?? 'Unknown error';
}

export function App() {
  const { t } = useLocale();

  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.page-ops.com/api/v1');

  const [targetUrl, setTargetUrl] = useState('');
  const [mode, setMode] = useState<'async' | 'sync'>('async');

  const [viewportW, setViewportW] = useState('');
  const [viewportH, setViewportH] = useState('');
  const [selector, setSelector] = useState('');
  const [delayMs, setDelayMs] = useState('');

  const [headersJson, setHeadersJson] = useState('');
  const [cookiesJson, setCookiesJson] = useState('');

  // Watermark config
  const [watermark, setWatermark] = useState<WatermarkConfig>({
    enabled: true,
    text: 'Screenshot by PageOps',
    position: 'bottom-right',
    fontSize: 14,
    opacity: 0.7,
    color: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 8
  });

  // Poster config
  const [posterConfig, setPosterConfig] = useState<PosterConfig>(defaultPosterConfig);
  const [showPosterPanel, setShowPosterPanel] = useState(false);
  const [generatingPoster, setGeneratingPoster] = useState<string | null>(null);

  // Batch mode
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState('');
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Presets
  interface PresetConfig {
    name: string;
    viewportW: string;
    viewportH: string;
    mode: 'async' | 'sync';
    headersJson: string;
    cookiesJson: string;
  }
  const [presets, setPresets] = useState<PresetConfig[]>([]);
  const [showPresetPanel, setShowPresetPanel] = useState(false);
  const [presetName, setPresetName] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  // Load settings on mount
  useEffect(() => {
    window.pageops.settings.load().then((res) => {
      if (res.ok) {
        const s = res.data;
        if (s.apiKey) setApiKey(s.apiKey);
        if (s.apiBaseUrl) setApiBaseUrl(s.apiBaseUrl);
        if (s.targetUrl) setTargetUrl(s.targetUrl);
        if (s.mode) setMode(s.mode);
        if (s.viewportW) setViewportW(s.viewportW);
        if (s.viewportH) setViewportH(s.viewportH);
        if (s.selector) setSelector(s.selector);
        if (s.headersJson) setHeadersJson(s.headersJson);
        if (s.cookiesJson) setCookiesJson(s.cookiesJson);
        if (s.watermark) setWatermark(s.watermark);
        if (s.posterConfig) setPosterConfig(s.posterConfig);
      }
      setSettingsLoaded(true);
    });
  }, []);

  // Auto-save settings when values change (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!settingsLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      window.pageops.settings.save({
        apiKey,
        apiBaseUrl,
        targetUrl,
        mode,
        viewportW,
        viewportH,
        selector,
        headersJson,
        cookiesJson,
        watermark,
        posterConfig
      });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [apiKey, apiBaseUrl, targetUrl, mode, viewportW, viewportH, selector, headersJson, cookiesJson, watermark, posterConfig, settingsLoaded]);

  const viewport = useMemo(() => {
    const w = viewportW.trim() ? Number(viewportW) : undefined;
    const h = viewportH.trim() ? Number(viewportH) : undefined;
    if (!w && !h) return undefined;
    return { width: w, height: h };
  }, [viewportW, viewportH]);

  async function onCapture() {
    setError(null);

    if (!apiKey.trim()) {
      setError('Please fill PageOps API Key');
      return;
    }

    // Determine URLs to capture
    let urls: string[] = [];
    if (batchMode) {
      urls = batchUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0).slice(0, 20);
      if (urls.length === 0) {
        setError('Please enter batch URL (one Url per line)');
        return;
      }
    } else {
      if (!targetUrl.trim()) {
        setError('Please enter URL');
        return;
      }
      urls = [targetUrl.trim()];
    }

    const headersParsed = safeJsonParse<Record<string, string>>(headersJson);
    if (!headersParsed.ok) {
        setError(`Headers JSON parse failed: ${headersParsed.error}`);
      return;
    }

    // Try to parse cookies
    let cookiesParsed = safeJsonParse<any>(cookiesJson);
    let finalCookiesJson = cookiesJson;

    if (!cookiesParsed.ok) {
      const targetForCookie = urls[0];
      const cookieStringParsed = parseCookieString(cookiesJson, targetForCookie);
      if (cookieStringParsed.ok) {
        finalCookiesJson = cookieStringParsed.value;
        cookiesParsed = safeJsonParse<any>(finalCookiesJson);
        setCookiesJson(finalCookiesJson);
      } else {
        setError(`Cookies [parse failed]: ${cookiesParsed.error}`);
        return;
      }
    }

    const cookiesValue = finalCookiesJson.trim() && cookiesParsed.ok ? cookiesParsed.value : undefined;
    const cookies = Array.isArray(cookiesValue) ? cookiesValue : undefined;
    if (finalCookiesJson.trim() && !cookies) {
      setError('Cookies JSON must be array, for example: [{"name":"a","value":"b","domain":"example.com"}]');
      return;
    }

    const delay = delayMs.trim() ? Number(delayMs) : undefined;

    // Create history items for all URLs
    const baseTime = Date.now();
    const items: HistoryItem[] = urls.map((url, idx) => ({
      id: `${baseTime}-${idx}`,
      createdAt: baseTime + idx,
      url,
      status: 'pending' as JobStatus
    }));

    setHistory((h: HistoryItem[]) => [...items, ...h]);
    setBusy(true);
    setBatchProgress(batchMode ? { current: 0, total: urls.length } : null);
    abortRef.current.aborted = false;

    // Process URLs sequentially
    try {
      for (let i = 0; i < items.length; i++) {
        if (abortRef.current.aborted) break;

        const item = items[i];
        setBatchProgress(batchMode ? { current: i + 1, total: urls.length } : null);

        const res = await window.pageops.createScreenshot({
          apiKey: apiKey.trim(),
          apiBaseUrl: apiBaseUrl.trim() || undefined,
          url: item.url,
          config: {
            mode,
            viewport,
            selector: selector.trim() || undefined,
            delayMs: delay
          },
          headers: Object.keys(headersParsed.value ?? {}).length ? headersParsed.value : undefined,
          cookies
        });

        if (!res.ok) {
          const msg = mapError(res.error?.status, res.error?.message);
          setHistory((h: HistoryItem[]) => h.map((x: HistoryItem) => (x.id === item.id ? { ...x, status: 'failed', error: msg } : x)));
          continue;
        }

        const jobId = res.data?.jobId ?? res.data?.jobID ?? res.data?.job_id;
        const status: JobStatus = res.data?.status ?? 'pending';
        const imageUrl = res.data?.result?.url;

        setHistory((h: HistoryItem[]) => h.map((x: HistoryItem) => (x.id === item.id ? { ...x, jobId, status, imageUrl } : x)));

        if (mode === 'sync' || !jobId) {
          continue;
        }

        // Poll for this job
        for (let pollIdx = 0; pollIdx < 30; pollIdx++) {
          if (abortRef.current.aborted) break;
          await sleep(1200);

          const poll = await window.pageops.getScreenshotStatus({
            apiKey: apiKey.trim(),
            apiBaseUrl: apiBaseUrl.trim() || undefined,
            jobId
          });

          if (!poll.ok) {
            const msg = mapError(poll.error?.status, poll.error?.message);
            setHistory((h: HistoryItem[]) => h.map((x: HistoryItem) => (x.id === item.id ? { ...x, status: 'failed', error: msg } : x)));
            break;
          }

          const st: JobStatus = poll.data?.status ?? 'processing';
          const img = poll.data?.result?.url;

          setHistory((h: HistoryItem[]) => h.map((x: HistoryItem) => (x.id === item.id ? { ...x, status: st, imageUrl: img ?? x.imageUrl } : x)));

          if (st === 'succeeded' || st === 'failed') {
            break;
          }

          if (pollIdx === 29) {
            setHistory((h: HistoryItem[]) => h.map((x: HistoryItem) => (x.id === item.id ? { ...x, status: 'failed', error: 'Polling timeout' } : x)));
          }
        }
      }
    } finally {
      setBusy(false);
      setBatchProgress(null);
    }
  }

  async function onDownload(item: HistoryItem, ext: 'png' | 'jpeg', withWatermark: boolean = false) {
    if (!item.imageUrl) return;

    if (!withWatermark || !watermark.enabled) {
      // Download original
      const safeName = `screenshot-${item.jobId ?? item.id}.${ext}`;
      const res = await window.pageops.downloadImage({ url: item.imageUrl, suggestedName: safeName });
      if (!res.ok && !res.canceled) {
        setError(res.error?.message ?? 'Download failed');
      }
      return;
    }

    // Download with watermark (using Canvas)
    try {
      const canvas = await addWatermarkToImage(item.imageUrl, watermark);
      const blob = await canvasToBlob(canvas, ext);
      const dataUrl = await blobToDataUrl(blob);
      const safeName = `screenshot-${item.jobId ?? item.id}-watermarked.${ext}`;

      // Use IPC to download data URL
      const link = document.createElement('a');
      link.download = safeName;
      link.href = dataUrl;
      link.click();
    } catch (e: any) {
      setError(`Failed to add watermark: ${e.message}`);
    }
  }

  function canvasToBlob(canvas: HTMLCanvasElement, ext: 'png' | 'jpeg'): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, `image/${ext}`, 0.95);
    });
  }

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function addWatermarkToImage(imageUrl: string, config: WatermarkConfig): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Calculate text dimensions
        ctx.font = `${config.fontSize}px Arial, sans-serif`;
        const textMetrics = ctx.measureText(config.text);
        const textWidth = textMetrics.width;
        const textHeight = config.fontSize;

        // Calculate position
        const padding = config.padding;
        let x: number, y: number;
        const boxWidth = textWidth + padding * 2;
        const boxHeight = textHeight + padding * 2;

        switch (config.position) {
          case 'top-left':
            x = padding;
            y = padding + textHeight;
            break;
          case 'top-right':
            x = canvas.width - textWidth - padding;
            y = padding + textHeight;
            break;
          case 'bottom-left':
            x = padding;
            y = canvas.height - padding;
            break;
          case 'center':
            x = (canvas.width - textWidth) / 2;
            y = (canvas.height + textHeight) / 2;
            break;
          case 'bottom-right':
          default:
            x = canvas.width - textWidth - padding;
            y = canvas.height - padding;
        }

        // Draw background
        const bgX = x - padding;
        const bgY = y - textHeight - padding / 2;
        ctx.fillStyle = config.backgroundColor;
        ctx.fillRect(bgX, bgY, boxWidth, boxHeight);

        // Draw text
        ctx.fillStyle = config.color;
        ctx.font = `${config.fontSize}px Arial, sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(config.text, x, y);

        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }

  async function onGeneratePoster(item: HistoryItem) {
    if (!item.imageUrl || generatingPoster) return;

    setGeneratingPoster(item.id);
    setError(null);

    try {
      const blob = await generatePoster(
        item.imageUrl,
        posterConfig,
        {
          url: item.url,
          viewport: { width: parseInt(viewportW) || undefined, height: parseInt(viewportH) || undefined },
          timestamp: item.createdAt
        }
      );

      // Download the poster
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `poster-${item.jobId ?? item.id}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(`Failed to generate poster: ${e.message}`);
    } finally {
      setGeneratingPoster(null);
    }
  }

  return (
    <div className="container">
      <div className="panel">
        <div className="h1">{t('app.inputPanel')}</div>

        <div className="field">
          <div className="label">{t('fields.apiKey')}</div>
          <input className="input" value={apiKey} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)} placeholder="Bearer API Key" />
        </div>

        <div className="field">
          <div className="label">{t('fields.apiBaseUrl')}</div>
          <input className="input" value={apiBaseUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiBaseUrl(e.target.value)} />
        </div>

        <div className="field">
          <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{batchMode ? t('fields.batchMode') : t('fields.targetUrl')}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 'normal', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={batchMode}
                onChange={(e) => setBatchMode(e.target.checked)}
              />
              {t('fields.batchMode')}
            </label>
          </div>
          {batchMode ? (
            <textarea
              className="textarea"
              value={batchUrls}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBatchUrls(e.target.value)}
              placeholder={t('fields.batchUrlsPlaceholder')}
              rows={6}
            />
          ) : (
            <input className="input" value={targetUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetUrl(e.target.value)} placeholder="https://example.com" />
          )}
          {batchMode && batchProgress && (
            <div className="kv" style={{ marginTop: 8 }}>
              {t('progress.batch', { current: batchProgress.current, total: batchProgress.total })}
            </div>
          )}
        </div>

        <div className="field">
          <div className="label">{t('fields.mode')}</div>
          <select className="select" value={mode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMode(e.target.value as any)}>
            <option value="async">{t('fields.modeAsync')}</option>
            <option value="sync">{t('fields.modeSync')}</option>
          </select>
        </div>

        <div className="h1">{t('config.screenshotConfig')}</div>
        <div className="row">
          <div className="field">
            <div className="label">{t('fields.viewportWidth')}</div>
            <input className="input" value={viewportW} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setViewportW(e.target.value)} placeholder="1280" />
          </div>
          <div className="field">
            <div className="label">{t('fields.viewportHeight')}</div>
            <input className="input" value={viewportH} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setViewportH(e.target.value)} placeholder="720" />
          </div>
        </div>

        <div className="field">
          <div className="label">{t('fields.selector')}</div>
          <input className="input" value={selector} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelector(e.target.value)} placeholder="#main" />
        </div>

        <div className="field">
          <div className="label">{t('fields.delay')}</div>
          <input className="input" value={delayMs} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDelayMs(e.target.value)} placeholder="500" />
        </div>

        <div className="h1">{t('config.cookieTokenInput')}</div>

        <div className="field">
          <div className="label">{t('fields.headers')}</div>
          <textarea className="textarea" value={headersJson} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHeadersJson(e.target.value)} placeholder='{"Authorization":"Bearer xxx"}' />
        </div>

        <div className="field">
          <div className="label">{t('fields.cookies')}</div>
          <textarea className="textarea" value={cookiesJson} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCookiesJson(e.target.value)} placeholder='[{"name":"sid","value":"...","domain":"example.com","path":"/"}]' />
        </div>

        <div className="h1">{t('config.presets')}</div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showPresetPanel}
              onChange={(e) => setShowPresetPanel(e.target.checked)}
            />
            <span>{t('config.showPresetPanel')}</span>
          </label>
        </div>

        {showPresetPanel && (
          <>
            {presets.length > 0 && (
              <div className="field">
                <div className="label">{t('config.loadPreset')}</div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {presets.map((preset, idx) => (
                    <button
                      key={idx}
                      className="button"
                      onClick={() => {
                        setViewportW(preset.viewportW);
                        setViewportH(preset.viewportH);
                        setMode(preset.mode);
                        setHeadersJson(preset.headersJson);
                        setCookiesJson(preset.cookiesJson);
                      }}
                      style={{ fontSize: 12, padding: '6px 12px' }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="field">
              <div className="label">{t('config.savePreset')}</div>
              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder={t('config.presetNamePlaceholder')}
                  style={{ flex: 1 }}
                />
                <button
                  className="button"
                  onClick={() => {
                    if (!presetName.trim()) return;
                    const newPreset: PresetConfig = {
                      name: presetName.trim(),
                      viewportW,
                      viewportH,
                      mode,
                      headersJson,
                      cookiesJson
                    };
                    setPresets([...presets, newPreset]);
                    setPresetName('');
                  }}
                  disabled={!presetName.trim()}
                >
                  {t('config.save')}
                </button>
              </div>
            </div>

            {presets.length > 0 && (
              <div className="field">
                <button
                  className="button"
                  onClick={() => {
                    if (confirm(t('confirm.clearPresets'))) {
                      setPresets([]);
                    }
                  }}
                  style={{ background: '#666', fontSize: 12 }}
                >
                  {t('config.clearAllPresets')}
                </button>
              </div>
            )}
          </>
        )}

        <div className="h1">{t('config.watermark')}</div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={watermark.enabled}
              onChange={(e) => setWatermark({ ...watermark, enabled: e.target.checked })}
            />
            <span>{t('config.enableWatermark')}</span>
          </label>
        </div>

        {watermark.enabled && (
          <>
            <div className="field">
              <div className="label">{t('config.watermarkText')}</div>
              <input
                className="input"
                value={watermark.text}
                onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
                placeholder="Screenshot by PageOps"
              />
            </div>

            <div className="row">
              <div className="field">
                <div className="label">{t('config.watermarkPosition')}</div>
                <select
                  className="select"
                  value={watermark.position}
                  onChange={(e) => setWatermark({ ...watermark, position: e.target.value as WatermarkPosition })}
                >
                  <option value="bottom-right">{t('config.watermarkPosition')}: BR</option>
                  <option value="bottom-left">{t('config.watermarkPosition')}: BL</option>
                  <option value="top-right">{t('config.watermarkPosition')}: TR</option>
                  <option value="top-left">{t('config.watermarkPosition')}: TL</option>
                  <option value="center">{t('config.watermarkPosition')}: Center</option>
                </select>
              </div>
              <div className="field">
                <div className="label">{t('config.watermarkFontSize')} (px)</div>
                <input
                  className="input"
                  type="number"
                  min={8}
                  max={48}
                  value={watermark.fontSize}
                  onChange={(e) => setWatermark({ ...watermark, fontSize: parseInt(e.target.value) || 14 })}
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <div className="label">{t('config.watermarkOpacity')} (0-1)</div>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={watermark.opacity}
                  onChange={(e) => setWatermark({ ...watermark, opacity: parseFloat(e.target.value) || 0.7 })}
                />
              </div>
              <div className="field">
                <div className="label">{t('config.watermarkPadding')} (px)</div>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={50}
                  value={watermark.padding}
                  onChange={(e) => setWatermark({ ...watermark, padding: parseInt(e.target.value) || 8 })}
                />
              </div>
            </div>
          </>
        )}

        <div className="h1">{t('config.poster')}</div>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showPosterPanel}
              onChange={(e) => setShowPosterPanel(e.target.checked)}
            />
            <span>{t('config.showPosterPanel')}</span>
          </label>
        </div>

        {showPosterPanel && (
          <>
            <div className="field">
              <div className="label">{t('config.posterTemplate')}</div>
              <select
                className="select"
                value={posterConfig.templateId}
                onChange={(e) => setPosterConfig({ ...posterConfig, templateId: e.target.value as PosterTemplateId })}
              >
                {posterTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.width}×{t.height})</option>
                ))}
              </select>
            </div>

            <div className="field">
              <div className="label">{t('config.posterTitle')}</div>
              <input
                className="input"
                value={posterConfig.title}
                onChange={(e) => setPosterConfig({ ...posterConfig, title: e.target.value })}
                placeholder="Limited Time Offer"
              />
            </div>

            <div className="field">
              <div className="label">{t('config.posterSubtitle')}</div>
              <input
                className="input"
                value={posterConfig.subtitle}
                onChange={(e) => setPosterConfig({ ...posterConfig, subtitle: e.target.value })}
                placeholder="Shop Now - Free Shipping"
              />
            </div>

            <div className="field">
              <div className="label">{t('config.posterPrice')}</div>
              <input
                className="input"
                value={posterConfig.price}
                onChange={(e) => setPosterConfig({ ...posterConfig, price: e.target.value })}
                placeholder="$29.99"
              />
            </div>

            <div className="row">
              <div className="field">
                <div className="label">{t('config.posterAccentColor')}</div>
                <input
                  className="input"
                  type="color"
                  value={posterConfig.accentColor}
                  onChange={(e) => setPosterConfig({ ...posterConfig, accentColor: e.target.value })}
                  style={{ height: 40, padding: 2 }}
                />
              </div>
              <div className="field">
                <div className="label">{t('config.posterBgStyle')}</div>
                <select
                  className="select"
                  value={posterConfig.backgroundStyle}
                  onChange={(e) => setPosterConfig({ ...posterConfig, backgroundStyle: e.target.value as any })}
                >
                  <option value="gradient">Gradient</option>
                  <option value="dark">Dark</option>
                  <option value="solid">Solid</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={posterConfig.showUrl}
                  onChange={(e) => setPosterConfig({ ...posterConfig, showUrl: e.target.checked })}
                />
                <span>{t('config.posterShowUrl')}</span>
              </label>
            </div>

            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={posterConfig.showBrand}
                  onChange={(e) => setPosterConfig({ ...posterConfig, showBrand: e.target.checked })}
                />
                <span>{t('config.posterShowBrand')}</span>
              </label>
            </div>
          </>
        )}

        <div className="actions">
          <button className="button" onClick={onCapture} disabled={busy}>{t('app.capture')}</button>
          <button className="button" onClick={() => { abortRef.current.aborted = true; }} disabled={!busy}>{t('app.cancel')}</button>
          <button
            className="button"
            onClick={() => window.pageops.console.openWindow()}
            style={{ background: '#0e639c' }}
          >
            Console (F12)
          </button>
          <button
            className="button"
            onClick={() => {
              if (confirm('Clear all saved settings?')) {
                window.pageops.settings.clear().then(() => {
                  setApiKey('');
                  setApiBaseUrl('https://api.page-ops.com/api/v1');
                  setTargetUrl('');
                  setMode('async');
                  setViewportW('');
                  setViewportH('');
                  setSelector('');
                  setHeadersJson('');
                  setCookiesJson('');
                });
              }
            }}
            style={{ background: '#666' }}
          >
            {t('app.clearSettings')}
          </button>
          <div className="kv">{t('app.historyCount', { count: history.length })}</div>
        </div>

        {error && (
          <div style={{ marginTop: 12 }} className="error">{error}</div>
        )}
      </div>

      <div className="panel">
        <div className="h1">{t('app.displayPanel')}</div>
        <div className="grid">
          {history.map((h: HistoryItem) => (
            <div className="card" key={h.id}>
              <div className="thumb">
                {h.imageUrl ? <img src={h.imageUrl} /> : <div className="kv">{t('history.noImage')}</div>}
              </div>
              <div className="cardBody">
                <div className="cardTitle">{h.url}</div>
                <div className="cardMeta">{t('history.jobId')}: {h.jobId ?? '-'} | {t('history.status')}: {h.status}</div>
                {h.error && <div className="error">{h.error}</div>}
                <div className="actions" style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button className="button" onClick={() => onDownload(h, 'png', false)} disabled={!h.imageUrl}>PNG</button>
                  <button className="button" onClick={() => onDownload(h, 'jpeg', false)} disabled={!h.imageUrl}>JPEG</button>
                  {watermark.enabled && (
                    <>
                      <button
                        className="button"
                        onClick={() => onDownload(h, 'png', true)}
                        disabled={!h.imageUrl}
                        style={{ background: '#0e639c', fontSize: 12 }}
                        title="Watermarked"
                      >
                        WaterPrint<sup style={{ fontSize: 10 }}>PNG</sup>
                      </button>
                      <button
                        className="button"
                        onClick={() => onDownload(h, 'jpeg', true)}
                        disabled={!h.imageUrl}
                        style={{ background: '#0e639c', fontSize: 12 }}
                        title="Watermarked"
                      >
                        WaterPrint<sup style={{ fontSize: 10 }}>JPEG</sup>
                      </button>
                    </>
                  )}
                  {showPosterPanel && (
                    <button
                      className="button"
                      onClick={() => onGeneratePoster(h)}
                      disabled={!h.imageUrl || generatingPoster === h.id}
                      style={{ background: '#8b5cf6' }}
                      title={t('history.download.poster')}
                    >
                      {generatingPoster === h.id ? t('history.download.posterGenerating') : t('history.download.poster')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
