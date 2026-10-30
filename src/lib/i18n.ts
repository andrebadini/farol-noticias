export type Lang = 'pt' | 'en'
export type LanguageSetting = 'auto' | Lang
export type Vars = Record<string, string | number>

let active: Lang = 'pt'

/**
 * O SDK do Even Hub não expõe o idioma do sistema (UserInfo só tem country).
 * O WebView do app, porém, herda navigator.language/languages do aparelho.
 * "auto" usa esse sinal; se não for pt/en, cai no português (idioma das notícias).
 */
export function resolveLanguage(setting: LanguageSetting): Lang {
  if (setting === 'pt' || setting === 'en') return setting
  if (typeof navigator === 'undefined') return 'pt'
  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean)
  for (const candidate of candidates) {
    const code = candidate.toLowerCase()
    if (code.startsWith('pt')) return 'pt'
    if (code.startsWith('en')) return 'en'
  
}
  return 'pt'

}

export function setActiveLanguage(lang: Lang): void {
  active = lang

}

export function currentLanguage(): Lang {
  return active

}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  )

}

/** Traduz a frase portuguesa (a própria frase é a chave) para o idioma ativo. */
export function t(template: string, vars?: Vars): string {
  const translated = active === 'en' ? EN[template] ?? template : template
  return interpolate(translated, vars)

}

