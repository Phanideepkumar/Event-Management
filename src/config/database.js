const mongoose = require('mongoose');

async function connectDB(uri) {
  const connectionUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventdesk';

  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(connectionUri, {
      dbName: 'eventdesk',
      autoIndex: true,
      serverSelectionTimeoutMS: 10000
    });
    console.log(`[EventDesk DB] Connected to MongoDB at ${connectionUri.replace(/\/\/.*@/, '//***@')}`);
    return mongoose.connection;
  } catch (err) {
    console.error('[EventDesk DB] MongoDB connection error:', err);
    throw err;
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[EventDesk DB] Disconnected from MongoDB.');
  }
}

module.exports = {
  connectDB,
  disconnectDB
};
