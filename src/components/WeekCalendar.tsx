import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Recipe, CalendarEvent } from '../types';
import RecipeList from './RecipeList';
import './WeekCalendar.css';

const WeekCalendar: React.FC = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { currentUser } = useAuth();

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    return new Date(d.setDate(diff));
  }

  const loadEvents = useCallback(async () => {
    if (!currentUser) return;

    try {
      const q = query(collection(db, 'calendarEvents'), where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const eventsData: CalendarEvent[] = [];
      querySnapshot.forEach((doc) => {
        eventsData.push({ id: doc.id, ...doc.data() } as CalendarEvent);
      });
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }, [currentUser]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const getWeekDays = (): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = formatDate(date);
    return events.filter((event) => event.date === dateStr);
  };

  const handleAddRecipe = (date: Date) => {
    setSelectedDate(date);
    setShowRecipeSelector(true);
  };

  const handleRecipeSelect = async (recipe: Recipe) => {
    if (!selectedDate || !currentUser) return;

    try {
      await addDoc(collection(db, 'calendarEvents'), {
        recipeId: recipe.id,
        recipeName: recipe.title,
        date: formatDate(selectedDate),
        userId: currentUser.uid,
      });
      await loadEvents();
      setShowRecipeSelector(false);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error adding event:', error);
      alert('Failed to add recipe to calendar');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Remove this dinner from the calendar?')) return;

    try {
      await deleteDoc(doc(db, 'calendarEvents', eventId));
      setEvents(events.filter((e) => e.id !== eventId));
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to remove event');
    }
  };

  const previousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const nextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const goToToday = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };

  const weekDays = getWeekDays();
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h2>Weekly Dinner Plan</h2>
        <div className="calendar-controls">
          <button onClick={previousWeek} className="btn-nav">
            ← Prev
          </button>
          <button onClick={goToToday} className="btn-today">
            Today
          </button>
          <button onClick={nextWeek} className="btn-nav">
            Next →
          </button>
        </div>
      </div>

      <div className="week-grid">
        {weekDays.map((day, index) => {
          const dayEvents = getEventsForDate(day);
          const isToday = formatDate(day) === formatDate(new Date());

          return (
            <div key={index} className={`day-column ${isToday ? 'today' : ''}`}>
              <div className="day-header">
                <div className="day-name">{dayNames[index]}</div>
                <div className="day-date">{day.getDate()}/{day.getMonth() + 1}</div>
              </div>
              <div className="day-content">
                {dayEvents.map((event) => (
                  <div key={event.id} className="event-card">
                    <div className="event-title">🍽️ {event.recipeName}</div>
                    <button
                      className="event-delete"
                      onClick={() => handleDeleteEvent(event.id!)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button className="btn-add-event" onClick={() => handleAddRecipe(day)}>
                  + Add Dinner
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showRecipeSelector && (
        <div className="modal-overlay" onClick={() => setShowRecipeSelector(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Recipe for {selectedDate?.toLocaleDateString()}</h2>
              <button className="close-btn" onClick={() => setShowRecipeSelector(false)}>
                ×
              </button>
            </div>
            <RecipeList onSelectRecipe={handleRecipeSelect} />
          </div>
        </div>
      )}
    </div>
  );
};

export default WeekCalendar;
