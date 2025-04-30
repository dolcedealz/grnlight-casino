// Улучшенный контроллер игр с системой управления шансами

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GameHistory = require('../models/GameHistory');

// Обработка результатов игры
exports.processGameResult = async (req, res) => {
  try {
    const { telegramId, gameType, betAmount, outcome, winAmount, gameData } = req.body;
    
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
    
    // Получаем множитель шанса победы
    // - Новым пользователям повышаем шанс победы
    // - Используем персональный winRate пользователя (устанавливается админом)
    let effectiveWinRate = user.winRate;
    
    // Повышенные шансы для новых пользователей
    if (isNewUser) {
      // Начинаем с высокого шанса и постепенно снижаем с каждой игрой
      const newUserBonus = Math.max(0, (10 - gamesPlayed) / 10); // от 1.0 до 0.0
      effectiveWinRate = Math.min(1.0, user.winRate + newUserBonus);
      
      console.log(`Новый пользователь ${user.firstName} (ID: ${user.telegramId}). Бонус к шансу: ${newUserBonus.toFixed(2)}, Итоговый шанс: ${effectiveWinRate.toFixed(2)}`);
    }
    
    // Модифицируем выигрыш в зависимости от эффективного winRate
    let modifiedWinAmount = winAmount;
    
    if (outcome === 'win' && winAmount > 0) {
      // Используем winRate для определения, "разрешить" ли выигрыш
      const random = Math.random();
      
      if (random > effectiveWinRate) {
        // Если случайное число больше winRate, меняем выигрыш на 0
        modifiedWinAmount = 0;
        console.log(`Выигрыш отменен для ${user.telegramId}. Random: ${random.toFixed(2)}, WinRate: ${effectiveWinRate.toFixed(2)}`);
      } else {
        console.log(`Выигрыш разрешен для ${user.telegramId}. Random: ${random.toFixed(2)}, WinRate: ${effectiveWinRate.toFixed(2)}`);
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
    
    // Записываем историю игры
    const gameHistory = new GameHistory({
      userId: user._id,
      telegramId: user.telegramId,
      gameType,
      betAmount,
      outcome: modifiedWinAmount > 0 ? 'win' : 'lose',
      winAmount: modifiedWinAmount,
      gameData
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

// Получение истории игр
exports.getGameHistory = async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const gameHistory = await GameHistory.find({ 
      userId: user._id 
    }).sort({ createdAt: -1 }).limit(50);
    
    res.status(200).json(gameHistory);
  } catch (error) {
    console.error('Ошибка при получении истории игр:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Получение статистики игр пользователя
exports.getUserGameStats = async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Общее количество игр
    const totalGames = await GameHistory.countDocuments({ userId: user._id });
    
    // Количество выигрышей
    const wins = await GameHistory.countDocuments({ 
      userId: user._id,
      outcome: 'win'
    });
    
    // Количество проигрышей
    const losses = totalGames - wins;
    
    // Процент выигрышей
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
    
    // Общая сумма ставок
    const totalBets = await Transaction.aggregate([
      { $match: { userId: user._id, type: 'bet' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Общая сумма выигрышей
    const totalWins = await Transaction.aggregate([
      { $match: { userId: user._id, type: 'win' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Статистика по играм
    const gameTypeStats = await GameHistory.aggregate([
      { $match: { userId: user._id } },
      { $group: { 
        _id: '$gameType', 
        count: { $sum: 1 },
        wins: { $sum: { $cond: [{ $eq: ['$outcome', 'win'] }, 1, 0] } },
        totalBet: { $sum: '$betAmount' },
        totalWin: { $sum: '$winAmount' }
      }}
    ]);
    
    res.status(200).json({
      totalGames,
      wins,
      losses,
      winRate: Math.round(winRate * 100) / 100,
      totalBets: totalBets[0]?.total || 0,
      totalWins: totalWins[0]?.total || 0,
      gameTypeStats
    });
  } catch (error) {
    console.error('Ошибка при получении статистики игр пользователя:', error);
    res.status(500).json({ message: 'Server error' });
  }
};