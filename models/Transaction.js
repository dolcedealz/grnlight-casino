const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  telegramId: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'bet', 'win', 'admin_adjustment'],
    required: true
  },
  game: {
    type: String,
    enum: ['slots', 'roulette', 'guessnumber', 'miner', 'crush', 'dispute', 'none'],
    default: 'none'
  },
  disputeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dispute',
    required: false
  },
  // Добавляем информацию о криптоплатеже
  cryptoDetails: {
    invoiceId: String,
    asset: String,
    amount: String,
    status: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);