// Улучшенный контроллер админа с управлением шансами выигрыша

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GameHistory = require('../models/GameHistory');

// Middleware для проверки прав администратора
exports.isAdmin = async (req, res, next) => {
  try {
    const { telegramId } = req.body;
    
    const user = await User.findOne({ telegramId });
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    next();
  } catch (error) {
    console.error('Ошибка при проверке прав администратора:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Получение всех пользователей
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    
    // Дополняем данные статистикой
    const usersWithStats = await Promise.all(users.map(async user => {
      // Получаем количество игр
      const gamesCount = await GameHistory.countDocuments({ userId: user._id });
      
      // Получаем количество выигрышей
      const winsCount = await GameHistory.countDocuments({ 
        userId: user._id,
        outcome: 'win'
      });
      
      // Получаем сумму ставок
      const betsTotal = await Transaction.aggregate([
        { $match: { userId: user._id, type: 'bet' } },
        { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
      ]);
      
      // Получаем сумму выигрышей
      const winsTotal = await Transaction.aggregate([
        { $match: { userId: user._id, type: 'win' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      // Формируем объект с пользователем и его статистикой
      return {
        ...user.toObject(),
        stats: {
          gamesCount,
          winsCount,
          lossesCount: gamesCount - winsCount,
          winRate: gamesCount > 0 ? Math.round((winsCount / gamesCount) * 100) / 100 : 0,
          betsTotal: betsTotal[0]?.total || 0,
          winsTotal: winsTotal[0]?.total || 0,
          profit: (winsTotal[0]?.total || 0) - (betsTotal[0]?.total || 0)
        }
      };
    }));
    
    res.status(200).json(usersWithStats);
  } catch (error) {
    console.error('Ошибка при получении списка пользователей:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Обновление шанса выигрыша пользователя
exports.updateWinRate = async (req, res) => {
  try {
    const { targetTelegramId, winRate, gameSpecificRates } = req.body;
    
    const user = await User.findOne({ telegramId: targetTelegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Обновляем общий шанс выигрыша (0 - никогда не выигрывает, 1 - всегда выигрывает)
    user.winRate = Math.max(0, Math.min(1, winRate));
    
    // Если переданы параметры для отдельных игр, обновляем их
    if (gameSpecificRates) {
      // Обновляем или создаем настройки шансов для конкретных игр
      if (!user.gameWinRates) {
        user.gameWinRates = {};
      }
      
      // Для каждого типа игры обновляем шанс
      Object.keys(gameSpecificRates).forEach(gameType => {
        const rate = parseFloat(gameSpecificRates[gameType]);
        if (!isNaN(rate)) {
          user.gameWinRates[gameType] = Math.max(0, Math.min(1, rate));
        }
      });
    }
    
    await user.save();
    
    // Логируем действие
    console.log(`Администратор обновил шансы выигрыша для ${user.firstName} (ID: ${user.telegramId}). Общий шанс: ${user.winRate}`);
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Ошибка при обновлении шанса выигрыша:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Обновление баланса пользователя (функция админа)
exports.updateUserBalance = async (req, res) => {
  try {
    const { targetTelegramId, amount } = req.body;
    
    const user = await User.findOne({ telegramId: targetTelegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Получаем текущий баланс для определения изменения
    const currentBalance = user.balance;
    const balanceChange = amount - currentBalance;
    
    // Обновляем баланс
    user.balance = amount;
    await user.save();
    
    // Записываем транзакцию
    const transaction = new Transaction({
      userId: user._id,
      telegramId: user.telegramId,
      amount: balanceChange,
      type: 'admin_adjustment'
    });
    
    await transaction.save();
    
    // Логируем действие
    console.log(`Администратор изменил баланс ${user.firstName} (ID: ${user.telegramId}) на ${amount} (изменение: ${balanceChange})`);
    
    res.status(200).json({ 
      user,
      transaction
    });
  } catch (error) {
    console.error('Ошибка при обновлении баланса пользователя:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Блокировка/разблокировка пользователя
exports.toggleBan = async (req, res) => {
  try {
    const { targetTelegramId } = req.body;
    
    const user = await User.findOne({ telegramId: targetTelegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Инвертируем статус блокировки
    user.isBanned = !user.isBanned;
    await user.save();
    
    // Логируем действие
    console.log(`Администратор ${user.isBanned ? 'заблокировал' : 'разблокировал'} пользователя ${user.firstName} (ID: ${user.telegramId})`);
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Ошибка при изменении статуса блокировки пользователя:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Получение статистики казино
exports.getStatistics = async (req, res) => {
  try {
    // Общая статистика пользователей
    const totalUsers = await User.countDocuments();
    const totalBannedUsers = await User.countDocuments({ isBanned: true });
    const activeUsers = await User.countDocuments({ isBanned: false });
    
    // Новые пользователи за последние 24 часа
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const newUsers24h = await User.countDocuments({ createdAt: { $gte: oneDayAgo } });
    
    // Финансовая статистика
    const totalDeposits = await Transaction.aggregate([
      { $match: { type: 'deposit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalWithdrawals = await Transaction.aggregate([
      { $match: { type: 'withdrawal' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalBets = await Transaction.aggregate([
      { $match: { type: 'bet' } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);
    
    const totalWins = await Transaction.aggregate([
      { $match: { type: 'win' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Статистика по играм
    const gameStats = await GameHistory.aggregate([
      { $group: { 
        _id: '$gameType', 
        count: { $sum: 1 },
        totalBet: { $sum: '$betAmount' },
        totalWin: { $sum: '$winAmount' }
      }}
    ]);
    
    // Статистика за последние 24 часа
    const bets24h = await Transaction.aggregate([
      { $match: { type: 'bet', createdAt: { $gte: oneDayAgo } } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);
    
    const wins24h = await Transaction.aggregate([
      { $match: { type: 'win', createdAt: { $gte: oneDayAgo } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Преобразуем игровую статистику в удобный формат
    const formattedGameStats = gameStats.map(game => {
      const profit = game.totalBet - game.totalWin;
      const profitMargin = game.totalBet > 0 ? (profit / game.totalBet) * 100 : 0;
      
      return {
        gameType: game._id,
        count: game.count,
        totalBet: game.totalBet,
        totalWin: game.totalWin,
        profit,
        profitMargin: Math.round(profitMargin * 100) / 100
      };
    });
    
    // Формируем итоговый объект статистики
    const statistics = {
      userStats: {
        total: totalUsers,
        active: activeUsers,
        banned: totalBannedUsers,
        newUsers24h
      },
      financialStats: {
        totalDeposits: totalDeposits[0]?.total || 0,
        totalWithdrawals: totalWithdrawals[0]?.total || 0,
        totalBets: totalBets[0]?.total || 0,
        totalWins: totalWins[0]?.total || 0,
        casinoProfit: (totalBets[0]?.total || 0) - (totalWins[0]?.total || 0),
        last24hBets: bets24h[0]?.total || 0,
        last24hWins: wins24h[0]?.total || 0,
        last24hProfit: (bets24h[0]?.total || 0) - (wins24h[0]?.total || 0)
      },
      gameStats: formattedGameStats
    };
    
    res.status(200).json(statistics);
  } catch (error) {
    console.error('Ошибка при получении статистики казино:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Получение детальной статистики по конкретному пользователю
exports.getUserDetailedStats = async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Общая игровая статистика
    const totalGames = await GameHistory.countDocuments({ userId: user._id });
    
    // Количество выигрышей
    const wins = await GameHistory.countDocuments({ 
      userId: user._id,
      outcome: 'win'
    });
    
    // Количество проигрышей и процент выигрышей
    const losses = totalGames - wins;
    const winRatePercent = totalGames > 0 ? (wins / totalGames) * 100 : 0;
    
    // Сумма ставок и выигрышей
    const betsTotal = await Transaction.aggregate([
      { $match: { userId: user._id, type: 'bet' } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);
    
    const winsTotal = await Transaction.aggregate([
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
    
    // Последние игры
    const recentGames = await GameHistory.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Последние транзакции
    const recentTransactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Формируем итоговый объект статистики
    const userStats = {
      user: {
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        balance: user.balance,
        winRate: user.winRate,
        gameWinRates: user.gameWinRates || {},
        isAdmin: user.isAdmin,
        isBanned: user.isBanned,
        createdAt: user.createdAt
      },
      gameStats: {
        totalGames,
        wins,
        losses,
        winRatePercent: Math.round(winRatePercent * 100) / 100,
        betsTotal: betsTotal[0]?.total || 0,
        winsTotal: winsTotal[0]?.total || 0,
        profit: (winsTotal[0]?.total || 0) - (betsTotal[0]?.total || 0)
      },
      gameTypeStats: gameTypeStats.map(game => ({
        gameType: game._id,
        count: game.count,
        wins: game.wins,
        losses: game.count - game.wins,
        winRate: game.count > 0 ? Math.round((game.wins / game.count) * 100) / 100 : 0,
        totalBet: game.totalBet,
        totalWin: game.totalWin,
        profit: game.totalWin - game.totalBet
      })),
      recentGames,
      recentTransactions
    };
    
    res.status(200).json(userStats);
  } catch (error) {
    console.error('Ошибка при получении детальной статистики пользователя:', error);
    res.status(500).json({ message: 'Server error' });
  }
};