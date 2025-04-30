const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String
  },
  username: {
    type: String
  },
  balance: {
    type: Number,
    default: 0
  },
  winRate: {
    type: Number,
    default: 1.0 // Общий множитель шанса выигрыша
  },
  // Новое поле для индивидуальных шансов по каждой игре
  gameWinRates: {
    type: Object,
    default: {
      slots: 1.0,
      roulette: 1.0,
      guessnumber: 1.0,
      miner: 1.0,
      crush: 1.0
    }
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  isNewUser: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Дата последней активности
  lastActivity: {
    type: Date,
    default: Date.now
  },
  // Сохраняем общую статистику
  stats: {
    gamesPlayed: {
      type: Number,
      default: 0
    },
    gamesWon: {
      type: Number,
      default: 0
    },
    totalBets: {
      type: Number,
      default: 0
    },
    totalWins: {
      type: Number,
      default: 0
    }
  }
});

// Метод для получения эффективного шанса выигрыша для конкретной игры
userSchema.methods.getEffectiveWinRate = function(gameType) {
  // Если есть индивидуальная настройка для игры - используем её
  if (this.gameWinRates && this.gameWinRates[gameType]) {
    return this.gameWinRates[gameType];
  }
  
  // Иначе используем общий шанс выигрыша
  return this.winRate;
};

// Метод для обновления статистики пользователя
userSchema.methods.updateStats = async function(gameResult) {
  this.stats.gamesPlayed += 1;
  
  if (gameResult.outcome === 'win') {
    this.stats.gamesWon += 1;
  }
  
  this.stats.totalBets += gameResult.betAmount;
  this.stats.totalWins += gameResult.winAmount;
  
  // Обновляем время последней активности
  this.lastActivity = new Date();
  
  // Пользователь больше не считается новым после 10 игр
  if (this.stats.gamesPlayed >= 10) {
    this.isNewUser = false;
  }
  
  await this.save();
};

module.exports = mongoose.model('User', userSchema);