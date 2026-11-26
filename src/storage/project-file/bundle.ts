import type { z } from 'zod';
import { readZip, writeZip, ZipLimitError } from '@/core/project-file/zip';
import { ENTRY_LIMITS, PROJECT_FILE_LIMITS, ProjectFileError } from './constants';
import { decodeWavFloat32, encodeWavFloat32 } from '@/core/project-file/wav';
import { AUDIO } from '@/core/audio/features';
import { keypointCount } from '@/core/pose/features';
import { CSV_LIMITS, parseCsv } from '@/core/tabular/csv';
import { imageDimensions } from '@/core/project-file/image-size';
import type { AudioSource, ImageCredit, PoseSource, RunRecord, SampleSource, Split, StoredImage } from '../db';
import { parseManifest, type Manifest } from '../schemas/manifest';
import type { ProjectType } from '../schemas/project';
import { modelCardFileSchema, type ModelCardFields } from '../schemas/model-card';
import { notesFileSchema, type Note } from '../schemas/notebook';
import type { NewTrialInput } from '../schemas/trial';
import { MAX_SAMPLES_PER_CLASS } from '../repositories/dataset-repository';
import { MAX_CLIPS_PER_CLASS } from '../repositories/audio-repository';
import { MAX_POSES_PER_CLASS } from '../repositories/pose-repository';
import { MAX_RUNS_PER_PROJECT } from '../repositories/experiment-repository';
import { isTabularConfig, isTextConfig, parseTableProjectConfig, type TableProjectConfig } from '../repositories/table-repository';
import {
  AUDIO_FILE_PATTERN,
  audioFileSchema,
  BUNDLE_FILES,
  classesFileSchema,
  IMAGE_FILE_PATTERN,
  imagesFileSchema,
  posesFileSchema,
  runsFileSchema,
  tableFileSchema,
  trialsFileSchema,
} from './bundle-schema';

/** Nội dung một dự án, độc lập với id trong IndexedDB (lớp được tham chiếu bằng chỉ số). */
export interface ProjectBundle {
  readonly manifest: Manifest;
  readonly classes: readonly string[];
  readonly images: readonly BundleImage[];
  readonly clips: readonly BundleClip[];
  readonly poses: readonly BundlePose[];
  readonly table: BundleTable | null;
  readonly runs: readonly BundleRun[];
  /** Thẻ mô hình học sinh đã viết (null nếu chưa viết). */
  readonly modelCard: ModelCardFields | null;
  /** Sổ tay khám phá: ghi chép của học sinh theo từng bước. */
  readonly notes: readonly Note[];
  /** Nhật ký thí nghiệm (Studio âm thanh, tư thế, văn bản, bảng số). */
  readonly trials: readonly BundleTrial[];
}

export type BundleTrial = NewTrialInput & { readonly number: number; readonly createdAt: string };

export interface BundleImage {
  readonly classIndex: number;
  readonly split: Split;
  readonly source: SampleSource;
  readonly image: StoredImage;
  readonly credit?: ImageCredit;
}

export interface BundleClip {
  readonly classIndex: number;
  readonly source: AudioSource;
  readonly samples: Float32Array;
}

export interface BundlePose {
  readonly classIndex: number;
  readonly kind: 'body' | 'hand';
  readonly source: PoseSource;
  readonly keypoints: readonly number[];
  readonly width: number;
  readonly height: number;
}

export interface BundleTable {
  readonly csv: string;
  readonly fileName: string;
  readonly sampleId: string | null;
  readonly config: TableProjectConfig | null;
}

export { PROJECT_FILE_EXTENSION, PROJECT_FILE_LIMITS, ProjectFileError } from './constants';

export type BundleRun = Omit<RunRecord, 'id' | 'projectId'> & { readonly matchesData: boolean };


/** Tệp dữ liệu nào được phép có trong từng loại dự án. */
const ALLOWED_DATA: Record<ProjectType, ReadonlySet<string>> = {
  image: new Set([BUNDLE_FILES.classes, BUNDLE_FILES.images, BUNDLE_FILES.runs]),
  audio: new Set([BUNDLE_FILES.classes, BUNDLE_FILES.audio, BUNDLE_FILES.trials]),
  pose: new Set([BUNDLE_FILES.classes, BUNDLE_FILES.poses, BUNDLE_FILES.trials]),
  text: new Set([BUNDLE_FILES.table, BUNDLE_FILES.tableCsv, BUNDLE_FILES.trials]),
  tabular: new Set([BUNDLE_FILES.table, BUNDLE_FILES.tableCsv, BUNDLE_FILES.trials]),
};

