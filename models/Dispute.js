const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  // Связь с пользователями
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  opponent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Telegram ID для быстрого доступа без JOIN
  creatorTelegramId: {
    type: Number,
    required: true
  },
  opponentTelegramId: {
    type: Number
  },
  
  // Информация о споре
  question: {
    type: String,
    required: true
  },
  bet: {
    amount: {
      type: Number,
      required: true
    },
    creatorChoice: {
      type: Boolean,
      default: null
    },
    opponentChoice: {
      type: Boolean,
      default: null
    }
  },
  
  // Информация для определения победителя
  creatorSide: {
    type: String,
    enum: ['heads', 'tails']
  },
  opponentSide: {
    type: String,
    enum: ['heads', 'tails']
  },
  result: {
    type: String,
    enum: ['heads', 'tails', null],
    default: null
  },
  
  // Информация о победителе
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  winnerTelegramId: {
    type: Number,
    default: null
  },
  
  // Комиссия системы
  commission: {
    type: Number,
    default: 0
  },
  
  // Статус спора
  status: {
    type: String,
    enum: ['pending', 'active', 'voting', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  // Данные сообщения для возможного обновления
  messageId: {
    type: Number
  },
  chatId: {
    type: Number
  },
  
  // Метки времени
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
});

module.exports = mongoose.model('Dispute', disputeSchema);