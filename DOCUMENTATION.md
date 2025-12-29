# Dinner Plan - UI Documentation

## Application Screenshots

### Authentication

#### Login Page
![Login Page](https://github.com/user-attachments/assets/b7ea4b59-74a8-416f-ac7e-420d5674156d)

The login page features:
- Email/password authentication
- Google Sign-in option
- Link to signup page
- Clean, centered design with gradient background

#### Signup Page
![Signup Page](https://github.com/user-attachments/assets/85a2d570-6c46-4859-a4cf-69501e969488)

The signup page includes:
- Email and password fields
- Password confirmation
- Google Sign-up option
- Link back to login page

### Main Application Features

Once logged in, users have access to:

#### 1. Weekly Calendar View (Home Page)
- Visual weekly calendar with Monday-Sunday layout
- Each day shows:
  - Day name and date
  - Planned dinners with 🍽️ emoji prefix
  - "+ Add Dinner" button
- Navigation controls:
  - Previous/Next week buttons
  - "Today" button to return to current week
- Responsive grid layout (7 columns on desktop, adapts for mobile)
- Today's date is highlighted

#### 2. Recipe Management (Recipes Page)
- View all saved recipes in a card grid
- Each recipe card shows:
  - Recipe title
  - Description
  - Expand/collapse button for ingredients
  - Add to calendar button (📅)
  - Delete button (🗑️)
- "+ Add Recipe" button to create new recipes
- Empty state message when no recipes exist

#### 3. Recipe Creation Form
- Modal popup with form fields:
  - Title (required)
  - Description (required)
  - Ingredients list (optional, one per line)
- Cancel and submit buttons
- Form validation

#### 4. Navigation Bar
- App logo/title (🍽️ Dinner Plan)
- Links to Calendar and Recipes pages
- User email display
- Logout button
- Responsive design for mobile

## Color Scheme

- Primary Purple: #667eea
- Secondary Purple: #764ba2
- Accent/Hover: #5568d3
- Background: #f8f9fa
- White: #ffffff
- Text Gray: #333333
- Border Gray: #e5e5e5

## Responsive Design

The application is fully responsive with breakpoints for:
- Desktop (1200px+): Full 7-column weekly calendar
- Tablet (768px-1200px): 4-column calendar grid
- Mobile (480px-768px): 2-column calendar grid
- Small Mobile (<480px): Single column calendar

## User Flow

1. **First Visit**: User sees login page
2. **Sign Up**: User creates account with email/password or Google
3. **Add Recipes**: User navigates to Recipes page and adds their favorite recipes
4. **Plan Week**: User returns to Calendar and adds recipes to specific days
5. **View Plan**: User sees their weekly dinner schedule with emoji markers

## Firebase Integration

The app uses Firebase for:
- **Authentication**: Email/password and Google OAuth
- **Firestore Database**: Stores recipes and calendar events
- **Security Rules**: User data is isolated by userId
- **Real-time Updates**: Changes reflect immediately

## Deployment

The app is configured for deployment on Netlify with:
- Automatic SPA routing (redirects to index.html)
- Environment variables for Firebase configuration
- Optimized production build
