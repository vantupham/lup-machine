import { AUDIO } from '@/core/audio/features';
import { LupDatabase } from '../db';
import { clipSamples, createDexieAudioRepository, MAX_CLIPS_PER_CLASS } from './audio-repository';
import { createDexieDatasetRepository } from './dataset-repository';
import { createDexieProjectRepository } from './project-repository';

async function setup() {
  const db = new LupDatabase(`audio-test-${crypto.randomUUID()}`);
  const projects = createDexieProjectRepository(db);
  const dataset = createDexieDatasetRepository(db);
  const audio = createDexieAudioRepository(db);
  const project = await projects.create({ name: 'Âm thanh', projectType: 'audio' });
  const a = await dataset.addClass(project.id, 'Chuông');
  const b = await dataset.addClass(project.id, 'Trống');
  return { db, projects, dataset, audio, project, a, b };
}

const clip = (v: number) => new Float32Array(AUDIO.clipSamples).fill(v);

describe('AudioRepository', () => {
  test('lưu và đọc lại đúng từng mẫu âm thanh, theo thứ tự thêm vào', async () => {
    const { audio, project, a, b } = await setup();
    await audio.addClips([{ projectId: project.id, classId: a.id, source: 'microphone', samples: clip(0.25) }]);
    await audio.addClips([{ projectId: project.id, classId: b.id, source: 'upload', samples: clip(-0.5) }]);
    const clips = await audio.listClips(project.id);
    expect(clips.map((c) => c.seq)).toEqual([0, 1]);
    expect(clipSamples(clips[1]!)[100]).toBe(-0.5);
    await audio.deleteClip(clips[0]!.id);
    expect(await audio.listClips(project.id)).toHaveLength(1);
  });

  test('từ chối đoạn sai độ dài, lớp không tồn tại, hoặc vượt giới hạn mỗi lớp', async () => {
    const { audio, project, a } = await setup();
    await expect(audio.addClips([{ projectId: project.id, classId: a.id, source: 'upload', samples: new Float32Array(10) }])).rejects.toThrow(RangeError);
    await expect(audio.addClips([{ projectId: project.id, classId: 'khong-co', source: 'upload', samples: clip(0) }])).rejects.toThrow(/Không tìm thấy lớp/);
    const many = Array.from({ length: MAX_CLIPS_PER_CLASS + 1 }, () => ({ projectId: project.id, classId: a.id, source: 'dataset' as const, samples: clip(0) }));
    await expect(audio.addClips(many)).rejects.toThrow(/tối đa/);
  });

  test('xóa lớp hoặc xóa dự án thì xóa luôn các đoạn âm thanh', async () => {
    const { audio, dataset, projects, project, a, b } = await setup();
    await audio.addClips([
      { projectId: project.id, classId: a.id, source: 'dataset', samples: clip(0.1) },
      { projectId: project.id, classId: b.id, source: 'dataset', samples: clip(0.2) },
    ]);
    await dataset.deleteClass(a.id);
    expect((await audio.listClips(project.id)).map((c) => c.classId)).toEqual([b.id]);
    await projects.delete(project.id);
    expect(await audio.listClips(project.id)).toEqual([]);
  });
});
