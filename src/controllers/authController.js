const passport = require('passport');
const User = require('../models/user');

function isJsonRequest(req) {
  const accept = req.headers.accept || '';
  return req.xhr || (accept.includes('application/json') && !accept.includes('text/html'));
}

const authController = {
  showRegister(req, res) {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.redirect('/events');
    }
    res.render('auth/register', {
      title: 'Sign Up - EventDesk',
      errors: [],
      values: {}
    });
  },

  async register(req, res, next) {
    try {
      const { name, email, password, role } = req.body;
      const errors = [];

      if (!name || !name.trim()) errors.push('Name is required.');
      if (!email || !email.trim()) errors.push('Email is required.');
      if (!password || password.length < 8) errors.push('Password must be at least 8 characters.');

      const userRole = role === 'organizer' ? 'organizer' : 'attendee';

      if (errors.length > 0) {
        if (isJsonRequest(req)) {
          return res.status(400).json({ errors });
        }
        return res.render('auth/register', {
          title: 'Sign Up - EventDesk',
          errors,
          values: { name, email, role: userRole }
        });
      }

      const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
      if (existingUser) {
        const errorMsg = 'An account with this email already exists.';
        if (isJsonRequest(req)) {
          return res.status(409).json({ error: errorMsg });
        }
        return res.render('auth/register', {
          title: 'Sign Up - EventDesk',
          errors: [errorMsg],
          values: { name, email, role: userRole }
        });
      }

      const newUser = await User.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: password, // Mongoose pre-save hook hashes password
        role: userRole
      });

      req.login(newUser, (err) => {
        if (err) return next(err);

        if (isJsonRequest(req)) {
          return res.status(201).json({
            message: 'Account created successfully',
            user: {
              id: newUser.id,
              name: newUser.name,
              email: newUser.email,
              role: newUser.role
            }
          });
        }

        req.flash('success', `Welcome to EventDesk, ${newUser.name}! Your account has been created.`);
        return res.redirect('/events');
      });
    } catch (err) {
      if (err.name === 'ValidationError') {
        const errorMsgs = Object.values(err.errors).map(e => e.message);
        if (isJsonRequest(req)) {
          return res.status(422).json({ errors: errorMsgs });
        }
        return res.render('auth/register', {
          title: 'Sign Up - EventDesk',
          errors: errorMsgs,
          values: req.body
        });
      }
      return next(err);
    }
  },

  showLogin(req, res) {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.redirect('/events');
    }
    res.render('auth/login', {
      title: 'Sign In - EventDesk',
      errors: []
    });
  },

  login(req, res, next) {
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);

      if (!user) {
        const message = (info && info.message) || 'Invalid email or password.';
        if (isJsonRequest(req)) {
          return res.status(401).json({ error: message });
        }
        return res.render('auth/login', {
          title: 'Sign In - EventDesk',
          errors: [message]
        });
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);

        if (isJsonRequest(req)) {
          return res.json({
            message: 'Authentication successful',
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role
            }
          });
        }

        req.flash('success', `Welcome back, ${user.name}!`);
        return res.redirect('/events');
      });
    })(req, res, next);
  },

  logout(req, res, next) {
    req.logout((err) => {
      if (err) return next(err);

      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        if (isJsonRequest(req)) {
          return res.json({ message: 'Logged out successfully' });
        }
        return res.redirect('/auth/login');
      });
    });
  }
};

module.exports = authController;
