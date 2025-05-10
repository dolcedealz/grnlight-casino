const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Схема пользователя
 * С улучшенной системой управления балансом и валютными операциями
 */
const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true
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
  // Балансы пользователя с дополнительными метаданными для блокировок
  balance: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(v) {
        return !isNaN(v) && isFinite(v);
      },
      message: 'Баланс должен быть числом'
    }
  },
  usdtBalance: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(v) {
        return !isNaN(v) && isFinite(v);
      },
      message: 'USDT баланс должен быть числом'
    }
  },
  rubleBalance: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: function(v) {
        return !isNaN(v) && isFinite(v);
      },
      message: 'Рублевый баланс должен быть числом'
    }
  },
  lastBalanceUpdate: {
    type: Date,
    default: Date.now
  },
  // Версия для оптимистической блокировки
  balanceVersion: {
    type: Number,
    default: 0
  },
  // Предпочитаемая валюта пользователя для отображения
  preferredCurrency: {
    type: String,
    enum: ['usdt', 'rub', 'stars'],
    default: 'stars'
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
  // Шансы выигрыша
  winRate: {
    type: Number,
    default: 1.0,
    min: 0,
    max: 1.0
  },
  gameWinRates: {
    type: Map,
    of: Number,
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
        invoiceId: String,
        amount: Number,
        currency: String,
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
        externalId: String
      }
    ],
    // Хранение истории переводов
    transfers: [
      {
        transferId: String,
        userId: Number,
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
  if (!gameType) {
    return this.winRate;
  }
  
  // Если есть индивидуальная настройка для игры - используем её
  if (this.gameWinRates && this.gameWinRates.get(gameType)) {
    return this.gameWinRates.get(gameType);
  } else if (this.gameWinRates && this.gameWinRates[gameType]) {
    // Поддержка старого формата
    return this.gameWinRates[gameType];
  }
  
  // Иначе используем общий шанс выигрыша
  return this.winRate;
};

// Метод для обновления статистики пользователя
userSchema.methods.updateStats = async function(gameResult) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Получаем актуальную версию документа в транзакции
    const user = await this.constructor.findOne({ _id: this._id }).session(session);
    
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    user.stats.gamesPlayed += 1;
    
    if (gameResult.outcome === 'win') {
      user.stats.gamesWon += 1;
    }
    
    // Валидация числовых значений
    const betAmount = parseFloat(gameResult.betAmount);
    const winAmount = parseFloat(gameResult.winAmount || 0);
    
    if (isNaN(betAmount) || !isFinite(betAmount) || betAmount < 0) {
      throw new Error('Некорректная сумма ставки');
    }
    
    if (isNaN(winAmount) || !isFinite(winAmount) || winAmount < 0) {
      throw new Error('Некорректная сумма выигрыша');
    }
    
    user.stats.totalBets += betAmount;
    user.stats.totalWins += winAmount;
    
    // Обновляем время последней активности
    user.lastActivity = new Date();
    
    // Пользователь больше не считается новым после 10 игр
    if (user.stats.gamesPlayed >= 10) {
      user.isNewUser = false;
    }
    
    await user.save({ session });
    await session.commitTransaction();
    
    // Обновляем текущий объект
    this.stats = user.stats;
    this.lastActivity = user.lastActivity;
    this.isNewUser = user.isNewUser;
    
    return true;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Атомарное добавление средств к балансу пользователя с использованием транзакций
 * @param {Number} amount - Сумма для добавления
 * @param {String} currency - Валюта (usdt, rub, stars)
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Object>} - Результат операции
 */
