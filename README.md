# Dinner Plan

A web application that lets users plan dinners and automatically sync them to their Google Calendar.

## Features

- 🍽️ Create dinner plans with date, time, location, and description
- 📅 Automatically sync dinner plans to Google Calendar
- 🔔 Get reminders for upcoming dinners
- 👀 View all upcoming dinner plans in one place
- 🔐 Secure Google OAuth authentication

## Prerequisites

- Node.js (v14 or higher)
- A Google Cloud Platform account
- Google Calendar API enabled

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URI: `http://localhost:3000/oauth2callback`
   - For production, add your production URL's callback
5. Copy the Client ID and Client Secret

## Installation

1. Clone the repository:
```bash
git clone https://github.com/eivindhammers/dinner-plan.git
cd dinner-plan
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Edit the `.env` file and add your Google OAuth credentials:
```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
SESSION_SECRET=your_random_session_secret_here
PORT=3000
```

## Usage

1. Start the application:
```bash
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

3. Click "Sign in with Google" to authenticate

4. Once authenticated, you'll be redirected to the dashboard where you can:
   - Create new dinner plans
   - View upcoming dinner plans
   - Each dinner plan is automatically added to your Google Calendar

## How It Works

1. **Authentication**: Users sign in with their Google account using OAuth 2.0
2. **Create Dinner Plans**: Users fill out a form with dinner details (title, date, time, location, description)
3. **Calendar Sync**: The app uses the Google Calendar API to create events in the user's primary calendar
4. **View Plans**: Users can see all their upcoming dinner plans that contain "Dinner:" in the title

## Security Notes

- Never commit your `.env` file to version control
- Use HTTPS in production
- Set `cookie: { secure: true }` in session configuration when using HTTPS
- Regularly rotate your session secret

## Development

The application uses:
- Express.js for the web server
- Google APIs Node.js Client for Calendar integration
- Express Session for session management
- Vanilla JavaScript for the frontend

## License

MIT