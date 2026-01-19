import { type FormEvent, useEffect, useMemo, useState } from 'react'
import './App.css'
import { MigrationModal } from './MigrationModal'
import {
  type Meal,
  type Day,
  type WeekPlan,
  type WeeklyPlans,
  subscribeToMeals,
  subscribeToWeeklyPlans,
  addMealToFirestore,
  updateMealInFirestore,
  deleteMealFromFirestore,
  updateWeeklyPlanInFirestore,
  migrateToFirestore,
  checkFirestoreHasData,
} from './firestoreUtils'
import { isFirebaseConfigured } from './firebase'

const DAYS: Day[] = [
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
  'Søndag',
]

const DEFAULT_MEALS: Meal[] = [
  {
    id: 'seed-curry-laks',
    title: 'Superrask rød curry med laks',
    ingredients: [
      '400 g laksefilet i terninger',
      '1 rød paprika i strimler',
      '1 bunt vårløk i skiver',
      '100 g sukkererter i staver',
      '2 ss rød currypaste',
      '1 boks kokosmelk (4 dl)',
      '1 terning fiskebuljong',
      '1 ss olje til steking',
      'Limebåter og frisk koriander til servering',
      'Kokt ris eller nudler som tilbehør',
    ].join('\n'),
    imageUrl: 'https://www.godfisk.no/globalassets/3iuka/godfisk/laks/rod-curry-laks.jpg',
    steps: [
      'Skjær laksen i terninger.',
      'Strimle vårløk og skjær paprika og sukkererter i staver.',
      'Varm olje i en gryte og fres rød currypaste kort.',
      'Tilsett kokosmelk og fiskebuljong, kok opp.',
      'Ha i fisk og grønnsaker og la trekke til fisken er ferdig (ca. 5 min).',
      'Server med ris eller nudler, lime og koriander.',
    ].join('\n'),
  },
  {
    id: 'seed-pannekaker',
    title: 'Pannekaker',
    ingredients: [
      '3 dl hvetemel',
      '0,5 ts salt',
      '5 dl melk',
      '4 egg',
      '1 ss smør eller margarin til røren',
    ].join('\n'),
    imageUrl: 'https://images.matprat.no/mvgzxlprh3-normal/710/pannekakerøre.jpg.png',
    steps: [
      'Bland mel og salt i en stor bolle.',
      'Visp inn halvparten av melken til en klumpfri røre, rør inn resten av melken.',
      'Visp inn eggene og la røren svelle i ca. 30 minutter.',
      'Smelt smør i en varm stekepanne og stek tynne pannekaker, snu når oversiden har satt seg.',
      'Legg pannekakene i et fat med lokk for å holde dem varme til servering.',
    ].join('\n'),
  },
]

const MEAL_STORAGE_KEY = 'dinner-plan:meals'
const LEGACY_PLAN_KEY = 'dinner-plan:weekly-plan'
const LEGACY_WEEK_START_KEY = 'dinner-plan:week-start'
const WEEKLY_PLANS_KEY = 'dinner-plan:weekly-plans'
const AUTH_KEY = 'dinner-plan:auth'
const MIGRATION_DONE_KEY = 'dinner-plan:migration-done'
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD ?? 'familie'

