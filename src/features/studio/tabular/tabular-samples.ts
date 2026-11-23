/** Bộ dữ liệu bảng mẫu có giấy phép mở (dựng bằng scripts/build-tabular-datasets.py). */
export type TabularSampleId = 'iris' | 'penguins';

export interface TabularSample {
  readonly id: TabularSampleId;
  readonly fileName: string;
  readonly rows: number;
  readonly author: string;
  readonly source: string;
  readonly license: string;
  readonly licenseUrl: string;
  /** Cột gợi ý làm cột cần dự đoán khi mới nạp bộ dữ liệu. */
  readonly defaultTarget: string;
  readonly load: () => Promise<string>;
}

export const TABULAR_SAMPLES: readonly TabularSample[] = [
  {
    id: 'iris',
    fileName: 'iris.csv',
    rows: 150,
    author: 'R. A. Fisher (1936)',
    source: 'https://archive.ics.uci.edu/dataset/53/iris',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    defaultTarget: 'Loài',
    load: () => import('@/content/tabular/iris.csv?raw').then((m) => m.default),
  },
  {
    id: 'penguins',
    fileName: 'penguins.csv',
    rows: 344,
    author: 'K. B. Gorman, T. D. Williams, W. R. Fraser (2014); A. M. Horst, A. P. Hill, K. B. Gorman (2020)',
    source: 'https://github.com/allisonhorst/palmerpenguins',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    defaultTarget: 'Loài',
    load: () => import('@/content/tabular/penguins.csv?raw').then((m) => m.default),
  },
];

export function findTabularSample(id: string | null): TabularSample | null {
  return TABULAR_SAMPLES.find((s) => s.id === id) ?? null;
}
