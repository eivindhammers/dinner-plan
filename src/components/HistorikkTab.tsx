import './HistorikkTab.css'
import type { Day, Meal, WeeklyPlans } from '../firestoreUtils'

const DAYS: Day[] = [
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
  'Søndag',
]

interface HistorikkTabProps {
  weekList: string[]
  weeklyPlans: WeeklyPlans
  currentWeekStart: string
  stats: { meal: Meal | undefined; count: number }[]
  onWeekChange: (value: string) => void
}

export function HistorikkTab({
  weekList,
  weeklyPlans,
  currentWeekStart,
  stats,
  onWeekChange,
}: HistorikkTabProps) {
  return (
    <>
      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Historikk</p>
            <h2>Tidligere uker</h2>
          </div>
          <p className="hint">Velg en uke fra historikken for å se eller redigere.</p>
        </div>
        {weekList.length === 0 ? (
          <p className="empty">Ingen uker lagret ennå.</p>
        ) : (
          <div className="history-grid">
            {weekList.map((week) => {
              const plannedCount = DAYS.reduce(
                (acc, day) => acc + (weeklyPlans[week]?.[day]?.length ?? 0),
                0,
              )
              return (
                <button
                  key={week}
                  className={`history-card ${week === currentWeekStart ? 'active' : ''}`}
                  onClick={() => onWeekChange(week)}
                >
                  <div>
                    <p className="hint small">Uke som starter</p>
                    <strong>{new Date(week).toLocaleDateString('no-NO')}</strong>
                  </div>
                  <p className="hint small">{plannedCount} planlagte retter</p>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Statistikk</p>
            <h2>Hyppighet</h2>
          </div>
          <p className="hint">Oppsummerer alle lagrede uker.</p>
        </div>
        {stats.length === 0 ? (
          <p className="empty">Ingen statistikk ennå. Legg til retter i flere uker.</p>
        ) : (
          <ul className="stats-list">
            {stats.map(({ meal, count }) => (
              <li key={meal!.id}>
                <div>
                  <p className="plan-title">{meal!.title}</p>
                  <p className="hint small">Valgt {count} ganger</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
