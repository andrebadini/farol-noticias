import { BeaconMark } from './Art'

export function BootSplash({ leaving }: { leaving: boolean }) {
  return (
    <div className={`splash ${leaving ? 'is-leaving' : ''}`} aria-hidden={leaving}>
      <div className="splash__beacon">
        <span className="splash__beam" />
        <span className="splash__beam splash__beam--2" />
        <span className="splash__dot"><BeaconMark size={38} /></span>
      </div>
      <div className="splash__word">Farol</div>
      <p className="splash__tag">notícias do Brasil, num olhar</p>
      <div className="splash__bar"><span /></div>
    </div>
  )
}

export function FeedSkeleton() {
  return (
    <div className="skeleton" aria-label="Carregando notícias">
      <div className="skeleton__hero">
        <span className="sk sk--xs" />
        <span className="sk sk--title" />
        <span className="sk sk--title sk--short" />
        <span className="sk sk--line" />
        <span className="sk sk--line sk--short" />
      </div>
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="skeleton__row" key={index}>
          <span className="sk sk--xs" />
          <span className="sk sk--line" />
          <span className="sk sk--line sk--short" />
        </div>
      ))}
    </div>
  )
}
