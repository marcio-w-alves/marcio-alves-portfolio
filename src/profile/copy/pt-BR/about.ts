import { MAX_HISTORY_MESSAGES } from '@/core/chat/request';
import {
  MAX_CALLS_PER_ROUND,
  MAX_OUTPUT_TOKENS,
  MAX_ROUNDS,
} from '@/core/assistant/system2/model-assistant';
import type { AboutPageCopy } from '@/site/about-page';
import { REPOSITORY } from '../en/about';

/** The page about how this site itself is built, in Portuguese. */
export const about: AboutPageCopy = {
  label: 'Sobre este site',
  title: 'Como este portfólio é construído',
  description:
    'Como este portfólio é construído: Next.js, TypeScript e Tailwind, um assistente de IA ancorado em fatos, como ele poupa tokens e como Marcio constrói com IA.',
  markdown: `Este site é um portfólio com o qual você pode conversar. Em vez de uma página estática sobre o Marcio, um assistente responde perguntas sobre a carreira dele — e só pode dizer o que o histórico dele documenta. Esta página explica como tudo se encaixa. O código é público no [GitHub](${REPOSITORY}).

## O stack

- **Next.js 16** com o App Router e **React 19**: as páginas são Server Components, pré-renderizadas no build, e só o chat é interativo no navegador.
- **TypeScript** em modo strict em todo o código, com **Zod** validando tudo o que vem de fora — requisições, as chamadas de ferramentas do modelo, as respostas dos adaptadores.
- **Tailwind CSS 4**, estilizado só por design tokens: nada de CSS escrito à mão para o que um utilitário consegue expressar.
- **OpenAI**: o \`gpt-4o-mini\` escreve as respostas que precisam de um modelo, e o \`text-embedding-3-small\` alimenta a busca no histórico dele.
- **Vercel** hospeda o site, com um deploy de prévia para cada pull request.
- **Ferramentas de qualidade**: Vitest, Testing Library e MSW para testes unitários e de integração; Playwright e axe para testes end-to-end e de acessibilidade; Lighthouse CI para orçamentos de performance; dependency-cruiser para regras de arquitetura; ESLint, Prettier, lefthook e commitlint em todo commit.

## A arquitetura

O código segue a Clean Architecture. O domínio e suas regras ficam em um núcleo de TypeScript puro: ele nunca importa Next.js, React ou o SDK da OpenAI, e um teste falha se isso acontecer. Tudo o que conversa com o mundo de fora — o modelo, o índice de busca, a Wikipédia, o GitHub — fica atrás de uma porta, em um adaptador, e tudo é ligado em uma única composition root.

O site também é white-label. Tudo o que é do Marcio — o histórico, as palavras, as cores e as fontes dele — fica em uma única pasta de perfil, e outro teste falha se o núcleo sequer citar uma das empresas dele. Troque o perfil e o mesmo código renderiza o portfólio de outra pessoa.

## Como o assistente responde

Toda pergunta segue um de dois caminhos, e quem visita não percebe qual.

1. **Sistema 1, um roteador determinístico.** As perguntas que ele reconhece com certeza — todas as que a interface sugere, as recusas, tecnologias comparadas com o histórico dele — são respondidas direto da base de conhecimento. Sem chamada ao modelo, sem tokens, sem espera.
2. **Sistema 2, o modelo.** Todo o resto vai para o \`gpt-4o-mini\`, que só pode agir por uma lista fechada de ações nomeadas e validadas: consultar um cargo, buscar no histórico dele, descrever uma tecnologia, mostrar um cartão. Ele nunca recebe a base de conhecimento inteira.

A busca é geração aumentada por recuperação (RAG): cada afirmação do currículo dele e cada seção das anotações da base de conhecimento viram embeddings uma única vez, offline, em um índice versionado junto com o código. Em tempo de execução, só a pergunta vira embedding, e os trechos abaixo de um piso de relevância são descartados — assim, uma pergunta fora do assunto não encontra nada, em vez de encontrar os fatos menos irrelevantes.

## Como ele se mantém honesto

- **Ancoragem.** Um fato sobre o Marcio só pode vir do resultado de uma ação na conversa. Quando nada documenta uma resposta, o assistente diz isso e indica o que pode responder — ele nunca preenche a lacuna com um palpite plausível.
- **Níveis de evidência.** As anotações dele marcam cada afirmação como fato do currículo, relato dele ou estudo para um dos produtos dele. O assistente segue essas marcações: o design de um projeto paralelo nunca vira experiência em produção em um empregador.
- **Segurança.** O que uma ação devolve é dado, nunca instrução; pedidos para mudar as regras, revelá-las ou interpretar outro papel são recusados.
- **Avaliação.** Um conjunto de conversas — fatos da carreira, tecnologias, detalhes não documentados, pedidos fora do assunto, tentativas de injeção, outros idiomas — roda contra a montagem real. Um segundo modelo precisa sustentar cada afirmação de uma resposta com um trecho que ele copia das evidências, e o script confere se o trecho está mesmo lá.

## Gastando menos tokens

O modelo é a única parte que custa dinheiro, então ele é usado o mínimo que uma resposta honesta permite.

- **Respostas gratuitas primeiro.** O Sistema 1 responde tudo o que a interface sugere sem chamar o modelo, e as páginas de tópico são renderizadas a partir do histórico no momento do build.
- **Um modelo pequeno.** O \`gpt-4o-mini\` basta para respostas ancoradas em fatos recuperados, por uma fração do preço de um modelo maior.
- **Um loop com limite.** No máximo ${String(MAX_ROUNDS)} rodadas por resposta, a última obrigada a escrever em vez de chamar outra ação; no máximo ${String(MAX_CALLS_PER_ROUND)} ações por rodada, executadas em paralelo; ${String(MAX_OUTPUT_TOKENS)} tokens de saída por rodada.
- **Contexto curto.** Só as últimas ${String(MAX_HISTORY_MESSAGES)} mensagens de uma conversa são enviadas, cada uma cortada em um tamanho curto; as buscas devolvem poucos trechos, com as anotações longas limitadas para nunca tomarem o lugar do currículo; em uma página de tópico, o modelo recebe um resumo compacto do que a página já mostra, para não gastar tokens repetindo.
- **Embeddings uma vez só.** O índice de busca é construído offline, então um build não precisa de chave e uma visita só gera o embedding da pergunta.
- **Cache.** Uma pergunta feita sem histórico é respondida pelo modelo uma vez por página e depois reaproveitada do cache, sem custo.
- **Orçamentos.** Por padrão, cada visitante pode iniciar 15 respostas do modelo a cada dez minutos, e cada servidor para de chamar o modelo depois de cerca de dois milhões de tokens por dia; quem passa de um limite ainda recebe uma resposta gratuita indicando o que continua funcionando. O teto definitivo é o orçamento mensal do projeto na OpenAI.

## Como o Marcio constrói com IA

Este portfólio foi construído com o Claude Code, e o modo como foi construído é parte do que ele mostra.

- **Planos antes do código.** Cada trabalho começa como um documento de requisitos, um design técnico e um plano de testes, renderizados como uma página para revisão. Nada é implementado antes de ele aprovar.
- **Tarefas pequenas e verificáveis.** Um plano aprovado é dividido em tickets. Agentes os implementam em paralelo, cada um na própria git worktree, e todo ticket termina como um pull request.
- **Verificações antes das pessoas.** Typecheck, lint, regras de arquitetura e testes unitários, de integração, end-to-end, de acessibilidade e de performance rodam antes da revisão. Uma correção de bug vem com um teste que falha sem ela, e nenhum teste é dobrado para passar.
- **Pessoas decidem.** Os agentes implementam e verificam; a arquitetura, os trade-offs e o aceite final ficam com ele.

## A régua de qualidade

- **Lighthouse:** 100 em acessibilidade, boas práticas e SEO em todas as páginas, no celular e no desktop.
- **Acessibilidade:** WCAG 2.1 AA verificado pelo axe em todas as páginas e estados, além de navegação por teclado, um link para pular ao conteúdo, títulos em ordem e controles do tamanho de um dedo no celular.
- **Busca e compartilhamento:** um endereço canônico, um cartão de compartilhamento e dados estruturados em todas as páginas — um ProfilePage do schema.org sobre ele, e breadcrumbs.
- **Segurança:** uma Content Security Policy que só permite esta origem, HSTS e os outros cabeçalhos de segurança, corpos de requisição limitados e validados, limites de uso por cliente, e a chave do modelo só no servidor.`,
};
