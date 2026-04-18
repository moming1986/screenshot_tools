export type PosterTemplateId = 'instagram-product' | 'instagram-story' | 'facebook-ad' | 'twitter-card' | 'trust-badge';

export type PosterTemplate = {
  id: PosterTemplateId;
  name: string;
  width: number;
  height: number;
  category: 'social' | 'showcase' | 'comparison';
};

export const posterTemplates: PosterTemplate[] = [
    { id: 'instagram-product', name: 'Instagram Product Showcase', width: 1080, height: 1350, category: 'social' },
    { id: 'instagram-story', name: 'Instagram/TikTok Story', width: 1080, height: 1920, category: 'social' },
    { id: 'facebook-ad', name: 'Facebook Ad', width: 1200, height: 628, category: 'social' },
    { id: 'twitter-card', name: 'Twitter/X Card', width: 1200, height: 675, category: 'social' },
    { id: 'trust-badge', name: 'Trust Badge', width: 800, height: 800, category: 'showcase' },
];

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

export const defaultPosterConfig: PosterConfig = {
  templateId: 'instagram-product',
  title: '',
  subtitle: '',
  price: '',
  badge: '',
  showUrl: true,
  showTimestamp: true,
  showDeviceInfo: true,
  showBrand: true,
  brandText: 'Captured by PageOps',
  accentColor: '#6366f1',
  backgroundStyle: 'gradient',
};

interface ScreenshotMetadata {
  url: string;
  viewport?: { width?: number; height?: number };
  timestamp: number;
}

