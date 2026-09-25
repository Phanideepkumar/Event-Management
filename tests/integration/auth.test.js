const request = require('supertest');
const { setupTestDb, teardownTestDb, clearTestDb } = require('../setupDb');
const app = require('../../src/app');
const User = require('../../src/models/user');

describe('Authentication Integration Tests (MongoDB)', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe('POST /auth/register', () => {
    test('should create a new user account and return JSON when Accept is application/json', async () => {
      const response = await request(app)
        .post('/auth/register')
        .set('Accept', 'application/json')
        .send({
          name: 'Sarah Connor',
          email: 'sarah@skynet.com',
          password: 'Password123!',
          role: 'organizer'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Account created successfully');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe('sarah@skynet.com');
      expect(response.body.user.role).toBe('organizer');
    });

    test('should reject duplicate email registration', async () => {
      await User.create({
        name: 'Existing Sarah',
        email: 'sarah@skynet.com',
        passwordHash: 'Password123!',
        role: 'organizer'
      });

      const response = await request(app)
        .post('/auth/register')
        .set('Accept', 'application/json')
        .send({
          name: 'Duplicate Sarah',
          email: 'sarah@skynet.com',
          password: 'Password123!',
          role: 'attendee'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    test('should reject password under 8 characters', async () => {
      const response = await request(app)
        .post('/auth/register')
        .set('Accept', 'application/json')
        .send({
          name: 'Short Pass',
          email: 'short@example.com',
          password: '123',
          role: 'attendee'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContain('Password must be at least 8 characters.');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await User.create({
        name: 'Sarah Connor',
        email: 'sarah@skynet.com',
        passwordHash: 'Password123!',
        role: 'organizer'
      });
    });

    test('should authenticate user with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Accept', 'application/json')
        .send({
          email: 'sarah@skynet.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Authentication successful');
      expect(response.body.user.email).toBe('sarah@skynet.com');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should reject invalid password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Accept', 'application/json')
        .send({
          email: 'sarah@skynet.com',
          password: 'WrongPassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });
  });
});
