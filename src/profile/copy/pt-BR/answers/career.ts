import type { AssistantResponse } from '@/core/assistant/response';
import type { ConversationContext } from '@/core/chat/request';
import { bullets, details, text, type ResponseKit } from '@/core/assistant/response-kit';
import { createFacts } from './facts';

/**
 * The Portuguese answers about career, impact and leadership. Every claim
 * maps to a record in the knowledge base; what the record does not document
 * is left out rather than inferred.
 */
export function createCareerAnswers(kit: ResponseKit) {
  const {
    roleById,
    allRoleSources,
    contactOnce,
    metrics,
    note,
    response,
    table,
    timeline,
    knowledge,
  } = kit;
  const { practice } = knowledge;
  const {
    first,
    experience,
    employer,
    title,
    period,
    years,
    startMonth,
    product: productName,
    metric,
    award,
    amount,
    before,
    after,
    countsInWords,
  } = createFacts(kit);
  const team = countsInWords('roots-team');
  const peopleList = countsInWords('deel-people-list');

  function career(): AssistantResponse {
    return response(
      'career',
      [
        text(
          `${first} é engenheiro frontend com **${experience}** de experiência profissional. Ele começou em ${String(knowledge.profile.careerStartYear)} como desenvolvedor web freelance e cresceu até cargos de frontend sênior e de liderança — ajudando a liderar o time de HRIS na **${employer('deel')}** (${period('deel')}) e, desde ${startMonth('way2b1')}, como ${title('way2b1')} na **${employer('way2b1')}**, trabalhando full stack em todo o conjunto de produtos de uma pequena startup.\n\n` +
            'Em todos esses cargos o fio condutor é o mesmo: arquitetura com React e Next.js, performance, developer experience e liderança técnica, com o trabalho de engenharia ligado às necessidades do produto e ao impacto para os usuários.',
        ),
        text(`### Como o escopo dele cresceu\n${bullets(practice.careerArc)}`),
        timeline(),
        text('Alguns resultados documentados ao longo do caminho:'),
        metrics(['deel-critical-load', 'deel-web-vitals', 'deel-people-list', 'roots-team']),
        text(`### O que ele busca a seguir\n${practice.goals.roles} ${practice.goals.mode}`),
      ],
      {
        followUps: [
          `O que ele construiu na ${employer('deel')}?`,
          'Ele já liderou times de engenharia?',
          'Em quais projetos ele está trabalhando?',
        ],
        sources: ['profile', ...allRoleSources(), 'notes'],
        related: 'deel',
      },
    );
  }

  function roleFit(context: ConversationContext): AssistantResponse {
    return response(
      'roleFit',
      [
        text(
          `O escopo de ${first} já foi além do próprio código: ele foi responsável por decisões de arquitetura, entregou melhorias mensuráveis no produto e fez mentoria de engenheiros.\n\n` +
            `Na **${employer('deel')}**, ele ajudou a liderar o time de HRIS, padronizou a arquitetura das interfaces do time e liderou a migração da ${employer('roots')} para a plataforma — enquanto melhorava os Web Vitals em pelo menos ${amount('deel-web-vitals')} e reduzia em ${metric('deel-critical-load')} o tempo de carregamento das páginas críticas. Na **${employer('roots')}**, ele dirigiu a estratégia de frontend e ampliou o time de frontend de ${team.from} desenvolvedor para ${team.to}.`,
        ),
        table(
          ['Sinal', 'Evidência', 'Onde'],
          [
            [
              'Responsabilidade pela arquitetura',
              'Dirigiu a estratégia técnica e a arquitetura do frontend de um produto em crescimento',
              employer('roots'),
            ],
            [
              'Padrões em escala',
              'Padronizou a arquitetura frontend do HRIS: estrutura, gerenciamento de estado, tratamento de erros',
              employer('deel'),
            ],
            [
              'Impacto mensurável',
              `Web Vitals +${amount('deel-web-vitals')}, carregamento das páginas críticas −${metric('deel-critical-load')}, carregamento da People List de ${before('deel-people-list')} para ${after('deel-people-list')}`,
              employer('deel'),
            ],
            [
              'Formação de time',
              `Ampliou o time de frontend de um único desenvolvedor para ${team.to} desenvolvedores`,
              employer('roots'),
            ],
            [
              'Liderança de entregas',
              'Trade-offs técnicos, planos de entrega, OKRs e metas trimestrais com Produto',
              employer('deel'),
            ],
            [
              'Entre produtos',
              `Bundle reduzido em quase ${amount('way2b1-bundle')} e código legado migrado em um conjunto de produtos`,
              employer('way2b1'),
            ],
          ],
          'O escopo do trabalho dele, com evidências',
        ),
        text(
          `### Como ele lidera\n${practice.leadershipPractice.style}\n\nOs títulos mais recentes dele são ${title('way2b1')} e, na ${employer('roots')}, ${title('roots')}. Nenhum título no histórico dele é Staff: as evidências acima descrevem o escopo do trabalho dele, não um título.`,
        ),
        note(
          'inference',
          'Esta é uma avaliação tirada da experiência documentada dele. Se ele se encaixa em uma vaga específica depende das necessidades daquele time.',
        ),
        contactOnce(context),
      ],
      {
        followUps: [
          'Me fale mais sobre a liderança dele.',
          'Mostre exemplos de decisões de arquitetura.',
          'Quais são as competências técnicas mais fortes dele?',
        ],
        sources: ['resume.way2b1', 'resume.deel', 'resume.roots', 'notes'],
        related: 'deel',
      },
    );
  }

  const COMPANY_INTROS: Readonly<Record<string, string>> = {
    way2b1: `Desde ${startMonth('way2b1')}, ${first} é ${title('way2b1')} na **${employer('way2b1')}**, uma pequena startup de São Francisco que constrói uma plataforma para famílias e family offices. Ele trabalha full stack em todo o conjunto de produtos: reduziu o bundle em quase ${amount('way2b1-bundle')}, baixou os tempos de carregamento para algumas centenas de milissegundos e migrou código legado em vários produtos.`,
    deel: `${first} trabalhou na **${employer('deel')}** de ${years('deel').from} a ${years('deel').to} como ${title('deel')}, ajudando a liderar o time de HRIS responsável pelas ferramentas centrais de RH da empresa e liderando a migração da ${employer('roots')} para a ${employer('deel')}.`,
    roots: `Na **${employer('roots')}** (${period('roots')}), uma startup que cria bots de Slack para RH, ${first} foi ${title('roots')}. Ele construiu o frontend do produto de ponta a ponta, ampliou o time de frontend de ${team.from} para ${team.to} e depois liderou a migração da plataforma para a ${employer('deel')}.`,
    shall: `Na **${employer('shall')}** (${period('shall')}), ${first} trabalhou como ${title('shall')} em uma plataforma de RH de uma empresa americana, onde foi promovido de pleno a Principal Frontend Developer.`,
  };

  const COMPANY_FOLLOW_UPS: Readonly<Record<string, readonly string[]>> = {
    way2b1: [
      'Como ele otimizou a performance?',
      'Como ele aborda a arquitetura frontend?',
      'Ele se encaixaria em uma posição de liderança técnica?',
    ],
    deel: [
      'Que melhorias de arquitetura ele introduziu?',
      'Como ele otimizou a performance?',
      'Qual era o papel dele no time de HRIS?',
    ],
    roots: [
      `Como ele fez o time crescer na ${employer('roots')}?`,
      `O que ele construiu na ${employer('deel')}?`,
      'Ele já construiu algo do zero?',
    ],
    shall: [
      'Ele já trabalhou com sistemas de backend?',
      'Ele já construiu apps mobile?',
      'Ele já recebeu algum prêmio?',
    ],
    maison: [
      'Ele tem experiência com Next.js e SSR?',
      `Me fale sobre a carreira do ${first}.`,
      'Quais são as maiores conquistas técnicas dele?',
    ],
  };

  function section(heading: string, items: readonly string[]) {
    return items.length > 0 ? text(`### ${heading}\n${bullets(items)}`) : null;
  }

  function caseStudy(roleId: string) {
    const study = practice.caseStudies[roleId];
    if (!study) return [];
    return [text(`### O problema de engenharia\n${study.problem}\n\n${bullets(study.angles)}`)];
  }

  function company(roleId: string): AssistantResponse {
    const role = roleById(roleId);
    const intro =
      COMPANY_INTROS[roleId] ??
      `${first} trabalhou na **${role.company}** como ${role.role} (${role.period}).`;
    return response(
      `company:${roleId}`,
      [
        text(intro),
        role.metrics.length > 0 ? text('### Impacto') : null,
        role.metrics.length > 0 ? metrics(role.metrics) : null,
        text(`### O que o trabalho envolvia\n${bullets(role.responsibilities)}`),
        section('Liderança', role.leadership),
        section('Reconhecimento', role.achievements),
        ...caseStudy(roleId),
        roleId === 'deel'
          ? details(
              'Como os ganhos de performance foram alcançados?',
              `Com refatoração e otimização direcionadas das páginas críticas. A página People List passou de ${peopleList.from} segundos para ${peopleList.to} sem cache, o tempo de carregamento das páginas críticas caiu ${metric('deel-critical-load')} no geral e os Web Vitals melhoraram pelo menos ${amount('deel-web-vitals')}. As ferramentas específicas por trás de cada mudança não estão documentadas.`,
            )
          : null,
      ],
      {
        followUps: COMPANY_FOLLOW_UPS[roleId] ?? [
          `Me fale sobre a carreira do ${first}.`,
          'Quais são as maiores conquistas técnicas dele?',
          'Qual é a experiência dele com React e TypeScript?',
        ],
        sources: practice.caseStudies[roleId] ? [role.source, 'notes'] : [role.source],
        related: roleId,
      },
    );
  }

  function leadRole(): AssistantResponse {
    return response(
      'leadRole',
      [
        text(
          `Na **${employer('deel')}**, ${first} ajudou a liderar e manter o time de HRIS responsável pelo produto central de ferramentas de RH da empresa. O papel dele cobria quatro frentes:\n\n` +
            '- **Arquitetura** — padronizou o frontend do HRIS: estrutura, gerenciamento de estado, tratamento de erros e escalabilidade.\n' +
            `- **Integração** — liderou a migração e a escalabilidade da ${employer('roots')} dentro da ${employer('deel')}, mitigando os riscos de rollout.\n` +
            '- **Planejamento** — definiu trade-offs técnicos e planos de entrega, e documentou entregas para OKRs e metas trimestrais com os Product Managers.\n' +
            '- **Pessoas** — orientou engenheiros júnior e pleno com sessões de compartilhamento de conhecimento e walkthroughs de código, conduziu revisões de código e pair programming, e ajudou a contratar e a fazer o onboarding de engenheiros.',
        ),
        metrics(['deel-critical-load', 'deel-people-list']),
        text(
          `### O system design por trás disso\n${bullets(practice.caseStudies.deel?.angles ?? [])}`,
        ),
      ],
      {
        followUps: [
          'Como ele otimizou a performance?',
          'Como ele eleva a qualidade do código?',
          'Me fale mais sobre a liderança dele.',
        ],
        sources: ['resume.deel', 'notes'],
        related: 'deel',
      },
    );
  }

  function leadership(): AssistantResponse {
    return response(
      'leadership',
      [
        text(
          `Sim. A liderança de ${first} abrange formação de times, direção técnica, entregas e desenvolvimento de pessoas.\n\n` +
            '### Formação de times\n' +
            `- Na **${employer('roots')}**, ele ampliou o time de frontend, que tinha um único desenvolvedor, recrutando e integrando ${team.added} desenvolvedores, e depois o liderou por quase dois anos.\n` +
            `- Na **${employer('deel')}**, ele ajudou a liderar o time de HRIS e contribuiu para a contratação e o onboarding.\n\n` +
            '### Direção técnica\n' +
            `- Dirigiu a estratégia e a arquitetura de frontend na **${employer('roots')}**.\n` +
            `- Padronizou a arquitetura frontend do HRIS e liderou a migração da ${employer('roots')} na **${employer('deel')}**.\n` +
            `- Trabalha com os times de vários produtos na **${employer('way2b1')}**, migrando código legado.\n\n` +
            '### Entregas e pessoas\n' +
            `- Definiu trade-offs técnicos, planos de entrega, OKRs e metas trimestrais com Produto na **${employer('deel')}**.\n` +
            `- Coordenou o planejamento de sprints com gestores e stakeholders na **${employer('roots')}**.\n` +
            `- Orientou engenheiros júnior e pleno, conduziu revisões de código e pair programming na **${employer('deel')}**, e definiu padrões de código na **${employer('maison')}**.\n` +
            `- Foi promovido a Principal Frontend Developer na **${employer('shall')}**.`,
        ),
        text(
          `### Como ele lidera\n${practice.leadershipPractice.style}\n\n${bullets(practice.leadershipPractice.habits)}\n\n${practice.leadershipPractice.balance}`,
        ),
        metrics(['roots-team']),
      ],
      {
        followUps: [
          'Mostre exemplos de decisões de arquitetura.',
          `Como ele fez o time crescer na ${employer('roots')}?`,
          'Ele se encaixaria em uma posição de liderança técnica?',
        ],
        sources: [
          'resume.roots',
          'resume.deel',
          'resume.way2b1',
          'resume.maison',
          'resume.shall',
          'notes',
        ],
      },
    );
  }

  function teamGrowth(): AssistantResponse {
    return response(
      'teamGrowth',
      [
        text(
          `Como ${title('roots')} na **${employer('roots')}** (${period('roots')}), ${first} ampliou o time de frontend, que tinha um único desenvolvedor, para ${team.to} desenvolvedores, recrutando e integrando ${team.added}. Depois ele liderou o desenvolvimento frontend por quase dois anos, organizando e delegando o trabalho e coordenando o planejamento de sprints e as entregas com gestores e stakeholders.\n\n` +
            `Na ${employer('deel')}, ele também contribuiu para a contratação e o onboarding de engenheiros.`,
        ),
        text(
          `### O que fazer o time crescer exigiu\n${practice.caseStudies.roots?.problem ?? ''}\n\n${bullets(practice.caseStudies.roots?.angles ?? [])}`,
        ),
        metrics(['roots-team']),
      ],
      {
        followUps: [
          'Ele já liderou times de engenharia?',
          `O que ele fez na ${employer('roots')}?`,
          'Ele já construiu algo do zero?',
        ],
        sources: ['resume.roots', 'resume.deel', 'notes'],
        related: 'roots',
      },
    );
  }

  function achievements(): AssistantResponse {
    return response(
      'achievements',
      [
        text(
          'Os resultados documentados mais claros vêm do trabalho em performance, qualidade e formação de times:',
        ),
        metrics(['deel-critical-load', 'deel-web-vitals', 'deel-people-list', 'roots-team']),
        text(
          '### Outros reconhecimentos\n' +
            `- Contribuiu para uma aplicação web e mobile que recebeu o **${award('shall').won}** na ${employer('shall')}.\n` +
            `- Contribuiu para o projeto de newsletter na ${employer('maison')}, que alcançou um **aumento de ${metric('maison-newsletter')} na receita**.\n` +
            `- Ajudou clientes industriais menores da ${employer('webfi')} a aumentar as vendas em **mais de ${amount('webfi-sales')}**.`,
        ),
        details(
          `Como os ganhos de performance na ${employer('deel')} foram alcançados`,
          `Com refatoração e otimização direcionadas das páginas críticas. O jeito como ele aborda um problema de performance:\n\n${bullets(practice.performanceApproach)}`,
        ),
        note(
          'inference',
          'Estes são resultados do trabalho em equipe relatados no currículo dele; nenhum é atribuído só a ele. Produtividade, ROI ou receita atribuíveis apenas a ele não estão documentados.',
        ),
      ],
      {
        followUps: [
          'Como ele otimizou a performance?',
          'Como ele eleva a qualidade do código?',
          'Me fale sobre a experiência de liderança dele.',
        ],
        sources: [
          'resume.deel',
          'resume.roots',
          'resume.shall',
          'resume.maison',
          'resume.webfi',
          'notes',
        ],
        related: 'deel',
      },
    );
  }

  function qualityImprovement(): AssistantResponse {
    return response(
      'qualityImprovement',
      [
        text(
          `Na **${employer('deel')}**, ${first} padronizou a arquitetura frontend do HRIS — incluindo o gerenciamento de estado e o tratamento de erros — e elevou os padrões de qualidade com revisões de código, pair programming e onboarding. Na **${employer('maison')}**, ele liderou revisões de código e estabeleceu padrões de código para reduzir bugs e melhorar a manutenibilidade.`,
        ),
        text(
          `### O que é uma base de código saudável para ele\n${bullets(practice.qualityPractices)}`,
        ),
      ],
      {
        followUps: [
          'Que melhorias de arquitetura ele introduziu?',
          'Como ele pensa a qualidade de código?',
          `O que ele construiu na ${employer('deel')}?`,
        ],
        sources: ['resume.deel', 'resume.maison', 'notes'],
        related: 'deel',
      },
    );
  }

  function awards(): AssistantResponse {
    return response(
      'awards',
      [
        text(
          `Na **${employer('shall')}**, ${first} contribuiu para uma aplicação web e mobile que recebeu o **${award('shall').won}**.\n\n` +
            `Outros resultados de negócio documentados incluem o projeto de newsletter da ${employer('maison')}, que alcançou um aumento de ${metric('maison-newsletter')} na receita, e a ajuda para clientes menores da ${employer('webfi')} aumentarem as vendas em mais de ${amount('webfi-sales')}.`,
        ),
        note(
          'inference',
          `O ${award('shall').name} foi para o produto em que ele trabalhou, não para ele pessoalmente.`,
        ),
      ],
      {
        followUps: [
          'Quais são as maiores conquistas técnicas dele?',
          `O que ele fez na ${employer('shall')}?`,
          `Me fale sobre a carreira do ${first}.`,
        ],
        sources: ['resume.shall', 'resume.maison', 'resume.webfi'],
        related: 'shall',
      },
    );
  }

  function scaling(): AssistantResponse {
    return response(
      'scaling',
      [
        text(
          `A escala aparece no trabalho de ${first} em três níveis — produto, base de código e time:\n\n` +
            `- **Produto** — na ${employer('deel')}, ele liderou a migração e a escalabilidade da plataforma ${employer('roots')} dentro da ${employer('deel')}, mitigando os riscos de rollout; na ${employer('roots')}, ele moldou a arquitetura frontend para sustentar o crescimento da base de usuários.\n` +
            `- **Base de código** — ele padronizou a arquitetura frontend do HRIS na ${employer('deel')}, introduziu um gerenciamento de estado avançado na ${employer('roots')} e migra código legado em vários produtos na ${employer('way2b1')}.\n` +
            `- **Time** — na ${employer('roots')}, ele ampliou o time de frontend de ${team.from} para ${team.to} e montou pipelines de GitLab CI com deploy no Amazon S3.`,
        ),
        metrics(['deel-critical-load', 'roots-team']),
        text(
          `### O que escalar o HRIS da ${employer('deel')} envolveu\n${bullets(practice.caseStudies.deel?.angles ?? [])}`,
        ),
      ],
      {
        followUps: [
          `O que ele construiu na ${employer('deel')}?`,
          'Como ele aborda a arquitetura frontend?',
          'Como ele otimizou a performance?',
        ],
        sources: ['resume.deel', 'resume.roots', 'resume.way2b1', 'notes'],
        related: 'deel',
      },
    );
  }

  function scratch(): AssistantResponse {
    return response(
      'scratch',
      [
        text(
          'Sim, várias vezes:\n\n' +
            `- Na **${employer('roots')}**, ele construiu de ponta a ponta um frontend em React para uma startup que cria bots de Slack para RH, com a arquitetura, o gerenciamento de estado e os pipelines de CI.\n` +
            `- Na **${employer('shall')}**, ele liderou o desenvolvimento de um progressive web app.\n` +
            `- Por conta própria, ele constrói produtos como o **${productName('evcopilot')}**, o **${productName('formdaily')}** e o **${productName('targup')}**.`,
        ),
        metrics(['roots-team']),
        text(
          `### Começando do zero na ${employer('roots')}\n${practice.caseStudies.roots?.problem ?? ''}\n\nNos produtos próprios, ele começa do mesmo jeito: primeiro o objetivo do produto e os usuários, depois o domínio, depois a arquitetura mais simples que atende.`,
        ),
      ],
      {
        followUps: [
          'Em quais projetos ele está trabalhando?',
          `O que ele fez na ${employer('roots')}?`,
          'Como ele aborda a arquitetura frontend?',
        ],
        sources: ['resume.roots', 'resume.shall', 'projects', 'notes'],
        related: 'roots',
      },
    );
  }

  function enterprise(context: ConversationContext): AssistantResponse {
    return response(
      'enterprise',
      [
        text(
          `Sim. O exemplo corporativo mais substancial é a **${employer('deel')}** (${period('deel')}), onde ele ajudou a liderar o time de HRIS responsável pelas ferramentas centrais de RH da empresa, padronizou a arquitetura frontend do time e liderou a migração da ${employer('roots')} para a plataforma.\n\n` +
            `Na **${employer('way2b1')}**, uma startup menor, ele trabalha full stack em vários produtos, migrando código legado e melhorando a performance.`,
        ),
        text(
          `### O problema corporativo na ${employer('deel')}\n${practice.caseStudies.deel?.problem ?? ''}`,
        ),
        metrics(['deel-web-vitals', 'deel-critical-load', 'deel-people-list']),
        contactOnce(context),
      ],
      {
        followUps: [
          `O que ele construiu na ${employer('deel')}?`,
          'Como ele otimizou a performance?',
          'Ele já liderou times de engenharia?',
        ],
        sources: ['profile', 'resume.deel', 'resume.way2b1', 'notes'],
        related: 'deel',
      },
    );
  }

  function product(): AssistantResponse {
    return response(
      'product',
      [
        text(
          'A colaboração próxima com produto, design e liderança atravessa os cargos dele:\n\n' +
            `- Na **${employer('deel')}**, ele definiu trade-offs técnicos e planos de entrega com Produto e Engenharia, e planejou OKRs e metas trimestrais com os Product Managers.\n` +
            `- Na **${employer('roots')}**, ele coordenou o planejamento de sprints com gestores e stakeholders e incorporou acessibilidade junto com designers de UX.\n` +
            `- Na **${employer('maison')}**, ele transformou requisitos complexos em interfaces acessíveis com designers de UX.\n\n` +
            knowledge.profile.focus.replace(/^Ele/, first),
        ),
        text(
          `### Como ele trabalha com esses times\n${bullets(practice.leadershipPractice.habits)}\n\nEle parte do objetivo do produto, dos usuários e de como é o sucesso antes de escolher uma solução, e trata requisitos como latência, privacidade, acessibilidade e custo de operação como parte do design.`,
        ),
      ],
      {
        followUps: [
          'Qual é a filosofia de engenharia dele?',
          'Ele se encaixaria em uma posição de liderança técnica?',
          `O que ele construiu na ${employer('deel')}?`,
        ],
        sources: ['resume.deel', 'resume.roots', 'resume.maison', 'profile', 'notes'],
      },
    );
  }

  return {
    career,
    roleFit,
    company,
    leadRole,
    leadership,
    teamGrowth,
    achievements,
    qualityImprovement,
    awards,
    scaling,
    scratch,
    enterprise,
    product,
  };
}
