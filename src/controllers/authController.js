const passport = require('passport');
const User = require('../models/user');

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
        return res.format({
          'text/html': () => {
            res.render('auth/register', {
              title: 'Sign Up - EventDesk',
              errors,
              values: { name, email, role: userRole }
            });
          },
          'application/json': () => {
            res.status(400).json({ errors });
          },
          'default': () => res.status(406).send('Not Acceptable')
        });
      }

      const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
      if (existingUser) {
        const errorMsg = 'An account with this email already exists.';
        return res.format({
          'text/html': () => {
            res.render('auth/register', {
              title: 'Sign Up - EventDesk',
              errors: [errorMsg],
              values: { name, email, role: userRole }
            });
          },
          'application/json': () => {
            res.status(409).json({ error: errorMsg });
          },
          'default': () => res.status(406).send('Not Acceptable')
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

        return res.format({
          'text/html': () => {
            req.flash('success', `Welcome to EventDesk, ${newUser.name}! Your account has been created.`);
            res.redirect('/events');
          },
          'application/json': () => {
            res.status(201).json({
              message: 'Account created successfully',
              user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
              }
            });
          },
          'default': () => res.status(406).send('Not Acceptable')
        });
      });
    } catch (err) {
      if (err.name === 'ValidationError') {
        const errorMsgs = Object.values(err.errors).map(e => e.message);
        return res.format({
          'text/html': () => {
            res.render('auth/register', {
              title: 'Sign Up - EventDesk',
              errors: errorMsgs,
              values: req.body
            });
          },
          'application/json': () => {
            res.status(422).json({ errors: errorMsgs });
          },
          'default': () => res.status(406).send('Not Acceptable')
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
        return res.format({
          'text/html': () => {
            res.render('auth/login', {
              title: 'Sign In - EventDesk',
              errors: [message]
            });
          },
          'application/json': () => {
            res.status(401).json({ error: message });
          },
          'default': () => res.status(406).send('Not Acceptable')
        });
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);

        return res.format({
          'text/html': () => {
            req.flash('success', `Welcome back, ${user.name}!`);
            res.redirect('/events');
          },
          'application/json': () => {
            res.json({
              message: 'Authentication successful',
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
              }
            });
          },
          'default': () => res.status(406).send('Not Acceptable')
        });
      });
    })(req, res, next);
  },

  logout(req, res, next) {
    req.logout((err) => {
      if (err) return next(err);

      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        return res.format({
          'text/html': () => {
            res.redirect('/auth/login');
          },
          'application/json': () => {
            res.json({ message: 'Logged out successfully' });
          },
          'default': () => res.status(406).send('Not Acceptable')
        });
      });
    });
  }
};

module.exports = authController;