export async function generatePoster(
  imageUrl: string,
  config: PosterConfig,
  metadata: ScreenshotMetadata
): Promise<Blob> {
  const template = posterTemplates.find(t => t.id === config.templateId);
  if (!template) throw new Error('Template not found');

  const canvas = document.createElement('canvas');
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext('2d')!;

  // Draw background
  drawBackground(ctx, template, config);

  // Draw screenshot with frame
  await drawScreenshot(ctx, imageUrl, template, config);

  // Draw info overlay
  drawInfoOverlay(ctx, template, config, metadata);

  // Draw brand
  if (config.showBrand) {
    drawBrand(ctx, template, config);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create poster blob'));
    }, 'image/png', 0.95);
  });
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  template: PosterTemplate,
  config: PosterConfig
): void {
  const { width, height } = template;

  switch (config.backgroundStyle) {
    case 'gradient':
      // Warm gradient for e-commerce
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#fef3c7'); // amber-100
      gradient.addColorStop(0.5, '#fde68a'); // amber-200
      gradient.addColorStop(1, '#fcd34d'); // amber-300
      ctx.fillStyle = gradient;
      break;
    case 'dark':
      const darkGradient = ctx.createLinearGradient(0, 0, width, height);
      darkGradient.addColorStop(0, '#1e293b');
      darkGradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = darkGradient;
      break;
    case 'solid':
    default:
      ctx.fillStyle = '#ffffff';
  }

  ctx.fillRect(0, 0, width, height);

  // Add subtle pattern
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = config.accentColor;
  for (let x = 0; x < width; x += 40) {
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

async function drawScreenshot(
  ctx: CanvasRenderingContext2D,
  imageUrl: string,
  template: PosterTemplate,
  config: PosterConfig
): Promise<void> {
  const { width, height } = template;

  // Load image
  const img = await loadImage(imageUrl);

  // Calculate frame dimensions based on template
  let frameWidth: number;
  let frameHeight: number;
  let frameX: number;
  let frameY: number;

  if (template.id === 'instagram-story') {
    // Vertical layout: screenshot in middle
    frameWidth = width * 0.85;
    frameHeight = frameWidth * (img.height / img.width);
    frameX = (width - frameWidth) / 2;
    frameY = height * 0.15;
  } else if (template.id === 'instagram-product') {
    // 4:5 layout: larger screenshot
    frameWidth = width * 0.88;
    frameHeight = Math.min(frameWidth * (img.height / img.width), height * 0.6);
    frameX = (width - frameWidth) / 2;
    frameY = height * 0.12;
  } else {
    // Horizontal templates
    frameHeight = height * 0.6;
    frameWidth = frameHeight * (img.width / img.height);
    if (frameWidth > width * 0.8) {
      frameWidth = width * 0.8;
      frameHeight = frameWidth * (img.height / img.width);
    }
    frameX = (width - frameWidth) / 2;
    frameY = height * 0.1;
  }

  // Draw phone/device frame
  const cornerRadius = 20;
  const padding = 8;

  // Phone frame shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 15;

  // Phone frame
  ctx.beginPath();
  roundRect(ctx, frameX - padding, frameY - padding, frameWidth + padding * 2, frameHeight + padding * 2, cornerRadius + 4);
  ctx.fillStyle = '#1f2937';
  ctx.fill();
  ctx.restore();

  // Screen area
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, frameX, frameY, frameWidth, frameHeight, cornerRadius);
  ctx.clip();

  // Draw screenshot
  ctx.drawImage(img, frameX, frameY, frameWidth, frameHeight);
  ctx.restore();

  // Notch for phone (optional)
  if (template.id.includes('instagram') || template.id.includes('story')) {
    const notchWidth = 80;
    const notchHeight = 25;
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    roundRect(ctx, frameX + (frameWidth - notchWidth) / 2, frameY - padding, notchWidth, notchHeight, 12);
    ctx.fill();
  }
}

function drawInfoOverlay(
  ctx: CanvasRenderingContext2D,
  template: PosterTemplate,
  config: PosterConfig,
  metadata: ScreenshotMetadata
): void {
  const { width, height } = template;
  ctx.save();

  // Determine text area based on template
  let textY = height * 0.78;
  if (template.id === 'instagram-story') {
    textY = height * 0.75;
  } else if (template.id === 'twitter-card' || template.id === 'facebook-ad') {
    textY = height * 0.82;
  }

  // Title
  if (config.title) {
    ctx.font = `bold ${template.id.includes('story') ? 56 : 42}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = config.backgroundStyle === 'dark' ? '#ffffff' : '#1f2937';
    ctx.textAlign = 'center';
    ctx.fillText(config.title, width / 2, textY);
    textY += template.id.includes('story') ? 70 : 55;
  }

  // Subtitle
  if (config.subtitle) {
    ctx.font = `${template.id.includes('story') ? 32 : 24}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = config.backgroundStyle === 'dark' ? '#9ca3af' : '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText(config.subtitle, width / 2, textY);
    textY += template.id.includes('story') ? 50 : 40;
  }

  // Price with badge
  if (config.price) {
    const badgeWidth = ctx.measureText(config.price).width + 60;
    const badgeHeight = template.id.includes('story') ? 70 : 56;
    const badgeX = (width - badgeWidth) / 2;
    const badgeY = textY;

    // Badge background
    ctx.fillStyle = config.accentColor;
    roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
    ctx.fill();

    // Price text
    ctx.font = `bold ${template.id.includes('story') ? 40 : 32}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.price, width / 2, badgeY + badgeHeight / 2);

    textY += badgeHeight + 30;
  }

  // URL and metadata
  if (config.showUrl || config.showDeviceInfo || config.showTimestamp) {
    textY += 20;
    ctx.font = `${template.id.includes('story') ? 22 : 18}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = config.backgroundStyle === 'dark' ? '#9ca3af' : '#9ca3af';
    ctx.textAlign = 'center';

    const parts: string[] = [];
    if (config.showUrl) {
      try {
        const url = new URL(metadata.url);
        parts.push(url.hostname);
      } catch {
        parts.push(metadata.url.substring(0, 30));
      }
    }
    if (config.showDeviceInfo && metadata.viewport) {
      parts.push(`${metadata.viewport.width || '?'}×${metadata.viewport.height || '?'}`);
    }
    if (config.showTimestamp) {
      parts.push(new Date(metadata.timestamp).toLocaleDateString());
    }

    if (parts.length > 0) {
      ctx.fillText(parts.join(' · '), width / 2, textY);
    }
  }

  ctx.restore();
}

function drawBrand(
  ctx: CanvasRenderingContext2D,
  template: PosterTemplate,
  config: PosterConfig
): void {
  const { width, height } = template;
  const padding = template.id.includes('story') ? 50 : 40;

  ctx.save();
  ctx.font = `${template.id.includes('story') ? 24 : 20}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.fillStyle = config.backgroundStyle === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(config.brandText, width - padding, height - padding);
  ctx.restore();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
