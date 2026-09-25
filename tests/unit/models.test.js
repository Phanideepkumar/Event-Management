const { setupTestDb, teardownTestDb, clearTestDb } = require('../setupDb');
const User = require('../../src/models/user');
const Event = require('../../src/models/event');
const Registration = require('../../src/models/registration');

describe('MongoDB Model Unit Tests', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe('User Model Validations', () => {
    test('should sanitize email to lowercase', async () => {
      const user = await User.create({
        name: 'Test User',
        email: '  JOHN.DOE@EXAMPLE.COM  ',
        passwordHash: 'SuperSecret123!',
        role: 'attendee'
      });

      expect(user.email).toBe('john.doe@example.com');
    });

    test('should hash password automatically on create', async () => {
      const user = await User.create({
        name: 'Jane Doe',
        email: 'jane@example.com',
        passwordHash: 'PlainPassword123!',
        role: 'organizer'
      });

      expect(user.passwordHash).not.toBe('PlainPassword123!');
      expect(user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')).toBe(true);

      const isValid = await user.validPassword('PlainPassword123!');
      expect(isValid).toBe(true);
    });

    test('should reject invalid email syntax', async () => {
      await expect(User.create({
        name: 'Invalid Email',
        email: 'invalid-email-string',
        passwordHash: 'ValidPass123!',
        role: 'attendee'
      })).rejects.toThrow();
    });
  });

  describe('Event Model Validations', () => {
    test('should reject past event dates', async () => {
      const organizer = await User.create({
        name: 'Organizer One',
        email: 'org1@example.com',
        passwordHash: 'Pass123456!',
        role: 'organizer'
      });

      const pastDate = new Date(Date.now() - 1000 * 60 * 60);

      await expect(Event.create({
        organizerId: organizer._id,
        title: 'Past Event',
        description: 'Should fail',
        eventDate: pastDate,
        totalCapacity: 50,
        status: 'published'
      })).rejects.toThrow('Event date must be set to a future timestamp');
    });

    test('should reject zero capacity', async () => {
      const organizer = await User.create({
        name: 'Organizer One',
        email: 'org2@example.com',
        passwordHash: 'Pass123456!',
        role: 'organizer'
      });

      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24);

      await expect(Event.create({
        organizerId: organizer._id,
        title: 'Invalid Capacity Event',
        eventDate: futureDate,
        totalCapacity: 0,
        status: 'published'
      })).rejects.toThrow();
    });
  });

  describe('Registration Model Validations', () => {
    test('should enforce compound uniqueness on userId and eventId', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'Pass123456!',
        role: 'attendee'
      });

      const organizer = await User.create({
        name: 'Organizer Alpha',
        email: 'orgalpha@example.com',
        passwordHash: 'Pass123456!',
        role: 'organizer'
      });

      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 48);

      const event = await Event.create({
        organizerId: organizer._id,
        title: 'Unique Registration Test Event',
        eventDate: futureDate,
        totalCapacity: 10,
        status: 'published'
      });

      await Registration.create({
        userId: user._id,
        eventId: event._id,
        fullName: 'John Doe',
        regNo: '21BCE1001',
        branch: 'Computer Science & Engineering',
        section: 'A',
        ticketCode: 'TICK-TEST-100001',
        status: 'confirmed'
      });

      await expect(Registration.create({
        userId: user._id,
        eventId: event._id,
        fullName: 'John Doe',
        regNo: '21BCE1001',
        branch: 'Computer Science & Engineering',
        section: 'A',
        ticketCode: 'TICK-TEST-100002',
        status: 'confirmed'
      })).rejects.toThrow();
    });
  });
});