const KNOWN_JSON: ReadonlySet<string> = new Set(Object.values(BUNDLE_FILES));
const IMAGE_EXTENSIONS: Readonly<Record<string, string>> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const encoder = new TextEncoder();

function json(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

const fileNumber = (i: number) => String(i + 1).padStart(5, '0');

export function encodeBundle(bundle: ProjectBundle): Uint8Array {
  const files: Record<string, Uint8Array> = { [BUNDLE_FILES.manifest]: json(bundle.manifest) };
  if (bundle.modelCard) files[BUNDLE_FILES.modelCard] = json(bundle.modelCard);
  if (bundle.notes.length > 0) files[BUNDLE_FILES.notebook] = json({ notes: bundle.notes });
  if (bundle.trials.length > 0 && bundle.manifest.projectType !== 'image') files[BUNDLE_FILES.trials] = json({ trials: bundle.trials });
  const type = bundle.manifest.projectType;
  if (type === 'image' || type === 'audio' || type === 'pose') files[BUNDLE_FILES.classes] = json({ classes: bundle.classes });
  if (type === 'image') {
    const items = bundle.images.map((item, i) => {
      const ext = IMAGE_EXTENSIONS[item.image.mime];
      if (!ext) throw new ProjectFileError(`Định dạng ảnh không hỗ trợ: ${item.image.mime}`);
      const file = `samples/${fileNumber(i)}.${ext}`;
      files[file] = new Uint8Array(item.image.bytes);
      const { width, height } = item.image;
      return { file, class: item.classIndex, split: item.split, source: item.source, width, height, ...(item.credit ? { credit: item.credit } : {}) };
    });
    files[BUNDLE_FILES.images] = json({ items });
    files[BUNDLE_FILES.runs] = json({ runs: bundle.runs });
  }
  if (type === 'audio') {
    const items = bundle.clips.map((clip, i) => {
      const file = `audio/${fileNumber(i)}.wav`;
      files[file] = encodeWavFloat32(clip.samples, AUDIO.sampleRate);
      return { file, class: clip.classIndex, source: clip.source };
    });
    files[BUNDLE_FILES.audio] = json({ items });
  }
  if (type === 'pose') {
    files[BUNDLE_FILES.poses] = json({ items: bundle.poses.map(({ classIndex, ...rest }) => ({ class: classIndex, ...rest })) });
  }
  if ((type === 'text' || type === 'tabular') && bundle.table) {
    const { csv, ...meta } = bundle.table;
    files[BUNDLE_FILES.tableCsv] = encoder.encode(csv);
    files[BUNDLE_FILES.table] = json(meta);
  }
  return writeZip(files);
}

/** Số byte tối đa sau giải nén cho mỗi tên tệp đã biết; tên lạ bị bỏ qua (false). */
function acceptEntry(name: string): number | false {
  if (name === BUNDLE_FILES.tableCsv) return ENTRY_LIMITS.csv;
  if (KNOWN_JSON.has(name)) return ENTRY_LIMITS.json;
  if (IMAGE_FILE_PATTERN.test(name)) return ENTRY_LIMITS.image;
  if (AUDIO_FILE_PATTERN.test(name)) return ENTRY_LIMITS.wav;
  return false;
}

/** Mỗi tệp nhị phân chỉ được một mục dùng (tránh một tệp bị nhân bản hàng nghìn lần trong bộ nhớ). */
function checkUniqueFiles(files: readonly string[]): void {
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file)) throw new ProjectFileError(`Tệp ${file} được dùng nhiều lần`);
    seen.add(file);
  }
}

/** ArrayBuffer riêng của mảng byte (fflate trả về mảng có bộ đệm riêng nên thường không phải sao chép). */
function ownBuffer(bytes: Uint8Array): ArrayBuffer {
  const isWhole = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer;
  return isWhole ? (bytes.buffer as ArrayBuffer) : bytes.slice().buffer;
}

