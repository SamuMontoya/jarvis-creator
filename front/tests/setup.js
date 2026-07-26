import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

global.fetch = vi.fn();

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Downloads use a real anchor so appendChild/removeChild work; only the
// navigation side effect needs stubbing.
HTMLAnchorElement.prototype.click = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});
