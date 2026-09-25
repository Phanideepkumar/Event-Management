const crypto = require('crypto');
const { Transform, pipeline } = require('stream');
const Event = require('../models/event');
const Registration = require('../models/registration');

/**
 * Escapes values according to RFC 4180 CSV standard.
 */
function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates a unique 15-character ticket code.
 */
function generateTicketCode() {
  const prefix = 'TICK';
  const randomPart = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars
  return `${prefix}-${randomPart}`;
}

const registrationController = {
  /**
   * Atomic RSVP Engine with Custom Event Registration Form Details
   */
  async rsvp(req, res, next) {
    try {
      const eventId = req.params.id;
      const userId = req.user.id;
      const { fullName, regNo, branch, section } = req.body;

      // Validate required attendee details
      const errors = [];
      if (!fullName || !fullName.trim()) errors.push('Full Name is required.');
      if (!regNo || !regNo.trim()) errors.push('Registration Number is required.');
      if (!branch || !branch.trim()) errors.push('Branch is required.');
      if (!section || !section.trim()) errors.push('Section is required.');

      if (errors.length > 0) {
        return res.format({
          'text/html': () => {
            req.flash('error', errors.join(' '));
            res.redirect(`/events/${eventId}`);
          },
          'application/json': () => {
            res.status(400).json({ errors });
          },
          'default': () => res.status(406).send('Not Acceptable')
        });
      }

      const event = await Event.findById(eventId);

      if (!event) {
        const err = new Error('Event not found');
        err.status = 404;
        throw err;
      }

      if (event.status !== 'published') {
        const err = new Error('Event is not available for registration');
        err.status = 400;
        throw err;
      }

      // 1. Check if user is already registered
      const existingRegistration = await Registration.findOne({
        userId,
        eventId,
        status: 'confirmed'
      });

      if (existingRegistration) {
        const err = new Error('You are already registered for this event');
        err.status = 409;
        throw err;
      }

      // 2. Count active confirmed registrations
      const confirmedCount = await Registration.countDocuments({
        eventId,
        status: 'confirmed'
      });

      if (confirmedCount >= event.totalCapacity) {
        const err = new Error('Event is sold out! No seats remaining.');
        err.status = 409;
        throw err;
      }

      const ticketCode = generateTicketCode();

      const registrationResult = await Registration.create({
        userId,
        eventId,
        fullName: fullName.trim(),
        regNo: regNo.trim().toUpperCase(),
        branch: branch.trim(),
        section: section.trim().toUpperCase(),
        ticketCode,
        status: 'confirmed'
      });

      res.format({
        'text/html': () => {
          req.flash('success', `Registration successful! Your ticket code is ${registrationResult.ticketCode}`);
          res.redirect(`/events/${eventId}`);
        },
        'application/json': () => {
          res.status(201).json({
            message: 'RSVP confirmed successfully',
            registration: registrationResult
          });
        },
        'default': () => res.status(406).send('Not Acceptable')
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.format({
          'text/html': () => {
            req.flash('error', 'You are already registered for this event.');
            res.redirect(`/events/${req.params.id}`);
          },
          'application/json': () => {
            res.status(409).json({ error: 'You are already registered for this event' });
          },
          'default': () => res.status(406).send('Not Acceptable')
        });
      }

      if (err.name === 'ValidationError') {
        const errorMsgs = Object.values(err.errors).map(e => e.message);
        return res.format({
          'text/html': () => {
            req.flash('error', errorMsgs.join(' '));
            res.redirect(`/events/${req.params.id}`);
          },
          'application/json': () => {
            res.status(422).json({ errors: errorMsgs });
          },
          'default': () => res.status(406).send('Not Acceptable')
        });
      }

      if (err.status && err.status < 500) {
        return res.format({
          'text/html': () => {
            req.flash('error', err.message);
            res.redirect(`/events/${req.params.id}`);
          },
          'application/json': () => {
            res.status(err.status).json({ error: err.message });
          },
          'default': () => res.status(406).send('Not Acceptable')
        });
      }
      next(err);
    }
  },

  /**
   * Cancel RSVP
   */
  async cancelRsvp(req, res, next) {
    try {
      const eventId = req.params.id;
      const userId = req.user.id;

      const registration = await Registration.findOne({
        eventId,
        userId,
        status: 'confirmed'
      });

      if (!registration) {
        return res.format({
          'text/html': () => {
            req.flash('error', 'Active registration not found.');
            res.redirect(`/events/${eventId}`);
          },
          'application/json': () => {
            res.status(404).json({ error: 'Registration not found' });
          },
          'default': () => res.status(406).send('Not Acceptable')
        });
      }

      registration.status = 'cancelled';
      await registration.save();

      res.format({
        'text/html': () => {
          req.flash('success', 'Your reservation has been cancelled.');
          res.redirect(`/events/${eventId}`);
        },
        'application/json': () => {
          res.json({ message: 'Reservation cancelled successfully' });
        },
        'default': () => res.status(406).send('Not Acceptable')
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Organizer Attendee List Table View
   */
  async getAttendeesTable(req, res, next) {
    try {
      const eventId = req.params.id;
      const event = req.event || await Event.findById(eventId).populate('organizerId', 'name email');

      if (!event) {
        req.flash('error', 'Event not found.');
        return res.redirect('/events');
      }

      const registrations = await Registration.find({
        eventId,
        status: 'confirmed'
      })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 })
      .lean();

      const formattedRegistrations = registrations.map(r => ({
        ...r,
        id: r._id.toString(),
        user: r.userId ? {
          id: r.userId._id.toString(),
          name: r.userId.name,
          email: r.userId.email
        } : null
      }));

      const organizer = event.organizerId ? {
        id: event.organizerId._id ? event.organizerId._id.toString() : event.organizerId.toString(),
        name: event.organizerId.name || 'Organizer',
        email: event.organizerId.email || ''
      } : null;

      const eventData = {
        ...event.toObject ? event.toObject() : event,
        id: event._id.toString(),
        organizer
      };

      res.format({
        'text/html': () => {
          res.render('events/attendeesTable', {
            title: `Attendee List Table: ${event.title}`,
            event: eventData,
            attendees: formattedRegistrations
          });
        },
        'application/json': () => {
          res.json({
            event: eventData,
            count: formattedRegistrations.length,
            attendees: formattedRegistrations
          });
        },
        'default': () => res.status(406).send('Not Acceptable')
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * O(1) Memory-Efficient Attendees CSV Export Stream with Full Student Details
   */
  async exportAttendees(req, res, next) {
    try {
      const eventId = req.params.id;
      const event = req.event || await Event.findById(eventId);

      if (!event) {
        req.flash('error', 'Event not found.');
        return res.redirect('/events');
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="attendees-event-${eventId}.csv"`);

      // Create RFC 4180 Transform Stream with full attendee details
      const csvTransform = new Transform({
        objectMode: true,
        transform(record, encoding, callback) {
          if (record.isHeader) {
            this.push('Ticket Code,Full Name,Registration Number,Branch,Section,Email Address,Registration Date\n');
            return callback();
          }

          const ticketCode = escapeCsvField(record.ticketCode);
          const fullName = escapeCsvField(record.fullName || (record.userId ? record.userId.name : 'N/A'));
          const regNo = escapeCsvField(record.regNo || 'N/A');
          const branch = escapeCsvField(record.branch || 'N/A');
          const section = escapeCsvField(record.section || 'N/A');
          const email = escapeCsvField(record.userId ? record.userId.email : 'N/A');
          const date = escapeCsvField(record.createdAt ? new Date(record.createdAt).toISOString() : '');

          const line = `${ticketCode},${fullName},${regNo},${branch},${section},${email},${date}\n`;
          this.push(line);
          callback();
        }
      });

      // Push CSV Header
      csvTransform.write({ isHeader: true });

      // Create Mongoose Stream Cursor
      const cursor = Registration.find({
        eventId,
        status: 'confirmed'
      })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 })
      .cursor();

      cursor.on('data', (doc) => {
        csvTransform.write(doc);
      });

      cursor.on('end', () => {
        csvTransform.end();
      });

      cursor.on('error', (err) => {
        csvTransform.destroy(err);
      });

      pipeline(csvTransform, res, (err) => {
        if (err && !res.headersSent) {
          next(err);
        }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = registrationController;
