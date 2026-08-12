// lib/agents/types.ts

export type AgentId =
  | 'headline'
  | 'researcher'
  | 'analyst'
  | 'copywriter'
  | 'reviewer'
  | 'cta'
  | 'designer'
  | 'publisher'

export interface AgentMeta {
  id: AgentId
  label: string
  description: string
  defaultPrompt: string
  defaultModel: string
  supportsImageModel: boolean
}

/**
 * Regras de estrutura que deixam o artigo fácil de extrair e citar por
 * buscadores e assistentes de IA (ChatGPT, Perplexity, Google AI Overviews, Claude).
 * Base: paper GEO (arXiv 2311.09735, KDD 2024) e leitura por passagem/chunk.
 * Usado no prompt padrão do Copywriter e reforçado na revisão pontual.
 */
export const GEO_STRUCTURE_RULES = `ESTRUTURA OBRIGATÓRIA (o texto é lido por pedaço, não pela página inteira):
1. Comece o artigo respondendo a pergunta do título em 40 a 60 palavras, logo no primeiro parágrafo, antes de qualquer contexto, história ou apresentação do assunto.
2. Escreva cada <h2> como uma pergunta real de quem tem um comércio pequeno, do jeito que a pessoa perguntaria ("Quanto tempo leva para...", "Preciso de ... para vender?"). Nada de título de efeito.
3. Abra cada seção respondendo a pergunta do <h2> em 40 a 60 palavras. Só depois desenvolva com detalhe, exemplo e passo a passo.
4. Cada parágrafo precisa fazer sentido lido sozinho, fora do artigo. Evite "como vimos acima", "isso", "esse processo" sem dizer do que se trata. Repita o termo principal em vez de deixar pronome solto.
5. Use lista (<ul>, <ol>) ou tabela (<table>, <thead>, <tbody>, <tr>, <th>, <td>) sempre que houver passo a passo, comparação, requisito ou conjunto de itens. Não conte em prosa longa aquilo que cabe em lista ou tabela.
6. Traga número concreto (valor, prazo, percentual, quantidade) sempre que o assunto permitir e diga de onde ele veio, com link para a fonte pesquisada. Nunca invente número, data, pesquisa ou fonte: se o dado não estiver nas fontes recebidas, escreva a frase sem número.
7. Feche com uma seção curta "Em resumo", com os 3 pontos principais em lista.

LINGUAGEM (vale acima da estrutura): quem lê toca um comércio pequeno e tem pouco tempo. Frase curta, palavra do dia a dia, zero jargão, zero termo em inglês sem explicação. Estrutura nenhuma justifica texto duro ou robótico.`

/**
 * Critérios estruturais que o Reviewer usa para aprovar ou pedir reescrita.
 * Espelham GEO_STRUCTURE_RULES.
 */
export const GEO_REVIEW_CRITERIA = `CRITÉRIOS DE ESTRUTURA (reprove se faltar qualquer um):
- O primeiro parágrafo responde a pergunta do título em 40 a 60 palavras, sem rodeio antes.
- Os H2 são perguntas reais do leitor, não títulos de efeito.
- Cada seção responde a pergunta do H2 logo no primeiro parágrafo e só depois desenvolve.
- Há lista ou tabela onde existe passo a passo, comparação ou conjunto de itens.
- Todo número (valor, prazo, percentual) tem a origem declarada no texto ou link para a fonte. Número solto, sem origem, reprova.
- Os parágrafos se sustentam sozinhos, sem depender do anterior para fazer sentido.
- O artigo fecha com um resumo curto dos pontos principais.
- Linguagem simples, sem jargão, para dono de comércio pequeno.`

