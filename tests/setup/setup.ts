import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom chưa có URL.createObjectURL / revokeObjectURL.
let objectUrlCounter = 0;
URL.createObjectURL = () => `blob:test/${++objectUrlCounter}`;
URL.revokeObjectURL = () => undefined;

// jsdom không có canvas: trả về null (thay vì báo "Not implemented") để component tự bỏ qua bước vẽ.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
