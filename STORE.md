# Publicação no Even Hub — Além dos Pontos 1.1.0

Tudo o que você precisa colar no portal do Even Hub (ou passar para o CLI), com os textos prontos e os limites de cada campo.

## 1. Campos do app

| Campo | Valor | Limite |
|---|---|---|
| **Nome** | `Além dos Pontos` | 1–20 caracteres |
| **Tagline / descrição curta** | `Brazil's news, beyond the headlines.` | 1–50 caracteres |
| **Descrição da loja** | [store/description-en.txt](description-en.txt) (inglês; a versão PT é [store/description-pt.txt](description-pt.txt)) | 1–2000 caracteres |
| **Categoria** | Entertainment (o Even Hub não tem “News”) | — |
| **Ícone (CLI / portal 24×24)** | [store/icon-24.png](icon-24.png) | PNG 24×24, pixels visíveis #F4F4F4 em blocos 2×2 |
| **Ícone grande (se o portal pedir)** | [store/icon-1024.png](icon-1024.png) | PNG quadrado |
| **Idioma da interface** | Português (Brasil) e English; automático pelo idioma do celular ou escolha manual | — |
| **País / região** | Brasil | — |
| **Versão** | `1.1.0` | semver |
| **min_app_version** | `2.2.10` | exigido pelo SDK 0.0.16 |
| **min_sdk_version** | `0.0.16` | SDK usado no build |
| **Política de privacidade** | https://andrebadini.github.io/farol-noticias/privacy.html | URL pública |
| **Site / suporte** | https://andrebadini.github.io/farol-noticias/ | URL pública |
| **Pacote** | `alemdospontos-1.1.0.ehpk` | gerado por `npm run pack` |
| **Package ID** | `com.andrebadini.alemdospontos` | reverse domain, minúsculo |

## Estado do envio (11/11/2026)

- **Build 1.1.0 enviada pelo portal em 11/11/2026 e submetida como Public: status `In Review`**
  (`alemdospontos-1.1.0.ehpk`, 537.991 bytes, SHA-256
  `31b1bbbe8dfeba6dfc72c2755c55924feaca1a68a80c616df0b81fd1e44a0195`). A revisão da 1.0.4 foi cancelada
  para dar lugar a ela (1.0.4 e 1.0.3 ficaram `Private`; a pública segue sendo a 1.0.2). Conteúdo: redesign completo do HUD. Abertura
  animada (três pontos + farol que emite ondas); home "destaque fixo" — a notícia em foco ocupa
  sempre o mesmo card com borda arredondada, com o veículo em peso normal (sem negrito) e a manchete
  como protagonista, "A seguir" com as duas próximas e rodapé com progresso e teclas em relevo;
  indicador circular de carregamento animado; leitor com anel de progresso e tempo restante;
  menu/fontes/salvos em moldura com cabeçalho e teclas. Animações usam imagens pequenas pré-renderizadas
  escolhidas pelo relógio. Desempenho no aparelho real ainda não medido. Após `npm run pack`,
  registrar aqui tamanho e SHA-256.
- **1.0.4 enviada pelo portal em 11/11/2026 e submetida como Public: status `In Review`.** Para isso a
  revisão pendente da 1.0.3 foi cancelada (o portal recusa um segundo envio com "invalid parameter"
  enquanto outra build está em revisão); a 1.0.3 ficou `Private`. A build pública segue sendo a 1.0.2.
- Build **1.0.4** empacotada em 11/11/2026 (`alemdospontos-1.0.4.ehpk`, 533.557 bytes, SHA-256 `85321b3f69fc20adcfde697842693776c1e615b4e625a060f6abbe8c16f12f74`): nos óculos, cada notícia mostra
  o veículo em negrito com o logo acima da manchete (até 2 linhas) e o horário local à direita; o
  cursor volta à matéria aberta; a lista é contínua até as mais antigas (3 por página); o menu fica
  acima da 1ª notícia e também no fim da lista.
