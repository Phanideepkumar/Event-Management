const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event ID is required']
  },
  fullName: {
    type: String,
    required: [true, 'Full Name is required'],
    trim: true,
    maxlength: [100, 'Full Name cannot exceed 100 characters']
  },
  regNo: {
    type: String,
    required: [true, 'Registration Number is required'],
    trim: true,
    uppercase: true,
    maxlength: [50, 'Registration Number cannot exceed 50 characters']
  },
  branch: {
    type: String,
    required: [true, 'Branch is required'],
    trim: true,
    maxlength: [100, 'Branch cannot exceed 100 characters']
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    trim: true,
    uppercase: true,
    maxlength: [20, 'Section cannot exceed 20 characters']
  },
  ticketCode: {
    type: String,
    required: [true, 'Ticket code cannot be empty'],
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [8, 'Ticket code length must be at least 8 characters'],
    maxlength: [16, 'Ticket code length must be at most 16 characters']
  },
  status: {
    type: String,
    enum: {
      values: ['confirmed', 'cancelled'],
      message: 'Status must be confirmed or cancelled'
    },
    default: 'confirmed'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for id
registrationSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Virtual populate for user
registrationSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual populate for event
registrationSchema.virtual('event', {
  ref: 'Event',
  localField: 'eventId',
  foreignField: '_id',
  justOne: true
});

// Compound unique index to prevent duplicate registrations per user per event
registrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });
registrationSchema.index({ status: 1 });

const Registration = mongoose.model('Registration', registrationSchema);
module.exports = Registration;