function openArchive(bytes: Uint8Array): Map<string, Uint8Array> {
  try {
    return readZip(bytes, PROJECT_FILE_LIMITS, acceptEntry);
  } catch (error: unknown) {
    if (error instanceof ZipLimitError) throw new ProjectFileError(error.message);
    throw new ProjectFileError('Không đọc được tệp: tệp hỏng hoặc không phải tệp dự án .lup', { cause: error });
  }
}

function readText(files: Map<string, Uint8Array>, name: string): string | null {
  const data = files.get(name);
  if (!data) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    throw new ProjectFileError(`${name}: không phải văn bản UTF-8`);
  }
}

function readJson<T>(files: Map<string, Uint8Array>, name: string, schema: z.ZodType<T>): T | null {
  const text = readText(files, name);
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ProjectFileError(`${name}: JSON không hợp lệ`);
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ProjectFileError(`${name}: ${issue?.path.join('.') || '(gốc)'} ${issue?.message ?? 'không hợp lệ'}`);
  }
  return result.data;
}

function requireFile(files: Map<string, Uint8Array>, name: string): Uint8Array {
  const data = files.get(name);
  if (!data) throw new ProjectFileError(`Thiếu tệp ${name}`);
  return data;
}

function sameName(a: string, b: string): boolean {
  const key = (s: string) => s.normalize('NFC').trim().toLocaleLowerCase('vi');
  return key(a) === key(b);
}

function checkClasses(classes: readonly string[]): void {
  classes.forEach((name, i) => {
    if (classes.slice(0, i).some((other) => sameName(other, name))) throw new ProjectFileError(`Tên lớp "${name}" bị trùng`);
  });
}

/** Đếm mẫu theo lớp, kiểm tra chỉ số lớp hợp lệ và không vượt giới hạn mỗi lớp. */
function checkClassCounts(indices: readonly number[], classCount: number, maxPerClass: number): void {
  const counts = new Map<number, number>();
  for (const index of indices) {
    if (index >= classCount) throw new ProjectFileError(`Mẫu thuộc lớp số ${index + 1} không tồn tại`);
    const next = (counts.get(index) ?? 0) + 1;
    if (next > maxPerClass) throw new ProjectFileError(`Mỗi lớp có tối đa ${maxPerClass} mẫu`);
    counts.set(index, next);
  }
}

function isImageOfType(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b);
}

function decodeImages(files: Map<string, Uint8Array>, classCount: number): BundleImage[] {
  const parsed = readJson(files, BUNDLE_FILES.images, imagesFileSchema);
  const items = parsed?.items ?? [];
  checkClassCounts(items.map((i) => i.class), classCount, MAX_SAMPLES_PER_CLASS);
  checkUniqueFiles(items.map((i) => i.file));
  return items.map((item) => {
    const bytes = requireFile(files, item.file);
    const mime = item.file.endsWith('.png') ? 'image/png' : 'image/jpeg';
    if (!isImageOfType(bytes, mime)) throw new ProjectFileError(`${item.file}: không phải ảnh ${mime}`);
    const size = imageDimensions(bytes, mime);
    if (!size || size.width !== item.width || size.height !== item.height) {
      throw new ProjectFileError(`${item.file}: kích thước ảnh không khớp với khai báo`);
    }
    const image: StoredImage = { bytes: ownBuffer(bytes), mime, width: item.width, height: item.height };
    return { classIndex: item.class, split: item.split, source: item.source, image, ...(item.credit ? { credit: item.credit } : {}) };
  });
}

function decodeClips(files: Map<string, Uint8Array>, classCount: number): BundleClip[] {
  const items = readJson(files, BUNDLE_FILES.audio, audioFileSchema)?.items ?? [];
  checkClassCounts(items.map((i) => i.class), classCount, MAX_CLIPS_PER_CLASS);
  checkUniqueFiles(items.map((i) => i.file));
  return items.map((item) => {
    try {
      const samples = decodeWavFloat32(requireFile(files, item.file), { sampleRate: AUDIO.sampleRate, length: AUDIO.clipSamples });
      return { classIndex: item.class, source: item.source, samples };
    } catch (error: unknown) {
      if (error instanceof ProjectFileError) throw error;
      throw new ProjectFileError(`${item.file}: ${error instanceof Error ? error.message : 'không hợp lệ'}`);
    }
  });
}

