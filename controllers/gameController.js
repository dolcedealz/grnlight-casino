const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GameHistory = require('../models/GameHistory');

// Обработка результатов игры с улучшенной безопасностью
exports.processGameResult = async (req, res) => {
  try {
    const { telegramId, gameType, betAmount, outcome, winAmount, gameData } = req.body;
    
    // Валидация входных данных
    if (!telegramId || !gameType || !betAmount || !outcome) {
      return res.status(400).json({ message: 'Отсутствуют обязательные параметры' });
    }
    
    // Проверка допустимых значений
    const validGameTypes = ['slots', 'roulette', 'guessnumber', 'miner', 'crush', 'dispute'];
    const validOutcomes = ['win', 'lose'];
    
    if (!validGameTypes.includes(gameType)) {
      return res.status(400).json({ message: 'Недопустимый тип игры' });
    }
    
    if (!validOutcomes.includes(outcome)) {
      return res.status(400).json({ message: 'Недопустимый исход игры' });
    }
    
    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ message: 'Недопустимая сумма ставки' });
    }
    
    if (outcome === 'win' && (isNaN(winAmount) || winAmount <= 0)) {
      return res.status(400).json({ message: 'Недопустимая сумма выигрыша' });
    }
    
    // Проверка соотношения выигрыша к ставке
    if (outcome === 'win' && winAmount > betAmount * 100) {
      console.warn(`Подозрительно высокий выигрыш: ${winAmount} для ставки ${betAmount} от ${telegramId}. Тип игры: ${gameType}`);
      return res.status(400).json({ message: 'Недопустимый коэффициент выигрыша' });
    }
    
    // Находим пользователя
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.isBanned) {
      return res.status(403).json({ message: 'User is banned' });
    }
    
    // Проверяем, достаточно ли у пользователя баланса
    if (user.balance < betAmount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    // Определяем, является ли пользователь новым (играет менее 10 игр)
    const gamesPlayed = await GameHistory.countDocuments({ userId: user._id });
    const isNewUser = gamesPlayed < 10;
    
    // Получаем эффективный шанс выигрыша с улучшенной логикой
    const effectiveWinRate = await getEffectiveWinRate(user, gameType, betAmount, isNewUser);
    
    // Используем более сложный алгоритм для определения выигрыша
    let modifiedWinAmount = winAmount;
    
    if (outcome === 'win' && winAmount > 0) {
      // Создаем случайное значение с использованием нескольких источников энтропии
      const randomResult = await generateRandomResult(user._id.toString(), gameType, betAmount, winAmount, gameData);
      
      if (randomResult > effectiveWinRate) {
        // Если случайное число больше шанса выигрыша, отменяем выигрыш
        modifiedWinAmount = 0;
        console.log(`Выигрыш отменен для ${user.telegramId}. Random: ${randomResult.toFixed(4)}, WinRate: ${effectiveWinRate.toFixed(4)}`);
      } else {
        console.log(`Выигрыш разрешен для ${user.telegramId}. Random: ${randomResult.toFixed(4)}, WinRate: ${effectiveWinRate.toFixed(4)}`);
      }
    }
    
    // Записываем транзакцию ставки
    const betTransaction = new Transaction({
      userId: user._id,
      telegramId: user.telegramId,
      amount: -betAmount,
      type: 'bet',
      game: gameType
    });
    
    await betTransaction.save();
    
    // Обновляем баланс пользователя - вычитаем ставку
    user.balance -= betAmount;
    
    // Записываем транзакцию выигрыша, если применимо
    if (modifiedWinAmount > 0) {
      const winTransaction = new Transaction({
        userId: user._id,
        telegramId: user.telegramId,
        amount: modifiedWinAmount,
        type: 'win',
        game: gameType
      });
      
      await winTransaction.save();
      
      // Добавляем выигрыш к балансу
      user.balance += modifiedWinAmount;
    }
    
    await user.save();
    
    // Обновляем статистику пользователя
    await updateUserStats(user, gameType, betAmount, modifiedWinAmount > 0);
    
    // Записываем историю игры
    const gameHistory = new GameHistory({
      userId: user._id,
      telegramId: user.telegramId,
      gameType,
      betAmount,
      outcome: modifiedWinAmount > 0 ? 'win' : 'lose',
      winAmount: modifiedWinAmount,
      gameData: sanitizeGameData(gameData)
    });
    
    await gameHistory.save();
    
    // Возвращаем результат
    res.status(200).json({
      user,
      gameHistory,
      modifiedWinAmount
    });
  } catch (error) {
    console.error('Ошибка при обработке результата игры:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Генерация криптостойкого случайного результата на основе нескольких факторов
 * @param {string} userId - ID пользователя
 * @param {string} gameType - Тип игры
 * @param {number} betAmount - Сумма ставки
 * @param {number} potentialWin - Потенциальный выигрыш
 * @param {Object} gameData - Данные игры
 * @returns {Promise<number>} - Случайное число от 0 до 1
 */
async function generateRandomResult(userId, gameType, betAmount, potentialWin, gameData) {
  try {
    // Создаем уникальную "соль" на основе текущего времени и случайных данных
    const timestamp = Date.now().toString();
    const randomSalt = crypto.randomBytes(16).toString('hex');
    
    // Включаем различные факторы в генерацию случайного числа
    let dataToHash = userId + gameType + betAmount.toString() + potentialWin.toString() + timestamp + randomSalt;
    
    // Добавляем clientSeed из gameData, если он есть
    if (gameData && gameData.clientSeed) {
      dataToHash += gameData.clientSeed;
    }
    
    // Создаем случайный хеш с использованием SHA-256
    const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');
    
    // Преобразуем первые 8 символов хеша в число от 0 до 1
    const decimal = parseInt(hash.substring(0, 8), 16);
    const randomValue = decimal / 0xffffffff;
    
    // Добавляем небольшую вариацию на основе времени дня и других факторов
    const hourVariation = (new Date().getHours() % 12) / 1200; // от 0 до 0.01
    const minuteVariation = (new Date().getMinutes()) / 6000; // от 0 до 0.01
    
    // Комбинируем все источники случайности
    const combinedRandom = (randomValue + hourVariation + minuteVariation) % 1.0;
    
    return combinedRandom;
  } catch (error) {
    console.error('Ошибка генерации случайного результата:', error);
    // В случае ошибки возвращаем значение, которое с большой вероятностью приведет к отмене выигрыша
    return 0.95;
  }
}

/**
 * Вычисление эффективного шанса выигрыша с учетом множества факторов
 * @param {Object} user - Объект пользователя
 * @param {string} gameType - Тип игры
 * @param {number} betAmount - Сумма ставки
 * @param {boolean} isNewUser - Новый ли пользователь
 * @returns {Promise<number>} - Эффективный шанс выигрыша (от 0 до 1)
 */
async function getEffectiveWinRate(user, gameType, betAmount, isNewUser) {
  try {
    // Получаем базовый шанс победы для данного пользователя и игры
    let baseWinRate = user.getEffectiveWinRate(gameType);
    
    // Получаем статистику игр казино
    const casinoStats = await getCasinoStats();
    
    // Повышенные шансы для новых пользователей
    let effectiveWinRate = baseWinRate;
    if (isNewUser) {
      // Получаем количество игр пользователя
      const gamesPlayed = await GameHistory.countDocuments({ userId: user._id });
      
      // Начинаем с высокого шанса и постепенно снижаем с каждой игрой
      const newUserBonus = Math.max(0, (10 - gamesPlayed) / 20); // от 0.5 до 0.0
      effectiveWinRate = Math.min(0.95, baseWinRate + newUserBonus);
      
      console.log(`Новый пользователь ${user.firstName} (ID: ${user.telegramId}). Бонус к шансу: ${newUserBonus.toFixed(2)}, Итоговый шанс: ${effectiveWinRate.toFixed(2)}`);
    }
    
    // Коррекция шанса в зависимости от общей прибыльности казино
    if (casinoStats.profitMargin > 30) {
      // Если прибыль казино слишком высокая, незначительно увеличиваем шансы выигрыша
      effectiveWinRate *= 1.05; // +5%
    } else if (casinoStats.profitMargin < 10) {
      // Если прибыль казино слишком низкая, незначительно снижаем шансы выигрыша
      effectiveWinRate *= 0.95; // -5%
    }
    
    // Коррекция шанса в зависимости от суммы ставки
    // Для высоких ставок незначительно снижаем шанс выигрыша
    if (betAmount > 1000) {
      const betFactor = Math.min(0.1, betAmount / 10000); // Максимальное снижение на 10%
      effectiveWinRate *= (1 - betFactor);
    }
    
    // Вариация в зависимости от времени (чуть снижаем в часы пик)
    const hour = new Date().getHours();
    if (hour >= 18 && hour <= 22) { // Вечерние часы пик
      effectiveWinRate *= 0.98; // -2%
    }
    
    // Вариация в зависимости от дня недели (в выходные чуть повышаем)
    const day = new Date().getDay();
    if (day === 0 || day === 6) { // Суббота или воскресенье
      effectiveWinRate *= 1.02; // +2%
    }
    
    // Обеспечиваем, что финальный шанс находится в допустимых пределах
    return Math.max(0.05, Math.min(0.95, effectiveWinRate));
  } catch (error) {
    console.error('Ошибка при вычислении эффективного шанса выигрыша:', error);
    // В случае ошибки возвращаем базовый шанс
    return user.winRate || 0.5;
  }
}

/**
 * Получение агрегированной статистики казино
 * @returns {Promise<Object>} - Статистика казино
 */
async function getCasinoStats() {
  try {
    // Получаем сумму всех ставок
    const betsData = await Transaction.aggregate([
      { $match: { type: 'bet' } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);
    
    // Получаем сумму всех выигрышей
    const winsData = await Transaction.aggregate([
      { $match: { type: 'win' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalBets = betsData[0]?.total || 0;
    const totalWins = winsData[0]?.total || 0;
    
    // Рассчитываем прибыль и маржу
    const profit = totalBets - totalWins;
    const profitMargin = totalBets > 0 ? (profit / totalBets) * 100 : 20; // По умолчанию 20%
    
    return {
      totalBets,
      totalWins,
      profit,
      profitMargin
    };
  } catch (error) {
    console.error('Ошибка при получении статистики казино:', error);
    // Возвращаем дефолтные значения при ошибке
    return {
      totalBets: 0,
      totalWins: 0,
      profit: 0,
      profitMargin: 20 // По умолчанию 20%
    };
  }
}

/**
 * Обновление статистики пользователя
 * @param {Object} user - Объект пользователя
 * @param {string} gameType - Тип игры
 * @param {number} betAmount - Сумма ставки
 * @param {boolean} isWin - Выиграл ли пользователь
 * @returns {Promise<void>}
 */
async function updateUserStats(user, gameType, betAmount, isWin) {
  try {
    // Обновляем общую статистику
    if (!user.stats) {
      user.stats = {
        gamesPlayed: 0,
        gamesWon: 0,
        totalBets: 0,
        totalWins: 0
      };
    }
    
    user.stats.gamesPlayed += 1;
    user.stats.totalBets += betAmount;
    
    if (isWin) {
      user.stats.gamesWon += 1;
    }
    
    // Обновляем время последней активности
    user.lastActivity = new Date();
    
    // Если количество игр превышает порог для новых пользователей, обновляем статус
    if (user.stats.gamesPlayed >= 10) {
      user.isNewUser = false;
    }
    
    await user.save();
  } catch (error) {
    console.error('Ошибка при обновлении статистики пользователя:', error);
  }
}

/**
 * Очистка и валидация данных игры
 * @param {Object} gameData - Данные игры
 * @returns {Object} - Очищенные данные игры
 */
function sanitizeGameData(gameData) {
  // Если gameData не объект, возвращаем пустой объект
  if (!gameData || typeof gameData !== 'object') {
    return {};
  }
  
  // Создаем новый объект, чтобы избежать изменения оригинала
  const sanitized = {};
  
  // Список допустимых полей
  const allowedFields = [
    'clientSeed', 'timestamp', 'symbols', 'lines', 'bet', 'reel1', 'reel2', 'reel3',
    'number', 'selectedNumber', 'mines', 'cells', 'multiplier', 'cashedOut'
  ];
  
  // Копируем только допустимые поля
  for (const field of allowedFields) {
    if (field in gameData) {
      sanitized[field] = gameData[field];
    }
  }
  
  return sanitized;
}