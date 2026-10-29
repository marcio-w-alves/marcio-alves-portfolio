import type { AssistantResponse } from '@/core/assistant/response';
import type { ConversationContext } from '@/core/chat/request';
import { bullets, details, numbered, text, type ResponseKit } from '@/core/assistant/response-kit';
import { capitalized, createFacts, inWords } from './facts';
import { LEVEL } from './topics';

/** The Portuguese answers about expertise, products, background and contact. */
export function createExpertiseAnswers(kit: ResponseKit) {
  const {
    productDepth,
    projectById,
    roleById,
    allRoleSources,
    siteSources,
    contactCard,
    contactOnce,
    metrics,
    projects: projectCards,
    response,
    skills: skillGroups,
    timeline,
    knowledge,
    note,
    table,
  } = kit;
  const { practice } = knowledge;
  const {
    first,
    employer,
    period,
    years,
    product,
    metric,
    award,
    amount,
    before,
    after,
    countsInWords,
  } = createFacts(kit);
  const team = countsInWords('roots-team');
  const liveProducts = capitalized(
    inWords(knowledge.projects.filter((project) => project.live).length),
  );
  const peopleList = countsInWords('deel-people-list');
  const criticalLoad =
    metric('deel-critical-load') === '50%'
      ? 'reduziu pela metade o tempo de carregamento das páginas críticas'
      : `reduziu em ${metric('deel-critical-load')} o tempo de carregamento das páginas críticas`;
  const toolsFor = (area: string) => practice.toolset.find((tools) => tools.area === area)?.items;

  function react(): AssistantResponse {
    return response(
      'react',
      [
        text(
          `O React está no centro do trabalho documentado de ${first}, de ${years('shall').from} até hoje. Em vez de uma afirmação genérica de domínio, aqui está a evidência por área:\n\n` +
            `- **Interfaces de produto complexas** — ajudou a liderar o time de HRIS na ${employer('deel')} e padronizou a arquitetura, o gerenciamento de estado e o tratamento de erros.\n` +
            `- **Performance** — melhorou os Web Vitals em ${metric('deel-web-vitals')} e ${criticalLoad} na ${employer('deel')}.\n` +
            `- **Gerenciamento de estado** — implementou um gerenciamento de estado avançado na ${employer('roots')}, onde construiu o frontend de ponta a ponta.\n` +
            `- **Next.js e SSR** — construiu revistas digitais responsivas com Next.js e server-side rendering na ${employer('maison')}.\n` +
            `- **Modernização** — refatorou uma base de código para React Hooks na ${employer('shall')}.`,
        ),
        skillGroups(['frontend', 'architecture']),
        text(
          `### As ferramentas de React com que ele trabalha\n${toolsFor('Frontend e UI') ?? ''}.`,
        ),
      ],
      {
        followUps: [
          'Como ele aborda a arquitetura frontend?',
          `O que ele construiu na ${employer('deel')}?`,
          'Ele já trabalhou com sistemas de backend?',
        ],
        sources: [
          'resume.deel',
          'resume.roots',
          'resume.maison',
          'resume.shall',
          'resume.skills',
          'notes',
        ],
        related: 'deel',
      },
    );
  }

  const EXAMPLE_CODE = [
    '// Ilustrativo: o componente da funcionalidade só orquestra primitivos.',
    '// Layout, acesso a dados e efeitos colaterais ficam em outro lugar.',
    'export function ProductCard({ product, onAddToCart }: ProductCardProps) {',
    '  return (',
    '    <Card>',
    '      <Card.Media>',
    '        <Image src={product.imageUrl} alt={product.name} />',
    '      </Card.Media>',
    '      <Card.Body>',
    '        <Text variant="title">{product.name}</Text>',
    '        <Price amount={product.price} />',
    '      </Card.Body>',
    '      <Card.Actions>',
    '        <Button onClick={() => onAddToCart(product.id)}>Adicionar ao carrinho</Button>',
    '      </Card.Actions>',
    '      <CommentList comments={product.comments} />',
    '    </Card>',
    '  );',
    '}',
  ].join('\n');

  function architecture(): AssistantResponse {
    return response(
      'architecture',
      [
        text(
          `O trabalho de arquitetura de ${first} segue um fio consistente: padronizar as fundações, manter os componentes modulares e ligar as decisões estruturais a resultados mensuráveis no produto.\n\n` +
            '### Decisões documentadas\n' +
            `- **${employer('way2b1')}** — migra código legado para uma base moderna e sustentável em vários produtos.\n` +
            `- **${employer('deel')}** — padronizou a arquitetura frontend do HRIS para melhorar a estrutura, o gerenciamento de estado, o tratamento de erros e a escalabilidade.\n` +
            `- **${employer('roots')}** — dirigiu a estratégia de frontend, introduziu um gerenciamento de estado avançado e montou pipelines de GitLab CI com deploy no Amazon S3.\n` +
            `- **${employer('maison')}** — implementou SSR com Next.js e integrou o frontend a plataformas externas de publicação.\n` +
            `- **${employer('shall')}** — levou a base de código para React Hooks e construiu apps dentro de uma arquitetura de microsserviços.`,
        ),
        text(
          `### O que ele considera arquitetura frontend\n${bullets(practice.frontendArchitecture)}`,
        ),
        text(
          `### Como ele projeta um sistema\n${numbered(practice.designProcess)}\n\nOs trade-offs que ele mais pesa: ${practice.decisionCriteria.map((criterion) => criterion.charAt(0).toLowerCase() + criterion.slice(1)).join('; ')}.`,
        ),
        details(
          `O problema de engenharia na ${employer('roots')}, na ${employer('deel')} e na ${employer('way2b1')}`,
          (['roots', 'deel', 'way2b1'] as const)
            .map((id) => {
              const study = practice.caseStudies[id];
              return study
                ? `**${roleById(id).company}** — ${study.problem}\n\n${bullets(study.angles)}`
                : '';
            })
            .join('\n\n'),
        ),
        note(
          'example',
          'O trecho abaixo ilustra o princípio de composição. Ele não foi tirado da base de código de nenhum empregador.',
        ),
        text(`\`\`\`tsx\n${EXAMPLE_CODE}\n\`\`\``),
      ],
      {
        followUps: [
          'Como ele otimizou a performance?',
          'Qual é a filosofia de engenharia dele?',
          'O que ele sabe sobre design systems?',
        ],
        sources: [
          'resume.deel',
          'resume.roots',
          'resume.maison',
          'resume.shall',
          'principles',
          'notes',
        ],
        related: 'deel',
      },
    );
  }

  function performance(): AssistantResponse {
    return response(
      'performance',
      [
        text(
          `A performance é um dos temas mais consistentemente documentados no trabalho de ${first}:`,
        ),
        metrics(['deel-web-vitals', 'deel-critical-load', 'deel-people-list', 'way2b1-bundle']),
        text(
          '### Como ele chegou lá\n' +
            `- **${employer('way2b1')}** — refatorou e otimizou fluxos críticos em toda a plataforma; bundle quase ${amount('way2b1-bundle')} menor e tempos de carregamento reduzidos a algumas centenas de milissegundos.\n` +
            `- **${employer('deel')}** — refatoração e otimização direcionadas das páginas críticas; a página People List passou de ${peopleList.from} segundos para ${peopleList.to} sem cache.\n` +
            `- **${employer('maison')}** — server-side rendering para melhorar o SEO e a velocidade do carregamento inicial de produtos editoriais lidos por milhares de pessoas todos os dias.`,
        ),
        text(
          `### Como ele aborda um problema de performance\n${bullets(practice.performanceApproach)}`,
        ),
      ],
      {
        followUps: [
          `O que ele construiu na ${employer('deel')}?`,
          'Ele tem experiência com Next.js e SSR?',
          'Como ele aborda a arquitetura frontend?',
        ],
        sources: ['resume.way2b1', 'resume.deel', 'resume.maison', 'resume.skills', 'notes'],
        related: 'deel',
      },
    );
  }

  function backend(): AssistantResponse {
    return response(
      'backend',
      [
        text(
          `Sim, com uma distinção clara: ${first} é especialista em frontend e também tem experiência prática full stack. ${practice.fullStack.summary}`,
        ),
        text(`### Empresa por empresa\n${bullets(practice.fullStack.byCompany)}`),
        text(`### Nos produtos próprios\n${practice.fullStack.ownProducts}`),
        skillGroups(['backend']),
        note(
          'inference',
          `A especialização mais profunda dele é frontend; o cargo atual na ${employer('way2b1')} é full stack, e na ${employer('roots')} e na ${employer('deel')} o backend pertencia a outros times.`,
        ),
      ],
      {
        followUps: [
          `O que ele fez na ${employer('shall')}?`,
          'Quais são as competências técnicas mais fortes dele?',
          'Como ele aborda a arquitetura frontend?',
        ],
        sources: [
          'resume.shall',
          'resume.way2b1',
          'resume.roots',
          'resume.deel',
          'resume.skills',
          'notes',
        ],
        related: 'shall',
      },
    );
  }

  function mobile(): AssistantResponse {
    return response(
      'mobile',
      [
        text(
          `Sim. Na **${employer('shall')}**, ${first} construiu aplicações web e mobile — entre elas uma que recebeu o ${award('shall').won} — e liderou o desenvolvimento de um progressive web app antes de o produto migrar para um app Android nativo.\n\n` +
            `Os produtos próprios dele também são mobile-first: o **${product('evcopilot')}** está em beta para iPhone só com convite, e o **${product('formdaily')}** lista web, iOS e Android. ${practice.mobileExplorations}`,
        ),
        projectCards(['evcopilot', 'formdaily']),
      ],
      {
        followUps: [
          'Em quais projetos ele está trabalhando?',
          `O que ele fez na ${employer('shall')}?`,
          'Qual é a experiência dele com React e TypeScript?',
        ],
        sources: ['resume.shall', 'projects', 'notes'],
        related: 'shall',
      },
    );
  }

  function skills(): AssistantResponse {
    return response(
      'skills',
      [
        text(
          `Aqui estão as competências de ${first} agrupadas por área. Não há percentuais autoatribuídos — a linha do tempo da experiência guarda a evidência de cada uma.`,
        ),
        skillGroups(),
        text(
          `As áreas documentadas mais fortes dele são **arquitetura com React e Next.js** e **performance**, ambas sustentadas por resultados mensuráveis na ${employer('deel')} e na ${employer('roots')}.`,
        ),
        text(
          `### Até onde vai a evidência\n${bullets(practice.skillDepth.map(({ area, items }) => `**${area}** — ${items}`))}`,
        ),
        text(
          `### Ferramentas\n${bullets(practice.toolset.map(({ area, items }) => `**${area}** — ${items}`))}`,
        ),
      ],
      {
        followUps: [
          'Qual é a experiência dele com React e TypeScript?',
          'Como ele otimizou a performance?',
          'Como ele aborda a acessibilidade?',
        ],
        sources: ['resume.skills', 'resume.deel', 'resume.roots', 'notes'],
      },
    );
  }

  function nextjs(): AssistantResponse {
    return response(
      'nextjs',
      [
        text(
          `Sim. Na **${employer('maison')}** (${period('maison')}), ${first} construiu revistas digitais e newsletters responsivas com Next.js e React, distribuídas em vários países. Ele implementou server-side rendering para melhorar o SEO e a velocidade do carregamento inicial, integrou o frontend a plataformas externas de publicação e manteve os produtos editoriais rápidos para milhares de leitores diários.`,
        ),
        text(
          `### Como ele decide o que renderiza onde\n${bullets(practice.frontendArchitecture.filter((decision) => /SSR|estado/.test(decision)))}`,
        ),
        skillGroups(['frontend', 'architecture']),
      ],
      {
        followUps: [
          'Como ele otimizou a performance?',
          `O que ele fez na ${employer('maison')}?`,
          'Qual é a experiência dele com React e TypeScript?',
        ],
        sources: ['resume.maison', 'resume.skills', 'notes'],
        related: 'maison',
      },
    );
  }

  function designSystems(): AssistantResponse {
    return response(
      'designSystems',
      [
        text(
          `O trabalho documentado dele em fundações de UI compartilhadas é de arquitetura: na **${employer('deel')}**, ele padronizou a arquitetura frontend do HRIS — estrutura, gerenciamento de estado e tratamento de erros — entre as áreas do produto, e na **${employer('maison')}** estabeleceu padrões de código e liderou revisões de código.\n\n` +
            'Construir componentes e módulos reutilizáveis sem abrir mão da legibilidade faz parte do jeito como ele trabalha, e design systems estão entre os temas que ele acompanha de perto.',
        ),
      ],
      {
        followUps: [
          'Como ele aborda a acessibilidade?',
          'Como ele aborda a arquitetura frontend?',
          `No que ele está trabalhando na ${employer('way2b1')}?`,
        ],
        sources: ['resume.deel', 'resume.maison', 'notes'],
        related: 'deel',
      },
    );
  }

  function accessibility(): AssistantResponse {
    return response(
      'accessibility',
      [
        text(
          `A acessibilidade aparece em dois dos cargos de ${first}:\n\n` +
            `- **${employer('roots')}** — integrou padrões de acessibilidade junto com designers de UX.\n` +
            `- **${employer('maison')}** — construiu interfaces intuitivas e acessíveis a partir de requisitos complexos com designers de UX.\n\n` +
            'Ele trata a acessibilidade como um requisito da fundação, e não como uma correção tardia em telas isoladas, e a confere junto com o design, os testes e a performance antes de dar uma funcionalidade como pronta.',
        ),
      ],
      {
        followUps: [
          'O que ele sabe sobre design systems?',
          'Como ele aborda a arquitetura frontend?',
          'Como ele trabalha com times de produto?',
        ],
        sources: ['resume.roots', 'resume.maison', 'notes'],
        related: 'roots',
      },
    );
  }

  function testing(): AssistantResponse {
    return response(
      'testing',
      [
        text(
          `Estratégias de teste de frontend estão entre as competências centrais de ${first}. Na prática, o trabalho de qualidade documentado dele inclui o tratamento de erros padronizado na ${employer('deel')}, revisões de código e pair programming, e os padrões de código que ele definiu na ${employer('maison')} para reduzir bugs.`,
        ),
        text(
          '### Como ele aborda os testes\n' +
            '- **Na medida do risco** — testes unitários, de integração, de contrato e end-to-end escolhidos pelo quanto cada fluxo pode quebrar, não por uma meta de cobertura.\n' +
            '- **Testado nas fronteiras** — módulos com interfaces claras, para que o comportamento possa ser conferido sem montar a aplicação inteira.\n' +
            '- **Conferido antes da entrega** — typecheck, lint, builds reproduzíveis e os fluxos críticos verificados antes de ir para produção.\n' +
            '- **Acompanhado depois da entrega** — monitoramento de erros e Web Vitals para pegar regressões.\n\n' +
            `Ferramentas na prática dele: ${toolsFor('Testes e qualidade') ?? ''}.`,
        ),
      ],
      {
        followUps: [
          'Como ele pensa a qualidade de código?',
          'Como ele eleva a qualidade do código?',
          'Quais são as competências técnicas mais fortes dele?',
        ],
        sources: ['resume.skills', 'resume.deel', 'resume.maison', 'notes'],
      },
    );
  }

  const PRINCIPLES_IN_PRACTICE: Readonly<Record<string, string>> = {
    'Manutenibilidade acima de esperteza': `Padrões de código e revisões de código na ${employer('maison')}; a migração para React Hooks na ${employer('shall')}.`,
    'Composição em vez de monólitos': `Código legado levado para uma base de código moderna e modular em vários produtos na ${employer('way2b1')}.`,
    'Reaproveitar antes de reescrever': `Uma única arquitetura frontend padronizada para o HRIS entre as áreas do produto na ${employer('deel')}.`,
    'Arquitetura do tamanho do problema': `Um frontend em React construído desde um estágio inicial na ${employer('roots')} e depois organizado para um time de ${team.to}.`,
    'Performance desde o design': `Páginas críticas ${metric('deel-critical-load')} mais rápidas e a People List de ${before('deel-people-list')} para ${after('deel-people-list')} na ${employer('deel')}; SSR para produtos editoriais na ${employer('maison')}.`,
    'UX e fidelidade visual': `Acessibilidade incorporada com designers de UX na ${employer('roots')} e na ${employer('maison')}.`,
    'Qualidade verificável': `Pair programming, revisões de código e onboarding na ${employer('deel')}; pipelines de GitLab CI na ${employer('roots')}.`,
    'Trade-offs explícitos': `Trade-offs técnicos e planos de entrega definidos com Produto e Engenharia na ${employer('deel')}.`,
    'Segurança no servidor':
      'Nos designs dos produtos próprios: permissões conferidas no backend, acesso por papel e isolamento entre clientes.',
  };

  function philosophy(): AssistantResponse {
    return response(
      'philosophy',
      [
        text(
          `A filosofia de ${first} é pragmática: código legível que outras pessoas conseguem evoluir, arquitetura do tamanho do estágio real do produto e qualidade que ele consegue verificar em vez de presumir. Cada princípio abaixo vem acompanhado de onde ele aparece no trabalho dele.`,
        ),
        text(
          `### Cada princípio na prática\n${bullets(
            knowledge.principles.map(
              (principle) =>
                `**${principle.title}** — ${principle.text} **Na prática:** ${PRINCIPLES_IN_PRACTICE[principle.title] ?? ''}`,
            ),
          )}`,
        ),
        text(`### Como ele leva um problema até a entrega\n${numbered(practice.designProcess)}`),
        text(`### No dia a dia\n${numbered(practice.workflow)}`),
        note(
          'inference',
          'O processo e a rotina do dia a dia resumem como ele descreve o próprio trabalho; não são um método formal adotado por algum empregador.',
        ),
      ],
      {
        followUps: [
          'Mostre exemplos de decisões de arquitetura.',
          'Como ele usa IA na engenharia?',
          'Como ele pensa a qualidade de código?',
        ],
        sources: [
          'principles',
          'resume.way2b1',
          'resume.deel',
          'resume.roots',
          'resume.maison',
          'resume.shall',
          'notes',
        ],
      },
    );
  }

  function aiEngineering(): AssistantResponse {
    const ai = practice.aiEngineering;
    return response(
      'aiEngineering',
      [
        text(ai.summary),
        text(`### Ferramentas\n${bullets(ai.tools)}`),
        text(`### Como ele trabalha com agentes\n${bullets(ai.practices)}`),
        text(`### IA dentro dos produtos\n${ai.inProducts}`),
      ],
      {
        followUps: [
          'Qual é a filosofia de engenharia dele?',
          'Como ele aborda a arquitetura frontend?',
          'Em quais projetos ele está trabalhando?',
        ],
        sources: ['notes'],
      },
    );
  }

  function codeQuality(): AssistantResponse {
    return response(
      'codeQuality',
      [
        text(
          `Os princípios de engenharia de ${first} tratam a qualidade como uma questão estrutural: código legível e explícito; componentes pequenos e componíveis; lógica compartilhada centralizada em vez de duplicada; e segurança garantida no servidor.\n\n` +
            `Na prática, isso significou tratamento de erros e gerenciamento de estado padronizados, revisões de código e pair programming, padrões de código na ${employer('maison')} e a migração para React Hooks na ${employer('shall')}. Estratégias de teste de frontend fazem parte das competências centrais dele.`,
        ),
        text(
          `### O que é uma base de código saudável para ele\n${bullets(practice.qualityPractices)}`,
        ),
      ],
      {
        followUps: [
          'Qual é a filosofia de engenharia dele?',
          'Como ele otimizou a performance?',
          'Como ele aborda a arquitetura frontend?',
        ],
        sources: [
          'principles',
          'resume.deel',
          'resume.maison',
          'resume.shall',
          'resume.skills',
          'notes',
        ],
      },
    );
  }

  function projects(): AssistantResponse {
    return response(
      'projects',
      [
        text(
          `Além do trabalho profissional, ${first} constrói os próprios produtos. ${liveProducts} já têm sites públicos — o **${product('evcopilot')}** (beta para iPhone), o **${product('formdaily')}** (só com convite), o **${product('targup')}** (em desenvolvimento) e o **${product('marciomariani-dev')}**, este site — e o **${product('fictiondraft')}** ainda é um conceito.`,
        ),
        projectCards(),
        text(
          `### A engenharia por trás deles\n${bullets(knowledge.projects.map((item) => `**${item.name}** — ${productDepth(item.id)}`))}`,
        ),
      ],
      {
        followUps: [
          `Me conte mais sobre o ${product('evcopilot')}.`,
          `Me conte mais sobre o ${product('formdaily')}.`,
          `O que é o ${product('targup')}?`,
        ],
        sources: ['projects', 'notes'],
      },
    );
  }

  function project(projectId: string): AssistantResponse {
    const subject = projectById(projectId);
    const next = knowledge.projects.find((other) => other.id !== projectId && other.live);
    const lead = subject.live
      ? `O **${subject.name}** é um dos produtos próprios de ${first}. ${subject.description}`
      : `O **${subject.name}** é um dos conceitos de produto de ${first}: ${subject.description.charAt(0).toLowerCase()}${subject.description.slice(1)}`;
    return response(
      `project:${projectId}`,
      [
        text(lead),
        projectCards([projectId]),
        text(`### A engenharia por trás dele\n${productDepth(projectId)}`),
      ],
      {
        followUps: [
          next ? `Me conte mais sobre o ${next.name}.` : 'Em quais projetos ele está trabalhando?',
          'Em quais projetos ele está trabalhando?',
          'Ele já construiu algo do zero?',
        ],
        // The card's description and features were read from the product's own site.
        sources: ['projects', 'notes', ...siteSources({ kind: 'project', id: projectId })],
      },
    );
  }

  function languageTable() {
    return table(
      ['Idioma', 'Nível'],
      knowledge.languages.map((language) => [language.name, LEVEL[language.level]]),
      'Idiomas',
    );
  }

  function education(): AssistantResponse {
    const { degree, school, schoolShort, location, year } = knowledge.education;
    const courses = knowledge.certifications
      .map((certification) => `- ${certification.name} (${certification.issuer})`)
      .join('\n');
    return response(
      'education',
      [
        text(
          `${first} tem **${degree}** pela ${school} (${schoolShort}), ${location}, concluído em ${String(year)}.`,
        ),
        languageTable(),
        details('Cursos e certificações', courses),
        text(`### Aprendizado contínuo\n${practice.learningStyle}\n\n${bullets(practice.studies)}`),
      ],
      {
        followUps: [
          `Me fale sobre a carreira do ${first}.`,
          'Posso ver o currículo dele?',
          `Como posso falar com o ${first}?`,
        ],
        sources: ['resume.education', 'resume.languages', 'resume.certifications', 'notes'],
      },
    );
  }

  function languages(question: string): AssistantResponse {
    // \b only knows ASCII letters, and Portuguese language names end in ê or ã.
    const asked = knowledge.languages.find((language) =>
      new RegExp(`(?<!\\p{L})${language.name}(?!\\p{L})`, 'iu').test(question),
    );
    let lead = `${first} trabalha em ${inWords(knowledge.languages.length)} idiomas:`;
    if (asked?.level === 'Native') lead = `${asked.name} é a língua nativa dele.`;
    else if (asked) lead = `Sim — ${asked.name} em nível ${LEVEL[asked.level].toLowerCase()}.`;
    return response('languages', [text(lead), languageTable()], {
      followUps: [
        'Onde ele estudou?',
        `Me fale sobre a carreira do ${first}.`,
        `Como posso falar com o ${first}?`,
      ],
      sources: ['resume.languages'],
    });
  }

  function location(): AssistantResponse {
    const { location: where, availability } = knowledge.profile;
    const based = where.city
      ? `${first} está baseado em **${where.city}, ${where.country}**.`
      : `${first} está baseado no **${where.country}**. A cidade dele não está documentada no portfólio, então não vou chutar.`;
    return response('location', [text(`${based}\n\nDisponibilidade: **${availability}**.`)], {
      followUps: [
        `Como posso falar com o ${first}?`,
        'Quais idiomas ele fala?',
        `Me fale sobre a carreira do ${first}.`,
      ],
      sources: ['profile'],
    });
  }

  function contact(): AssistantResponse {
    return response(
      'contact',
      [
        text(
          `A melhor forma de falar com o ${first} é por e-mail ou pelo LinkedIn. Disponibilidade: **${knowledge.profile.availability}**.`,
        ),
        contactCard(),
      ],
      {
        followUps: [
          'Posso ver o currículo dele?',
          'Ele se encaixaria em uma posição de liderança técnica?',
          `Me fale sobre a carreira do ${first}.`,
        ],
        sources: ['profile'],
      },
    );
  }

  function resume(context: ConversationContext): AssistantResponse {
    const url = knowledge.contact.resumeUrl;
    return response(
      'resume',
      [
        text(
          url
            ? `Claro — você pode [abrir o currículo dele em PDF](${url}). Aqui está o histórico profissional que ele cobre:`
            : 'O currículo dele em PDF ainda não está publicado neste site, então você pode pedi-lo por e-mail. Enquanto isso, aqui está o histórico profissional documentado:',
        ),
        timeline(),
        contactOnce(context),
      ],
      {
        followUps: [
          'Quais são as maiores conquistas técnicas dele?',
          'Quais são as competências técnicas mais fortes dele?',
          'Onde ele estudou?',
        ],
        sources: allRoleSources(),
      },
    );
  }

  return {
    react,
    architecture,
    performance,
    backend,
    mobile,
    skills,
    nextjs,
    designSystems,
    accessibility,
    testing,
    philosophy,
    aiEngineering,
    codeQuality,
    projects,
    project,
    education,
    languages,
    location,
    contact,
    resume,
  };
}
