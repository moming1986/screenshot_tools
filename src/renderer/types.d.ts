import type { PageOpsBridge } from '../main/preload';

declare global {
  interface Window {
    pageops: PageOpsBridge;
  }
}

export {};
