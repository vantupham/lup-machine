import { useTranslation } from 'react-i18next';
import { readPixel, type RgbaImage } from '@/core/image/preprocess';

export const NEIGHBORHOOD_RADIUS = 3; // 7 × 7

interface PixelGridProps {
  readonly image: RgbaImage;
  readonly x: number;
  readonly y: number;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Lưới 7 × 7 điểm ảnh quanh điểm đang chọn, mỗi ô ghi giá trị R, G, B thật. */
export function PixelGrid({ image, x, y }: PixelGridProps) {
  const { t } = useTranslation();
  const cells = [];
  for (let dy = -NEIGHBORHOOD_RADIUS; dy <= NEIGHBORHOOD_RADIUS; dy++) {
    for (let dx = -NEIGHBORHOOD_RADIUS; dx <= NEIGHBORHOOD_RADIUS; dx++) {
      const px = x + dx;
      const py = y + dy;
      const inside = px >= 0 && py >= 0 && px < image.width && py < image.height;
      cells.push({ key: `${dx},${dy}`, isCenter: dx === 0 && dy === 0, pixel: inside ? readPixel(image, px, py) : null });
    }
  }

  return (
    <figure>
      <figcaption className="mb-1 text-xs text-muted">{t('project.inspector.neighborhood')}</figcaption>
      <div role="grid" aria-label={t('project.inspector.neighborhood')} className="grid grid-cols-7 gap-px bg-rule">
        {cells.map(({ key, isCenter, pixel }) => (
          <div
            key={key}
            role="gridcell"
            aria-current={isCenter || undefined}
            className={`flex aspect-square flex-col items-center justify-center font-mono text-[9px] leading-tight ${
              isCenter ? 'outline outline-2 -outline-offset-2 outline-highlight' : ''
            }`}
            style={
              pixel
                ? {
                    backgroundColor: `rgb(${pixel.r} ${pixel.g} ${pixel.b})`,
                    color: luminance(pixel.r, pixel.g, pixel.b) < 128 ? '#fff' : '#111',
                  }
                : undefined
            }
          >
            {pixel ? (
              <>
                <span>{pixel.r}</span>
                <span>{pixel.g}</span>
                <span>{pixel.b}</span>
              </>
            ) : (
              <span aria-hidden="true">·</span>
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}
