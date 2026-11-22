import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom chưa có URL.createObjectURL / revokeObjectURL.
let objectUrlCounter = 0;
URL.createObjectURL = () => `blob:test/${++objectUrlCounter}`;
URL.revokeObjectURL = () => undefined;
