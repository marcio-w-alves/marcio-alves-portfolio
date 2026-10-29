import type { Guard, IntentRules, LanguageRules, Subject } from './intents';
import { WORD_END } from './intents';

/**
 * The router's generic Portuguese rules. Visitors write Portuguese with and
 * without its accents ("experiência", "experiencia"), so the question is read
 * without them and every pattern here is written without them too — which
 * also lets \b close after what was an accented letter.
 */

function withoutAccents(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

// Who the question is about: "ele", "ela", or the owner by name, with or without
// the article Portuguese puts before a name ("a Ada").
const about = (first: string) => `(ele|ela|o ${first}|a ${first}|${first})`;
const of = (first: string) => `(dele|dela|d[oa] ${first})`;

// "atue como" refuses only when addressed to the assistant ("ele atuou como tech
// lead" is a career question). A private word that is also an engineering word
// ("saúde do código", "redefinição de senha") refuses only when the question is
// about him.
function guards({ first }: Subject): Readonly<Record<Guard, RegExp>> {
  return {
    offPurpose: new RegExp(
      `\\b((ignore|ignora|desconsidere|esqueca) (todas |as |os |suas |tuas )*(instrucoes|regras|ordens)|prompt do sistema|system prompt|agora voce e|finja (ser|que)|jailbreak|modo (desenvolvedor|dev)|revele (suas|as|o) (instrucoes|regras|prompt))\\b|(^|[.!?;:] )((por favor|ei|ok|agora|entao|so),? )*(aja|atue|finja) como\\b|\\bvoce (pode |vai )?(agir|atuar|fingir) como\\b`,
      'u',
    ),
    // A city is shareable; a home address is not.
    privateInfo: new RegExp(
      `\\b(salario|salarios|pretensao salarial|remuneracao|valor (da|por) hora|quanto ${about(first)} (cobra|ganha|recebe)|(idade|aniversario|filhos|esposa|marido|namorad[ao]|religiao|politica|saude|senha|telefone|celular|whatsapp|endereco) ${of(first)}|quantos anos ${about(first)} tem|${about(first)} (e|eh) (casad[oa]|solteir[oa]|divorciad[oa]|religios[oa])|${about(first)} tem filhos|quantos filhos|endereco residencial|numero de (telefone|celular|whatsapp))${WORD_END}`,
      'u',
    ),
  };
}

const GREETING = /^(oi|ola|ei|e ai|bom dia|boa tarde|boa noite|hello|hi)[!. ]*$/;

// Spanish, which these rules would misread as Portuguese.
const FOREIGN = /[ñ¿¡]/;

const TASK_REQUEST =
  /^(voce pode |voce poderia |pode |poderia |por favor )?(escreva|escrever|crie|criar|gere|gerar|codifique|programe|faca|fazer|redija|implemente|implementar|construa|traduza|traduzir)\b/;

function whyDecision({ first }: Subject): RegExp {
  return new RegExp(`^por ?que ${about(first)}\\b`, 'u');
}

const NARROW_DETAIL = /\b(notas?|media final|exat\w*)\b/;

const GENERIC_FOLLOW_UP =
  /^(me (fale|conte) mais|fale mais|conte mais|mais|continue|continua|e|e entao|por que|porque|como|explique( melhor| mais)?|detalhes?|mais detalhes|pode detalhar|pode elaborar)[?.! ]*$/;

const COMPARISON = /\b(compar\w*|versus|vs\.?|diferenca\w*|difer\w*)\b/;

// "O que é TypeScript?" asks for a definition; "o que ele faz" is about him.
function definition({ first }: Subject): RegExp {
  return new RegExp(
    `^(o que e|o que sao|que e|defina|explique o que e) (?!(ele|ela|o ${first}|a ${first})\\b|${first})`,
    'u',
  );
}

function companyProfile(anyCompany: string): RegExp {
  return new RegExp(
    `\\b(que (tipo|especie) de (empresa|negocio|startup)|o que (a empresa|a |o )?(${anyCompany}) faz)\\b`,
  );
}

const intentRules = ({ first }: Subject): IntentRules => ({
  identity: [
    [new RegExp(`\\bvoce e (o |a )?(${first}|(ele|ela|um bot|uma ia|real|humano)\\b)`, 'u'), 5],
    [/\bquem e voce\b/, 5],
    [/\bo que e voce\b/, 4],
    [/\bestou (falando|conversando) com\b/, 4],
  ],
  resume: [
    [/\b(curriculo|cv)\b/, 5],
    [/\bpdf\b/, 2],
  ],
  contact: [
    [/\bcontato\b/, 4],
    [/\bentrar em contato\b/, 4],
    [new RegExp(`\\b(falar|conversar) com ${about(first)}`, 'u'), 4],
    [/\be-?mail\b/, 3],
    [/\blinkedin\b/, 3],
    [/\bdisponib\w*|\bdisponive\w*/, 2],
  ],
  location: [
    [new RegExp(`\\bonde ${about(first)} (mora|vive|esta|fica|e de)\\b`, 'u'), 5],
    [/\b(qual|que|em que) cidade\b/, 5],
    [/\b(mora em|morando em|baseado em|baseada em|cidade natal)\b/, 4],
    [/\bcidade\b/, 3],
    [/\bpais\b/, 2],
  ],
  accessibility: [
    [/\bacessib\w*/, 5],
    [/\b(a11y|wcag)\b/, 5],
    [/\bleitor(es)? de tela\b/, 3],
  ],
  testing: [
    [/\btest(e|es|ar|ando|ado|ou|a)\b/, 4],
    [/\b(tdd|e2e|testes? unitarios?)\b/, 4],
  ],
  mobile: [
    [/\bmobile\b/, 4],
    [/\b(pwa|ios|iphone|android|apps? nativos?|aplicativos?)\b/, 3],
    [/\bapps?\b/, 0.5],
  ],
  designSystems: [
    [/\bdesign systems?\b|\bsistemas? de design\b/, 5],
    [/\bbibliotecas? de componentes\b/, 4],
    [/\bui kit\b/, 2],
  ],
  nextjs: [
    [/\bnext\.?js\b/, 4],
    [/\b(ssr|renderiza\w* (no|do lado do) servidor)\b/, 4],
    [/\bseo\b/, 2],
  ],
  codeQuality: [
    [/\bqualidade (de|do) codigo\b/, 5],
    [/\b(codigo limpo|clean code)\b/, 4],
    [/\bqualidade\b/, 2],
  ],
  qualityImprovement: [
    [/\bbacklog\b/, 4],
    [/\bbugs?\b/, 2],
    [/\b(tickets|chamados) de suporte\b/, 2],
  ],
  awards: [
    [/\bpremi\w*/, 4],
    [/\breconhec\w*/, 2],
  ],
  teamGrowth: [
    [/\bcresc\w*\b.*\b(time|equipe)\b/, 4],
    [/\b(time|equipe)\b.*\bcresc\w*/, 4],
    [/\bcontrata(cao|coes|ndo)\b/, 2],
  ],
  // Too weak alone: a lead role is recognized by the team's name, which only
  // the owner's vocabulary knows.
  leadRole: [[/\b(papel|funcao|cargo)( dele| dela)? (no|na) (time|equipe)\b/, 1]],
  product: [
    [/\b(times?|equipes?|gerentes?|pessoas) de produto\b|\bproduct managers?\b/, 4],
    [/\b(stakeholders?|partes interessadas)\b/, 3],
    [/\btrabalh\w* com (produto|design)\w*/, 3],
    [/\bokrs?\b/, 2],
  ],
  scratch: [
    [/\bdo zero\b/, 4],
    [/\bgreenfield\b/, 4],
    [/\bdo zero ao um\b/, 3],
    [/\bconstruiu algo\b/, 1],
  ],
  scaling: [[/\bescal(a|ar|ando|ou|ada|adas|avel|aveis|abilidade|onamento)\b/, 3]],
  enterprise: [
    [/\b(corporativ\w*|enterprise)\b/, 4],
    [/\b(grande|larga) escala\b/, 2],
    [/\b(produtos?|aplicac\w*|sistemas?) complex\w*/, 2],
  ],
  roleFit: [
    [/\bstaff\b/, 3],
    [/\bescopo\b/, 3],
    [/\bencaix\w*/, 3],
    [/\bbom (candidato|perfil|nome)\b|\bboa (contratacao|escolha)\b/, 3],
    [/\bforte\b.*\b(engenheir\w*|candidat\w*)\b/, 1],
    [/\b(posicao|vaga)\b/, 1],
    [/\bcontrat(ar|a-lo|a-la|alo|ala)\b/, 2],
    [/\bpor que (deveriamos|devemos|eu deveria|deveria)\b/, 2],
  ],
  aiEngineering: [
    [/\b(codex|claude( code)?|cursor|copilot)\b/, 5],
    [/\b(ia|ai|llms?|inteligencia artificial|genai)\b/, 4],
    [/\b(agentes?|agentic|prompts?|rag)\b/, 2],
  ],
  philosophy: [
    [/\bfilosofi\w*/, 5],
    [/\bprincipios?\b/, 3],
    [/\bmentalidade\b/, 3],
    [/\bvalores\b/, 2],
    [/\b(acredita|crencas?)\b/, 2],
    [/\bcomo (ele|ela) (pensa|trabalha)\b/, 2],
  ],
  architecture: [
    [/\barquitet\w*/, 3],
    [/\b(design de sistemas|system design)\b/, 3],
    [/\bgerenciamento de estado\b/, 2],
    [/\bcomposicao\b/, 2],
    [/\bdecis(ao|oes)\b/, 1],
    [/\bpadr(ao|oes)\b/, 1],
    [/\bestrutur\w*/, 1],
  ],
  performance: [
    [/\b(performance|desempenho)\b/, 3],
    [/\b(web vitals|vitals|core web)\b/, 3],
    [/\botimiz\w*/, 3],
    [/\b(velocidade|mais rapid\w*|carregamento|tempos? de carga)\b/, 2],
    [/\blighthouse\b/, 2],
  ],
  backend: [
    [/\bback-?end\b/, 4],
    [/\bnode(\.?js)?\b/, 3],
    [/\bfull[- ]?stack\b/, 3],
    [/\bapis?\b/, 2],
    [/\b(bancos? de dados|postgres\w*|sql|redis)\b/, 2],
    [/\bmicro-?servic\w*/, 2],
    [/\b(infraestrutura|aws|ci\/cd|devops)\b/, 1.5],
    [/\bservidor\b/, 1],
  ],
  react: [
    [/\breact\b/, 3],
    [/\b(typescript|ts)\b/, 2],
    [/\b(javascript|js)\b/, 1.5],
  ],
  skills: [
    [/\blinguage(m|ns) de programacao\b/, 5],
    [/\b(competencias?|habilidades?)\b/, 3],
    [/\bstack\b/, 3],
    [/\btecnologi\w*/, 2],
    [/\b(especialidades?|expertise)\b/, 2],
    [/\b(bom|boa) em\b/, 2],
    // Alone, "ferramentas" is too weak to answer on: "ferramentas internas" is not his stack.
    [/\bferramentas?\b/, 1],
    [/\bmais fortes?\b/, 1],
  ],
  leadership: [
    [/\blider\w*/, 2],
    [/\bmentor\w*/, 2],
    [/\b(gerenci|gest)\w*/, 1.5],
    [/\b(times?|equipes?)\b/, 1],
  ],
  achievements: [
    [/\bconquist\w*/, 3],
    [/\brealizac\w*/, 3],
    [/\bmensur\w*/, 3],
    [/\bimpacto\b/, 2],
    [/\bresultados?\b/, 2],
    [/\bmetricas?\b/, 2],
    [/\borgulh\w*/, 2],
    [/\bmelhorias?\b/, 1],
    [/\bmaior(es)?\b/, 1],
  ],
  projects: [
    [/\bprojetos?\b/, 3],
    [/\btrabalhando em\b/, 2],
    [/\bparalel\w*/, 2],
    [/\bconceitos?\b/, 2],
    [/\bprodutos? (proprios?|dele|dela)\b/, 3],
    [/\bprodutos?\b/, 1.5],
    [/\bconstruindo\b/, 1],
  ],
  languages: [
    [/\b(fala|falam)\b/, 3],
    [/\b(idiomas?|linguas?)\b/, 3],
    [/\b(ingles|frances|espanhol|portugues)\b/, 3],
  ],
  education: [
    [/\b(formacao|educacao)\b/, 4],
    [/\b(graduacao|diploma|bacharel\w*)\b/, 4],
    [/\b(universidade|faculdade)\b/, 4],
    [/\bestud(ou|a|ar|os)\b/, 3],
    [/\b(formou|gradu\w*)\b/, 3],
    [/\b(certifica\w*|cursos?)\b/, 4],
  ],
  career: [
    [/\bcarreira\b/, 3],
    [new RegExp(`\\bquem e ${about(first)}`, 'u'), 3],
    [/\b(trajetoria|historico|historia)\b/, 2],
    [/\blinha do tempo\b/, 2],
    [/\bjornada\b/, 2],
    [/\b(visao geral|resumo|resum\w*)\b/, 2],
    [new RegExp(`\\b(fale|conte)( me)? (sobre|de|do|da) ${about(first)}`, 'u'), 2],
    [/\bexperiencia\b/, 0.5],
  ],
});

export const portugueseRules: LanguageRules = {
  prepare: withoutAccents,
  foreign: FOREIGN,
  greeting: GREETING,
  taskRequest: TASK_REQUEST,
  narrowDetail: NARROW_DETAIL,
  genericFollowUp: GENERIC_FOLLOW_UP,
  comparison: COMPARISON,
  guards,
  whyDecision,
  definition,
  companyProfile,
  intents: intentRules,
};
