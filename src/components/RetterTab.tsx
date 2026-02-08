import { type FormEvent, useEffect, useRef, useState } from 'react'
import './RetterTab.css'
import type { Day, Meal, SharedMeal, WeekPlan } from '../firestoreUtils'

const SHORT_DAYS: { key: Day; label: string }[] = [
  { key: 'Mandag', label: 'Ma' },
  { key: 'Tirsdag', label: 'Ti' },
  { key: 'Onsdag', label: 'On' },
  { key: 'Torsdag', label: 'To' },
  { key: 'Fredag', label: 'Fr' },
  { key: 'Lørdag', label: 'Lø' },
  { key: 'Søndag', label: 'Sø' },
]

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
  currentPlan: WeekPlan
  onAddMealToDay: (day: Day, mealId: string) => void
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
  currentPlan,
  onAddMealToDay,
  sharedMeals,
  sharedMealFilter,
  onSharedMealFilterChange,
  sharedOpenDetails,
  onToggleSharedDetails,
  onImportSharedMeal,
  totalSharedMeals,
}: RetterTabProps) {
  const formRef = useRef<HTMLDivElement>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [dayPickerMealId, setDayPickerMealId] = useState<string | null>(null)
  const [addedConfirm, setAddedConfirm] = useState<string | null>(null)

  // Auto-open form when editing
  useEffect(() => {
    if (editingMealId) {
      setFormOpen(true)
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [editingMealId])

  // Close form after successful save (editingMealId cleared and form fields reset)
  const handleSubmit = (event: FormEvent) => {
    onSubmit(event)
    if (!editingMealId) {
      setFormOpen(false)
    }
  }

  const handleCancelEdit = () => {
    onCancelEdit()
    setFormOpen(false)
  }

  const handleAddToDay = (day: Day, mealId: string) => {
    onAddMealToDay(day, mealId)
    setDayPickerMealId(null)
    setAddedConfirm(mealId)
    setTimeout(() => setAddedConfirm(null), 1500)
  }

  return (
    <div className="retter-layout">
      <div ref={formRef}>
        {formOpen ? (
          <section className="card retter-form">
            <div className="section-header">
              <div>
                <p className="eyebrow">Middagsportefølje</p>
                <h2>{editingMealId ? 'Rediger rett' : 'Legg til en rett'}</h2>
              </div>
              {!editingMealId && (
                <button type="button" className="ghost" onClick={() => setFormOpen(false)}>
                  Lukk
                </button>
              )}
            </div>
            <form className="form" onSubmit={handleSubmit}>
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
                <span>Ingredienser (en per linje)</span>
                <textarea
                  value={formState.ingredients}
                  onChange={(event) => onFormChange('ingredients', event.target.value)}
                  placeholder={'Laks\nSitron\nHvitløk'}
                  rows={3}
                />
              </label>
              <label className="field">
                <span>Fremgangsmåte (en per linje)</span>
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
                  <button type="button" onClick={handleCancelEdit}>
                    Avbryt
                  </button>
                )}
                <button type="submit" className="primary">
                  {editingMealId ? 'Lagre endringer' : 'Lagre rett'}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <button type="button" className="add-meal-btn" onClick={() => setFormOpen(true)}>
            + Ny rett
          </button>
        )}
      </div>

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
          <p className="empty">Ingen lagrede retter ennå. Importer fra fellesbiblioteket nedenfor.</p>
        ) : (
          <div className="meal-grid">
            {filteredMeals.map((meal) => {
              const ingredients = meal.ingredients
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
              const isOpen = openDetails[meal.id] ?? false
              const showDayPicker = dayPickerMealId === meal.id
              const justAdded = addedConfirm === meal.id
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
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setDayPickerMealId(showDayPicker ? null : meal.id)}
                        >
                          {justAdded ? 'Lagt til!' : 'Planlegg'}
                        </button>
                        <button type="button" className="ghost" onClick={() => onStartEdit(meal)}>
                          Rediger
                        </button>
                        <button type="button" className="ghost" onClick={() => onToggleDetails(meal.id)}>
                          {isOpen ? 'Skjul' : 'Detaljer'}
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
                    {showDayPicker && (
                      <div className="day-picker">
                        {SHORT_DAYS.map(({ key, label }) => {
                          const count = currentPlan[key]?.length ?? 0
                          return (
                            <button
                              type="button"
                              key={key}
                              className={`day-chip ${count > 0 ? 'has-meals' : ''}`}
                              onClick={() => handleAddToDay(key, meal.id)}
                              title={key}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    )}
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
      </section>
    </div>
  )
}
