const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  creatorTelegramId: {
    type: Number,
    required: true
  },
  opponentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  opponentTelegramId: {
    type: Number,
    default: null
  },
  creatorSide: {
    type: String,
    enum: ['heads', 'tails'],
    default: null
  },
  opponentSide: {
    type: String,
    enum: ['heads', 'tails'],
    default: null
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'canceled'],
    default: 'pending'
  },
  result: {
    type: String,
    enum: ['heads', 'tails', null],
    default: null
  },
  winnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  winnerTelegramId: {
    type: Number,
    default: null
  },
  messageId: {
    type: Number,
    default: null
  },
  chatId: {
    type: Number,
    default: null
  },
  commissionAmount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// Helper methods for the dispute model
disputeSchema.methods.accept = function(opponentId, opponentTelegramId, opponentSide) {
  this.opponentId = opponentId;
  this.opponentTelegramId = opponentTelegramId;
  this.opponentSide = opponentSide;
  this.status = 'accepted';
  return this.save();
};

disputeSchema.methods.reject = function() {
  this.status = 'rejected';
  return this.save();
};

disputeSchema.methods.cancel = function() {
  this.status = 'canceled';
  return this.save();
};

disputeSchema.methods.complete = function(result) {
  if (result !== 'heads' && result !== 'tails') {
    throw new Error('Result must be either heads or tails');
  }
  
  this.result = result;
  this.status = 'completed';
  this.completedAt = new Date();
  
  // Determine the winner
  if (this.creatorSide === result) {
    this.winnerId = this.creatorId;
    this.winnerTelegramId = this.creatorTelegramId;
  } else if (this.opponentSide === result) {
    this.winnerId = this.opponentId;
    this.winnerTelegramId = this.opponentTelegramId;
  }
  
  return this.save();
};

// Static methods
disputeSchema.statics.findPendingForUser = function(telegramId) {
  return this.find({
    $or: [
      { creatorTelegramId: telegramId, status: 'pending' },
      { opponentTelegramId: telegramId, status: 'pending' }
    ]
  });
};

disputeSchema.statics.findActiveForUser = function(telegramId) {
  return this.find({
    $or: [
      { creatorTelegramId: telegramId, status: 'accepted' },
      { opponentTelegramId: telegramId, status: 'accepted' }
    ]
  });
};

disputeSchema.statics.findCompletedForUser = function(telegramId) {
  return this.find({
    $or: [
      { creatorTelegramId: telegramId, status: 'completed' },
      { opponentTelegramId: telegramId, status: 'completed' }
    ]
  });
};

module.exports = mongoose.model('Dispute', disputeSchema);