function decodePoses(files: Map<string, Uint8Array>, classCount: number): BundlePose[] {
  const items = readJson(files, BUNDLE_FILES.poses, posesFileSchema)?.items ?? [];
  checkClassCounts(items.map((i) => i.class), classCount, MAX_POSES_PER_CLASS);
  return items.map(({ class: classIndex, ...rest }) => {
    if (rest.keypoints.length !== keypointCount(rest.kind) * 3) throw new ProjectFileError(`Mẫu tư thế phải có đúng ${keypointCount(rest.kind)} khớp`);
    return { classIndex, ...rest };
  });
}

function decodeTable(files: Map<string, Uint8Array>, type: 'text' | 'tabular'): BundleTable | null {
  const meta = readJson(files, BUNDLE_FILES.table, tableFileSchema);
  if (!meta) return null;
  const csv = readText(files, BUNDLE_FILES.tableCsv);
  if (csv === null) throw new ProjectFileError(`Thiếu tệp ${BUNDLE_FILES.tableCsv}`);
  if (csv.length > CSV_LIMITS.maxChars) throw new ProjectFileError('Bảng dữ liệu quá lớn');
  const table = parseCsv(csv);
  if (!table.ok) throw new ProjectFileError(`${BUNDLE_FILES.tableCsv}: bảng không hợp lệ (${table.error})`);
  const parsed = parseTableProjectConfig(meta.config);
  const config = (type === 'text' ? isTextConfig(parsed) : isTabularConfig(parsed)) ? parsed : null;
  return { csv, fileName: meta.fileName, sampleId: meta.sampleId, config };
}

function checkTypeMatchesData(files: Map<string, Uint8Array>, type: ProjectType): void {
  const allowed = ALLOWED_DATA[type];
  const stray = [...files.keys()].find(
    (name) => name !== BUNDLE_FILES.manifest && name !== BUNDLE_FILES.modelCard && name !== BUNDLE_FILES.notebook && !allowed.has(name) && !(type === 'image' && IMAGE_FILE_PATTERN.test(name)) && !(type === 'audio' && AUDIO_FILE_PATTERN.test(name)),
  );
  if (stray) throw new ProjectFileError(`Tệp ${stray} không đúng loại dự án "${type}"`);
}

/** Đọc tệp .lup từ nguồn không tin cậy. Mọi phần đều được kiểm tra; lỗi ném ProjectFileError. */
export function decodeBundle(bytes: Uint8Array): ProjectBundle {
  const files = openArchive(bytes);
  const manifestText = readText(files, BUNDLE_FILES.manifest);
  if (manifestText === null) throw new ProjectFileError('Thiếu manifest.json: đây không phải tệp dự án LUP Machine');
  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(manifestText);
  } catch {
    throw new ProjectFileError('manifest.json: JSON không hợp lệ');
  }
  const manifest = parseManifest(manifestValue);
  if (!manifest.success) throw new ProjectFileError(`manifest.json: ${manifest.error}`);
  const type = manifest.data.projectType;
  checkTypeMatchesData(files, type);

  const hasClasses = type === 'image' || type === 'audio' || type === 'pose';
  const classes = hasClasses ? (readJson(files, BUNDLE_FILES.classes, classesFileSchema)?.classes ?? []) : [];
  checkClasses(classes);
  const runs = type === 'image' ? (readJson(files, BUNDLE_FILES.runs, runsFileSchema)?.runs ?? []) : [];
  if (runs.length > MAX_RUNS_PER_PROJECT) throw new ProjectFileError(`Nhật ký có tối đa ${MAX_RUNS_PER_PROJECT} lần chạy`);
  if (runs.some((run, i) => i > 0 && run.number <= (runs[i - 1]?.number ?? 0))) {
    throw new ProjectFileError('Nhật ký: số thứ tự lần chạy phải tăng dần, không trùng');
  }

  return {
    manifest: manifest.data,
    classes,
    images: type === 'image' ? decodeImages(files, classes.length) : [],
    clips: type === 'audio' ? decodeClips(files, classes.length) : [],
    poses: type === 'pose' ? decodePoses(files, classes.length) : [],
    table: type === 'text' || type === 'tabular' ? decodeTable(files, type) : null,
    runs,
    modelCard: readJson(files, BUNDLE_FILES.modelCard, modelCardFileSchema),
    notes: readJson(files, BUNDLE_FILES.notebook, notesFileSchema)?.notes ?? [],
    trials: type === 'image' ? [] : (readJson(files, BUNDLE_FILES.trials, trialsFileSchema)?.trials ?? []),
  };
}
