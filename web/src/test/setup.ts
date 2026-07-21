import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom doesn't implement these — needed for apiDownload tests.
URL.createObjectURL = vi.fn(() => 'blob:mock');
URL.revokeObjectURL = vi.fn();

// React Testing Library doesn't auto-unmount between tests under Vitest
// unless this is registered globally — without it, DOM from one test leaks
// into the next within the same file, causing "found multiple elements".
afterEach(cleanup);
