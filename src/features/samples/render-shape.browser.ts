/** Vẽ một ảnh hình học tổng hợp ra canvas 224×224 (chạy trên trình duyệt; kiểm thử bằng E2E). */
import type { ShapeSpec } from '@/core/datasets/synthetic';
import type { StoredImage } from '@/storage/db';
import { canvasToStoredImage, createSquareCanvas } from '@/features/studio/image/image-codec.browser';

function tracePath(ctx: CanvasRenderingContext2D, shape: ShapeSpec): void {
  const r = shape.size / 2;
  ctx.beginPath();
  if (shape.kind === 'circle') {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    return;
  }
  // Hình vuông và tam giác nội tiếp đường tròn bán kính r → xoay góc nào cũng nằm trọn trong khung.
  const corners = shape.kind === 'square' ? 4 : 3;
  for (let i = 0; i < corners; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / corners;
    ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
  }
  ctx.closePath();
}

export async function renderShape(shape: ShapeSpec): Promise<StoredImage> {
  const { canvas, ctx } = createSquareCanvas();
  ctx.fillStyle = shape.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(shape.cx, shape.cy);
  ctx.rotate((shape.rotation * Math.PI) / 180);
  ctx.fillStyle = shape.fill;
  tracePath(ctx, shape);
  ctx.fill();
  ctx.restore();
  return canvasToStoredImage(canvas);
}
