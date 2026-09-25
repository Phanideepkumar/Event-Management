const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const registrationController = require('../controllers/registrationController');
const { ensureAuthenticated, ensureOrganizer, ensureEventOwner } = require('../middleware/auth');

// Public event listing and details
router.get('/', eventController.listEvents);
router.get('/new', ensureAuthenticated, ensureOrganizer, eventController.showCreateForm);
router.post('/', ensureAuthenticated, ensureOrganizer, eventController.createEvent);

router.get('/:id', eventController.showEvent);

// Event management (Organizer owner only)
router.get('/:id/edit', ensureAuthenticated, ensureOrganizer, ensureEventOwner, eventController.showEditForm);
router.post('/:id/edit', ensureAuthenticated, ensureOrganizer, ensureEventOwner, eventController.updateEvent);
router.put('/:id', ensureAuthenticated, ensureOrganizer, ensureEventOwner, eventController.updateEvent);
router.post('/:id/delete', ensureAuthenticated, ensureOrganizer, ensureEventOwner, eventController.deleteEvent);
router.delete('/:id', ensureAuthenticated, ensureOrganizer, ensureEventOwner, eventController.deleteEvent);

// Registrations / RSVPs
router.post('/:id/rsvp', ensureAuthenticated, registrationController.rsvp);
router.post('/:id/cancel-rsvp', ensureAuthenticated, registrationController.cancelRsvp);

// Organizer Roster Views & Exports (Organizer owner only)
router.get('/:id/attendees-table', ensureAuthenticated, ensureOrganizer, ensureEventOwner, registrationController.getAttendeesTable);
router.get('/:id/export-attendees', ensureAuthenticated, ensureOrganizer, ensureEventOwner, registrationController.exportAttendees);

module.exports = router;
