import { z } from 'zod';
import { PROJECT_NAME_MAX_LENGTH, PROJECT_TYPES } from './manifest';

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const projectNameSchema = z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH);

export const createProjectSchema = z
  .object({
    name: projectNameSchema,
    projectType: z.enum(PROJECT_TYPES),
  })
  .strict();

export const updateProjectSchema = z.object({ name: projectNameSchema }).partial().strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
