const Event = require('../models/event');

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
  if (isJson) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in to proceed.' });
  }

  req.flash('error', 'Please sign in to access this page.');
  return res.redirect('/auth/login');
}

function ensureOrganizer(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user.role === 'organizer') {
    return next();
  }

  const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
  if (isJson) {
    return res.status(403).json({ error: 'Forbidden. Organizer access required.' });
  }

  req.flash('error', 'Access denied. Organizer privilege required.');
  return res.redirect('/events');
}

async function ensureEventOwner(req, res, next) {
  try {
    const eventId = req.params.id;
    let event = null;

    if (eventId.match(/^[0-9a-fA-F]{24}$/)) {
      event = await Event.findById(eventId);
    }

    if (!event) {
      const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
      if (isJson) {
        return res.status(404).json({ error: 'Event not found.' });
      }
      req.flash('error', 'Event not found.');
      return res.redirect('/events');
    }

    if (event.organizerId.toString() !== req.user.id.toString()) {
      const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
      if (isJson) {
        return res.status(403).json({ error: 'Forbidden. You do not own this event.' });
      }
      req.flash('error', 'You are not authorized to manage this event.');
      return res.redirect('/events');
    }

    req.event = event;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  ensureAuthenticated,
  ensureOrganizer,
  ensureEventOwner
};
