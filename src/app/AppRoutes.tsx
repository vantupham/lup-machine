import { Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';
import { HomePage } from './pages/HomePage';
import { StudioPage } from './pages/StudioPage';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ImageProjectPage } from '@/features/studio/image/ImageProjectPage';
import { LessonsPage } from '@/features/lessons/LessonsPage';
import { LessonPage } from '@/features/lessons/LessonPage';
import { WorksheetPage } from '@/features/lessons/WorksheetPage';
import { PlaygroundPage } from '@/features/playground/PlaygroundPage';
import { PlaygroundAlgoPage } from '@/features/playground/PlaygroundAlgoPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="studio" element={<StudioPage />} />
        <Route path="studio/:projectId" element={<ImageProjectPage />} />
        <Route path="playground" element={<PlaygroundPage />} />
        <Route path="playground/:algo" element={<PlaygroundAlgoPage />} />
        <Route path="lessons" element={<LessonsPage />} />
        <Route path="lessons/:lessonId" element={<LessonPage />} />
        <Route path="lessons/:lessonId/phieu-bai-tap" element={<WorksheetPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
