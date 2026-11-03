// Roteamento do duplo toque nos óculos, isolado para teste.
// Regra do Even Hub: na página raiz (home), o duplo toque abre o diálogo
// de saída do sistema via shutDownPageContainer(1). Nas demais telas, o
// duplo toque continua navegando (abrir ações da matéria ou voltar).
export type GlassesScreen = 'home' | 'article' | 'actions' | 'sources' | 'saved' | 'help'
export type DoubleTapAction = 'exit-dialog' | 'actions' | 'home'

export function doubleTapAction(screen: GlassesScreen): DoubleTapAction {
  if (screen === 'home') return 'exit-dialog'
  if (screen === 'article') return 'actions'
  return 'home'
}
