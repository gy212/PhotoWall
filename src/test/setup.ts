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
global.__TAURI_INTERNALS__ = {
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
