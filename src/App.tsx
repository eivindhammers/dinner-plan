import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import './App.css'
import { MigrationModal } from './MigrationModal'
import {
  type Meal,
  type Day,
  type WeekPlan,
  type WeeklyPlans,
  type SharedMeal,
  subscribeToMeals,
  subscribeToWeeklyPlans,
  addMealToFirestore,
  updateMealInFirestore,
  deleteMealFromFirestore,
  updateWeeklyPlanInFirestore,
  migrateToFirestore,
  checkFirestoreHasData,
  migrateLegacyMealsToShared,
  createUserProfile,
  getUserProfile,
  subscribeToSharedMeals,
  shareMealToGlobal,
  importSharedMeal,
  makeId,
} from './firestoreUtils'
import { auth, isFirebaseConfigured } from './firebase'
import { TabBar, type TabId } from './components/TabBar'
import { UkeplanTab } from './components/UkeplanTab'
import { RetterTab } from './components/RetterTab'
import { HistorikkTab } from './components/HistorikkTab'

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
const MIGRATION_DONE_KEY = 'dinner-plan:migration-done'

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

const initialPlans = loadWeeklyPlans()

function App() {
  // Firebase Auth state
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured())
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authHouseholdName, setAuthHouseholdName] = useState('')
  const [authError, setAuthError] = useState('')
  const [householdName, setHouseholdName] = useState('')

  // Shared meals state
  const [sharedMeals, setSharedMeals] = useState<SharedMeal[]>([])
  const [sharedMealFilter, setSharedMealFilter] = useState('')
  const [sharedOpenDetails, setSharedOpenDetails] = useState<Record<string, boolean>>({})

  // App state
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
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [firestoreError, setFirestoreError] = useState<string | null>(null)
  const [useFirestore, setUseFirestore] = useState(isFirebaseConfigured())
  const [creatingWeeks, setCreatingWeeks] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<TabId>('ukeplan')

  // Firebase Auth listener
  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setAuthLoading(false)
      setIsLoading(false)
      setUseFirestore(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setAuthLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Load user profile when authenticated
  useEffect(() => {
    if (!user) {
      setHouseholdName('')
      return
    }

    getUserProfile(user.uid).then((profile) => {
      if (profile) {
        setHouseholdName(profile.householdName)
      }
    })
  }, [user])

  // Subscribe to shared meals when authenticated
  useEffect(() => {
    if (!user) return

    const unsubscribe = subscribeToSharedMeals(
      (meals) => setSharedMeals(meals),
      (error) => console.error('Shared meals error:', error),
    )

    return () => unsubscribe()
  }, [user])

  // Migrate legacy top-level meals to shared library (one-time, tracked in Firestore)
  useEffect(() => {
    if (!user) return
    migrateLegacyMealsToShared(user.uid, householdName || 'Ukjent')
  }, [user, householdName])

  // Check if localStorage → Firestore migration is needed
  useEffect(() => {
    if (!user) return

    const checkMigration = async () => {
      try {
        const migrationDone = localStorage.getItem(MIGRATION_DONE_KEY) === 'true'
        const hasFirestoreData = await checkFirestoreHasData(user.uid)

        const localMeals = loadMeals()
        const localPlans = loadWeeklyPlans()
        const hasLocalData =
          localMeals.length > 0 || Object.keys(localPlans).length > 0

        if (!migrationDone && !hasFirestoreData && hasLocalData) {
          setShowMigrationModal(true)
        }
      } catch (error) {
        console.error('Error during migration check:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkMigration()
  }, [user])

  // Subscribe to Firestore meals
  useEffect(() => {
    if (!useFirestore || !user) return

    const unsubscribe = subscribeToMeals(
      user.uid,
      (firestoreMeals) => {
        setMeals(firestoreMeals)
        setIsLoading(false)
      },
      (error) => {
        console.error('Firestore meals error:', error)
        setFirestoreError('Kunne ikke laste retter fra Firebase')
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [useFirestore, user])

  // Subscribe to Firestore weekly plans
  useEffect(() => {
    if (!useFirestore || !user) return

    const unsubscribe = subscribeToWeeklyPlans(
      user.uid,
      (firestorePlans) => {
        setWeeklyPlans(firestorePlans)
      },
      (error) => {
        console.error('Firestore plans error:', error)
        setFirestoreError('Kunne ikke laste ukeplaner fra Firebase')
      },
    )

    return () => unsubscribe()
  }, [useFirestore, user])

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

  // Auth handlers
  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setAuthError('')
    try {
      await signInWithEmailAndPassword(auth!, authEmail, authPassword)
    } catch (error: unknown) {
      const code = (error as { code?: string }).code
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setAuthError('Feil e-post eller passord.')
      } else if (code === 'auth/invalid-email') {
        setAuthError('Ugyldig e-postadresse.')
      } else if (code === 'auth/too-many-requests') {
        setAuthError('For mange forsøk. Prøv igjen senere.')
      } else {
        setAuthError('Kunne ikke logge inn. Prøv igjen.')
      }
    }
  }

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault()
    setAuthError('')
    if (!authHouseholdName.trim()) {
      setAuthError('Du må oppgi et husstandsnavn.')
      return
    }
    try {
      const result = await createUserWithEmailAndPassword(auth!, authEmail, authPassword)
      await createUserProfile(result.user.uid, authEmail, authHouseholdName.trim())
    } catch (error: unknown) {
      const code = (error as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        setAuthError('Denne e-postadressen er allerede i bruk.')
      } else if (code === 'auth/weak-password') {
        setAuthError('Passordet må være minst 6 tegn.')
      } else if (code === 'auth/invalid-email') {
        setAuthError('Ugyldig e-postadresse.')
      } else {
        setAuthError('Kunne ikke opprette konto. Prøv igjen.')
      }
    }
  }

  const handleLogout = async () => {
    if (auth) await signOut(auth)
  }

  const handleShareMeal = async (meal: Meal) => {
    if (!user) return
    try {
      await shareMealToGlobal(meal, user.uid, householdName || 'Ukjent')
    } catch (error) {
      console.error('Error sharing meal:', error)
      setFirestoreError('Kunne ikke dele rett')
    }
  }

  const handleImportSharedMeal = async (sharedMeal: SharedMeal) => {
    if (!user) return
    try {
      await importSharedMeal(user.uid, sharedMeal)
    } catch (error) {
      console.error('Error importing shared meal:', error)
      setFirestoreError('Kunne ikke importere rett')
    }
  }

  const handleMigration = async (
    mealsToMigrate: Meal[],
    plansToMigrate: WeeklyPlans,
    onProgress: (status: string) => void,
  ) => {
    if (!user) return
    await migrateToFirestore(user.uid, mealsToMigrate, plansToMigrate, onProgress)
    localStorage.setItem(MIGRATION_DONE_KEY, 'true')
    setShowMigrationModal(false)
  }

  const dismissMigrationModal = () => {
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

  const filteredSharedMeals = useMemo(() => {
    const q = sharedMealFilter.trim().toLowerCase()
    if (!q) return sharedMeals
    return sharedMeals.filter(
      (meal) =>
        meal.title.toLowerCase().includes(q) ||
        meal.ingredients.toLowerCase().includes(q) ||
        meal.addedByHousehold.toLowerCase().includes(q),
    )
  }, [sharedMeals, sharedMealFilter])

  const weekList = useMemo(() => Object.keys(weeklyPlans).sort(), [weeklyPlans])

  const ensureWeekExists = async (weekStart: string) => {
    const monday = toMonday(weekStart)
    if (weeklyPlans[monday] || creatingWeeks.has(monday)) return

    setCreatingWeeks((prev) => new Set(prev).add(monday))

    const newPlan = emptyPlan()

    try {
      if (useFirestore && user) {
        await updateWeeklyPlanInFirestore(user.uid, monday, newPlan)
      } else {
        setWeeklyPlans((prev) => ({
          ...prev,
          [monday]: newPlan,
        }))
      }
    } catch (error) {
      console.error('Error creating week:', error)
      setFirestoreError('Kunne ikke opprette uke')
    } finally {
      setCreatingWeeks((prev) => {
        const next = new Set(prev)
        next.delete(monday)
        return next
      })
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
      if (useFirestore && user) {
        if (editingMealId) {
          await updateMealInFirestore(user.uid, mealData)
        } else {
          await addMealToFirestore(user.uid, mealData)
        }
      } else {
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
      if (useFirestore && user) {
        await deleteMealFromFirestore(user.uid, id)
        const updatedPlans: WeeklyPlans = {}
        Object.entries(weeklyPlans).forEach(([week, plan]) => {
          const updated = emptyPlan()
          DAYS.forEach((day) => {
            updated[day] = plan[day].filter((mealId) => mealId !== id)
          })
          updatedPlans[week] = updated
        })
        for (const [week, plan] of Object.entries(updatedPlans)) {
          if (JSON.stringify(plan) !== JSON.stringify(weeklyPlans[week])) {
            await updateWeeklyPlanInFirestore(user.uid, week, plan)
          }
        }
      } else {
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
      if (useFirestore && user) {
        await updateWeeklyPlanInFirestore(user.uid, currentWeekStart, newPlan)
      } else {
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

  const toggleSharedDetails = (id: string) => {
    setSharedOpenDetails((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const removeFromPlan = async (day: Day, index: number) => {
    const plan = weeklyPlans[currentWeekStart] ?? emptyPlan()
    const newPlan: WeekPlan = {
      ...plan,
      [day]: plan[day].filter((_, i) => i !== index),
    }

    try {
      if (useFirestore && user) {
        await updateWeeklyPlanInFirestore(user.uid, currentWeekStart, newPlan)
      } else {
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

  const handleFormChange = (field: string, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleDayInputChange = (day: Day, value: string) => {
    setDayInputs((prev) => ({ ...prev, [day]: value }))
  }

  // Auth loading screen
  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Laster...</h1>
          <p className="hint">Sjekker innlogging...</p>
        </div>
      </div>
    )
  }

  // Login/Register screen (only when Firebase is configured)
  if (isFirebaseConfigured() && !user) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>{authMode === 'login' ? 'Logg inn' : 'Registrer deg'}</h1>
          <p className="hint">
            {authMode === 'login'
              ? 'Logg inn for å få tilgang til middagsplanleggeren.'
              : 'Opprett en konto for husstanden din.'}
          </p>
          <form
            className="form"
            onSubmit={authMode === 'login' ? handleLogin : handleRegister}
          >
            <label className="field">
              <span>E-post</span>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="din@epost.no"
              />
            </label>
            <label className="field">
              <span>Passord</span>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Minst 6 tegn"
              />
            </label>
            {authMode === 'register' && (
              <label className="field">
                <span>Husstandsnavn</span>
                <input
                  required
                  value={authHouseholdName}
                  onChange={(event) => setAuthHouseholdName(event.target.value)}
                  placeholder="F.eks. Familien Hansen"
                />
              </label>
            )}
            {authError && <p className="error">{authError}</p>}
            <div className="actions">
              <button type="submit" className="primary">
                {authMode === 'login' ? 'Logg inn' : 'Registrer'}
              </button>
            </div>
          </form>
          <p className="auth-toggle">
            {authMode === 'login' ? (
              <>
                Har du ikke konto?{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => { setAuthMode('register'); setAuthError('') }}
                >
                  Registrer deg
                </button>
              </>
            ) : (
              <>
                Har du allerede konto?{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => { setAuthMode('login'); setAuthError('') }}
                >
                  Logg inn
                </button>
              </>
            )}
          </p>
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
            <h2>Feil</h2>
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
      <header className="app-header">
        <div className="app-header-row">
          <h1>Middagsplanlegger</h1>
          {user && (
            <div className="user-info">
              <span className="household-name">{householdName || user.email}</span>
              <button type="button" className="ghost header-logout" onClick={handleLogout}>
                Logg ut
              </button>
            </div>
          )}
        </div>
      </header>

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'ukeplan' && (
        <UkeplanTab
          meals={meals}
          currentPlan={currentPlan}
          currentWeekStart={currentWeekStart}
          planHasEntries={planHasEntries}
          dayInputs={dayInputs}
          onDayInputChange={handleDayInputChange}
          onAddMealToDay={addMealToDay}
          onRemoveFromPlan={removeFromPlan}
          onNavigateWeek={navigateWeek}
          onWeekChange={handleWeekChange}
          onDownloadIcs={handleDownloadIcs}
          dateForOffset={dateForOffset}
        />
      )}

      {activeTab === 'retter' && (
        <RetterTab
          meals={meals}
          filteredMeals={filteredMeals}
          mealFilter={mealFilter}
          onMealFilterChange={setMealFilter}
          formState={formState}
          onFormChange={handleFormChange}
          onSubmit={onSubmit}
          editingMealId={editingMealId}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onDeleteMeal={deleteMeal}
          openDetails={openDetails}
          onToggleDetails={toggleDetails}
          onShareMeal={user ? handleShareMeal : undefined}
          sharedMeals={filteredSharedMeals}
          sharedMealFilter={sharedMealFilter}
          onSharedMealFilterChange={setSharedMealFilter}
          sharedOpenDetails={sharedOpenDetails}
          onToggleSharedDetails={toggleSharedDetails}
          onImportSharedMeal={handleImportSharedMeal}
          totalSharedMeals={sharedMeals.length}
        />
      )}

      {activeTab === 'historikk' && (
        <HistorikkTab
          weekList={weekList}
          weeklyPlans={weeklyPlans}
          currentWeekStart={currentWeekStart}
          stats={stats}
          onWeekChange={handleWeekChange}
        />
      )}
    </div>
    </>
  )
}

export default App
