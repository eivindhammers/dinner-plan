import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

// TypeScript types for Firestore documents
export type Meal = {
  id: string
  title: string
  ingredients: string
  imageUrl?: string
  steps?: string
}

export type Day =
  | 'Mandag'
  | 'Tirsdag'
  | 'Onsdag'
  | 'Torsdag'
  | 'Fredag'
  | 'Lørdag'
  | 'Søndag'

export type WeekPlan = Record<Day, string[]>

export type WeeklyPlans = Record<string, WeekPlan>

// Collection names (shared for family access)
const MEALS_COLLECTION = 'meals'
const WEEKLY_PLANS_COLLECTION = 'weeklyPlans'

// Firestore helper functions for Meals
export const subscribeToMeals = (
  callback: (meals: Meal[]) => void,
  onError?: (error: Error) => void,
) => {
  if (!isFirebaseConfigured()) {
    return () => {}
  }

  const mealsRef = collection(db, MEALS_COLLECTION)
  const q = query(mealsRef, orderBy('title'))

  return onSnapshot(
    q,
    (snapshot) => {
      const meals: Meal[] = []
      snapshot.forEach((doc) => {
        meals.push({ id: doc.id, ...doc.data() } as Meal)
      })
      callback(meals)
    },
    (error) => {
      console.error('Error subscribing to meals:', error)
      if (onError) onError(error)
    },
  )
}

export const addMealToFirestore = async (meal: Meal): Promise<void> => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured')
  }
  const mealRef = doc(db, MEALS_COLLECTION, meal.id)
  await setDoc(mealRef, {
    title: meal.title,
    ingredients: meal.ingredients,
    imageUrl: meal.imageUrl,
    steps: meal.steps,
  })
}

export const updateMealInFirestore = async (meal: Meal): Promise<void> => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured')
  }
  const mealRef = doc(db, MEALS_COLLECTION, meal.id)
  await setDoc(mealRef, {
    title: meal.title,
    ingredients: meal.ingredients,
    imageUrl: meal.imageUrl,
    steps: meal.steps,
  })
}

export const deleteMealFromFirestore = async (id: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured')
  }
  const mealRef = doc(db, MEALS_COLLECTION, id)
  await deleteDoc(mealRef)
}

// Firestore helper functions for Weekly Plans
export const subscribeToWeeklyPlans = (
  callback: (plans: WeeklyPlans) => void,
  onError?: (error: Error) => void,
) => {
  if (!isFirebaseConfigured()) {
    return () => {}
  }

  const plansRef = collection(db, WEEKLY_PLANS_COLLECTION)

  return onSnapshot(
    plansRef,
    (snapshot) => {
      const plans: WeeklyPlans = {}
      snapshot.forEach((doc) => {
        plans[doc.id] = doc.data() as WeekPlan
      })
      callback(plans)
    },
    (error) => {
      console.error('Error subscribing to weekly plans:', error)
      if (onError) onError(error)
    },
  )
}

export const updateWeeklyPlanInFirestore = async (
  weekStart: string,
  plan: WeekPlan,
): Promise<void> => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured')
  }
  const planRef = doc(db, WEEKLY_PLANS_COLLECTION, weekStart)
  await setDoc(planRef, plan)
}

// Migration helper: Upload data from localStorage to Firestore
export const migrateToFirestore = async (
  meals: Meal[],
  weeklyPlans: WeeklyPlans,
  onProgress?: (status: string) => void,
): Promise<void> => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured')
  }

  const batch = writeBatch(db)
  let operationCount = 0

  // Migrate meals
  onProgress?.('Migrerer retter...')
  meals.forEach((meal) => {
    const mealRef = doc(db, MEALS_COLLECTION, meal.id)
    batch.set(mealRef, {
      title: meal.title,
      ingredients: meal.ingredients,
      imageUrl: meal.imageUrl,
      steps: meal.steps,
    })
    operationCount++
  })

  // Commit meal batch
  if (operationCount > 0) {
    await batch.commit()
    onProgress?.(`Migrerte ${operationCount} retter`)
  }

  // Migrate weekly plans (in separate batches to avoid limits)
  const planEntries = Object.entries(weeklyPlans)
  onProgress?.('Migrerer ukeplaner...')

  for (const [weekStart, plan] of planEntries) {
    const planRef = doc(db, WEEKLY_PLANS_COLLECTION, weekStart)
    await setDoc(planRef, plan)
  }

  onProgress?.(`Migrerte ${planEntries.length} ukeplaner`)
}

// Check if Firestore has data (to determine if migration is needed)
export const checkFirestoreHasData = async (): Promise<boolean> => {
  if (!isFirebaseConfigured()) {
    return false
  }

  try {
    const mealsSnapshot = await getDocs(collection(db, MEALS_COLLECTION))
    return !mealsSnapshot.empty
  } catch (error) {
    console.error('Error checking Firestore data:', error)
    return false
  }
}
