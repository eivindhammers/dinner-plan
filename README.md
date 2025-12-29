# 🍽️ Dinner Plan

A browser-based application for planning weekly dinner schedules with recipe management.

## Features

- **Recipe Management**: Add, view, and delete recipes with titles, descriptions, and optional ingredient lists
- **Weekly Calendar**: Visual weekly calendar view to plan dinners for each day
- **Authentication**: Secure login with email/password or Google account
- **Firebase Integration**: Real-time data synchronization with Firebase
- **Netlify Deployment**: Easy deployment to Netlify

## Tech Stack

- React 19 with TypeScript
- Firebase (Authentication & Firestore)
- React Router for navigation
- Netlify for hosting

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Firebase project
- (Optional) A Netlify account for deployment

### Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable Email/Password
   - Enable Google Sign-in
3. Create a Firestore Database:
   - Go to Firestore Database
   - Create database in production mode
   - Set up security rules (see below)
4. Get your Firebase configuration:
   - Go to Project Settings > General
   - Scroll to "Your apps" and click on the web app icon
   - Copy the configuration values

### Firestore Security Rules

Add these rules in Firestore Database > Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /recipes/{recipeId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    match /calendarEvents/{eventId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/eivindhammers/dinner-plan.git
cd dinner-plan
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Add your Firebase configuration to `.env`:
```
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

5. Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
```

### Deploy to Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `build`
4. Add environment variables from your `.env` file to Netlify Environment Variables
5. Deploy!

Alternatively, use the Netlify CLI:
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

## Usage

1. **Sign Up/Login**: Create an account or log in with Google
2. **Add Recipes**: Click "Recipes" in the navigation, then "Add Recipe"
3. **Plan Dinners**: Go to the Calendar view and click "+ Add Dinner" on any day
4. **Select Recipe**: Choose from your saved recipes to add to the calendar
5. **View Schedule**: See your weekly dinner plan with 🍽️ emoji markers

## Available Scripts

### `npm start`
Runs the app in development mode at [http://localhost:3000](http://localhost:3000)

### `npm test`
Launches the test runner in interactive watch mode

### `npm run build`
Builds the app for production to the `build` folder

## Future Enhancements

- Google Calendar synchronization
- Recipe search and filtering
- Shopping list generation from ingredients
- Recipe sharing between users
- Mobile app version
- Recipe photos
- Meal categories (breakfast, lunch, dinner)

## License

MIT
