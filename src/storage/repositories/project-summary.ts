import type { LupDatabase, ProjectRecord, StoredImage } from '../db';

/** Những gì thẻ dự án cần để học sinh nhận ra dự án của mình mà không phải mở ra. */
export interface ProjectSummary {
  readonly classCount: number;
  /** Số ảnh / đoạn âm thanh / mẫu tư thế. Dự án bảng và văn bản không đếm (xem `hasTable`). */
  readonly itemCount: number;
  /** Số lần huấn luyện đã lưu trong nhật ký thí nghiệm (hiện chỉ Studio ảnh ghi nhật ký). */
  readonly runCount: number;
  readonly hasTable: boolean;
  /**
   * Một ảnh đại diện cho mỗi lớp (tối đa 4 lớp đầu, theo thứ tự lớp). Không cố lấy ảnh cũ nhất:
   * ảnh không có chỉ mục theo thời gian, đọc hết ảnh của lớp chỉ để chọn một tấm thì quá nặng.
   */
  readonly thumbnails: readonly StoredImage[];
}

export const MAX_THUMBNAILS = 4;

/** Chỉ cần id và loại dự án để tóm tắt. */
export type SummaryTarget = Pick<ProjectRecord, 'id' | 'projectType'>;

async function countItems(db: LupDatabase, project: SummaryTarget): Promise<number> {
  switch (project.projectType) {
    case 'image':
      return db.samples.where('projectId').equals(project.id).count();
    case 'audio':
      return db.audioClips.where('projectId').equals(project.id).count();
    case 'pose':
      return db.poseSamples.where('projectId').equals(project.id).count();
    default:
      return 0;
  }
}

async function firstImages(db: LupDatabase, project: SummaryTarget, classIds: readonly string[]): Promise<StoredImage[]> {
  if (project.projectType !== 'image') return [];
  const images: StoredImage[] = [];
  for (const classId of classIds) {
    if (images.length >= MAX_THUMBNAILS) break;
    const sample = await db.samples.where('classId').equals(classId).first();
    if (sample) images.push(sample.image);
  }
  return images;
}

export async function summarizeProject(db: LupDatabase, project: SummaryTarget): Promise<ProjectSummary> {
  const classes = (await db.classes.where('projectId').equals(project.id).toArray()).sort((a, b) => a.order - b.order);
  const [itemCount, runCount, tableCount, thumbnails] = await Promise.all([
    countItems(db, project),
    db.runs.where('projectId').equals(project.id).count(),
    db.dataTables.where('projectId').equals(project.id).count(),
    firstImages(db, project, classes.map((c) => c.id)),
  ]);
  return { classCount: classes.length, itemCount, runCount, hasTable: tableCount > 0, thumbnails };
}
