import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './app/AppRoutes';
import { RepositoriesProvider, type Repositories } from './storage/repository-context';
import { createDexieProjectRepository } from './storage/repositories/project-repository';
import { createDexieDatasetRepository } from './storage/repositories/dataset-repository';
import { createDexieExperimentRepository } from './storage/repositories/experiment-repository';
import { LupDatabase } from './storage/db';
import { initialLanguage } from './i18n';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Không tìm thấy phần tử #root');

document.documentElement.lang = initialLanguage();
const db = new LupDatabase();
const repositories: Repositories = {
  projects: createDexieProjectRepository(db),
  dataset: createDexieDatasetRepository(db),
  experiments: createDexieExperimentRepository(db),
};

// HashRouter: GitHub Pages không hỗ trợ viết lại URL cho ứng dụng một trang.
createRoot(rootElement).render(
  <StrictMode>
    <RepositoriesProvider repositories={repositories}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </RepositoriesProvider>
  </StrictMode>,
);
