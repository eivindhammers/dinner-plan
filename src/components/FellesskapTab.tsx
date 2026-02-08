import './FellesskapTab.css'
import type { SharedMeal } from '../firestoreUtils'

interface FellesskapTabProps {
  sharedMeals: SharedMeal[]
  sharedMealFilter: string
  onSharedMealFilterChange: (value: string) => void
  sharedOpenDetails: Record<string, boolean>
  onToggleSharedDetails: (id: string) => void
  onImportSharedMeal: (meal: SharedMeal) => void
  totalSharedMeals: number
}

export function FellesskapTab({
  sharedMeals,
  sharedMealFilter,
  onSharedMealFilterChange,
  sharedOpenDetails,
  onToggleSharedDetails,
  onImportSharedMeal,
  totalSharedMeals,
}: FellesskapTabProps) {
  return (
    <section className="card fellesskap-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Fellesskap</p>
          <h2>Fellesbibliotek</h2>
        </div>
        <p className="hint">Retter delt av alle husstander. Importer til ditt eget bibliotek.</p>
      </div>
      <label className="field">
        <span>Søk i delte retter</span>
        <input
          value={sharedMealFilter}
          onChange={(event) => onSharedMealFilterChange(event.target.value)}
          placeholder="Søk etter navn, ingrediens eller husstand"
        />
      </label>
      <p className="hint small">
        Viser {sharedMeals.length} av {totalSharedMeals} delte retter
      </p>
      {sharedMeals.length === 0 && !sharedMealFilter ? (
        <p className="empty">Ingen delte retter ennå.</p>
      ) : (
        <div className="meal-grid">
          {sharedMeals.map((meal) => {
            const ingredients = meal.ingredients
              .split('\n')
              .map((item) => item.trim())
              .filter(Boolean)
            const isOpen = sharedOpenDetails[meal.id] ?? false
            return (
              <article className="meal-card" key={meal.id}>
                <div className="thumb">
                  {meal.imageUrl ? (
                    <img src={meal.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="placeholder" aria-hidden />
                  )}
                </div>
                <div className="meal-body">
                  <div className="meal-header">
                    <div>
                      <h3>{meal.title}</h3>
                      <p className="shared-by">Delt av {meal.addedByHousehold}</p>
                    </div>
                    <div className="meal-actions">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onToggleSharedDetails(meal.id)}
                      >
                        {isOpen ? 'Skjul' : 'Detaljer'}
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => onImportSharedMeal(meal)}
                      >
                        Legg til
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <>
                      {ingredients.length > 0 && (
                        <ul className="ingredients">
                          {ingredients.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      )}
                      {meal.steps && (
                        <ol className="steps">
                          {meal.steps
                            .split('\n')
                            .map((step) => step.trim())
                            .filter(Boolean)
                            .map((step, index) => (
                              <li key={index}>{step}</li>
                            ))}
                        </ol>
                      )}
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
