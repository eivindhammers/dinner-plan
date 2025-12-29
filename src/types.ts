export interface Recipe {
  id?: string;
  title: string;
  description: string;
  ingredients?: string[];
  userId: string;
  createdAt: Date;
}

export interface CalendarEvent {
  id?: string;
  recipeId: string;
  recipeName: string;
  date: string; // ISO date string
  userId: string;
}
