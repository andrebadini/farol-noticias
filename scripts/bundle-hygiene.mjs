/**
 * Higiene do pacote do Even Hub. O build de produção do React DOM escreve, nas mensagens de erro
 * minificadas, o endereço `https://react.dev/errors/`; a revisão do Even Hub recusa qualquer URL
 * fora da whitelist de rede, mesmo quando ela é só texto de biblioteca. Este plugin troca o
 * formatador por um equivalente sem o link. Se o trecho esperado não existir (o React mudou), o
 * build falha em vez de deixar a URL passar em silêncio.
 */

/** Mensagem de erro de produção do React sem o link para react.dev (mesmo código e argumentos). */
const REACT_ERROR_FORMATTER = [
  'function formatProdErrorMessage(code) {',
  '  var args = [];',
  '  for (var i = 1; i < arguments.length; i++) args.push(String(arguments[i]));',
  '  return (',
  '    "Minified React error #" +',
  '    code +',
  '    (args.length ? " (args: " + args.join(", ") + ")" : "") +',
  '    "; use the non-minified dev environment for the full message."',
  '  );',
  '}',
].join('\n');
const REACT_ERROR_SOURCE =
  /function formatProdErrorMessage\(code\) \{\n\s+var url = "https:\/\/react\.dev\/errors\/" \+ code;[\s\S]*?\n\}/;

/** Reescritas aplicadas aos módulos das bibliotecas antes do bundle. */
export const BUNDLE_REWRITES = [
  {
    name: 'mensagens de erro do React (react.dev/errors)',
    file: /[\\/]react-dom[\\/]cjs[\\/][^\\/]*\.production\.js$/,
    apply(code) {
      if (!code.includes('react.dev/errors/')) return code;
      const next = code.replace(REACT_ERROR_SOURCE, REACT_ERROR_FORMATTER);
      return next.includes('react.dev/errors/') ? undefined : next;
    },
  },
];

/** Aplica a reescrita a um módulo; `null` quando o módulo não é de biblioteca tratada. */
export function rewriteModule(id, code) {
  const path = id.split('?')[0];
  const rewrite = BUNDLE_REWRITES.find((item) => item.file.test(path));
  if (!rewrite) return null;
  const next = rewrite.apply(code);
  if (next === undefined)
    throw new Error(
      `bundle-hygiene: trecho de ${rewrite.name} não encontrado em ${path}. ` +
        'A biblioteca mudou; atualize scripts/bundle-hygiene.mjs.',
    );
  return next;
}

/** Plugin Vite que aplica as reescritas só no build de produção. */
export function bundleHygiene() {
  return {
    name: 'alemdospontos-bundle-hygiene',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      const next = rewriteModule(id, code);
      return next === null || next === code ? null : { code: next, map: null };
    },
  };
}
