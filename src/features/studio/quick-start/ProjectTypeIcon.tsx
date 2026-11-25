import type { ProjectType } from '@/storage/schemas/project';
import { AudioLines, Image, MessageSquareText, PersonStanding, Table, type IconComponent } from '@/ui/icons';

const ICONS: Readonly<Record<ProjectType, IconComponent>> = {
  image: Image,
  audio: AudioLines,
  pose: PersonStanding,
  text: MessageSquareText,
  tabular: Table,
};

/** Icon của một loại dữ liệu, cùng bộ icon với phần còn lại của giao diện. */
export function ProjectTypeIcon({ type }: { readonly type: ProjectType }) {
  const Icon = ICONS[type];
  return <Icon className="size-7" strokeWidth={1.75} />;
}
