import { lessonPixels } from './lesson-1-pixels';
import { lessonTraining } from './lesson-2-training';
import { lessonShortcut } from './lesson-3-shortcut';
import { lessonPlantDisease } from './lesson-4-plant-disease';
import type { Lesson } from './types';

export type { Lesson, LessonStep, QuizQuestion } from './types';

export const LESSONS: readonly Lesson[] = [lessonPixels, lessonTraining, lessonShortcut, lessonPlantDisease];

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
