import type { AssistantResponse } from '@/core/assistant/response';
import { text, type ResponseKit } from '@/core/assistant/response-kit';
import type { TechnologyEvidence } from '@/core/assistant/system1/technologies';

/**
 * The Portuguese answers that mark the edges of what this assistant does:
 * greetings, what it is, refusals, technologies weighed against the record,
 * and the honest fallback when nothing better is available.
 */
export function createBoundaryAnswers(kit: ResponseKit) {
  const { response, skills, note } = kit;
  const first = kit.knowledge.profile.firstName;

  const CORE_FOLLOW_UPS = [
    `Me fale sobre a carreira do ${first}.`,
    'Quais são as maiores conquistas técnicas dele?',
    `Como posso falar com o ${first}?`,
  ];

  function greeting(): AssistantResponse {
    return response(
      'greeting',
      [
        text(
          `Olá! Eu sou o assistente do portfólio de ${first}. Respondo perguntas com base na experiência profissional documentada dele — carreira, competências, produtos e o jeito como ele trabalha.`,
        ),
      ],
      { followUps: CORE_FOLLOW_UPS, sources: [] },
    );
  }

  function identity(): AssistantResponse {
    return response(
      'identity',
      [
        text(
          `Eu não sou o ${first} — sou um assistente que representa o portfólio profissional dele. Respondo a partir da experiência documentada dele e, quando algo não está documentado, digo isso em vez de chutar. Para falar diretamente com o ${first}, use as opções de contato.`,
        ),
      ],
      {
        followUps: [
          `Como posso falar com o ${first}?`,
          `Me fale sobre a carreira do ${first}.`,
          'Em quais projetos ele está trabalhando?',
        ],
        sources: [],
      },
    );
  }

  function privateInfo(): AssistantResponse {
    return response(
      'privateInfo',
      [
        text(
          `Isso está fora do que este portfólio cobre. Só compartilho as informações profissionais que o ${first} escolheu documentar: experiência, competências, produtos, formação e como falar com ele.`,
        ),
      ],
      {
        followUps: [
          `Me fale sobre a carreira do ${first}.`,
          `Como posso falar com o ${first}?`,
          'Quais são as competências técnicas mais fortes dele?',
        ],
        sources: [],
        grounded: false,
      },
    );
  }

  function offPurpose(): AssistantResponse {
    return response(
      'offPurpose',
      [
        text(
          `Não posso mudar o meu funcionamento nem sair deste portfólio, mas respondo com prazer perguntas sobre a experiência profissional do ${first}.`,
        ),
      ],
      {
        followUps: [
          `Me fale sobre a carreira do ${first}.`,
          'Em que escopo ele já trabalhou?',
          'Em quais projetos ele está trabalhando?',
        ],
        sources: [],
        grounded: false,
      },
    );
  }

  function describe(evidence: TechnologyEvidence): string {
    const { technology, work, skills: listed, coursework } = evidence;
    if (work.length > 0 || listed.length > 0) {
      const lines = [
        ...work.map((item) => `- **${item.company}** — ${item.statement}`),
        ...(listed.length > 0 ? [`- **Competências listadas** — ${listed.join(', ')}`] : []),
      ];
      return `**${technology.name}** aparece na experiência documentada dele:\n\n${lines.join('\n')}`;
    }
    const study =
      coursework.length > 0
        ? ` Ele concluiu cursos sobre o assunto — ${coursework.join(' e ')} —, mas nenhum uso profissional está documentado.`
        : '';
    return `Não tenho informação documentada sobre o ${first} trabalhando com **${technology.name}** nos cargos dele, então não posso dizer qual é a experiência dele com isso.${study}`;
  }

  const DOCUMENTED_STACK_GROUPS = ['frontend', 'backend'];
  const stackSources = kit.knowledge.skills
    .filter((group) => DOCUMENTED_STACK_GROUPS.includes(group.id))
    .map((group) => group.source);
  const DOCUMENTED_STACK =
    'O stack documentado dele é React, TypeScript e Next.js no frontend, e Node.js e APIs REST no backend.';

  /**
   * Reports exactly where each technology appears in the record — work, listed
   * skill, coursework or nowhere — without upgrading one into another.
   */
  function technology(evidence: readonly TechnologyEvidence[]): AssistantResponse {
    const documented = evidence.some((item) => item.work.length > 0 || item.skills.length > 0);
    const sources = new Set(
      evidence.flatMap((item) => [
        ...item.sources.work,
        ...item.sources.skills,
        ...(documented ? [] : stackSources),
        ...item.sources.coursework,
      ]),
    );
    const answer = evidence.map(describe).join('\n\n');
    return response(
      'technology',
      [
        text(documented ? answer : `${answer} ${DOCUMENTED_STACK}`),
        documented ? null : skills(DOCUMENTED_STACK_GROUPS),
      ],
      {
        followUps: [
          'Qual é a experiência dele com React e TypeScript?',
          'Ele já trabalhou com sistemas de backend?',
          `Como posso falar com o ${first}?`,
        ],
        sources: [...sources],
        grounded: documented,
      },
    );
  }

  /** The answer of last resort, used only when the model-backed path is unavailable. */
  function unknown(): AssistantResponse {
    return response(
      'unknown',
      [
        text(
          'Não tenho informação documentada suficiente para responder isso com precisão, e prefiro não chutar. Veja o que eu posso responder:\n\n' +
            '- A carreira dele e as empresas em que trabalhou\n' +
            '- Resultados mensuráveis, trabalho de arquitetura e de performance\n' +
            '- Competências técnicas, liderança e os produtos próprios dele\n' +
            '- Formação, idiomas e como falar com ele',
        ),
        note(
          'info',
          'O assistente completo está indisponível no momento, então agora só os temas documentados podem ser respondidos.',
        ),
      ],
      { followUps: CORE_FOLLOW_UPS, sources: [], grounded: false },
    );
  }

  /**
   * For a visitor who has used up their share of model answers. Not an error:
   * the suggested questions are answered by the fast path, so they keep working
   * at no cost while the limit resets.
   */
  function slowDown(followUps: readonly string[]): AssistantResponse {
    return response(
      'rateLimited',
      [
        text(
          'Você fez muitas perguntas em pouco tempo, então o assistente completo vai fazer uma pausa de alguns minutos. As perguntas sugeridas abaixo são respondidas na hora e continuam funcionando.',
        ),
      ],
      {
        followUps: followUps.length > 0 ? followUps : CORE_FOLLOW_UPS,
        sources: [],
        grounded: false,
      },
    );
  }

  return { greeting, identity, privateInfo, offPurpose, technology, unknown, slowDown };
}
