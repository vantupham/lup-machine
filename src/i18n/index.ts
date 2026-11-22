import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from './vi.json';
import en from './en.json';
import { safeStorage } from '@/ui/safe-storage';

export const SUPPORTED_LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'vi';
const STORAGE_KEY = 'lup.language';

function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

export function initialLanguage(): Language {
  const stored = safeStorage.get(STORAGE_KEY);
  return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

export function rememberLanguage(language: Language): void {
  safeStorage.set(STORAGE_KEY, language);
  document.documentElement.lang = language;
}

void i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false }, // React đã tự thoát ký tự
  returnObjects: true,
});

export default i18n;
