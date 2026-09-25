const request = require('supertest');
const { setupTestDb, teardownTestDb, clearTestDb } = require('../setupDb');
const app = require('../../src/app');
const User = require('../../src/models/user');
const Event = require('../../src/models/event');

describe('Event Management, Multi-Tenancy, RSVP & Streaming Integration Tests (MongoDB)', () => {
  let organizerA, agentA, agentB, agentAtt1;
  let eventA, limitedEvent;

  beforeAll(async () => {
    await setupTestDb();
    await clearTestDb();

    // Seed test users
    organizerA = await User.create({
      name: 'Organizer Alpha',
      email: 'alpha@org.com',
      passwordHash: 'Password123!',
      role: 'organizer'
    });

    await User.create({
      name: 'Organizer Beta',
      email: 'beta@org.com',
      passwordHash: 'Password123!',
      role: 'organizer'
    });

    await User.create({
      name: 'Attendee One',
      email: 'att1@user.com',
      passwordHash: 'Password123!',
      role: 'attendee'
    });

    // Create session agents
    agentA = request.agent(app);
    await agentA.post('/auth/login').set('Accept', 'application/json').send({
      email: 'alpha@org.com',
      password: 'Password123!'
    });

    agentB = request.agent(app);
    await agentB.post('/auth/login').set('Accept', 'application/json').send({
      email: 'beta@org.com',
      password: 'Password123!'
    });

    agentAtt1 = request.agent(app);
    await agentAtt1.post('/auth/login').set('Accept', 'application/json').send({
      email: 'att1@user.com',
      password: 'Password123!'
    });

    // Seed test events
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    eventA = await Event.create({
      organizerId: organizerA._id,
      title: 'Alpha Architecture Summit',
      description: 'System design summit',
      eventDate: futureDate,
      totalCapacity: 10,
      status: 'published'
    });

    limitedEvent = await Event.create({
      organizerId: organizerA._id,
      title: 'Limited Capacity Workshop',
      description: 'Only 1 seat available',
      eventDate: futureDate,
      totalCapacity: 1,
      status: 'published'
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('Content Negotiation (GET /events)', () => {
    test('should deliver rendered EJS view when Accept: text/html', async () => {
      const response = await request(app)
        .get('/events')
        .set('Accept', 'text/html');

      expect(response.status).toBe(200);
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('Alpha Architecture Summit');
    });

    test('should deliver JSON array payload when Accept: application/json', async () => {
      const response = await request(app)
        .get('/events')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.events.length).toBeGreaterThanOrEqual(2);
      expect(response.body.events[0]).toHaveProperty('spotsLeft');
    });

    test('should return 406 Not Acceptable for unsupported media types', async () => {
      const response = await request(app)
        .get('/events')
        .set('Accept', 'image/png');

      expect(response.status).toBe(406);
    });
  });

  describe('Multi-Tenant Boundary & Privilege Isolation', () => {
    test('should allow Organizer A to update their own event', async () => {
      const response = await agentA
        .put(`/events/${eventA.id}`)
        .set('Accept', 'application/json')
        .send({
          title: 'Alpha Architecture Summit (Updated)',
          totalCapacity: 15
        });

      expect(response.status).toBe(200);
      expect(response.body.event.title).toBe('Alpha Architecture Summit (Updated)');
    });

    test('should forbid Organizer B from updating Organizer A\'s event', async () => {
      const response = await agentB
        .put(`/events/${eventA.id}`)
        .set('Accept', 'application/json')
        .send({
          title: 'Hacked Title'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('You do not own this event');
    });

    test('should forbid Organizer B from deleting Organizer A\'s event', async () => {
      const response = await agentB
        .delete(`/events/${eventA.id}`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(403);
    });
  });

  describe('Atomic RSVP & Concurrency Quota Exhaustion', () => {
    test('should allow user to RSVP for available seat', async () => {
      const response = await agentAtt1
        .post(`/events/${limitedEvent.id}/rsvp`)
        .set('Accept', 'application/json')
        .send({
          fullName: 'Attendee One',
          regNo: '21BCE1099',
          branch: 'Computer Science & Engineering',
          section: 'B'
        });

      expect(response.status).toBe(201);
      expect(response.body.registration).toHaveProperty('ticketCode');
      expect(response.body.registration.ticketCode.startsWith('TICK-')).toBe(true);
    });

    test('should prevent duplicate registration by same user', async () => {
      const response = await agentAtt1
        .post(`/events/${limitedEvent.id}/rsvp`)
        .set('Accept', 'application/json')
        .send({
          fullName: 'Attendee One',
          regNo: '21BCE1099',
          branch: 'Computer Science & Engineering',
          section: 'B'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already registered');
    });

    test('should reject RSVP when event capacity is exhausted (Zero-Oversell Guarantee)', async () => {
      await User.create({
        name: 'Attendee Two',
        email: 'att2@user.com',
        passwordHash: 'Password123!',
        role: 'attendee'
      });

      const agentAtt2 = request.agent(app);
      await agentAtt2.post('/auth/login').set('Accept', 'application/json').send({
        email: 'att2@user.com',
        password: 'Password123!'
      });

      const response = await agentAtt2
        .post(`/events/${limitedEvent.id}/rsvp`)
        .set('Accept', 'application/json')
        .send({
          fullName: 'Attendee Two',
          regNo: '21BCE1100',
          branch: 'Information Technology',
          section: 'C'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('sold out');
    });
  });

  describe('Memory-Efficient Attendees CSV Stream Export', () => {
    test('should stream attendee roster as RFC 4180 CSV for event owner', async () => {
      const response = await agentA
        .get(`/events/${limitedEvent.id}/export-attendees`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain(`filename="attendees-event-${limitedEvent.id}.csv"`);
      expect(response.text).toContain('Ticket Code,Full Name,Registration Number,Branch,Section,Email Address,Registration Date');
      expect(response.text).toContain('Attendee One');
      expect(response.text).toContain('att1@user.com');
    });

    test('should reject attendee CSV export attempt by non-owner', async () => {
      const response = await agentB
        .get(`/events/${limitedEvent.id}/export-attendees`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(403);
    });
  });
});
