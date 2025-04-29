const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GameHistory = require('../models/GameHistory');

// Middleware to check if user is admin
exports.isAdmin = async (req, res, next) => {
  try {
    const { telegramId } = req.body;
    
    const user = await User.findOne({ telegramId });
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user win rate
exports.updateWinRate = async (req, res) => {
  try {
    const { targetTelegramId, winRate } = req.body;
    
    const user = await User.findOne({ telegramId: targetTelegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Ensure win rate is between 0 and 1
    user.winRate = Math.max(0, Math.min(1, winRate));
    await user.save();
    
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user balance (admin function)
exports.updateUserBalance = async (req, res) => {
  try {
    const { targetTelegramId, amount } = req.body;
    
    const user = await User.findOne({ telegramId: targetTelegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update balance
    user.balance = amount;
    await user.save();
    
    // Record transaction
    const transaction = new Transaction({
      userId: user._id,
      telegramId: user.telegramId,
      amount,
      type: 'admin_adjustment'
    });
    
    await transaction.save();
    
    res.status(200).json({ 
      user,
      transaction
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Ban/unban user
exports.toggleBan = async (req, res) => {
  try {
    const { targetTelegramId } = req.body;
    
    const user = await User.findOne({ telegramId: targetTelegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.isBanned = !user.isBanned;
    await user.save();
    
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get casino statistics
exports.getStatistics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBannedUsers = await User.countDocuments({ isBanned: true });
    
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
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalWins = await Transaction.aggregate([
      { $match: { type: 'win' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const gameStats = await GameHistory.aggregate([
      { $group: { _id: '$gameType', count: { $sum: 1 } } }
    ]);
    
    res.status(200).json({
      userStats: {
        total: totalUsers,
        banned: totalBannedUsers
      },
      financialStats: {
        totalDeposits: totalDeposits[0]?.total || 0,
        totalWithdrawals: totalWithdrawals[0]?.total || 0,
        totalBets: totalBets[0]?.total || 0,
        totalWins: totalWins[0]?.total || 0,
        profit: (totalBets[0]?.total || 0) - (totalWins[0]?.total || 0)
      },
      gameStats: gameStats.reduce((obj, item) => {
        obj[item._id] = item.count;
        return obj;
      }, {})
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};