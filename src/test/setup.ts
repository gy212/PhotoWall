import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var __TAURI_INTERNALS__: {
    convertFileSrc: (path: string) => string;
  };
}

// 每个测试后清理
afterEach(() => {
  cleanup();
});

// Mock Tauri API
globalThis.__TAURI_INTERNALS__ = {
  convertFileSrc: (path: string) => `asset://${path}`,
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// Mock ResizeObserver (jsdom doesn't provide it by default)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = MockResizeObserver;
