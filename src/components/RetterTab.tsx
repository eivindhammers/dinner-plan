import { type FormEvent, useEffect, useRef } from 'react'
import './RetterTab.css'
import type { Meal, SharedMeal } from '../firestoreUtils'

interface RetterTabProps {
  meals: Meal[]
  filteredMeals: Meal[]
  mealFilter: string
  onMealFilterChange: (value: string) => void
  formState: { title: string; ingredients: string; steps: string; imageUrl: string }
  onFormChange: (field: string, value: string) => void
  onSubmit: (event: FormEvent) => void
  editingMealId: string | null
  onStartEdit: (meal: Meal) => void
  onCancelEdit: () => void
  onDeleteMeal: (id: string) => void
  openDetails: Record<string, boolean>
  onToggleDetails: (id: string) => void
  sharedMeals: SharedMeal[]
  sharedMealFilter: string
  onSharedMealFilterChange: (value: string) => void
  sharedOpenDetails: Record<string, boolean>
  onToggleSharedDetails: (id: string) => void
  onImportSharedMeal: (meal: SharedMeal) => void
  totalSharedMeals: number
}

export function RetterTab({
  meals,
  filteredMeals,
  mealFilter,
  onMealFilterChange,
  formState,
  onFormChange,
  onSubmit,
  editingMealId,
  onStartEdit,
  onCancelEdit,
  onDeleteMeal,
  openDetails,
  onToggleDetails,
  sharedMeals,
  sharedMealFilter,
  onSharedMealFilterChange,
  sharedOpenDetails,
  onToggleSharedDetails,
  onImportSharedMeal,
  totalSharedMeals,
}: RetterTabProps) {
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editingMealId && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [editingMealId])

  return (
    <div className="retter-layout">
      <section className="card retter-form" ref={formRef}>
        <div className="section-header">
          <div>
            <p className="eyebrow">Middagsportefølje</p>
            <h2>{editingMealId ? 'Rediger rett' : 'Legg til en rett'}</h2>
          </div>
        </div>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>Navn på rett</span>
            <input
              required
              value={formState.title}
              onChange={(event) => onFormChange('title', event.target.value)}
              placeholder="F.eks. Laks med sitron og urter"
            />
          </label>
          <label className="field">
            <span>Ingredienser (én per linje)</span>
            <textarea
              value={formState.ingredients}
              onChange={(event) => onFormChange('ingredients', event.target.value)}
              placeholder={'Laks\nSitron\nHvitløk'}
              rows={3}
            />
          </label>
          <label className="field">
            <span>Fremgangsmåte (én per linje)</span>
            <textarea
              value={formState.steps}
              onChange={(event) => onFormChange('steps', event.target.value)}
              placeholder={'Skjær laksen i terninger\nFres currypaste i olje\nKok opp med kokosmelk'}
              rows={3}
            />
          </label>
          <label className="field">
            <span>Bilde-URL (valgfritt)</span>
            <input
              value={formState.imageUrl}
              onChange={(event) => onFormChange('imageUrl', event.target.value)}
              placeholder="https://ditt-bilde.no/rett.jpg"
            />
          </label>
          <p className="hint small">Bilder er valgfrie. Bruk nettadresser du stoler på.</p>
          <div className="actions">
            {editingMealId && (
              <button type="button" onClick={onCancelEdit}>
                Avbryt
              </button>
            )}
            <button type="submit" className="primary">
              {editingMealId ? 'Lagre endringer' : 'Lagre rett'}
            </button>
          </div>
        </form>
      </section>

      <section className="card retter-library">
        <div className="section-header">
          <div>
            <p className="eyebrow">Middagsportefølje</p>
            <h2>Bibliotek</h2>
          </div>
          <p className="hint">Hold oversikt over rettene du liker å lage.</p>
        </div>
        <label className="field">
          <span>Søk i retter</span>
          <input
            value={mealFilter}
            onChange={(event) => onMealFilterChange(event.target.value)}
            placeholder="Søk etter navn eller ingrediens"
          />
        </label>
        <p className="hint small">
          Viser {filteredMeals.length} av {meals.length} retter
        </p>
        {meals.length === 0 ? (
          <p className="empty">Ingen lagrede retter ennå.</p>
        ) : (
          <div className="meal-grid">
            {filteredMeals.map((meal) => {
              const ingredients = meal.ingredients
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
              const isOpen = openDetails[meal.id] ?? false
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
                      </div>
                      <div className="meal-actions">
                        <button type="button" className="ghost" onClick={() => onStartEdit(meal)}>
                          Rediger
                        </button>
                        <button type="button" className="ghost" onClick={() => onToggleDetails(meal.id)}>
                          {isOpen ? 'Skjul detaljer' : 'Vis detaljer'}
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => onDeleteMeal(meal.id)}
                        >
                          Fjern
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

      <section className="card retter-shared">
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
                          {isOpen ? 'Skjul detaljer' : 'Vis detaljer'}
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
        </section>
    </div>
  )
}