- Build **1.0.3** preparada em 11/11/2026: lista do celular com o veículo em negrito acima da
  manchete, horário local com UTC à direita, retorno à linha do artigo ao fechar o leitor, menu da
  edição no fim da lista e gesto de arrasto que carrega o lote imediatamente mais antigo. Nos
  óculos, o artigo aberto volta ao topo da lista e "▼ Notícias mais antigas" carrega o próximo lote.
  Pacote `alemdospontos-1.0.3.ehpk`, 531.705 bytes, SHA-256 `d9fae9d722fdc16744b5bd767c800b4bdcb82984320977307e3b132d81912e34`.
- Build **1.0.1** foi **Rejected** em 02/11/2026: o revisor pediu que o duplo toque na página raiz
  abra o diálogo de saída (`shutDownPageContainer(1)`). A **1.0.2** corrige isso: na lista inicial,
  dois toques abrem o diálogo do sistema; o menu de ações passa a ser o último item da lista
  (☰ Menu). Pacote `alemdospontos-1.0.2.ehpk`, 527.941 bytes, SHA-256 `eb396b7d9a250c1a1260a8dfb5f264083af1a2f8073e81776c5b649981626148`.
  Ainda não enviada (`evenhub upload` + submit no portal).
- Build **1.0.1** enviada pela CLI 0.2.0: **ID 130846, status `Private`**, 527.776 bytes (antes
  1.486.859 bytes). SHA-256 `d222fd4c2eb54fa97ba99acf0e3fc8ee752a3bfe57bc4a3a699252a60e67cf7f`;
  o download do Hub confere byte a byte.
- A 1.0.0 e a 1.0.1 estão **Rejected**. Depois do upload, a 1.0.4 precisa ser submetida no portal:
  **Builds → 1.0.4 → Public → Submit for review** (a CLI não faz esse passo).
- O pacote não embute `dist/data`: o app busca o endpoint remoto autorizado e usa o cache do
  telefone. O `npm run pack` remove o snapshot e falha se sobrar URL fora da whitelist.

> **Nome escolhido em 30/10/2026:** `Além dos Pontos`. A busca rápida não encontrou site/marca de notícias com o nome exato; é uma expressão comum. Ainda vale validar domínio, redes e marca antes de investir em SEO.

## 2. Descrição da loja — alternativa em português

Copie de `store/description-pt.txt`. O texto tem 1.274 caracteres, dentro do limite de 2.000.

## 3. Descrição da loja — inglês (card atual)

Copie de `store/description-en.txt` se o portal estiver em inglês. O texto tem 1.314 caracteres.

## 4. Permissões

| Permissão | Por que |
|---|---|
| `network` | O app baixa o snapshot público das notícias em `https://andrebadini.github.io` (manchetes e o texto da matéria aberta). Não envia dados do usuário. |

Não usamos localização, microfone dos óculos, microfone do celular, álbum ou câmera. A busca por voz usa a API do WebView quando o sistema a oferece; quando não, orienta o uso do ditado do teclado — o app nunca abre o microfone por conta própria.

## 5. Assets

