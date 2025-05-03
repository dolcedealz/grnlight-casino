const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  creatorId: {
    type: Number,
    required: true
  },
  opponentId: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  winnerId: {
    type: Number,
    default: null
  },
  result: {
    type: String,
    enum: ['creator_won', 'opponent_won', null],
    default: null
  },
  gameData: {
    coinSide: {
      type: String,
      enum: ['heads', 'tails', null],
      default: null
    },
    creatorChoice: {
      type: String,
      enum: ['heads', 'tails', null],
      default: null
    },
    opponentChoice: {
      type: String,
      enum: ['heads', 'tails', null],
      default: null
    }
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

// Добавляем метод для завершения спора
disputeSchema.methods.complete = async function(winnerId, result) {
  this.status = 'completed';
  this.winnerId = winnerId;
  this.result = result;
  this.completedAt = new Date();
  await this.save();
};

module.exports = mongoose.model('Dispute', disputeSchema);