## Dinner Plan

Plan a week of dinners by saving your meal portfolio, scheduling dishes Monday–Sunday, and exporting an `.ics` file for your calendar.

### Features
- Create dishes with titles, ingredients, and optional illustration URLs.
- Add any dish to specific days in a weekly plan (multiple dishes per day).
- Export the plan to an all-day `.ics` calendar file.
- **Multi-device sync** with Firebase Firestore (optional).
- Data is stored in Firebase Firestore with fallback to localStorage.

### Getting started
```bash
npm install
npm run dev
```
Visit the printed local URL to use the app.

#### Build and lint
```bash
npm run build
npm run lint
```

### Firebase Setup (Optional - for multi-device sync)

The app can work with localStorage only, but for multi-device synchronization, you need to set up Firebase:

#### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Once created, click on "Web" (</>) to add a web app
4. Register your app and copy the Firebase configuration

#### 2. Enable Firestore
1. In Firebase Console, go to "Build" → "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode" (or test mode for development)
4. Select a location close to your users
5. Click "Enable"

#### 3. Configure Firestore Rules
Set up security rules in Firestore (Firebase Console → Firestore Database → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all reads and writes to meals and weeklyPlans collections
    // This is suitable for a family app with password protection at the app level
    match /meals/{document=**} {
      allow read, write: if true;
    }
    match /weeklyPlans/{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Note**: These rules allow anyone with your Firebase credentials to read/write data. The app uses a password (VITE_APP_PASSWORD) for basic protection. For production use with sensitive data, consider implementing Firebase Authentication.

#### 4. Set Environment Variables
Create a `.env` file in the root directory with your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_APP_PASSWORD=your-custom-password
```

### Data Migration

If you have existing data in localStorage, the app will automatically detect it and show a migration modal on first load:

1. **Automatic Detection**: When you open the app with Firebase configured, it checks for existing localStorage data
2. **Migration Modal**: If data is found, you'll see a modal offering to migrate your data to Firestore
3. **One-Click Migration**: Click "Start migrering" to transfer all meals and weekly plans to Firebase
4. **Backup**: Your localStorage data is kept as a backup even after migration
5. **Progress Updates**: The modal shows real-time progress during migration

#### Manual Migration Reset
If you need to re-show the migration modal:
```javascript
// In browser console:
localStorage.removeItem('dinner-plan:migration-done');
```
Then refresh the page.

### Deploying to Netlify

#### Build Settings
- Build command: `npm run build`
- Publish directory: `dist`

#### Environment Variables
Add these environment variables in Netlify (Site settings → Environment variables):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_APP_PASSWORD` (optional, defaults to "familie")

**Important**: All environment variables for Vite must be prefixed with `VITE_` to be accessible in the client-side code.

### Fallback Mode
If Firebase is not configured (environment variables missing), the app automatically falls back to localStorage-only mode. This means:
- Data is stored only in your browser
- No multi-device sync
- No migration modal appears
- All features work normally, just without sync

### Security Considerations
- The app uses a simple password protection system (`VITE_APP_PASSWORD`)
- This is suitable for family use but not for sensitive data
- All family members access the same shared data in Firestore
- For production use with privacy requirements, consider implementing Firebase Authentication with user-specific data scoping

### Troubleshooting

#### Migration not working
- Check browser console for error messages
- Verify Firebase configuration is correct
- Ensure Firestore rules allow read/write access
- Check that your Firebase project has billing enabled (required for Firestore)

#### Data not syncing across devices
- Verify all devices use the same Firebase project
- Check that environment variables are set correctly on all deployments
- Open browser console to see real-time Firestore connection status

#### "Firebase not configured" error
- Ensure all `VITE_FIREBASE_*` environment variables are set
- For local development, create a `.env` file with your credentials
- For Netlify, add variables in site settings and redeploy