const EN: Record<string, string> = {
  /* navegação e marca */
  'notícias do Brasil': 'Brazil news',
  'notícias do Brasil, num olhar': "Brazil's daily news, at a glance",
  'Pular para o conteúdo': 'Skip to content',
  'Agora': 'Now',
  'Buscar': 'Search',
  'Salvos': 'Saved',
  'Ajustes': 'Settings',
  'Navegação principal': 'Main navigation',
  'Edição': 'Edition',
  'seu recorte': 'your selection',
  'a edição de agora': 'this edition',
  'Últimas': 'Latest',
  'no radar': 'on the radar',
  'Tudo': 'All',
  'Fontes': 'Sources',
  'FONTES': 'SOURCES',
  'TUDO': 'ALL',
  'NOTÍCIAS': 'STORIES',
  'MENU': 'MENU',
  'SALVOS': 'SAVED',
  'COMO USAR': 'HOW TO USE',
  'voltar': 'back',
  'ações': 'actions',
  'AGORA': 'NOW',
  'notícias agora': 'headlines now',
  'acendendo o farol…': 'lighting the beacon…',
  'Manchetes agora': 'Headlines now',
  'cache': 'cache',
  'conectando': 'connecting',
  'agora': 'now',
  'há {n} min': '{n} min ago',
  'há {n} h': '{n} h ago',
  'há {n} d': '{n} d ago',
  'ontem': 'yesterday',
  'hoje': 'today',
  'atualizado agora': 'updated now',
  'atualizado há {n} min': 'updated {n} min ago',
  'aguardando primeira atualização': 'waiting for the first update',
  '{n} mil': '{n}k',
  'há {n} min atrás': '{n} min ago',
  '{online} de {total} fontes no ar': '{online} of {total} sources online',
  '{online}/{total} fontes no ar': '{online}/{total} sources online',

  /* categorias */
  'Política': 'Politics',
  'Economia': 'Business',
  'Mundo': 'World',
  'Esportes': 'Sports',
  'Tecnologia': 'Technology',
  'Cultura': 'Culture',
  'Cidades': 'Cities',
  'Saúde': 'Health',
  'Ciência': 'Science',
  'Justiça': 'Justice',
  'Geral': 'General',

  /* contagens e filtros */
  '{n} matérias': '{n} stories',
  '{n} matéria': '{n} story',
  '{n} restantes': '{n} left',
  '{n} resultado': '{n} result',
  '{n} resultados': '{n} results',
  '{n} matéria guardada': '{n} saved story',
  '{n} matérias guardadas': '{n} saved stories',
  '{n} veículos · edição completa': '{n} outlets · full edition',
  '{n} de {total} fontes ativas. As escolhas ficam salvas no celular.': '{n} of {total} sources active. Your choices are saved on the phone.',
  '{n} de {total} ativas': '{n} of {total} active',
  '{n}/{total}': '{n}/{total}',
  'Categorias': 'Categories',
  'Remover filtro de {source}': 'Remove {source} filter',
  'Filtrar por fontes': 'Filter by sources',
  'limpar filtros': 'clear filters',
  'Limpar filtros': 'Clear filters',
  'Fontes desta edição': 'Sources in this edition',
  'todas as fontes': 'all sources',
  '{n} matérias · atualize ou filtre': '{n} stories · refresh or filter',
  'filtrando: {source}': 'filtering: {source}',
  'mostrando todas as fontes': 'showing all sources',

  /* home, herói e feed */
  'destaque do dia': 'story of the day',
  'Ler a matéria': 'Read the story',
  'Nos óculos': 'On glasses',
  'Salvar matéria': 'Save story',
  'Remover dos salvos': 'Remove from saved',
  'Remover "{title}" dos salvos': 'Remove "{title}" from saved',
  'Salvar "{title}"': 'Save "{title}"',
  'salvo': 'saved',
  'Salvo': 'Saved',
  'Salvar': 'Save',
  'resumo': 'summary',
  'Texto resumido': 'Summary only',
  'Texto completo carregado': 'Full text loaded',
  'Ainda só temos o resumo. Abra o original.': 'We still only have the summary. Open the original.',
  'Ainda só temos o resumo — abra no celular': 'Still only the summary — open on the phone',
  'Buscar texto completo': 'Get full text',
  'Buscando texto completo…': 'Getting full text…',
  'Esta matéria chegou ao Farol Diário apenas com o resumo. Tente buscar o texto completo (versão pública ou arquivada) ou abra o original.':
    'This story reached Farol Diário as a summary only. Try the full text (public or archived version) or open the original.',
  'Esta matéria ainda não tem texto completo no Farol Diário. Abra a versão original no celular.':
    'This story does not have the full text on Farol Diário yet. Open the original on your phone.',
  'O farol ainda não acendeu': 'The beacon is not lit yet',
  'Não recebemos a edição de hoje. Verifique sua conexão e puxe a atualização — o serviço publica notícias a cada 15 minutos.':
    'We have not received today’s edition. Check your connection and pull to refresh — the service publishes news every 15 minutes.',
  'Buscar a edição': 'Fetch the edition',
  'Tentar': 'Try',
  'Tentar de novo': 'Try again',
  'Sem sinal agora. Esta é a última edição guardada no celular.': 'No signal right now. This is the last edition saved on your phone.',
  'Nada com esse filtro': 'Nothing with this filter',
  'O farol está sem sinal': 'The beacon has no signal',
  'Nenhuma matéria corresponde às fontes e categorias escolhidas. Tente abrir um pouco o olhar.':
    'No story matches the selected sources and categories. Try widening your view.',
  'Não conseguimos falar com o serviço de notícias. Verifique a conexão e tente de novo.':
    'We could not reach the news service. Check your connection and try again.',
  'Escolher fontes': 'Choose sources',
  'Escolher veículos': 'Choose outlets',
  'Você chegou ao fim da edição. O app se atualiza sozinho a cada 15 minutos.':
    'You have reached the end of the edition. The app refreshes itself every 15 minutes.',
  'Carregar mais': 'Load more',
  'buscando agora…': 'fetching now…',
  'Atualizar notícias': 'Refresh news',
  'Atualizar': 'Refresh',
  'Dicas de uso': 'Usage tips',
  'O jornal também mora nos óculos': 'The newspaper also lives on your glasses',
  'primeira vez aqui': 'first time here',
  'Dois toques no G2 abrem o menu. Deslize para virar a página e salve aqui para ler lá.':
    'Double-tap the G2 to open the menu. Swipe to turn the page and save here to read there.',
  'Ver gestos': 'See gestures',
  'Entendi': 'Got it',
  'Dica de uso': 'Usage tip',
  'Sem conexão. Mostrando o que já está salvo.': 'No connection. Showing what is already saved.',
  '{n} matéria nova na edição': '{n} new story in the edition',
  '{n} matérias novas na edição': '{n} new stories in the edition',
  'Edição já está atualizada': 'The edition is already up to date',
  'Não foi possível atualizar agora. Tente de novo.': 'Could not refresh now. Try again.',
  'Removido dos salvos': 'Removed from saved',
  'Salvo no seu celular': 'Saved on your phone',
  'Mantenha pelo menos uma fonte ativa.': 'Keep at least one source active.',
  'Abra o app no Even Hub com os óculos G2 conectados.': 'Open the app in Even Hub with your G2 glasses connected.',
  'No visor: matéria aberta': 'On glasses: story opened',
  'Ainda não há manchete para enviar.': 'There is no headline to send yet.',

  /* busca */
  'em todas as fontes': 'across all sources',
  'Procure por tema, veículo ou palavra-chave. Fale ou escreva.': 'Search by topic, outlet, or keyword. Speak or type.',
  'Ex.: eleições, dólar, Amazônia…': 'E.g. eleições, dólar, Amazônia…',
  'Buscar notícias': 'Search news',
  'Limpar busca': 'Clear search',
  'Parar de ouvir': 'Stop listening',
  'Buscar por voz': 'Voice search',
  'Ouvindo…': 'Listening…',
  'Fale o tema da busca.': 'Say what you are looking for.',
  'Parar': 'Stop',
  'Fechar aviso': 'Close alert',
  'Voz no bolso': 'Voice in your pocket',
  'O microfone do navegador está disponível. Se a permissão falhar, use o botão de ditado do teclado.':
    'The browser microphone is available. If permission fails, use the keyboard dictation button.',
  'O WebView do Even Hub não libera o microfone para páginas. Toque no microfone do teclado do celular e dite a busca — a busca entende igual.':
    'The Even Hub WebView does not expose the microphone to pages. Tap the phone keyboard microphone and dictate — search understands it the same way.',
  'Fechar dica': 'Close tip',
  'sugestões': 'suggestions',
  'buscas recentes': 'recent searches',
  'limpar': 'clear',
  'A busca roda na edição carregada no seu celular — {n} matérias das principais fontes do Brasil. Sem enviar sua pesquisa para ninguém.':
    'Search runs on the edition loaded on your phone — {n} stories from Brazil’s main outlets. Your query is never sent to anyone.',
  '“{term}”': '“{term}”',
  'Nada encontrado': 'Nothing found',
  'Tente uma palavra mais curta, o nome do veículo ou outro tema.': 'Try a shorter word, the outlet name, or another topic.',
  'Permissão do microfone negada. Use o ditado do teclado.': 'Microphone permission denied. Use keyboard dictation.',
  'O microfone não está disponível neste WebView. Use o ditado do teclado.': 'The microphone is not available in this WebView. Use keyboard dictation.',
  'Não ouvi nada. Tente de novo.': 'I did not hear anything. Try again.',
  'Nenhum microfone encontrado.': 'No microphone found.',
  'Sem conexão para reconhecer a voz.': 'No connection for voice recognition.',
  'Não foi possível ouvir. Tente de novo.': 'Could not listen. Try again.',
  'Não foi possível iniciar o microfone.': 'Could not start the microphone.',

  /* salvos */
  '{n} matéria guardada no seu celular — leia quando quiser, mesmo sem sinal.':
    '{n} saved story on your phone — read it whenever you want, even offline.',
  '{n} matérias guardadas no seu celular — leia quando quiser, mesmo sem sinal.':
    '{n} saved stories on your phone — read them whenever you want, even offline.',
  'Guarde o que quer ler depois. Fica no celular e também no menu dos óculos.':
    'Save what you want to read later. It stays on your phone and in the glasses menu too.',
  'Seu farol pessoal começa aqui': 'Your personal beacon starts here',
  'Toque no marcador de uma matéria para salvá-la. No G2, dois toques abrem o menu e': 'Tap a story’s bookmark to save it. On the G2, double-tap opens the menu and',
  '★ Salvar': '★ Save',
  'Explorar a edição': 'Explore the edition',
  'offline': 'offline',
  'nos óculos': 'on glasses',
  'sem login': 'no login',
  'Salvo no armazenamento do Even Hub — não some ao fechar o app.': 'Saved in Even Hub storage — it does not disappear when you close the app.',

  /* leitor */
  'Voltar': 'Back',
  'Tamanho do texto': 'Text size',
  'Compartilhar': 'Share',
  '{n} min de leitura': '{n} min read',
  'Ler na íntegra em {source}': 'Read the full story at {source}',
  'Abrir no site original': 'Open on the original site',
  'Ler nos óculos': 'Read on glasses',
  'Original': 'Original',
  'Carregando matéria': 'Loading story',
  '{n} min': '{n} min',
  'Diminuir texto': 'Decrease text',
  'Aumentar texto': 'Increase text',

  /* ajustes */
  'seu farol, do seu jeito': 'your beacon, your way',
  'Controle a edição, o tamanho da leitura e o que aparece nos óculos.': 'Control the edition, reading size, and what appears on your glasses.',
  'Idioma': 'Language',
  'Idioma do app': 'App language',
  'Automático': 'Automatic',
  'Detectado: Português': 'Detected: Portuguese',
  'Detectado: English': 'Detected: English',
  'Interface do app. As notícias continuam em português.': 'App interface. The news stays in Portuguese.',
  'Português': 'Português',
  'English': 'English',
  'Sistema': 'System',
  'Claro': 'Light',
  'Escuro': 'Dark',
  'Leitura': 'Reading',
  'vale para o celular': 'applies to the phone',
  'Aparência': 'Appearance',
  'No leitor de matérias': 'In the story reader',
  'Atalhos para os gestos dos óculos': 'Shortcuts for the glasses gestures',
  'Atualização': 'Updates',
  'servidor a cada 15 min': 'server every 15 min',
  'Buscar novidades a cada': 'Check for updates every',
  'Manual': 'Manual',
  'Edição atual': 'Current edition',
  'carregando': 'loading',
  'de': 'of',
  'ativas': 'active',
  'G1, Folha, Valor, Crusoé, Intercept e mais': 'G1, Folha, Valor, Crusoé, Intercept and more',
  'você está com um recorte': 'you are using a selection',
  'edição completa': 'full edition',
  'óculos conectados': 'glasses connected',
  'procurando óculos…': 'looking for glasses…',
  'não foi possível falar com os óculos': 'could not reach the glasses',
  'modo navegador': 'browser mode',
  'Deslizar': 'Swipe',
  'navegar / virar página': 'navigate / turn page',
  '1 toque': '1 tap',
  'abrir a matéria': 'open the story',
  '2 toques': '2 taps',
  'menu de ações': 'actions menu',
  '2 toques → Atualizar': '2 taps → Refresh',
  'Enviar a manchete': 'Send the headline',
  'Como funciona': 'How it works',
  'No celular, use o botão “Ler nos óculos” dentro de qualquer matéria.':
    'On the phone, use the “Read on glasses” button inside any story.',
  'Sem óculos por perto, o app segue funcionando aqui. Abra o app no Even Hub com o G2 conectado para espelhar as matérias.':
    'Without glasses nearby, the app keeps working here. Open it in Even Hub with the G2 connected to mirror stories.',
  'Dados e privacidade': 'Data and privacy',
  'Snapshots de notícias': 'News snapshots',
  'Abrir endpoint de dados': 'Open data endpoint',
  'Limpar cache': 'Clear cache',
  'Limpar o cache de notícias? Seus salvos continuam guardados.': 'Clear the news cache? Your saved stories are kept.',
  'Cache limpo. O Farol Diário vai buscar novidades.': 'Cache cleared. Farol Diário will look for updates.',
  'Mantém os salvos no celular': 'Keeps saved stories on the phone',
  'Salvos offline': 'Saved offline',
  'no Even Hub': 'in Even Hub',
  'O app não tem login nem rastreamento. As notícias vêm de feeds públicos dos veículos; favoritos e ajustes ficam no armazenamento do seu celular via Even Hub.':
    'The app has no login and no tracking. News comes from public outlet feeds; favorites and settings stay in your phone storage via Even Hub.',
  'versão 1.0.0 · feito para Even Realities G2': 'version 1.0.0 · made for Even Realities G2',
  'versão 1.0.1 · feito para Even Realities G2': 'version 1.0.0 · made for Even Realities G2',

  /* fontes e metadados */
  'monte seu farol': 'build your beacon',
  'Suas fontes': 'Your sources',
  'O recorte vale para o celular e para a lista nos óculos.': 'This selection applies to the phone and the glasses list.',
  'Fechar': 'Close',
  'Todas as fontes': 'All sources',
  'fora do ar': 'offline',
  'Pronto': 'Done',
  'Portal': 'Portal',
  'Jornal': 'Newspaper',
  'Revista': 'Magazine',
  'Agência': 'Agency',
  'Site': 'Website',
  'Blog': 'Blog',
  'Notícias 24h': '24h news',
  'Grande imprensa': 'Major press',
  'Investigação': 'Investigative',
  'Análise': 'Analysis',
  'Independente': 'Independent',
  'Esquerda': 'Left',
  'Direita': 'Right',
  'Centro': 'Center',
  'Notícias': 'News',
  'Política e poder': 'Politics and power',
  'Economia e negócios': 'Business and economy',

  /* óculos */
  '▲▼ rolar  ·  ● abrir  ·  2× menu': '▲▼ scroll  ·  ● open  ·  2× menu',
  '▲▼ rolar  ·  ● escolher  ·  2× lista': '▲▼ scroll  ·  ● choose  ·  2× list',
  '▲▼ rolar  ·  ● filtrar  ·  2× voltar': '▲▼ scroll  ·  ● filter  ·  2× back',
  '▲▼ rolar  ·  ● abrir  ·  2× voltar': '▲▼ scroll  ·  ● open  ·  2× back',
  '◈  Abrindo o Farol Diário…': '◈  Opening Farol Diário…',
  '◈  Sem notícias agora — 2× para atualizar': '◈  No stories right now — 2× to refresh',
  '◈  Sem notícias agora': '◈  No stories right now',
  '◈  Últimas notícias': '◈  Latest stories',
  '◈  Buscar texto completo': '◈  Get full text',
  '◈  Como usar': '◈  How to use',
  '☆  Salvar matéria': '☆  Save story',
  '★  Remover dos salvos': '★  Remove from saved',
  '★  Matérias salvas': '★  Saved stories',
  '◀  Voltar à leitura': '◀  Back to reading',
  '▶  Atualizar notícias': '▶  Refresh news',
  '▷  Filtrar por fonte': '▷  Filter by source',
  '×  Sair do Farol Diário': '×  Exit Farol Diário',
  '●  Todas as fontes': '●  All sources',
  'NADA SALVO AINDA': 'NOTHING SAVED YET',
  'Abra uma matéria e toque': 'Open a story and tap',
  'em ★ Salvar (no menu).': '★ Save (in the menu).',
  'Fica no seu celular, mesmo': 'It stays on your phone, even',
  'offline.': 'offline.',
  '★ salvos  ·  ● voltar': '★ saved  ·  ● back',
  '★ SALVOS · {n}': '★ SAVED · {n}',
  'guardados no seu celular': 'saved on your phone',
  '★ SALVO NO CELULAR': '★ SAVED ON PHONE',
  '☆ REMOVIDO DOS SALVOS': '☆ REMOVED FROM SAVED',
  '↻ ATUALIZANDO…': '↻ REFRESHING…',
  'OK · ATUALIZADO AGORA': 'OK · UPDATED NOW',
  '! SEM CONEXÃO — TENTE DE NOVO': '! NO CONNECTION — TRY AGAIN',
  'Modo navegador — sem óculos conectados': 'Browser mode — no glasses connected',
  'falha ao iniciar': 'failed to start',
  '1/2  ● ações': '1/2  ● actions',
  '(Resumo do Farol Diário. A íntegra está disponível no site da fonte.)':
    '(Farol Diário summary. The full story is available on the source site.)',
  '◈ FAROL DIÁRIO — COMO USAR': '◈ FAROL DIÁRIO — HOW TO USE',
  '▲ ▼  navegar e virar página': '▲ ▼  navigate and turn page',
  '●    abrir a matéria': '●    open the story',
  '●●   2 toques: menu de ações': '●●   2 taps: actions menu',
  '2× em matéria abre o menu': '2× on a story opens the menu',
  'No menu: atualizar, filtrar': 'In the menu: refresh, filter',
  'por fonte, salvar, ajuda e sair.': 'by source, save, help and exit.',
  'O app atualiza sozinho a': 'The app refreshes by itself',
  'cada 15 minutos. Gesto manual:': 'every 15 minutes. Manual gesture:',
  '2 toques → menu Atualizar.': '2 taps → Refresh menu.',

  'Esta matéria ainda não tem texto disponível. Abra a versão original para ler na íntegra.':
    'This story does not have text available yet. Open the original to read the full piece.',
  '{n} NOTÍCIAS': '{n} STORIES',
  'Mercados': 'Markets',
  'Brasília': 'Brasília',
  'Serviço público': 'Public service',
  'Movimentos': 'Movements',
  'Negócios': 'Business',
  'Rádio': 'Radio',
  'Contexto': 'Context',
  'Checagem': 'Fact-check',
  'Direitos': 'Rights',
  'Diversidade': 'Diversity',
  'Debate': 'Debate',

  'Carregando notícias': 'Loading news',
  'Prévia aproximada do que aparece nos óculos': 'Approximate preview of the glasses display',
  'prévia aproximada do visor · 576 × 288': 'approximate preview of the display · 576 × 288',
  'Últimas notícias': 'Latest news',

}
