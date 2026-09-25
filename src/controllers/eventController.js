const Event = require('../models/event');
const Registration = require('../models/registration');

function isJsonRequest(req) {
  const accept = req.headers.accept || '';
  return req.xhr || (accept.includes('application/json') && !accept.includes('text/html'));
}

const eventController = {
  async listEvents(req, res, next) {
    try {
      const events = await Event.find({ status: 'published' })
        .populate('organizerId', 'name email')
        .sort({ eventDate: 1 })
        .lean();

      const formattedEvents = await Promise.all(events.map(async (e) => {
        const confirmedCount = await Registration.countDocuments({
          eventId: e._id,
          status: 'confirmed'
        });

        const organizer = e.organizerId ? {
          id: e.organizerId._id.toString(),
          name: e.organizerId.name,
          email: e.organizerId.email
        } : null;

        return {
          ...e,
          id: e._id.toString(),
          organizer,
          confirmedCount,
          spotsLeft: Math.max(0, e.totalCapacity - confirmedCount),
          isSoldOut: confirmedCount >= e.totalCapacity
        };
      }));

      if (isJsonRequest(req)) {
        return res.json({
          count: formattedEvents.length,
          events: formattedEvents
        });
      }

      const accept = req.headers.accept || '';
      if (accept.includes('image/png') && !accept.includes('text/html')) {
        return res.status(406).send('Not Acceptable');
      }

      res.render('events/index', {
        title: 'Browse Events - EventDesk',
        events: formattedEvents
      });
    } catch (err) {
      next(err);
    }
  },

  async showEvent(req, res, next) {
    try {
      const { id } = req.params;
      let event = null;

      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        event = await Event.findById(id).populate('organizerId', 'name email').lean();
      }

      if (!event) {
        if (isJsonRequest(req)) {
          return res.status(404).json({ error: 'Event not found' });
        }
        req.flash('error', 'Event not found.');
        return res.status(404).redirect('/events');
      }

      const confirmedRegistrations = await Registration.find({
        eventId: event._id,
        status: 'confirmed'
      }).populate('userId', 'name email').lean();

      const confirmedCount = confirmedRegistrations.length;
      const spotsLeft = Math.max(0, event.totalCapacity - confirmedCount);
      const isSoldOut = confirmedCount >= event.totalCapacity;

      let userRegistration = null;
      if (req.user) {
        userRegistration = await Registration.findOne({
          eventId: event._id,
          userId: req.user.id,
          status: 'confirmed'
        }).lean();
        if (userRegistration) {
          userRegistration.id = userRegistration._id.toString();
        }
      }

      const organizer = event.organizerId ? {
        id: event.organizerId._id.toString(),
        name: event.organizerId.name,
        email: event.organizerId.email
      } : null;

      const formattedRegistrations = confirmedRegistrations.map(r => ({
        ...r,
        id: r._id.toString(),
        user: r.userId ? {
          id: r.userId._id.toString(),
          name: r.userId.name,
          email: r.userId.email
        } : null
      }));

      const eventData = {
        ...event,
        id: event._id.toString(),
        organizer,
        organizerId: event.organizerId ? event.organizerId._id.toString() : null,
        registrations: formattedRegistrations,
        confirmedCount,
        spotsLeft,
        isSoldOut,
        userRegistration
      };

      if (isJsonRequest(req)) {
        return res.json({ event: eventData });
      }

      res.render('events/show', {
        title: `${event.title} - EventDesk`,
        event: eventData
      });
    } catch (err) {
      next(err);
    }
  },

  showCreateForm(req, res) {
    res.render('events/new', {
      title: 'Create New Event - EventDesk',
      errors: [],
      values: {}
    });
  },

  async createEvent(req, res, next) {
    try {
      const { title, description, eventDate, totalCapacity } = req.body;
      const organizerId = req.user.id;

      const event = await Event.create({
        organizerId,
        title: title ? title.trim() : '',
        description: description ? description.trim() : '',
        eventDate: eventDate ? new Date(eventDate) : null,
        totalCapacity: totalCapacity ? parseInt(totalCapacity, 10) : 0,
        status: 'published'
      });

      if (isJsonRequest(req)) {
        return res.status(201).json({
          message: 'Event created successfully',
          event
        });
      }

      req.flash('success', 'Event published successfully!');
      res.redirect(`/events/${event.id}`);
    } catch (err) {
      if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        if (isJsonRequest(req)) {
          return res.status(422).json({ errors });
        }
        return res.render('events/new', {
          title: 'Create New Event - EventDesk',
          errors,
          values: req.body
        });
      }
      next(err);
    }
  },

  async showEditForm(req, res, next) {
    try {
      const event = req.event || await Event.findById(req.params.id);
      if (!event) {
        req.flash('error', 'Event not found.');
        return res.redirect('/events');
      }

      res.render('events/edit', {
        title: `Edit Event: ${event.title}`,
        event,
        errors: []
      });
    } catch (err) {
      next(err);
    }
  },

  async updateEvent(req, res, next) {
    try {
      const event = req.event || await Event.findById(req.params.id);
      const { title, description, eventDate, totalCapacity, status } = req.body;

      if (title !== undefined) event.title = title.trim();
      if (description !== undefined) event.description = description.trim();
      if (eventDate) event.eventDate = new Date(eventDate);
      if (totalCapacity) event.totalCapacity = parseInt(totalCapacity, 10);
      if (status) event.status = status;

      await event.save();

      if (isJsonRequest(req)) {
        return res.json({
          message: 'Event updated successfully',
          event
        });
      }

      req.flash('success', 'Event updated successfully.');
      res.redirect(`/events/${event.id}`);
    } catch (err) {
      if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        if (isJsonRequest(req)) {
          return res.status(422).json({ errors });
        }
        return res.render('events/edit', {
          title: `Edit Event: ${req.body.title || 'Event'}`,
          event: { ...req.body, id: req.params.id },
          errors
        });
      }
      next(err);
    }
  },

  async deleteEvent(req, res, next) {
    try {
      const event = req.event || await Event.findById(req.params.id);
      event.status = 'cancelled';
      await event.save();

      if (isJsonRequest(req)) {
        return res.json({ message: 'Event status updated to cancelled' });
      }

      req.flash('success', 'Event has been cancelled.');
      res.redirect('/events');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = eventController;
