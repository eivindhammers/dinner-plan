import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
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

export type UserProfile = {
  email: string
  householdName: string
  createdAt: unknown
}

export type SharedMeal = Meal & {
  addedBy: string
  addedByHousehold: string
  addedAt: unknown
}

// ID generator
export const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

// User profile functions
export const createUserProfile = async (
  uid: string,
  email: string,
  householdName: string,
): Promise<void> => {
  if (!db) throw new Error('Firebase not configured')
  const profileRef = doc(db, 'users', uid)
  await setDoc(profileRef, {
    email,
    householdName,
    createdAt: serverTimestamp(),
  })
}

export const getUserProfile = async (
  uid: string,
): Promise<UserProfile | null> => {
  if (!db) return null
  const profileRef = doc(db, 'users', uid)
  const snap = await getDoc(profileRef)
  if (!snap.exists()) return null
  return snap.data() as UserProfile
}

// Firestore helper functions for Meals (per-household)
export const subscribeToMeals = (
  uid: string,
  callback: (meals: Meal[]) => void,
  onError?: (error: Error) => void,
) => {
  if (!isFirebaseConfigured() || !db) {
    return () => {}
  }

  const mealsRef = collection(db, 'users', uid, 'meals')
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

export const saveMealToFirestore = async (
  uid: string,
  meal: Meal,
): Promise<void> => {
  if (!db) throw new Error('Firebase not configured')
  const mealRef = doc(db, 'users', uid, 'meals', meal.id)
  await setDoc(mealRef, {
    title: meal.title,
    ingredients: meal.ingredients,
    imageUrl: meal.imageUrl,
    steps: meal.steps,
  })
}

export const addMealToFirestore = saveMealToFirestore
export const updateMealInFirestore = saveMealToFirestore

export const deleteMealFromFirestore = async (
  uid: string,
  id: string,
): Promise<void> => {
  if (!db) throw new Error('Firebase not configured')
  const mealRef = doc(db, 'users', uid, 'meals', id)
  await deleteDoc(mealRef)
}

// Firestore helper functions for Weekly Plans (per-household)
export const subscribeToWeeklyPlans = (
  uid: string,
  callback: (plans: WeeklyPlans) => void,
  onError?: (error: Error) => void,
) => {
  if (!isFirebaseConfigured() || !db) {
    return () => {}
  }

  const plansRef = collection(db, 'users', uid, 'weeklyPlans')

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
  uid: string,
  weekStart: string,
  plan: WeekPlan,
): Promise<void> => {
  if (!db) throw new Error('Firebase not configured')
  const planRef = doc(db, 'users', uid, 'weeklyPlans', weekStart)
  await setDoc(planRef, plan)
}

// Shared meals functions
export const subscribeToSharedMeals = (
  callback: (meals: SharedMeal[]) => void,
  onError?: (error: Error) => void,
) => {
  if (!isFirebaseConfigured() || !db) {
    return () => {}
  }

  const sharedRef = collection(db, 'sharedMeals')
  const q = query(sharedRef, orderBy('title'))

  return onSnapshot(
    q,
    (snapshot) => {
      const meals: SharedMeal[] = []
      snapshot.forEach((doc) => {
        meals.push({ id: doc.id, ...doc.data() } as SharedMeal)
      })
      callback(meals)
    },
    (error) => {
      console.error('Error subscribing to shared meals:', error)
      if (onError) onError(error)
    },
  )
}

export const shareMealToGlobal = async (
  meal: Meal,
  uid: string,
  householdName: string,
): Promise<void> => {
  if (!db) throw new Error('Firebase not configured')
  const sharedRef = doc(db, 'sharedMeals', makeId())
  await setDoc(sharedRef, {
    title: meal.title,
    ingredients: meal.ingredients,
    imageUrl: meal.imageUrl ?? null,
    steps: meal.steps ?? null,
    addedBy: uid,
    addedByHousehold: householdName,
    addedAt: serverTimestamp(),
  })
}

export const deleteSharedMeal = async (id: string): Promise<void> => {
  if (!db) throw new Error('Firebase not configured')
  const sharedRef = doc(db, 'sharedMeals', id)
  await deleteDoc(sharedRef)
}

export const importSharedMeal = async (
  uid: string,
  sharedMeal: SharedMeal,
): Promise<void> => {
  if (!db) throw new Error('Firebase not configured')
  const newId = makeId()
  const mealRef = doc(db, 'users', uid, 'meals', newId)
  await setDoc(mealRef, {
    title: sharedMeal.title,
    ingredients: sharedMeal.ingredients,
    imageUrl: sharedMeal.imageUrl ?? null,
    steps: sharedMeal.steps ?? null,
  })
}

// Migration helper: Upload data from localStorage to Firestore
export const migrateToFirestore = async (
  uid: string,
  meals: Meal[],
  weeklyPlans: WeeklyPlans,
  onProgress?: (status: string) => void,
): Promise<void> => {
  if (!db) throw new Error('Firebase not configured')

  const batch = writeBatch(db)
  let operationCount = 0

  onProgress?.('Migrerer retter...')
  meals.forEach((meal) => {
    const mealRef = doc(db!, 'users', uid, 'meals', meal.id)
    batch.set(mealRef, {
      title: meal.title,
      ingredients: meal.ingredients,
      imageUrl: meal.imageUrl,
      steps: meal.steps,
    })
    operationCount++
  })

  if (operationCount > 0) {
    await batch.commit()
    onProgress?.(`Migrerte ${operationCount} retter`)
  }

  const planEntries = Object.entries(weeklyPlans)
  onProgress?.('Migrerer ukeplaner...')

  for (const [weekStart, plan] of planEntries) {
    const planRef = doc(db, 'users', uid, 'weeklyPlans', weekStart)
    await setDoc(planRef, plan)
  }

  onProgress?.(`Migrerte ${planEntries.length} ukeplaner`)
}

// Check if Firestore has data (to determine if migration is needed)
export const checkFirestoreHasData = async (uid: string): Promise<boolean> => {
  if (!db) return false

  try {
    const mealsSnapshot = await getDocs(collection(db, 'users', uid, 'meals'))
    return !mealsSnapshot.empty
  } catch (error) {
    console.error('Error checking Firestore data:', error)
    return false
  }
}

// Migrate legacy top-level meals to the shared meals collection (one-time, tracked via Firestore flag)
export const migrateLegacyMealsToShared = async (
  uid: string,
  householdName: string,
): Promise<void> => {
  if (!db) return

  try {
    const flagRef = doc(db, 'config', 'legacyMigration')
    const flagSnap = await getDoc(flagRef)
    if (flagSnap.exists()) return

    const legacyMeals = await getDocs(collection(db, 'meals'))
    if (legacyMeals.empty) {
      await setDoc(flagRef, { done: true, migratedAt: serverTimestamp() })
      return
    }

    const batch = writeBatch(db)
    legacyMeals.forEach((docSnap) => {
      const data = docSnap.data()
      const sharedRef = doc(db!, 'sharedMeals', makeId())
      batch.set(sharedRef, {
        title: data.title,
        ingredients: data.ingredients,
        imageUrl: data.imageUrl ?? null,
        steps: data.steps ?? null,
        addedBy: uid,
        addedByHousehold: householdName,
        addedAt: serverTimestamp(),
      })
    })
    batch.set(flagRef, { done: true, migratedAt: serverTimestamp() })
    await batch.commit()
  } catch (error) {
    console.error('Error migrating legacy meals to shared:', error)
  }
}
