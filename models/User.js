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
  // Базовый баланс (звезды)
  balance: {
    type: Number,
    default: 0
  },
  // Добавляем балансы USDT и RUB
  usdtBalance: {
    type: Number,
    default: 0
  },
  rubleBalance: {
    type: Number,
    default: 0
  },
  // Предпочитаемая валюта пользователя для отображения
  preferredCurrency: {
    type: String,
    enum: ['usdt', 'rub', 'stars'],
    default: 'usdt'
  },
  // Настройки автоматического обмена
  autoExchange: {
    enabled: {
      type: Boolean,
      default: false
    },
    fromCurrency: {
      type: String,
      enum: ['usdt', 'rub', 'stars'],
      default: 'usdt'
    },
    toCurrency: {
      type: String,
      enum: ['usdt', 'rub', 'stars'],
      default: 'stars'
    },
    threshold: {
      type: Number,
      default: 10 // минимальная сумма для автоматического обмена
    }
  },
  // Общий множитель шанса выигрыша
  winRate: {
    type: Number,
    default: 1.0
  },
  // Индивидуальные шансы по каждой игре
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
  // Платежная информация из CryptoPay
  cryptoPay: {
    // Хранение идентификаторов инвойсов для отслеживания
    invoices: [
      {
        invoiceId: String, // ID счета в CryptoPay
        amount: Number,
        currency: String, // BTC, TON, USDT_TRC20, и т.д.
        status: {
          type: String,
          enum: ['active', 'paid', 'expired', 'cancelled']
        },
        createdAt: {
          type: Date,
          default: Date.now
        },
        paidAt: Date,
        description: String,
        externalId: String // Ваш внутренний идентификатор
      }
    ],
    // Хранение истории переводов
    transfers: [
      {
        transferId: String, // ID перевода в CryptoPay
        userId: Number, // telegramId пользователя
        amount: Number,
        currency: String,
        status: {
          type: String,
          enum: ['created', 'confirmed', 'cancelled']
        },
        createdAt: {
          type: Date,
          default: Date.now
        },
        completedAt: Date,
        comment: String
      }
    ]
  },
  // Статусы пользователя
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
  // Промокоды и бонусы
  referralCode: {
    type: String,
    unique: true,
    sparse: true // допускает null значения
  },
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referralCount: {
    type: Number,
    default: 0
  },
  bonuses: [
    {
      type: {
        type: String,
        enum: ['welcome', 'deposit', 'referral', 'promotion']
      },
      amount: Number,
      currency: {
        type: String,
        enum: ['usdt', 'rub', 'stars'],
        default: 'stars'
      },
      status: {
        type: String,
        enum: ['active', 'used', 'expired'],
        default: 'active'
      },
      expiresAt: Date,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  usedPromoCodes: [String],
  // Временные метки
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  lastDepositAt: Date,
  lastWithdrawalAt: Date,
  // Общая статистика
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
    },
    totalDeposited: {
      usdt: {
        type: Number,
        default: 0
      },
      rub: {
        type: Number,
        default: 0
      },
      stars: {
        type: Number,
        default: 0
      }
    },
    totalWithdrawn: {
      usdt: {
        type: Number,
        default: 0
      },
      rub: {
        type: Number,
        default: 0
      },
      stars: {
        type: Number,
        default: 0
      }
    }
  },
  // Настройки приватности
  privacySettings: {
    showInLeaderboard: {
      type: Boolean,
      default: true
    }
  },
  // Уведомления
  notifications: {
    telegram: {
      enabled: {
        type: Boolean,
        default: true
      }
    },
    depositSuccess: {
      type: Boolean,
      default: true
    },
    withdrawalSuccess: {
      type: Boolean,
      default: true
    },
    bonusReceived: {
      type: Boolean,
      default: true
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

// Метод для добавления средств к балансу пользователя
userSchema.methods.addFunds = async function(amount, currency) {
  currency = currency || 'stars';
  
  if (currency === 'usdt') {
    this.usdtBalance += amount;
  } else if (currency === 'rub') {
    this.rubleBalance += amount;
  } else {
    this.balance += amount; // stars
  }
  
  // Обновляем статистику пополнений
  if (amount > 0) {
    this.stats.totalDeposited[currency] += amount;
    this.lastDepositAt = new Date();
  }
  
  // Обновляем последнюю активность
  this.lastActivity = new Date();
  
  await this.save();
  return {
    currency,
    amount,
    newBalance: currency === 'usdt' ? this.usdtBalance : 
               (currency === 'rub' ? this.rubleBalance : this.balance)
  };
};

// Метод для снятия средств с баланса пользователя
userSchema.methods.withdrawFunds = async function(amount, currency) {
  currency = currency || 'stars';
  
  let currentBalance;
  if (currency === 'usdt') {
    currentBalance = this.usdtBalance;
  } else if (currency === 'rub') {
    currentBalance = this.rubleBalance;
  } else {
    currentBalance = this.balance; // stars
  }
  
  // Проверка наличия достаточного баланса
  if (currentBalance < amount) {
    throw new Error(`Недостаточно средств в ${currency} для вывода ${amount}`);
  }
  
  // Снимаем средства
  if (currency === 'usdt') {
    this.usdtBalance -= amount;
  } else if (currency === 'rub') {
    this.rubleBalance -= amount;
  } else {
    this.balance -= amount; // stars
  }
  
  // Обновляем статистику выводов
  this.stats.totalWithdrawn[currency] += amount;
  this.lastWithdrawalAt = new Date();
  
  // Обновляем последнюю активность
  this.lastActivity = new Date();
  
  await this.save();
  return {
    currency,
    amount,
    newBalance: currency === 'usdt' ? this.usdtBalance : 
               (currency === 'rub' ? this.rubleBalance : this.balance)
  };
};

// Метод для конвертации между валютами
userSchema.methods.convertCurrency = async function(fromCurrency, toCurrency, amount, rate) {
  // Проверка доступности валют
  if (!['usdt', 'rub', 'stars'].includes(fromCurrency) || 
      !['usdt', 'rub', 'stars'].includes(toCurrency)) {
    throw new Error('Неподдерживаемая валюта');
  }
  
  // Проверка наличия достаточного баланса
  let fromBalance;
  if (fromCurrency === 'usdt') {
    fromBalance = this.usdtBalance;
  } else if (fromCurrency === 'rub') {
    fromBalance = this.rubleBalance;
  } else {
    fromBalance = this.balance; // stars
  }
  
  if (fromBalance < amount) {
    throw new Error(`Недостаточно средств в ${fromCurrency} для конвертации ${amount}`);
  }
  
  // Рассчитываем сумму конвертации
  let convertedAmount;
  if (rate) {
    // Если указан конкретный курс, используем его
    convertedAmount = amount * rate;
  } else {
    // В противном случае нужно получить курс из базы или использовать дефолтный
    // Предположим, что у нас есть примерные курсы
    const defaultRates = {
      usdt_to_rub: 90,   // 1 USDT = 90 рублей
      usdt_to_stars: 100, // 1 USDT = 100 звезд
      rub_to_stars: 1.1   // 1 рубль = 1.1 звезды
    };
    
    if (fromCurrency === 'usdt' && toCurrency === 'rub') {
      convertedAmount = amount * defaultRates.usdt_to_rub;
    } else if (fromCurrency === 'usdt' && toCurrency === 'stars') {
      convertedAmount = amount * defaultRates.usdt_to_stars;
    } else if (fromCurrency === 'rub' && toCurrency === 'usdt') {
      convertedAmount = amount / defaultRates.usdt_to_rub;
    } else if (fromCurrency === 'rub' && toCurrency === 'stars') {
      convertedAmount = amount * defaultRates.rub_to_stars;
    } else if (fromCurrency === 'stars' && toCurrency === 'usdt') {
      convertedAmount = amount / defaultRates.usdt_to_stars;
    } else if (fromCurrency === 'stars' && toCurrency === 'rub') {
      convertedAmount = amount / defaultRates.rub_to_stars;
    } else {
      throw new Error('Неподдерживаемая комбинация валют');
    }
  }
  
  // Снимаем средства с одного баланса и добавляем на другой
  if (fromCurrency === 'usdt') {
    this.usdtBalance -= amount;
  } else if (fromCurrency === 'rub') {
    this.rubleBalance -= amount;
  } else {
    this.balance -= amount; // stars
  }
  
  if (toCurrency === 'usdt') {
    this.usdtBalance += convertedAmount;
  } else if (toCurrency === 'rub') {
    this.rubleBalance += convertedAmount;
  } else {
    this.balance += convertedAmount; // stars
  }
  
  // Обновляем последнюю активность
  this.lastActivity = new Date();
  
  await this.save();
  return {
    fromCurrency,
    fromAmount: amount,
    toCurrency,
    toAmount: convertedAmount,
    rate: rate || (convertedAmount / amount)
  };
};

// Метод для создания реферального кода
userSchema.methods.generateReferralCode = async function() {
  if (this.referralCode) {
    return this.referralCode;
  }
  
  // Генерируем код на основе имени и ID пользователя
  const baseCode = this.firstName.substring(0, 3).toUpperCase() + this.telegramId.toString().substring(0, 4);
  let code = baseCode;
  let counter = 1;
  
  // Проверяем уникальность кода
  while (true) {
    const existing = await mongoose.model('User').findOne({ referralCode: code });
    if (!existing) break;
    
    // Если код уже существует, добавляем счетчик
    code = baseCode + counter;
    counter++;
  }
  
  this.referralCode = code;
  await this.save();
  
  return code;
};

// Метод для сохранения информации о новом счете CryptoPay
userSchema.methods.addCryptoPayInvoice = function(invoiceData) {
  if (!this.cryptoPay) {
    this.cryptoPay = { invoices: [], transfers: [] };
  }
  
  this.cryptoPay.invoices.push({
    invoiceId: invoiceData.invoice_id,
    amount: invoiceData.amount,
    currency: invoiceData.currency,
    status: invoiceData.status,
    createdAt: new Date(invoiceData.created_at * 1000), // Unix timestamp в мс
    description: invoiceData.description,
    externalId: invoiceData.external_id
  });
  
  return this.cryptoPay.invoices[this.cryptoPay.invoices.length - 1];
};

// Метод для обновления статуса счета
userSchema.methods.updateCryptoPayInvoice = function(invoiceId, status, paidAt) {
  if (!this.cryptoPay || !this.cryptoPay.invoices) return null;
  
  const invoice = this.cryptoPay.invoices.find(inv => inv.invoiceId === invoiceId);
  if (!invoice) return null;
  
  invoice.status = status;
  if (paidAt) {
    invoice.paidAt = new Date(paidAt * 1000); // Unix timestamp в мс
  }
  
  return invoice;
};

// Метод для сохранения информации о переводе CryptoPay
userSchema.methods.addCryptoPayTransfer = function(transferData) {
  if (!this.cryptoPay) {
    this.cryptoPay = { invoices: [], transfers: [] };
  }
  
  this.cryptoPay.transfers.push({
    transferId: transferData.transfer_id,
    userId: transferData.user_id,
    amount: transferData.amount,
    currency: transferData.currency,
    status: transferData.status,
    createdAt: new Date(transferData.created_at * 1000), // Unix timestamp в мс
    comment: transferData.comment
  });
  
  return this.cryptoPay.transfers[this.cryptoPay.transfers.length - 1];
};

module.exports = mongoose.model('User', userSchema);