userSchema.methods.addFunds = async function(amount, currency, options = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Валидация параметров
    currency = String(currency || 'stars').toLowerCase();
    amount = parseFloat(amount);
    
    if (isNaN(amount) || !isFinite(amount)) {
      throw new Error(`Некорректная сумма: ${amount}`);
    }
    
    if (!['usdt', 'rub', 'stars'].includes(currency)) {
      throw new Error(`Неподдерживаемая валюта: ${currency}`);
    }
    
    // Получаем актуальную версию документа в транзакции
    const user = await this.constructor.findOne({ _id: this._id }).session(session);
    
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Добавляем средства к соответствующему балансу
    if (currency === 'usdt') {
      user.usdtBalance += amount;
    } else if (currency === 'rub') {
      user.rubleBalance += amount;
    } else {
      user.balance += amount; // stars
    }
    
    // Обновляем версию баланса для оптимистической блокировки
    user.balanceVersion += 1;
    user.lastBalanceUpdate = new Date();
    
    // Обновляем статистику пополнений
    if (amount > 0) {
      if (!user.stats.totalDeposited) {
        user.stats.totalDeposited = { usdt: 0, rub: 0, stars: 0 };
      }
      user.stats.totalDeposited[currency] += amount;
      user.lastDepositAt = new Date();
    }
    
    // Обновляем последнюю активность
    user.lastActivity = new Date();
    
    await user.save({ session });
    await session.commitTransaction();
    
    // Обновляем текущий объект
    if (currency === 'usdt') {
      this.usdtBalance = user.usdtBalance;
    } else if (currency === 'rub') {
      this.rubleBalance = user.rubleBalance;
    } else {
      this.balance = user.balance;
    }
    
    this.stats = user.stats;
    this.lastActivity = user.lastActivity;
    this.lastDepositAt = user.lastDepositAt;
    this.balanceVersion = user.balanceVersion;
    this.lastBalanceUpdate = user.lastBalanceUpdate;
    
    return {
      success: true,
      currency,
      amount,
      newBalance: currency === 'usdt' ? user.usdtBalance : 
                 (currency === 'rub' ? user.rubleBalance : user.balance)
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Атомарное снятие средств с баланса пользователя с использованием транзакций
 * @param {Number} amount - Сумма для снятия
 * @param {String} currency - Валюта (usdt, rub, stars)
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Object>} - Результат операции
 */
userSchema.methods.withdrawFunds = async function(amount, currency, options = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Валидация параметров
    currency = String(currency || 'stars').toLowerCase();
    amount = parseFloat(amount);
    
    if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
      throw new Error(`Некорректная сумма для вывода: ${amount}`);
    }
    
    if (!['usdt', 'rub', 'stars'].includes(currency)) {
      throw new Error(`Неподдерживаемая валюта: ${currency}`);
    }
    
    // Получаем актуальную версию документа в транзакции
    const user = await this.constructor.findOne({ _id: this._id }).session(session);
    
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Проверяем наличие достаточного баланса
    let currentBalance;
    if (currency === 'usdt') {
      currentBalance = user.usdtBalance;
    } else if (currency === 'rub') {
      currentBalance = user.rubleBalance;
    } else {
      currentBalance = user.balance; // stars
    }
    
    if (currentBalance < amount) {
      throw new Error(`Недостаточно средств для вывода ${amount} ${currency.toUpperCase()}. Доступно: ${currentBalance.toFixed(2)}`);
    }
    
    // Снимаем средства
    if (currency === 'usdt') {
      user.usdtBalance -= amount;
    } else if (currency === 'rub') {
      user.rubleBalance -= amount;
    } else {
      user.balance -= amount; // stars
    }
    
    // Обновляем версию баланса для оптимистической блокировки
    user.balanceVersion += 1;
    user.lastBalanceUpdate = new Date();
    
    // Обновляем статистику выводов
    if (!user.stats.totalWithdrawn) {
      user.stats.totalWithdrawn = { usdt: 0, rub: 0, stars: 0 };
    }
    user.stats.totalWithdrawn[currency] += amount;
    user.lastWithdrawalAt = new Date();
    
    // Обновляем последнюю активность
    user.lastActivity = new Date();
    
    await user.save({ session });
    await session.commitTransaction();
    
    // Обновляем текущий объект
    if (currency === 'usdt') {
      this.usdtBalance = user.usdtBalance;
    } else if (currency === 'rub') {
      this.rubleBalance = user.rubleBalance;
    } else {
      this.balance = user.balance;
    }
    
    this.stats = user.stats;
    this.lastActivity = user.lastActivity;
    this.lastWithdrawalAt = user.lastWithdrawalAt;
    this.balanceVersion = user.balanceVersion;
    this.lastBalanceUpdate = user.lastBalanceUpdate;
    
    return {
      success: true,
      currency,
      amount,
      newBalance: currency === 'usdt' ? user.usdtBalance : 
                 (currency === 'rub' ? user.rubleBalance : user.balance)
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Атомарная конвертация валют с использованием актуальных курсов обмена
 * @param {String} fromCurrency - Исходная валюта
 * @param {String} toCurrency - Целевая валюта
 * @param {Number} amount - Сумма для конвертации
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Object>} - Результат конвертации
 */
userSchema.methods.convertCurrency = async function(fromCurrency, toCurrency, amount, options = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Валидация параметров
    fromCurrency = String(fromCurrency || '').toLowerCase();
    toCurrency = String(toCurrency || '').toLowerCase();
    amount = parseFloat(amount);
    
    // Проверка валидности валют
    if (!['usdt', 'rub', 'stars'].includes(fromCurrency) || 
        !['usdt', 'rub', 'stars'].includes(toCurrency)) {
      throw new Error(`Неподдерживаемая комбинация валют: ${fromCurrency} -> ${toCurrency}`);
    }
    
    // Проверка суммы
    if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
      throw new Error(`Некорректная сумма для конвертации: ${amount}`);
    }
    
    // Загрузка актуальных курсов обмена
    const ExchangeRate = mongoose.model('ExchangeRate');
    let rates;
    
    try {
      rates = await ExchangeRate.findOne({ base: 'usdt' })
        .sort({ updatedAt: -1 })
        .limit(1)
        .session(session);
    } catch (rateError) {
      console.error('Ошибка получения курсов обмена:', rateError);
    }
    
    // Если курсы не найдены, используем запасные значения
    const fallbackRates = {
      usdt: 1,
      rub: 90,
      stars: 100
    };
    
    const exchangeRates = rates?.rates || fallbackRates;
    
    // Получаем актуальный документ пользователя в транзакции
    const user = await this.constructor.findOne({ _id: this._id }).session(session);
    
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Проверяем наличие достаточного баланса
    let fromBalance;
    if (fromCurrency === 'usdt') {
      fromBalance = user.usdtBalance;
    } else if (fromCurrency === 'rub') {
      fromBalance = user.rubleBalance;
    } else {
      fromBalance = user.balance; // stars
    }
    
    if (fromBalance < amount) {
      throw new Error(`Недостаточно средств для конвертации. Доступно: ${fromBalance.toFixed(2)} ${fromCurrency.toUpperCase()}`);
    }
    
    // Расчет коэффициента конвертации с использованием актуальных курсов
    let rate;
    
    // Рассчитываем курс на основе текущих курсов валют
    if (fromCurrency === 'usdt' && toCurrency === 'rub') {
      rate = exchangeRates.rub;
    } else if (fromCurrency === 'usdt' && toCurrency === 'stars') {
      rate = exchangeRates.stars;
    } else if (fromCurrency === 'rub' && toCurrency === 'usdt') {
      rate = 1 / exchangeRates.rub;
    } else if (fromCurrency === 'rub' && toCurrency === 'stars') {
      rate = exchangeRates.stars / exchangeRates.rub;
    } else if (fromCurrency === 'stars' && toCurrency === 'usdt') {
      rate = 1 / exchangeRates.stars;
    } else if (fromCurrency === 'stars' && toCurrency === 'rub') {
      rate = exchangeRates.rub / exchangeRates.stars;
    } else if (fromCurrency === toCurrency) {
      rate = 1; // Конвертация в ту же валюту
    } else {
      throw new Error(`Неподдерживаемая комбинация валют: ${fromCurrency} -> ${toCurrency}`);
    }
    
    // Рассчитываем итоговую сумму после конвертации
    const convertedAmount = amount * rate;
    
    // Снимаем средства с исходного баланса
    if (fromCurrency === 'usdt') {
      user.usdtBalance -= amount;
    } else if (fromCurrency === 'rub') {
      user.rubleBalance -= amount;
    } else {
      user.balance -= amount; // stars
    }
    
    // Добавляем средства на целевой баланс
    if (toCurrency === 'usdt') {
      user.usdtBalance += convertedAmount;
    } else if (toCurrency === 'rub') {
      user.rubleBalance += convertedAmount;
    } else {
      user.balance += convertedAmount; // stars
    }
    
    // Обновляем версию баланса для оптимистической блокировки
    user.balanceVersion += 1;
    user.lastBalanceUpdate = new Date();
    
    // Обновляем последнюю активность
    user.lastActivity = new Date();
    
    await user.save({ session });
    await session.commitTransaction();
    
    // Обновляем текущий объект
    this.usdtBalance = user.usdtBalance;
    this.rubleBalance = user.rubleBalance;
    this.balance = user.balance;
    this.lastActivity = user.lastActivity;
    this.balanceVersion = user.balanceVersion;
    this.lastBalanceUpdate = user.lastBalanceUpdate;
    
    return {
      success: true,
      fromCurrency,
      fromAmount: amount,
      toCurrency,
      toAmount: convertedAmount,
      rate
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Метод для создания реферального кода
userSchema.methods.generateReferralCode = async function() {
  if (this.referralCode) {
    return this.referralCode;
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Генерируем код на основе имени и ID пользователя
    const baseCode = this.firstName.substring(0, 3).toUpperCase() + 
                     this.telegramId.toString().substring(0, 4);
    let code = baseCode;
    let counter = 1;
    
    // Проверяем уникальность кода с повторами при необходимости
    while (true) {
      const existing = await this.constructor.findOne({ 
        referralCode: code,
        _id: { $ne: this._id }
      }).session(session);
      
      if (!existing) break;
      
      // Если код уже существует, добавляем счетчик
      code = baseCode + counter;
      counter++;
      
      // Предотвращаем бесконечный цикл
      if (counter > 100) {
        throw new Error('Не удалось сгенерировать уникальный реферальный код');
      }
    }
    
    // Обновляем пользователя с новым реферальным кодом
    const user = await this.constructor.findOneAndUpdate(
      { _id: this._id },
      { $set: { referralCode: code } },
      { new: true, session }
    );
    
    await session.commitTransaction();
    
    // Обновляем текущий объект
    this.referralCode = code;
    
    return code;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Статический метод для выполнения атомарных операций с балансом
userSchema.statics.updateBalance = async function(telegramId, amount, currency, type, options = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Валидация параметров
    if (!telegramId) {
      throw new Error('Не указан telegramId пользователя');
    }
    
    currency = String(currency || 'stars').toLowerCase();
    amount = parseFloat(amount);
    
    if (isNaN(amount) || !isFinite(amount)) {
      throw new Error(`Некорректная сумма: ${amount}`);
    }
    
    if (!['usdt', 'rub', 'stars'].includes(currency)) {
      throw new Error(`Неподдерживаемая валюта: ${currency}`);
    }
    
    // Поиск пользователя с блокировкой для обновления
    const user = await this.findOne({ telegramId }).session(session);
    
    if (!user) {
      throw new Error(`Пользователь с ID ${telegramId} не найден`);
    }
    
    // Проверка на блокировку
    if (user.isBanned && type !== 'admin_adjustment') {
      throw new Error('Пользователь заблокирован');
    }
    
    // Определяем текущий баланс и проверяем достаточность средств при списании
    let currentBalance;
    if (currency === 'usdt') {
      currentBalance = user.usdtBalance;
    } else if (currency === 'rub') {
      currentBalance = user.rubleBalance;
    } else {
      currentBalance = user.balance; // stars
    }
    
    if (amount < 0 && Math.abs(amount) > currentBalance) {
      throw new Error(`Недостаточно средств. Доступно: ${currentBalance} ${currency}`);
    }
    
    // Обновляем баланс
    if (currency === 'usdt') {
      user.usdtBalance += amount;
    } else if (currency === 'rub') {
      user.rubleBalance += amount;
    } else {
      user.balance += amount; // stars
    }
    
    // Обновляем метаданные
    user.balanceVersion += 1;
    user.lastBalanceUpdate = new Date();
    user.lastActivity = new Date();
    
    // Обновляем статистику в зависимости от типа операции
    if (type === 'deposit' && amount > 0) {
      if (!user.stats.totalDeposited) {
        user.stats.totalDeposited = { usdt: 0, rub: 0, stars: 0 };
      }
      user.stats.totalDeposited[currency] += amount;
      user.lastDepositAt = new Date();
    } else if (type === 'withdrawal' && amount < 0) {
      if (!user.stats.totalWithdrawn) {
        user.stats.totalWithdrawn = { usdt: 0, rub: 0, stars: 0 };
      }
      user.stats.totalWithdrawn[currency] += Math.abs(amount);
      user.lastWithdrawalAt = new Date();
    }
    
    await user.save({ session });
    await session.commitTransaction();
    
    return { 
      success: true,
      telegramId,
      amount,
      currency,
      type,
      newBalance: currency === 'usdt' ? user.usdtBalance : 
                 (currency === 'rub' ? user.rubleBalance : user.balance)
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Метод для сохранения информации о новом счете CryptoPay
userSchema.methods.addCryptoPayInvoice = function(invoiceData) {
  if (!this.cryptoPay) {
    this.cryptoPay = { invoices: [], transfers: [] };
  }
  
  // Проверяем и корректно преобразуем дату
  let createdAt;
  if (invoiceData.created_at) {
    // Проверяем, что created_at - число
    const timestamp = Number(invoiceData.created_at);
    if (!isNaN(timestamp)) {
      createdAt = new Date(timestamp * 1000); // Unix timestamp в мс
    }
  }
  
  // Если createdAt не удалось создать, используем текущую дату
  if (!createdAt || isNaN(createdAt.getTime())) {
    createdAt = new Date();
  }
  
  // Валидация данных инвойса
  const safeInvoice = {
    invoiceId: String(invoiceData.invoice_id || ''),
    amount: parseFloat(invoiceData.amount || 0),
    currency: String(invoiceData.currency || '').toUpperCase(),
    status: String(invoiceData.status || 'active'),
    createdAt: createdAt,
    description: String(invoiceData.description || ''),
    externalId: String(invoiceData.external_id || '')
  };
  
  this.cryptoPay.invoices.push(safeInvoice);
  
  return this.cryptoPay.invoices[this.cryptoPay.invoices.length - 1];
};

// Метод для обновления статуса счета
userSchema.methods.updateCryptoPayInvoice = function(invoiceId, status, paidAt) {
  if (!this.cryptoPay || !this.cryptoPay.invoices) return null;
  
  const invoice = this.cryptoPay.invoices.find(inv => inv.invoiceId === String(invoiceId));
  if (!invoice) return null;
  
  invoice.status = String(status || invoice.status);
  
  if (paidAt) {
    // Преобразуем Unix timestamp в Date
    if (typeof paidAt === 'number') {
      invoice.paidAt = new Date(paidAt * 1000);
    } else if (paidAt instanceof Date) {
      invoice.paidAt = paidAt;
    }
  }
  
  return invoice;
};

// Метод для сохранения информации о переводе CryptoPay
userSchema.methods.addCryptoPayTransfer = function(transferData) {
  if (!this.cryptoPay) {
    this.cryptoPay = { invoices: [], transfers: [] };
  }
  
  // Валидация данных перевода
  let createdAt;
  try {
    createdAt = new Date(Number(transferData.created_at) * 1000);
    if (isNaN(createdAt.getTime())) {
      createdAt = new Date();
    }
  } catch (e) {
    createdAt = new Date();
  }
  
  const safeTransfer = {
    transferId: String(transferData.transfer_id || ''),
    userId: parseInt(transferData.user_id || 0),
    amount: parseFloat(transferData.amount || 0),
    currency: String(transferData.currency || '').toUpperCase(),
    status: String(transferData.status || 'created'),
    createdAt: createdAt,
    comment: String(transferData.comment || '')
  };
  
  this.cryptoPay.transfers.push(safeTransfer);
  
  return this.cryptoPay.transfers[this.cryptoPay.transfers.length - 1];
};

// Индексы для оптимизации запросов
userSchema.index({ telegramId: 1 }, { unique: true });
userSchema.index({ lastActivity: -1 });
userSchema.index({ isAdmin: 1 });
userSchema.index({ isBanned: 1 });
userSchema.index({ 'stats.gamesPlayed': -1 });
userSchema.index({ referralCode: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);