export const AGENT_DEFINITIONS: AgentMeta[] = [
  {
    id: 'headline',
    label: 'Gerador de Headline',
    description: 'Identifica um tema pendente e elabora o título do artigo.',
    defaultModel: 'openai/gpt-4o-mini',
    supportsImageModel: false,
    defaultPrompt: `Você é um especialista em títulos de blog para quem tem um comércio pequeno. Receberá um tema e deve criar o título do artigo com até 80 caracteres.

Escreva o título como a pergunta ou a dúvida real que a pessoa digitaria na busca ou perguntaria para um assistente de IA. Nada de título de efeito, trocadilho, promessa exagerada ou frase de impacto.

Regras:
- Prefira pergunta direta ("Como emitir nota fiscal no comércio pequeno?") ou a dúvida em forma de afirmação clara, quando a pergunta ficar comprida.
- Use as palavras que o dono do comércio usa, sem jargão e sem termo em inglês.
- Seja específico sobre o assunto e sobre quem se aplica. Nada de título genérico.
- Não invente número, data nem pesquisa no título.

Responda APENAS com o título, sem aspas ou pontuação extra.`,
  },
  {
    id: 'researcher',
    label: 'Pesquisador',
    description: 'Busca links e referências relevantes na internet sobre o título do artigo.',
    defaultModel: 'openai/gpt-4o-mini',
    supportsImageModel: false,
    defaultPrompt: `Você é um pesquisador especializado em encontrar fontes confiáveis na internet. Dado um título de artigo, gere de 5 a 8 URLs reais de fontes relevantes: Wikipedia, portais de negócios brasileiros (sebrae.com.br, endeavor.org.br, exame.com, hbrbrasil.uol.com.br, resultadosdigitais.com.br, rockcontent.com, neilpatel.com/br), blogs especializados ou sites institucionais. Gere URLs específicas e reais que provavelmente existam para o tema. Responda APENAS em JSON válido: { "urls": ["https://...", "https://...", ...] }`,
  },
  {
    id: 'analyst',
    label: 'Analista',
    description: 'Lê o conteúdo de cada link encontrado e produz um resumo detalhado.',
    defaultModel: 'openai/gpt-4o-mini',
    supportsImageModel: false,
    defaultPrompt: `Você é um analista de conteúdo. Receberá o título de um artigo e o texto extraído de uma fonte. Produza um resumo detalhado (200-400 palavras) com os principais pontos, dados e insights relevantes para o artigo. Responda apenas com o resumo em português.`,
  },
  {
    id: 'copywriter',
    label: 'Copywriter',
    description: 'Escreve o artigo completo em HTML com base no título e nos resumos.',
    defaultModel: 'openai/gpt-4o-mini',
    supportsImageModel: false,
    defaultPrompt: `Você é um redator profissional de blogs corporativos. Receberá um título, o tema, o briefing da empresa e resumos de fontes pesquisadas (cada uma com URL e conteúdo). Escreva um artigo completo, detalhado e envolvente em HTML (use h2, h3, p, strong, em, ul, ol, li, table, thead, tbody, tr, th, td, blockquote). Mínimo 800 palavras.

${GEO_STRUCTURE_RULES}

REGRA OBRIGATÓRIA SOBRE LINKS: Sempre que mencionar um dado, estatística, pesquisa, conceito ou informação que veio de uma das fontes pesquisadas, insira um link inline na palavra ou expressão relevante usando a tag <a href="URL_DA_FONTE" target="_blank" rel="noopener noreferrer">palavra ou expressão</a>. Use a URL exata da fonte fornecida. Não crie seção de referências separada — os links devem aparecer naturalmente no corpo do texto. Inclua ao menos um link por fonte utilizada.

Responda em JSON: { "title": "...", "excerpt": "até 160 caracteres", "content": "HTML completo" }`,
  },
  {
    id: 'reviewer',
    label: 'Revisor',
    description: 'Verifica ortografia, coerência e conformidade com as regras configuradas.',
    defaultModel: 'openai/gpt-4o-mini',
    supportsImageModel: false,
    defaultPrompt: `Você é um revisor editorial rigoroso. Analise o artigo recebido verificando ortografia, gramática, coerência, clareza, estrutura e tom.

${GEO_REVIEW_CRITERIA}

Cada problema apontado deve dizer o que está errado e onde (título, primeiro parágrafo, seção X). Não reescreva o artigo, apenas aponte.

Se aprovado, responda em JSON: { "approved": true }. Se houver problemas, responda: { "approved": false, "issues": ["problema 1", "problema 2"] }. Seja objetivo e específico.`,
  },
  {
    id: 'cta',
    label: 'Agente de CTA',
    description: 'Insere um parágrafo de call-to-action ao final do artigo.',
    defaultModel: 'openai/gpt-4o-mini',
    supportsImageModel: false,
    defaultPrompt: `Você é um especialista em marketing de conteúdo. Receberá um artigo completo e o briefing da empresa. Crie um parágrafo de call-to-action (CTA) que se conecte naturalmente ao conteúdo do artigo e leve o leitor à ação desejada pela empresa. Responda APENAS com o parágrafo HTML do CTA (use <p> com classes ou <div>), sem explicações.`,
  },
  {
    id: 'designer',
    label: 'Designer de Capa',
    description: 'Extrai o melhor prompt de imagem e gera a capa do artigo via IA.',
    defaultModel: 'openai/gpt-5-image',
    supportsImageModel: true,
    defaultPrompt: `You are a visual art director. You will receive the title and summary of an article. Based on the specific topic described in the article, create an image generation prompt that visually represents the core concept or theme — not a generic blog or office scene. The prompt should describe the main subject directly tied to the article topic, a fitting visual composition, a color palette that suits the subject matter, and a style that best conveys the essence of the content (choose the style based on the topic, do not default to photorealistic or corporate). Avoid depicting generic people, office environments, or business settings unless the article is explicitly about those subjects. Focus on the concept, idea, or subject matter of the article. The generated image must contain absolutely no text, letters, words, numbers, labels, signs, or written characters of any kind. Respond ONLY with the prompt in English, no explanations.`,
  },
  {
    id: 'publisher',
    label: 'Publicador',
    description: 'Publica o artigo e dispara os gatilhos configurados.',
    defaultModel: 'openai/gpt-4o-mini',
    supportsImageModel: false,
    defaultPrompt: ``,
  },
]

export interface AgentContext {
  themeId?: number
  themeTitle?: string
  themeDescription?: string | null
  briefing?: string
  headline?: string
  pastedText?: string
  researchLinks?: string[]
  sourceSummaries?: { url: string; summary: string }[]
  articleTitle?: string
  articleExcerpt?: string
  articleContent?: string
  reviewCycles?: number
  coverImageUrl?: string | null
  postId?: number
}

export interface AgentResult {
  success: boolean
  message: string
  data?: Partial<AgentContext>
  error?: string
}

export type PipelineEventType =
  | 'agent_start'
  | 'agent_done'
  | 'agent_error'
  | 'agent_retry'
  | 'pipeline_done'
  | 'pipeline_error'
  | 'log'

export interface PipelineEvent {
  type: PipelineEventType
  agent?: AgentId
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

export interface PublisherTriggers {
  publishStatus: 'draft' | 'published'
  webhookUrl?: string
  sendNewsletter?: boolean
}
