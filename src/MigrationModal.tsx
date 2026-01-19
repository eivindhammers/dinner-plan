import { useState } from 'react'
import type { Meal, WeeklyPlans } from './firestoreUtils'

type MigrationModalProps = {
  meals: Meal[]
  weeklyPlans: WeeklyPlans
  onMigrate: (
    meals: Meal[],
    weeklyPlans: WeeklyPlans,
    onProgress: (status: string) => void,
  ) => Promise<void>
  onDismiss: () => void
}

export const MigrationModal = ({
  meals,
  weeklyPlans,
  onMigrate,
  onDismiss,
}: MigrationModalProps) => {
  const [migrating, setMigrating] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleMigrate = async () => {
    setMigrating(true)
    setError('')
    setStatus('Starter migrering...')

    try {
      await onMigrate(meals, weeklyPlans, (progressStatus) => {
        setStatus(progressStatus)
      })
      setSuccess(true)
      setStatus('Migrering fullført! Data er nå lagret i Firebase.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'En ukjent feil oppstod under migrering',
      )
      setStatus('')
    } finally {
      setMigrating(false)
    }
  }

  const weekCount = Object.keys(weeklyPlans).length

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>🔄 Migrer data til Firebase</h2>
        <p>
          Vi har oppdaget at du har eksisterende data lagret lokalt i nettleseren
          din. For å aktivere synkronisering på tvers av enheter, må vi migrere
          dataene dine til Firebase.
        </p>
        <div className="migration-info">
          <p>
            <strong>Data som vil bli migrert:</strong>
          </p>
          <ul>
            <li>{meals.length} retter</li>
            <li>{weekCount} ukeplaner</li>
          </ul>
          <p className="hint small">
            Dine lokale data vil bli beholdt som backup selv etter migrering.
          </p>
        </div>

        {status && (
          <div className="migration-status">
            <p>{status}</p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>
              <strong>Feil:</strong> {error}
            </p>
          </div>
        )}

        <div className="actions">
          {!success && !migrating && (
            <>
              <button type="button" onClick={onDismiss}>
                Avbryt
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleMigrate}
                disabled={migrating}
              >
                Start migrering
              </button>
            </>
          )}
          {success && (
            <button type="button" className="primary" onClick={onDismiss}>
              Lukk
            </button>
          )}
        </div>

        {migrating && (
          <p className="hint small">Vennligst ikke lukk vinduet...</p>
        )}
      </div>
    </div>
  )
}
