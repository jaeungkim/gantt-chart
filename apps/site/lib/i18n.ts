import { defineI18n } from 'fumadocs-core/i18n';
import { defineI18nUI } from 'fumadocs-ui/i18n';

// en and ko are a translation pair: the page sets must stay identical. English routes carry no prefix.
export const i18n = defineI18n({
  defaultLanguage: 'en',
  languages: ['en', 'ko'],
  hideLocale: 'default-locale',
});

export const { provider } = defineI18nUI(i18n, {
  en: { displayName: 'English' },
  ko: { displayName: '한국어' },
});
