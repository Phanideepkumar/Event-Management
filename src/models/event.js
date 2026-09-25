const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  organizerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Organizer ID is required']
  },
  title: {
    type: String,
    required: [true, 'Title cannot be blank'],
    trim: true,
    maxlength: [150, 'Title cannot exceed 150 characters']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  eventDate: {
    type: Date,
    required: [true, 'Event date is required'],
    validate: {
      validator: function(value) {
        return value && new Date(value) > new Date();
      },
      message: 'Event date must be set to a future timestamp'
    }
  },
  totalCapacity: {
    type: Number,
    required: [true, 'Total capacity is required'],
    min: [1, 'Total capacity must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Total capacity must be an integer'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['published', 'archived', 'cancelled'],
      message: 'Invalid status'
    },
    default: 'published'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for id
eventSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Virtual populate for organizer
eventSchema.virtual('organizer', {
  ref: 'User',
  localField: 'organizerId',
  foreignField: '_id',
  justOne: true
});

// Virtual populate for registrations
eventSchema.virtual('registrations', {
  ref: 'Registration',
  localField: '_id',
  foreignField: 'eventId'
});

// Indexes for query performance
eventSchema.index({ eventDate: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ organizerId: 1 });
eventSchema.index({ eventDate: 1, status: 1 });

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
