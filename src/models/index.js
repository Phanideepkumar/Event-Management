const mongoose = require('mongoose');
const User = require('./user');
const Event = require('./event');
const Registration = require('./registration');

module.exports = {
  User,
  Event,
  Registration,
  mongoose
};
