import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './app/AppRoutes';
import { ProjectRepositoryProvider } from './storage/repository-context';
import { createDexieProjectRepository } from './storage/repositories/project-repository';
import { LupDatabase } from './storage/db';
import { initialLanguage } from './i18n';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Không tìm thấy phần tử #root');

document.documentElement.lang = initialLanguage();
const repository = createDexieProjectRepository(new LupDatabase());

// HashRouter: GitHub Pages không hỗ trợ viết lại URL cho ứng dụng một trang.
createRoot(rootElement).render(
  <StrictMode>
    <ProjectRepositoryProvider repository={repository}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ProjectRepositoryProvider>
  </StrictMode>,
);
