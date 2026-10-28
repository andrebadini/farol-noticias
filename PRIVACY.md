# Política de privacidade — Farol Notícias

**Última atualização:** 28 de outubro de 2026 · versão 1.0.0

O Farol Notícias é um leitor de notícias para o celular e para os óculos **Even Realities G2**. Esta política explica, sem letra miúda, quais dados o app usa.

## Resumo

- **Sem login.** O app não pede conta, e-mail, telefone ou qualquer dado pessoal.
- **Sem rastreamento.** Não há analytics, pixels, publicidade ou perfis de uso.
- **Sem servidor próprio de usuários.** O app apenas baixa arquivos JSON públicos.
- **Favoritos e ajustes ficam no seu aparelho**, no armazenamento local do Even Hub.

## O que o app faz na rede

O app faz requisições **GET** para:

- `https://andrebadini.github.io/farol-noticias/data/latest.json` — manchetes e metadados da edição;
- `https://andrebadini.github.io/farol-noticias/data/a/<id>.json` — texto completo da matéria que você abriu.

Esses arquivos são gerados por um robô no GitHub Actions a partir dos feeds RSS **públicos** dos veículos listados no app. Nenhuma informação sua (identificador, localização, histórico, áudio) é enviada nessas requisições.

Quando você toca em **Original** ou no link do veículo, o app abre o site do veículo em outra aba/navegador. A partir daí valem a política de privacidade e os cookies daquele site, que o Farol não controla.

## O que fica guardado

No armazenamento local do Even Hub (ou no `localStorage` do navegador, em modo de desenvolvimento):

- favoritos, com o texto da matéria;
- ajustes (tema, intervalo de atualização, tamanho do texto, fontes ativas, dicas);
- cache da última edição e das últimas matérias abertas;
- a última matéria/página exibida nos óculos, para retomar a leitura.

Esses dados **não saem do aparelho**. Ao remover o app, o sistema pode apagar esse armazenamento. Não há backup em nuvem.

## Busca por voz

O botão de microfone usa a API de reconhecimento de fala do WebView **quando ela existe**. Nesse caso, o áudio é processado pelo serviço do sistema/navegador, conforme a política da plataforma; o Farol não grava nem envia áudio para servidores próprios.

Quando a API não está disponível (situação comum no WebView do Even Hub), o app **não abre o microfone**: ele orienta o uso do ditado do teclado do celular. A busca em si é feita localmente, no texto já carregado no aparelho.

## Conteúdo de terceiros

As notícias, títulos, resumos e textos pertencem aos veículos que os publicaram. O Farol apenas organiza feeds públicos, atribui a fonte e oferece o link para o original. Pedidos de correção ou remoção de conteúdo podem ser feitos em <https://github.com/andrebadini/farol-noticias/issues>.

## Crianças

O app não coleta dados e não é direcionado a crianças. O conteúdo é jornalístico e pode incluir temas sensíveis, como qualquer portal de notícias.

## Alterações

Mudanças nesta política serão publicadas nesta página e no repositório do projeto. A data no topo indica a última revisão.

## Contato

- Issues: <https://github.com/andrebadini/farol-noticias/issues>
- Repositório: <https://github.com/andrebadini/farol-noticias>

---

## Privacy policy (English summary)

Farol Notícias is a news reader for the Even Realities G2 glasses and the phone. It has no account, no analytics, no ads and no tracking. It only performs GET requests to the public JSON snapshots at `andrebadini.github.io/farol-noticias/data/`; no user data is sent. Bookmarks, settings and caches are stored locally through the Even Hub storage and never leave the device. Voice search uses the WebView speech API only when available; otherwise the app asks you to use the keyboard dictation and never opens the microphone. News content belongs to the original publishers, and every article links back to the source. Contact: <https://github.com/andrebadini/farol-noticias/issues>.
