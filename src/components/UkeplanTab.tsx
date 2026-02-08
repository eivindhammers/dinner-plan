import './UkeplanTab.css'
import type { Day, Meal, WeekPlan } from '../firestoreUtils'

const DAYS: Day[] = [
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
  'Søndag',
]

interface UkeplanTabProps {
  meals: Meal[]
  currentPlan: WeekPlan
  currentWeekStart: string
  planHasEntries: boolean
  dayInputs: Record<Day, string>
  onDayInputChange: (day: Day, value: string) => void
  onAddMealToDay: (day: Day, mealId: string) => void
  onRemoveFromPlan: (day: Day, index: number) => void
  onNavigateWeek: (direction: 1 | -1) => void
  onWeekChange: (value: string) => void
  onDownloadIcs: () => void
  dateForOffset: (offset: number) => Date
}

export function UkeplanTab({
  meals,
  currentPlan,
  currentWeekStart,
  planHasEntries,
  dayInputs,
  onDayInputChange,
  onAddMealToDay,
  onRemoveFromPlan,
  onNavigateWeek,
  onWeekChange,
  onDownloadIcs,
  dateForOffset,
}: UkeplanTabProps) {
  const renderSuggestions = (day: Day) => {
    const query = dayInputs[day].toLowerCase()
    if (!query) return null
    const matches = meals
      .filter((meal) => meal.title.toLowerCase().includes(query))
      .slice(0, 5)
    if (matches.length === 0) {
      return <p className="hint small">Ingen treff.</p>
    }
    return (
      <div className="suggestions">
        {matches.map((meal) => (
          <button
            type="button"
            key={meal.id}
            className="suggestion"
            onClick={() => onAddMealToDay(day, meal.id)}
          >
            <span>{meal.title}</span>
            <span className="hint small">
              {(meal.ingredients.split('\n').filter(Boolean)[0] ?? '').slice(0, 50)}
            </span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="week-controls">
        <label className="field">
          <span>Uke som vises</span>
          <input
            type="date"
            value={currentWeekStart}
            onChange={(event) => onWeekChange(event.target.value)}
            step={7}
          />
        </label>
        <div className="week-switcher">
          <button type="button" onClick={() => onNavigateWeek(-1)}>
            ← Forrige uke
          </button>
          <button type="button" onClick={() => onNavigateWeek(1)}>
            Neste uke →
          </button>
        </div>
        <button
          className="primary"
          onClick={onDownloadIcs}
          disabled={!planHasEntries || !currentWeekStart}
        >
          Eksporter .ics
        </button>
        {!planHasEntries && <p className="hint">Legg til retter i planen for å eksportere.</p>}
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Ukeplan</p>
            <h2>Legg til rett via autosøk</h2>
          </div>
          <p className="hint">
            Velg uke og skriv for å finne rettene dine. Flere retter per dag er lov.
          </p>
        </div>
        <div className="week-grid">
          {DAYS.map((day, offset) => (
            <div
              className={`day-card ${currentPlan[day].length ? 'has-items' : ''}`}
              key={day}
            >
              <div className="day-head">
                <div>
                  <p className="eyebrow">{day}</p>
                  <strong>
                    {dateForOffset(offset).toLocaleDateString('no-NO', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </strong>
                </div>
              </div>
              <label className="field">
                <span>Søk etter rett</span>
                <input
                  value={dayInputs[day]}
                  onChange={(event) => onDayInputChange(day, event.target.value)}
                  placeholder="Skriv for å søke"
                />
              </label>
              {renderSuggestions(day)}
              {currentPlan[day].length === 0 ? (
                <p className="empty">Ingen måltider planlagt.</p>
              ) : (
                <ul className="plan-list">
                  {currentPlan[day].map((mealId, index) => {
                    const meal = meals.find((entry) => entry.id === mealId)
                    return (
                      <li key={`${mealId}-${index}`}>
                        <div>
                          <p className="plan-title">{meal?.title ?? 'Slettet rett'}</p>
                          {meal?.ingredients && (
                            <p className="hint small">
                              {meal.ingredients.split('\n').filter(Boolean).slice(0, 2).join(' • ')}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => onRemoveFromPlan(day, index)}
                        >
                          Fjern
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
