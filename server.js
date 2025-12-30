const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Constants
const DINNER_DURATION_HOURS = 2;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dinner-plan-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Only send cookie over HTTPS in production
    httpOnly: true, // Prevent XSS attacks
    sameSite: 'lax' // CSRF protection - prevents cookie from being sent in cross-site POST requests
  }
}));

// Rate limiting for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for general routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Google OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
);

// Scopes for Google Calendar API
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// Routes
app.get('/', generalLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initiate OAuth flow
app.get('/auth/google', authLimiter, (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.redirect(authUrl);
});

// OAuth callback
app.get('/oauth2callback', authLimiter, async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization code not found');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Store tokens in session
    req.session.tokens = tokens;
    req.session.authenticated = true;
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error retrieving access token', error);
    res.status(500).send('Authentication failed');
  }
});

// Dashboard page
app.get('/dashboard', generalLimiter, (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Create dinner plan and add to Google Calendar
app.post('/api/dinner-plan', apiLimiter, async (req, res) => {
  if (!req.session.authenticated || !req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { title, date, time, description, location } = req.body;

  if (!title || !date || !time) {
    return res.status(400).json({ error: 'Title, date, and time are required' });
  }

  try {
    // Set up the OAuth2 client with stored tokens
    oauth2Client.setCredentials(req.session.tokens);
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Parse date and time
    const startDateTime = new Date(`${date}T${time}`);
    const endDateTime = new Date(startDateTime.getTime() + DINNER_DURATION_HOURS * 60 * 60 * 1000);

    const event = {
      summary: `Dinner: ${title}`,
      description: description || 'Dinner plan created by Dinner Plan app',
      location: location || '',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 60 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json({
      success: true,
      message: 'Dinner plan added to Google Calendar',
      eventId: response.data.id,
      eventLink: response.data.htmlLink
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ 
      error: 'Failed to create calendar event',
      details: error.message 
    });
  }
});

// Get upcoming dinner plans from Google Calendar
app.get('/api/dinner-plans', apiLimiter, async (req, res) => {
  if (!req.session.authenticated || !req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
      q: 'Dinner:'
    });

    const events = response.data.items || [];
    const dinnerPlans = events.map(event => ({
      id: event.id,
      title: event.summary,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      description: event.description,
      location: event.location,
      link: event.htmlLink
    }));

    res.json({ dinnerPlans });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dinner plans',
      details: error.message 
    });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/');
  });
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// Start server
app.listen(PORT, () => {
  console.log(`Dinner Plan app listening on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to get started`);
});
