const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');

const configurePassport = require('./config/passport');
const csrfProtection = require('./middleware/csrf');
const errorHandler = require('./middleware/errorHandler');
const { connectDB } = require('./config/database');
const routes = require('./routes');

const app = express();

// Ensure DB Connection Middleware (Serverless / Vercel / Render)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// View Engine Setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Body Parsers & Cookie Parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Static Files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Session Management
app.use(session({
  secret: process.env.SESSION_SECRET || 'eventdesk_super_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Flash Messages
app.use(flash());

// Passport Auth Setup
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());

// CSRF Protection Middleware
app.use(csrfProtection());

// Global Locals for Views
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  };
  res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  next();
});

// Mount Routes
app.use('/', routes);

// Centralized Error Handling
app.use(errorHandler);

module.exports = app;
