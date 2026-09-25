#!/usr/bin/env node

require('dotenv').config();
const { connectDB, disconnectDB } = require('../src/config/database');
const Event = require('../src/models/event');

function parseArgs() {
  const args = process.argv.slice(2);
  let cutoffDate = new Date(); // Default: events before now

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(`
EventDesk CLI Event Archiver Tool (MongoDB Engine)

Usage:
  node bin/archive-events.js [options]

Options:
  --before <ISO_DATE>   Archive events with eventDate earlier than specified date (e.g. --before 2026-09-01)
  --days <NUMBER>       Archive events older than N days ago from today (e.g. --days 30)
  --help, -h            Show this help message
      `);
      process.exit(0);
    }

    if (arg === '--before' && args[i + 1]) {
      const parsed = new Date(args[i + 1]);
      if (isNaN(parsed.getTime())) {
        console.error(`Invalid date format for --before: "${args[i + 1]}". Use YYYY-MM-DD.`);
        process.exit(1);
      }
      cutoffDate = parsed;
      i++;
    }

    if (arg === '--days' && args[i + 1]) {
      const days = parseInt(args[i + 1], 10);
      if (isNaN(days) || days < 0) {
        console.error(`Invalid number of days: "${args[i + 1]}". Must be a non-negative integer.`);
        process.exit(1);
      }
      cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      i++;
    }
  }

  return cutoffDate;
}

async function runArchiver() {
  const cutoffDate = parseArgs();

  console.log('[CLI Archiver] Connecting to MongoDB database...');
  await connectDB();

  console.log(`[CLI Archiver] Archiving published events before: ${cutoffDate.toISOString()}`);

  const result = await Event.updateMany(
    {
      status: 'published',
      eventDate: { $lt: cutoffDate }
    },
    {
      $set: { status: 'archived' }
    }
  );

  console.log(`[CLI Archiver] Successfully archived ${result.modifiedCount} expired event(s).`);
  await disconnectDB();
  process.exit(0);
}

runArchiver().catch((err) => {
  console.error('[CLI Archiver] Fatal error archiving events:', err);
  process.exit(1);
});