const pad = (n: number) => n.toString().padStart(2, '0')
const formatDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const parseDate = (value: string) => {
  const parts = value.split('-').map(Number)
  if (parts.length === 3 && parts.every((p) => !Number.isNaN(p))) {
    return new Date(parts[0], parts[1] - 1, parts[2])
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

const toMonday = (value: string) => {
  if (!value) return getUpcomingMonday()
  const date = parseDate(value)
  if (Number.isNaN(date.getTime())) return getUpcomingMonday()
  const day = date.getDay() || 7
  const diff = 1 - day
  date.setDate(date.getDate() + diff)
  return formatDate(date)
}

const emptyPlan = (): WeekPlan =>
  DAYS.reduce(
    (acc, day) => ({
      ...acc,
      [day]: [],
    }),
    {} as WeekPlan,
  )

const getUpcomingMonday = () => {
  const now = new Date()
  const weekday = now.getDay() || 7
  const diff = (1 - weekday + 7) % 7
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

const ensurePlanShape = (plan?: Partial<Record<Day, string[]>>): WeekPlan => {
  const base = emptyPlan()
  if (!plan) return base
  DAYS.forEach((day) => {
    base[day] = Array.isArray(plan[day]) ? plan[day]! : []
  })
  return base
}

const loadMeals = (): Meal[] => {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(MEAL_STORAGE_KEY)
  if (!raw) return DEFAULT_MEALS
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.length === 0 ? DEFAULT_MEALS : parsed
    return DEFAULT_MEALS
  } catch {
    return DEFAULT_MEALS
  }
}

const loadWeeklyPlans = (): WeeklyPlans => {
  if (typeof window === 'undefined') return {}
  const plansRaw = localStorage.getItem(WEEKLY_PLANS_KEY)
  const result: WeeklyPlans = {}

  if (plansRaw) {
    try {
      const parsed = JSON.parse(plansRaw) as Record<string, Partial<Record<Day, string[]>>>
      Object.entries(parsed).forEach(([week, plan]) => {
        const monday = toMonday(week)
        result[monday] = ensurePlanShape(plan)
      })
    } catch {
      // ignore broken data
    }
  }

  // Legacy single-plan storage: migrate into current week
  const legacyPlanRaw = localStorage.getItem(LEGACY_PLAN_KEY)
  if (legacyPlanRaw) {
    const weekStart = localStorage.getItem(LEGACY_WEEK_START_KEY) ?? getUpcomingMonday()
    try {
      const legacyPlan = JSON.parse(legacyPlanRaw) as Partial<Record<Day, string[]>>
      result[toMonday(weekStart)] = ensurePlanShape(legacyPlan)
    } catch {
      // ignore
    }
  }

  return result
}

const loadInitialWeekStart = (existingPlans: WeeklyPlans) => {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(LEGACY_WEEK_START_KEY) : null
  const weeks = Object.keys(existingPlans)
  if (stored && existingPlans[toMonday(stored)]) return toMonday(stored)
  if (stored) return toMonday(stored)
  if (weeks.length > 0) return weeks.sort()[weeks.length - 1]
  return getUpcomingMonday()
}

const escapeText = (text: string) =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')

const formatDateForICS = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '')

const buildIcsFile = (plan: WeekPlan, meals: Meal[], weekStartDate: string) => {
  if (!weekStartDate) return ''
  const startDate = new Date(weekStartDate)
  startDate.setHours(0, 0, 0, 0)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'PRODID:-//Middag Planlegger//EN',
  ]

  DAYS.forEach((day, offset) => {
    const dayMeals = plan[day] ?? []
    dayMeals.forEach((mealId, index) => {
      const meal = meals.find((entry) => entry.id === mealId)
      if (!meal) return

      const eventDate = new Date(startDate)
      eventDate.setDate(startDate.getDate() + offset)
      const endDate = new Date(eventDate)
      endDate.setDate(eventDate.getDate() + 1)

      const ingredients = meal.ingredients
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `- ${item}`)
        .join('\\n')

      const steps = meal.steps
        ? meal.steps
            .split('\n')
            .map((item, i) => `${i + 1}. ${item.trim()}`)
            .filter(Boolean)
            .join('\\n')
        : ''

      const description = [
        ingredients ? `Ingredienser:\\n${ingredients}` : '',
        steps ? `Fremgangsmåte:\\n${steps}` : '',
        meal.imageUrl ? `Bilde: ${meal.imageUrl}` : '',
      ]
        .filter(Boolean)
        .join('\\n')

      const titleWithEmoji = `🥗 ${meal.title}`

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${meal.id}-${offset}-${index}@dinner-plan`)
      lines.push(`SUMMARY:${escapeText(titleWithEmoji)}`)
      if (description) {
        lines.push(`DESCRIPTION:${escapeText(description)}`)
      }
      lines.push(`DTSTART;VALUE=DATE:${formatDateForICS(eventDate)}`)
      lines.push(`DTEND;VALUE=DATE:${formatDateForICS(endDate)}`)
      lines.push('TRANSP:TRANSPARENT')
      lines.push('END:VEVENT')
    })
  })

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const initialPlans = loadWeeklyPlans()

function App() {
  const [meals, setMeals] = useState<Meal[]>(loadMeals)
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlans>(initialPlans)
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(() =>
    loadInitialWeekStart(initialPlans),
  )
  const [formState, setFormState] = useState({
    title: '',
    ingredients: '',
    steps: '',
    imageUrl: '',
  })
  const [mealFilter, setMealFilter] = useState('')
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({})
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [dayInputs, setDayInputs] = useState<Record<Day, string>>(
    () =>
      DAYS.reduce(
        (acc, day) => ({
          ...acc,
          [day]: '',
        }),
        {} as Record<Day, string>,
      ),
  )
  const [authorized, setAuthorized] = useState(() =>
    typeof window === 'undefined' ? false : localStorage.getItem(AUTH_KEY) === 'ok',
  )
  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [firestoreError, setFirestoreError] = useState<string | null>(null)
  const [useFirestore, setUseFirestore] = useState(isFirebaseConfigured())

  // Check if migration is needed on mount
  useEffect(() => {
    const checkMigration = async () => {
      if (!isFirebaseConfigured()) {
        setUseFirestore(false)
        setIsLoading(false)
        return
      }

      const migrationDone = localStorage.getItem(MIGRATION_DONE_KEY) === 'true'
      const hasFirestoreData = await checkFirestoreHasData()

      // Show migration modal if:
      // 1. Migration not done yet
      // 2. Firestore doesn't have data
      // 3. localStorage has data
      const localMeals = loadMeals()
      const localPlans = loadWeeklyPlans()
      const hasLocalData =
        localMeals.length > 0 || Object.keys(localPlans).length > 0

      if (!migrationDone && !hasFirestoreData && hasLocalData) {
        setShowMigrationModal(true)
      }

      setIsLoading(false)
    }

    checkMigration()
  }, [])

  // Subscribe to Firestore meals
  useEffect(() => {
    if (!useFirestore) {
      return
    }

    let hasInitialized = false

    const unsubscribe = subscribeToMeals(
      async (firestoreMeals) => {
        // If Firestore has data, use it
        if (firestoreMeals.length > 0) {
          setMeals(firestoreMeals)
          setIsLoading(false)
        } else if (!hasInitialized) {
          // Initialize with default meals if Firestore is empty (new user, first time)
          hasInitialized = true
          setMeals(DEFAULT_MEALS)
          setIsLoading(false)
          
          // Add default meals to Firestore for new users (in background)
          try {
            for (const meal of DEFAULT_MEALS) {
              await addMealToFirestore(meal)
            }
          } catch (error) {
            console.error('Error adding default meals:', error)
          }
        }
      },
      (error) => {
        console.error('Firestore meals error:', error)
        setFirestoreError('Kunne ikke laste retter fra Firebase')
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [useFirestore])

  // Subscribe to Firestore weekly plans
  useEffect(() => {
    if (!useFirestore) return

    const unsubscribe = subscribeToWeeklyPlans(
      (firestorePlans) => {
        setWeeklyPlans(firestorePlans)
      },
      (error) => {
        console.error('Firestore plans error:', error)
        setFirestoreError('Kunne ikke laste ukeplaner fra Firebase')
      },
    )

    return () => unsubscribe()
  }, [useFirestore])

  // Fallback to localStorage if not using Firestore
  useEffect(() => {
    if (useFirestore) return
    localStorage.setItem(MEAL_STORAGE_KEY, JSON.stringify(meals))
  }, [meals, useFirestore])

  useEffect(() => {
    if (useFirestore) return
    localStorage.setItem(WEEKLY_PLANS_KEY, JSON.stringify(weeklyPlans))
  }, [weeklyPlans, useFirestore])

  useEffect(() => {
    localStorage.setItem(LEGACY_WEEK_START_KEY, currentWeekStart)
  }, [currentWeekStart])

  const handleAuth = (event: FormEvent) => {
    event.preventDefault()
    if (passwordInput === APP_PASSWORD) {
      setAuthorized(true)
      localStorage.setItem(AUTH_KEY, 'ok')
      setAuthError('')
    } else {
      setAuthError('Feil passord. Prøv igjen.')
    }
  }

  const handleMigration = async (
    mealsToMigrate: Meal[],
    plansToMigrate: WeeklyPlans,
    onProgress: (status: string) => void,
  ) => {
    await migrateToFirestore(mealsToMigrate, plansToMigrate, onProgress)
    localStorage.setItem(MIGRATION_DONE_KEY, 'true')
    setShowMigrationModal(false)
  }

  const dismissMigrationModal = () => {
    // User chose not to migrate, mark as done so modal doesn't show again
    localStorage.setItem(MIGRATION_DONE_KEY, 'true')
    setShowMigrationModal(false)
  }

  const currentPlan = useMemo(
    () => weeklyPlans[currentWeekStart] ?? emptyPlan(),
    [weeklyPlans, currentWeekStart],
  )

  const planHasEntries = useMemo(
    () => DAYS.some((day) => currentPlan[day]?.length),
    [currentPlan],
  )

  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    Object.values(weeklyPlans).forEach((plan) => {
      DAYS.forEach((day) => {
        plan[day]?.forEach((mealId) => {
          counts[mealId] = (counts[mealId] ?? 0) + 1
        })
      })
    })
    return Object.entries(counts)
      .map(([id, count]) => ({
        meal: meals.find((m) => m.id === id),
        count,
      }))
      .filter((entry) => entry.meal)
      .sort((a, b) => b.count - a.count)
  }, [weeklyPlans, meals])

  const filteredMeals = useMemo(() => {
    const q = mealFilter.trim().toLowerCase()
    if (!q) return meals
    return meals.filter(
      (meal) =>
        meal.title.toLowerCase().includes(q) ||
        meal.ingredients.toLowerCase().includes(q) ||
        (meal.steps?.toLowerCase().includes(q) ?? false),
    )
  }, [meals, mealFilter])

  const weekList = useMemo(() => Object.keys(weeklyPlans).sort(), [weeklyPlans])

  const ensureWeekExists = async (weekStart: string) => {
    const monday = toMonday(weekStart)
    if (weeklyPlans[monday]) return

    const newPlan = emptyPlan()

    try {
      if (useFirestore) {
        await updateWeeklyPlanInFirestore(monday, newPlan)
      } else {
        // Fallback to localStorage
        setWeeklyPlans((prev) => ({
          ...prev,
          [monday]: newPlan,
        }))
      }
    } catch (error) {
      console.error('Error creating week:', error)
      setFirestoreError('Kunne ikke opprette uke')
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!formState.title.trim()) return

    const mealData: Meal = {
      id: editingMealId || makeId(),
      title: formState.title.trim(),
      ingredients: formState.ingredients.trim(),
      steps: formState.steps.trim() || undefined,
      imageUrl: formState.imageUrl.trim() || undefined,
    }

    try {
      if (useFirestore) {
        if (editingMealId) {
          await updateMealInFirestore(mealData)
        } else {
          await addMealToFirestore(mealData)
        }
      } else {
        // Fallback to localStorage
        if (editingMealId) {
          setMeals((prev) =>
            prev.map((meal) => (meal.id === editingMealId ? mealData : meal)),
          )
        } else {
          setMeals((prev) => [...prev, mealData])
        }
      }

      setEditingMealId(null)
      setFormState({ title: '', ingredients: '', steps: '', imageUrl: '' })
    } catch (error) {
      console.error('Error saving meal:', error)
      setFirestoreError('Kunne ikke lagre rett')
    }
  }

  const startEdit = (meal: Meal) => {
    setEditingMealId(meal.id)
    setFormState({
      title: meal.title,
      ingredients: meal.ingredients,
      steps: meal.steps ?? '',
      imageUrl: meal.imageUrl ?? '',
    })
    setOpenDetails((prev) => ({ ...prev, [meal.id]: true }))
  }

  const cancelEdit = () => {
    setEditingMealId(null)
    setFormState({ title: '', ingredients: '', steps: '', imageUrl: '' })
  }

  const deleteMeal = async (id: string) => {
    try {
      if (useFirestore) {
        await deleteMealFromFirestore(id)
        // Also update weekly plans to remove the meal
        const updatedPlans: WeeklyPlans = {}
        Object.entries(weeklyPlans).forEach(([week, plan]) => {
          const updated = emptyPlan()
          DAYS.forEach((day) => {
            updated[day] = plan[day].filter((mealId) => mealId !== id)
          })
          updatedPlans[week] = updated
        })
        // Update all affected plans in Firestore
        for (const [week, plan] of Object.entries(updatedPlans)) {
          if (JSON.stringify(plan) !== JSON.stringify(weeklyPlans[week])) {
            await updateWeeklyPlanInFirestore(week, plan)
          }
        }
      } else {
        // Fallback to localStorage
        setMeals((prev) => prev.filter((meal) => meal.id !== id))
        setWeeklyPlans((prev) => {
          const next: WeeklyPlans = {}
          Object.entries(prev).forEach(([week, plan]) => {
            const updated = emptyPlan()
            DAYS.forEach((day) => {
              updated[day] = plan[day].filter((mealId) => mealId !== id)
            })
            next[week] = updated
          })
          return next
        })
      }
    } catch (error) {
      console.error('Error deleting meal:', error)
      setFirestoreError('Kunne ikke slette rett')
    }
  }

  const addMealToDay = async (day: Day, mealId: string) => {
    if (!mealId) return

    const newPlan: WeekPlan = {
      ...(weeklyPlans[currentWeekStart] ?? emptyPlan()),
      [day]: [...(weeklyPlans[currentWeekStart]?.[day] ?? []), mealId],
    }

    try {
      if (useFirestore) {
        await updateWeeklyPlanInFirestore(currentWeekStart, newPlan)
      } else {
        // Fallback to localStorage
        setWeeklyPlans((prev) => ({
          ...prev,
          [currentWeekStart]: newPlan,
        }))
      }
      setDayInputs((prev) => ({ ...prev, [day]: '' }))
    } catch (error) {
      console.error('Error adding meal to day:', error)
      setFirestoreError('Kunne ikke legge til rett i planen')
    }
  }

  const toggleDetails = (id: string) => {
    setOpenDetails((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const removeFromPlan = async (day: Day, index: number) => {
    const plan = weeklyPlans[currentWeekStart] ?? emptyPlan()
    const newPlan: WeekPlan = {
      ...plan,
      [day]: plan[day].filter((_, i) => i !== index),
    }

    try {
      if (useFirestore) {
        await updateWeeklyPlanInFirestore(currentWeekStart, newPlan)
      } else {
        // Fallback to localStorage
        setWeeklyPlans((prev) => ({
          ...prev,
          [currentWeekStart]: newPlan,
        }))
      }
    } catch (error) {
      console.error('Error removing meal from plan:', error)
      setFirestoreError('Kunne ikke fjerne rett fra planen')
    }
  }

  const handleDownloadIcs = () => {
    const content = buildIcsFile(currentPlan, meals, currentWeekStart)
    if (!content) return
    const blob = new Blob([content], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'middag-plan.ics'
    link.click()
    URL.revokeObjectURL(url)
  }

  const dateForOffset = (offset: number) => {
    const base = currentWeekStart ? parseDate(currentWeekStart) : new Date()
    base.setHours(0, 0, 0, 0)
    if (Number.isNaN(base.getTime())) return new Date()
    base.setDate(base.getDate() + offset)
    return base
  }

  const navigateWeek = (direction: 1 | -1) => {
    const base = currentWeekStart ? new Date(currentWeekStart) : new Date()
    base.setDate(base.getDate() + direction * 7)
    const nextWeek = toMonday(base.toISOString().split('T')[0])
    ensureWeekExists(nextWeek)
    setCurrentWeekStart(nextWeek)
  }

  const handleWeekChange = (value: string) => {
    if (!value) return
    const monday = toMonday(value)
    ensureWeekExists(monday)
    setCurrentWeekStart(monday)
  }

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
            onClick={() => addMealToDay(day, meal.id)}
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

  if (!authorized) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Middag (beskyttet)</h1>
          <p className="hint">Denne appen er passordbeskyttet for familien.</p>
          <form className="form" onSubmit={handleAuth}>
            <label className="field">
              <span>Passord</span>
              <input
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="Skriv passordet"
              />
            </label>
            {authError && <p className="error">{authError}</p>}
            <div className="actions">
              <button type="submit" className="primary">
                Lås opp
              </button>
            </div>
          </form>
          <p className="hint small">Sett VITE_APP_PASSWORD i miljøet for å endre passord.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Laster...</h1>
          <p className="hint">Henter data fra Firebase...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {showMigrationModal && (
        <MigrationModal
          meals={loadMeals()}
          weeklyPlans={loadWeeklyPlans()}
          onMigrate={handleMigration}
          onDismiss={dismissMigrationModal}
        />
      )}
      {firestoreError && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>⚠️ Feil</h2>
            <p>{firestoreError}</p>
            <div className="actions">
              <button
                type="button"
                className="primary"
                onClick={() => setFirestoreError(null)}
              >
                Lukk
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Middag</p>
          <h1>Planlegg ukeplanen med favorittrettene dine</h1>
          <p className="lede">
            Lagre rettene dine, legg dem til mandag–søndag med autosøk, og eksporter til kalenderen
            din som heldags hendelser.
          </p>
        </div>
        <div className="export">
          <label className="field">
            <span>Uke som vises</span>
            <input
              type="date"
              value={currentWeekStart}
              onChange={(event) => handleWeekChange(event.target.value || getUpcomingMonday())}
              step={7}
            />
          </label>
          <div className="week-switcher">
            <button type="button" onClick={() => navigateWeek(-1)}>
              ← Forrige uke
            </button>
            <button type="button" onClick={() => navigateWeek(1)}>
              Neste uke →
            </button>
          </div>
          <button
            className="primary"
            onClick={handleDownloadIcs}
            disabled={!planHasEntries || !currentWeekStart}
          >
            Eksporter .ics
          </button>
          {!planHasEntries && <p className="hint">Legg til retter i planen for å eksportere.</p>}
        </div>
      </header>

      <div className="grid">
        <section className="card">
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
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="F.eks. Laks med sitron og urter"
              />
            </label>
            <label className="field">
              <span>Ingredienser (én per linje)</span>
              <textarea
                value={formState.ingredients}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, ingredients: event.target.value }))
                }
                placeholder={'Laks\nSitron\nHvitløk\nOlivenolje'}
                rows={5}
              />
            </label>
            <label className="field">
              <span>Fremgangsmåte (én per linje)</span>
              <textarea
                value={formState.steps}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, steps: event.target.value }))
                }
                placeholder={'Skjær laksen i terninger\nFres currypaste i olje\nKok opp med kokosmelk'}
                rows={5}
              />
            </label>
            <label className="field">
              <span>Bilde-URL (valgfritt)</span>
              <input
                value={formState.imageUrl}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, imageUrl: event.target.value }))
                }
                placeholder="https://ditt-bilde.no/rett.jpg"
              />
            </label>
            <p className="hint small">Bilder er valgfrie. Bruk nettadresser du stoler på.</p>
            <div className="actions">
              {editingMealId && (
                <button type="button" onClick={cancelEdit}>
                  Avbryt
                </button>
              )}
              <button type="submit" className="primary">
                {editingMealId ? 'Lagre endringer' : 'Lagre rett'}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
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
              onChange={(event) => setMealFilter(event.target.value)}
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
                          <button type="button" className="ghost" onClick={() => startEdit(meal)}>
                            Rediger
                          </button>
                          <button type="button" className="ghost" onClick={() => toggleDetails(meal.id)}>
                            {isOpen ? 'Skjul detaljer' : 'Vis detaljer'}
                          </button>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => deleteMeal(meal.id)}
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
                  onChange={(event) =>
                    setDayInputs((prev) => ({ ...prev, [day]: event.target.value }))
                  }
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
                          onClick={() => removeFromPlan(day, index)}
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
                  onClick={() => handleWeekChange(week)}
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
    </div>
    </>
  )
}

export default App
