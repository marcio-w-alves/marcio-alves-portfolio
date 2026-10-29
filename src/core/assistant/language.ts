import type { Locale } from '../i18n/locale';

/**
 * Which language a question is written in, told from words and letters only
 * one language uses. A question with none of them — a technology, a company,
 * a name — is `ambiguous`, and is answered in the page's language; a language
 * the site does not speak is `other`, and goes to the model, which replies in
 * it.
 *
 * Words the languages share are left out on purpose: "me" ("tell me", "me
 * fale"), "do", "no" and "a" are English and Portuguese, and "e" opens
 * "e-mail". "Como" and "sobre" are Portuguese and Spanish, and count as the
 * language the site speaks. Nothing a technology or a company could be called
 * is listed.
 */
export type QuestionLanguage = Locale | 'other' | 'ambiguous';

type Detected = Exclude<QuestionLanguage, 'ambiguous'>;

const wordsOf = (list: string): ReadonlySet<string> => new Set(list.split(/\s+/));

const MARKERS: Readonly<Record<Detected, { words: ReadonlySet<string>; letters?: RegExp }>> = {
  en: {
    words: wordsOf(`about an and any are at be been build built by can could describe did does
      ever for from give had has have he her hers him his how i in is it its know many more most
      much my of on or she should show some speak tell than that the their them there they this to
      use used was were what when where which who whom whose why will with work worked working
      would you your`),
  },
  'pt-BR': {
    words: wordsOf(`ao aos aborda algum alguma aqui carreira como competências competencias
      conhece conquistas construiu conte contato currículo curriculo da das dele deles dela delas
      descreva dos ela elas ele eles em empresa equipe equipes essa esse esta este está experiência
      experiencia explique fala falar fale faz fez foi formação formacao isso já ja liderança
      lideranca lidera liderou mais meu minha mostre muito na nas nao não nos num numa o onde os
      para pela pelo pode por posso pra projetos quais qual quando quanto quantos quantas que quem
      sabe são sao seu seus sim sobre sua suas também tambem tem têm teve tinha trabalha
      trabalhando trabalho trabalhou um uma umas uns usou você voce vocês à às é`),
    letters: /[ãõçâêô]/,
  },
  other: {
    words: wordsOf(`años con cual cuál cuales cuáles cuantos cuántos cómo del donde dónde el ella
      equipo es habla hablar habilidades hay las le les lo los proyectos puede puedo qué quién sus
      tiene tienen trabaja trabajado trabajo trabajó tuvo una usted ustedes y`),
    letters: /[ñ¿¡]/,
  },
};

/** A letter only one language writes outweighs any one word. */
const LETTERS_WEIGHT = 2;

const LANGUAGES = Object.keys(MARKERS) as readonly Detected[];

function scoreOf(language: Detected, text: string, words: readonly string[]): number {
  const { words: known, letters } = MARKERS[language];
  const wordHits = words.filter((word) => known.has(word)).length;
  return wordHits + (letters?.test(text) ? LETTERS_WEIGHT : 0);
}

export function detectLanguage(question: string): QuestionLanguage {
  const text = question.toLowerCase();
  const words = text.match(/\p{L}+/gu) ?? [];
  const scores = LANGUAGES.map((language) => ({ language, score: scoreOf(language, text, words) }));
  const best = Math.max(...scores.map(({ score }) => score));
  const leaders = scores.filter(({ score }) => score === best);
  const [leader] = leaders;
  return best === 0 || leaders.length > 1 || !leader ? 'ambiguous' : leader.language;
}

/**
 * The language to answer in: the question's own, or the page's when the
 * question cannot tell. A language the site does not speak gets the page's
 * too: the model writes those answers in the visitor's language, and only
 * what surrounds them (the suggested follow-ups) is chosen here.
 */
export function replyLocale(question: string, pageLocale: Locale): Locale {
  const detected = detectLanguage(question);
  return detected === 'ambiguous' || detected === 'other' ? pageLocale : detected;
}
