const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  telegramId: {
    type: Number,
    required: true
  },
  gameType: {
    type: String,
    enum: ['slots', 'roulette', 'guessnumber', 'miner', 'crush', 'dispute'],
    required: true
  },
  betAmount: {
    type: Number,
    required: true
  },
  outcome: {
    type: String,
    required: true
  },
  winAmount: {
    type: Number,
    default: 0
  },
  gameData: {
    type: Object
  },
  disputeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dispute',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('GameHistory', gameHistorySchema);