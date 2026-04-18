const axios = require('axios');

class PageOpsClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.apiBaseUrl = 'https://api.page-ops.com/api/v1';
    this.client = axios.create({
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async createScreenshot(request) {
    const url = `${this.apiBaseUrl}/screenshots`;
    const response = await this.client.post(url, request);
    return response.data;
  }

  async getScreenshotStatus(jobId) {
    const url = `${this.apiBaseUrl}/screenshots/${jobId}`;
    const response = await this.client.get(url);
    return response.data;
  }
}

class ScreenshotRequest {
  constructor(url, options = {}) {
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
}

class PageOpsException extends Error {
  constructor(message) {
    super(message);
    this.name = 'PageOpsException';
  }
}

module.exports = {
  PageOpsClient,
  ScreenshotRequest,
  PageOpsException
};
