const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name cannot be empty'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email cannot be empty'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [emailRegex, 'Must be a valid email address']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash cannot be empty']
  },
  role: {
    type: String,
    enum: {
      values: ['organizer', 'attendee'],
      message: 'Role must be either organizer or attendee'
    },
    default: 'attendee'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for id
userSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Pre-save hook for password hashing
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }

  if (this.passwordHash && !this.passwordHash.startsWith('$2a$') && !this.passwordHash.startsWith('$2b$')) {
    if (this.passwordHash.length < 8) {
      return next(new Error('Password must be at least 8 characters long'));
    }
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  }

  next();
});

// Instance method to verify password
userSchema.methods.validPassword = async function(password) {
  if (!this.passwordHash || !password) return false;
  return await bcrypt.compare(password, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
