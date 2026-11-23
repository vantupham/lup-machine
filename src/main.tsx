import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './app/AppRoutes';
import { RepositoriesProvider, type Repositories } from './storage/repository-context';
import { createDexieProjectRepository } from './storage/repositories/project-repository';
import { createDexieDatasetRepository } from './storage/repositories/dataset-repository';
import { createDexieExperimentRepository } from './storage/repositories/experiment-repository';
import { createDexieTableRepository } from './storage/repositories/table-repository';
import { createDexieAudioRepository } from './storage/repositories/audio-repository';
import { createDexiePoseRepository } from './storage/repositories/pose-repository';
import { LupDatabase } from './storage/db';
import { initialLanguage } from './i18n';
import { registerServiceWorker, useOfflineStore } from './ui/offline';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Không tìm thấy phần tử #root');

document.documentElement.lang = initialLanguage();
const db = new LupDatabase();
const repositories: Repositories = {
  projects: createDexieProjectRepository(db),
  dataset: createDexieDatasetRepository(db),
  experiments: createDexieExperimentRepository(db),
  tables: createDexieTableRepository(db),
  audio: createDexieAudioRepository(db),
  poses: createDexiePoseRepository(db),
};

// Chạy ngoại tuyến chỉ bật ở bản build (bản dev của Vite thay đổi mã liên tục).
if (import.meta.env.PROD) {
  void registerServiceWorker(navigator.serviceWorker, `${import.meta.env.BASE_URL}sw.js`, useOfflineStore.getState().setStatus);
}

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
