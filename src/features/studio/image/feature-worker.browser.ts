/**
 * Web Worker chạy MobileNet: mọi phép tính nặng diễn ra ở luồng riêng,
 * luồng giao diện chỉ nhận kết quả → trang không bị đứng khi trích đặc trưng hay đo che khuất.
 */
import { serveFeatureExtractor, type PortLike } from '@/core/ml/worker-protocol';
import { createLocalExtractor } from './tf-backend.browser';

serveFeatureExtractor(self as unknown as PortLike, createLocalExtractor);
