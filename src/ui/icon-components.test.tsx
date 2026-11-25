import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BackLink } from './BackLink';
import { CLASS_SHAPES, ChartMarker, ClassMarker, shapeFor } from './ClassMarker';
import { StepNumber } from './StepNumber';
import { colorFor } from '@/features/studio/image/lab/class-style';

describe('StepNumber', () => {
  test('hiện số bước nhưng ẩn với trình đọc màn hình (tiêu đề đã có tên bước)', () => {
    const { container } = render(<h2>Huấn luyện<StepNumber n={4} /></h2>);
    expect(screen.getByRole('heading', { name: 'Huấn luyện' })).toBeInTheDocument();
    const badge = container.querySelector('[data-step-number="4"]');
    expect(badge).toHaveTextContent('4');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
  });

  test('bước đã xong hiện dấu tích thay cho số', () => {
    const { container } = render(<StepNumber n={2} done />);
    const badge = container.querySelector('[data-step-number="2"]');
    expect(badge).not.toHaveTextContent('2');
    expect(badge?.querySelector('svg')).not.toBeNull();
  });
});

describe('ClassMarker', () => {
  test('mỗi lớp một hình khác nhau, tô màu của lớp, ẩn với trình đọc màn hình', () => {
    const { container } = render(
      <p>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <ClassMarker key={i} index={i} />)}
      </p>,
    );
    const icons = [...container.querySelectorAll('svg[data-class-marker]')];
    expect(icons).toHaveLength(8);
    expect(new Set(icons.map((svg) => svg.getAttribute('data-shape'))).size).toBe(8);
    expect(new Set(icons.map((svg) => svg.querySelector('path')?.getAttribute('d'))).size).toBe(8);
    expect(icons[1]?.querySelector('path')).toHaveAttribute('fill', colorFor(1));
    expect(icons.every((svg) => svg.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  test('lớp thứ 9 quay lại hình của lớp 1', () => {
    expect(shapeFor(8)).toBe(shapeFor(0));
    expect(CLASS_SHAPES).toHaveLength(8);
  });

  test("color='current' theo màu chữ xung quanh", () => {
    const { container } = render(<ClassMarker index={2} color="current" />);
    expect(container.querySelector('path')).toHaveAttribute('fill', 'currentColor');
  });
});

describe('ChartMarker', () => {
  test('một phần tử duy nhất, cùng hình với chú thích, tâm tại (cx, cy)', () => {
    const { container } = render(
      <svg>
        <ChartMarker index={3} cx={50} cy={40} size={12} />
      </svg>,
    );
    const marks = container.querySelectorAll('[data-class-marker="3"]');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAttribute('data-shape', 'diamond');
    expect(marks[0]).toHaveAttribute('transform', 'translate(44 34) scale(0.5)');
    expect(marks[0]).toHaveAttribute('fill', colorFor(3));
  });

  test('halo thêm viền màu nền mà không thêm phần tử', () => {
    const { container } = render(
      <svg>
        <ChartMarker index={0} cx={0} cy={0} size={8} halo />
      </svg>,
    );
    const marks = container.querySelectorAll('[data-class-marker="0"]');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAttribute('stroke', 'var(--color-surface)');
  });
});

describe('BackLink', () => {
  test('liên kết quay lại có icon mũi tên nhưng tên chỉ là chữ', () => {
    render(
      <MemoryRouter>
        <BackLink to="/studio">Xưởng mô hình</BackLink>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Xưởng mô hình' });
    expect(link).toHaveAttribute('href', '/studio');
    expect(link.querySelector('svg')).not.toBeNull();
  });
});
