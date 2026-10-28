import type { Locale } from '@/core/i18n/locale';
import type { UiMessages } from './ui-messages';

/**
 * The failed-page messages of each language, apart from the catalogs: the
 * last-resort error page ships with every page and needs these alone, not
 * every language's whole interface.
 */
export const PAGE_FAILED: Readonly<Record<Locale, UiMessages['pageFailed']>> = {
  en: {
    failure: 'Error',
    title: 'This page failed to load',
    description:
      'Something broke on our side while showing it. Try again; if it keeps failing, come back in a few minutes.',
    retry: 'Try again',
    reference: 'Reference {digest}',
    documentTitle: 'Something went wrong — {name}',
  },
  'pt-BR': {
    failure: 'Erro',
    title: 'Esta página não carregou',
    description:
      'Algo quebrou do nosso lado ao exibi-la. Tente de novo; se continuar falhando, volte em alguns minutos.',
    retry: 'Tentar de novo',
    reference: 'Referência {digest}',
    documentTitle: 'Algo deu errado — {name}',
  },
};
