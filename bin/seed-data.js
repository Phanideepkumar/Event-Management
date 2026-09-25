#!/usr/bin/env node

require('dotenv').config();
const { connectDB, disconnectDB } = require('../src/config/database');
const User = require('../src/models/user');
const Event = require('../src/models/event');
const Registration = require('../src/models/registration');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();

    console.log('Clearing existing collections...');
    await User.deleteMany({});
    await Event.deleteMany({});
    await Registration.deleteMany({});

    console.log('Seeding demo data into MongoDB...');

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash('Password123!', salt);

    // Create Organizers
    const org1 = await User.create({
      name: 'Alice Organizer',
      email: 'alice@eventdesk.com',
      passwordHash: passHash,
      role: 'organizer'
    });

    const org2 = await User.create({
      name: 'Bob Organizer',
      email: 'bob@eventdesk.com',
      passwordHash: passHash,
      role: 'organizer'
    });

    // Create Attendees
    const att1 = await User.create({
      name: 'Charlie Attendee',
      email: 'charlie@gmail.com',
      passwordHash: passHash,
      role: 'attendee'
    });

    await User.create({
      name: 'Dana Attendee',
      email: 'dana@gmail.com',
      passwordHash: passHash,
      role: 'attendee'
    });

    // Create Events
    const futureDate1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days in future
    const futureDate2 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days in future

    const event1 = await Event.create({
      organizerId: org1._id,
      title: 'Global AI & Cloud Summit 2026',
      description: 'Join industry experts to explore state-of-the-art serverless architecture and AI agents.',
      eventDate: futureDate1,
      totalCapacity: 50,
      status: 'published'
    });

    await Event.create({
      organizerId: org1._id,
      title: 'Node.js Performance Workshop',
      description: 'Hands-on deep dive into memory leaks, stream transformations, and async I/O optimization.',
      eventDate: futureDate2,
      totalCapacity: 2, // Small capacity for concurrency testing
      status: 'published'
    });

    await Event.create({
      organizerId: org2._id,
      title: 'DevOps & Kubernetes Masterclass',
      description: 'Learn Helm, GitOps workflows, and continuous integration pipelines for high availability.',
      eventDate: futureDate1,
      totalCapacity: 100,
      status: 'published'
    });

    // Seed initial registration with student details
    await Registration.create({
      userId: att1._id,
      eventId: event1._id,
      fullName: 'Charlie Attendee',
      regNo: '21BCE1024',
      branch: 'Computer Science & Engineering',
      section: 'A',
      ticketCode: 'TICK-DEMO-000001',
      status: 'confirmed'
    });

    console.log('MongoDB Seed completed successfully!');
    console.log('Demo Credentials:');
    console.log('  Organizer: alice@eventdesk.com / Password123!');
    console.log('  Organizer: bob@eventdesk.com / Password123!');
    console.log('  Attendee: charlie@gmail.com / Password123!');
    console.log('  Attendee: dana@gmail.com / Password123!');

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