| Arquivo | Uso |
|---|---|
| [store/icon-24.png](icon-24.png) | ícone exigido pelo CLI/portal (24×24, branco #F4F4F4, blocos 2×2) |
| [store/icon-1024.png](icon-1024.png) | ícone de apresentação / loja, se houver campo quadrado grande |
| [store/icon-512.png](icon-512.png) | versão 512×512 do ícone grande |
| [store/screenshots/home-light.png](screenshots/home-light.png) | capa e destaque (claro) |
| [store/screenshots/home-dark.png](screenshots/home-dark.png) | capa e destaque (escuro) |
| [store/screenshots/reader.png](screenshots/reader.png) | leitor de matéria |
| [store/screenshots/search.png](screenshots/search.png) | busca por voz/teclado |
| [store/screenshots/saved.png](screenshots/saved.png) | favoritos offline |
| [store/screenshots/sources.png](screenshots/sources.png) | filtro de fontes |
| [store/screenshots/settings-glasses.png](screenshots/settings-glasses.png) | prévia do visor e gestos |
| [store/screenshots/glasses-home.png](screenshots/glasses-home.png) | lista no G2 (576×288) |
| [store/screenshots/glasses-article.png](screenshots/glasses-article.png) | leitura no G2 (576×288) |
| [store/screenshots/glasses-menu.png](screenshots/glasses-menu.png) | menu de ações no G2 (576×288) |

As capturas do celular estão em 1170×2532 (iPhone/Android 3×); as do visor estão em 576×288, a resolução nativa do G2.

## 6. Novidades desta versão (release notes)

```
1.1.0 — HUD redesenhado

• Abertura animada: três pontos acendem e um farol emite ondas para além deles.
• A manchete é a protagonista: card em destaque com borda, e o veículo em peso normal,
  mais discreto, numa linha com o selo em contorno.
• O foco fica sempre no mesmo lugar: as notícias passam pelo card, com "A seguir" logo abaixo.
• Indicador circular de carregamento animado ao atualizar e ao abrir matérias.
• Leitor com anel de progresso, tempo restante e teclas em relevo como dica de gestos.
• Menu, fontes e salvos com moldura própria; a ajuda traz os gestos atuais.

1.0.4 — HUD com veículo em destaque

• Nos óculos, cada notícia mostra o logo e o nome do veículo em negrito acima da manchete.
• O horário local da notícia aparece à direita de cada item.
• Ao fechar a leitura, o cursor volta à matéria que estava aberta.
• Arraste a lista para percorrer todas as notícias, até as mais antigas, de três em três.
• O menu fica acima da 1ª notícia e também no fim da lista.

1.0.3 — lista mais clara e lote mais antigo

• No celular, o nome do veículo aparece em negrito numa linha acima da manchete.
• O horário de cada notícia fica à direita, no fuso do aparelho e com a UTC indicada.
• Ao fechar a leitura, a lista volta na linha da matéria que estava aberta.
• No fim da lista há um menu para atualizar, filtrar, salvar ou abrir os ajustes.
• Arraste a lista para cima, no fim, para carregar o lote imediatamente mais antigo —
  e repita para os lotes seguintes.
• Nos óculos, a matéria aberta volta ao topo da lista e o item "▼ Notícias mais antigas"
  carrega o próximo lote; a matéria mostra a fonte em destaque e o horário com UTC.

1.0.2 — saída pelo duplo toque

• Na lista inicial dos óculos, dois toques abrem o diálogo de saída do sistema.
• O menu de ações (atualizar, filtrar, salvos, idioma, ajuda) é o último item da lista.
• Dentro da matéria, os gestos continuam iguais.

1.0.1 — correção da revisão de rede

• O pacote não cita mais o link de erro do React nem o snapshot de notícias embutido;
  a revisão do Even Hub encontra só o endpoint de dados autorizado.
• O app continua buscando as manchetes no GitHub Pages e abrindo a matéria original no celular.
• O link do projeto no rodapé aponta para a página pública autorizada.

1.0.0 — primeira edição

• 23 veículos brasileiros em uma edição única, atualizada a cada 15 minutos.
• Capa editorial com tipografia própria, arte generativa e leitura confortável.
• Busca por voz (quando disponível) ou teclado, com sugestões e buscas recentes.
• Filtros por categoria e fonte, válidos no celular e nos óculos.
• Favoritos offline guardados no armazenamento do Even Hub.
• Interface completa nos óculos G2: lista nativa, leitura paginada linha a linha,
  menu de dois toques, atualização manual por gesto e filtro por fonte.
• Tema claro e escuro, sem login, sem anúncios e sem rastreamento.
```

## 7. Publicando pelo CLI (opção oficial)

Pré-requisitos: `npm run pack` gera `alemdospontos-1.1.0.ehpk`; estar logado com `evenhub login`.

```bash
# 1. entre na sua conta Even
npx evenhub login

# 2. crie o app e o build Draft (só na primeira vez)
npx evenhub create alemdospontos-1.1.0.ehpk \
  --package-id com.andrebadini.alemdospontos \
  --name "Além dos Pontos" \
  --tagline "Brazil's news, beyond the headlines." \
  --description-file store/description-pt.txt \
  --icon store/icon-24.png

# 3. veja o app e as versões
npx evenhub ls

# 4. publique uma nova versão depois de um build
npm run pack
npx evenhub upload alemdospontos-1.1.0.ehpk \
  -m "Lista: fonte em negrito, horário local com UTC, retorno à posição, menu no fim e lote mais antigo por gesto; nos óculos, retomada da matéria e lote anterior." \
  --package-id com.andrebadini.alemdospontos

# 5. ajuste textos/ícone de um app ainda em Draft
npx evenhub update \
  --package-id com.andrebadini.alemdospontos \
  --name "Além dos Pontos" \
  --tagline "Brazil's news, beyond the headlines." \
  --description-file store/description-pt.txt \
  --icon store/icon-24.png
```

O `create` deixa o app em **Draft**; a publicação pública é feita no portal do Even Hub. O `pack` valida `app.json` (nome, package id, versão, entrypoint, permissões). A checagem de disponibilidade do package id (`pack -c`) e o `create`/`upload` exigem `evenhub login`; sem sessão eles param com "Not authenticated".

## 8. Publicando pelo portal (interface web)

1. Acesse o portal de desenvolvedor do Even Hub e crie um app com o `package_id` `com.andrebadini.alemdospontos`.
2. Cole os campos da seção 1; use os textos de `store/description-pt.txt` e `store/description-en.txt`.
3. Envie o ícone `store/icon-24.png` (o portal pode pedir também o `icon-1024.png`).
4. Envie `alemdospontos-1.1.0.ehpk` como build.
5. Adicione as capturas de tela na ordem da seção 5.
6. Informe a URL de privacidade e o repositório de suporte.
7. Peça revisão. Enquanto o app está em Draft/Beta, teste no seu G2 com o QR de desenvolvimento (`npx evenhub qr --url http://<ip>:5173`).

## 9. Checklist de QA antes de enviar

- [x] `app.json` válido (nome ≤20, package id reverso, versão semver, entrypoint `index.html`, permissões em array).
- [x] `npm run build` sem erros de TypeScript.
- [x] `npm run pack` gera `alemdospontos-1.1.0.ehpk`.
- [x] Snapshot remoto do GitHub Pages respondendo com CORS (`access-control-allow-origin: *`).
- [x] Simulador: home, artigo, paginação, menu, filtro por fonte, atualização manual, salvar.
- [x] Celular: capa, leitor, busca, filtros, fontes, salvos, ajustes, tema claro/escuro.
- [x] Fallback offline com o snapshot embutido (`./data`).
- [x] Nenhum glyph não suportado no firmware (validado pelos avisos do simulador).
- [x] Sem `console.error` no app.
- [x] Ícone 24×24 validado (pixels #F4F4F4, blocos 2×2).

## 10. Observações para o revisor

- A interface é **português + English**. O modo `Automático` usa `navigator.language`/`languages` do WebView (o SDK do Even Hub não expõe idioma do sistema; `UserInfo` só tem `country`). Há seleção manual nos Ajustes e um atalho no menu dos óculos.
- As **notícias continuam em português** (idioma dos veículos); a interface, menus, filtros, dicas e avisos são traduzidos. Alguns veículos podem ter edições em inglês, mas o Além dos Pontos não as agrega nesta versão.
- `app.json` mantém `supported_languages: ["en"]` porque o schema da plataforma aceita apenas `en, de, fr, es, it, zh, ja, ko`; o idioma de runtime da interface é independente desse metadado da loja.
- O app não tem conta. O conteúdo é obtido de feeds RSS públicos e o snapshot é publicado por um workflow de 15 minutos no GitHub Actions.
- O texto completo é exibido quando o veículo o publica no feed ou permite extração pública; caso contrário, o app mostra o resumo, identifica isso como **"Resumo do Além dos Pontos"** e oferece o link original. Nunca contorna paywall.
- As notícias pertencem aos veículos; o app sempre exibe a fonte e o link. A política de privacidade e o README detalham o pipeline.
