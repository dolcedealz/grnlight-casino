const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GameHistory = require('../models/GameHistory');

// Process game result
exports.processGameResult = async (req, res) => {
  try {
    const { telegramId, gameType, betAmount, outcome, winAmount, gameData } = req.body;
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.isBanned) {
      return res.status(403).json({ message: 'User is banned' });
    }
    
    // Check if user has enough balance
    if (user.balance < betAmount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    // Apply winRate modifier to determine if player wins
    let modifiedWinAmount = winAmount;
    if (winAmount > 0) {
      // This is a simplified win rate modifier
      const random = Math.random();
      if (random > user.winRate) {
        modifiedWinAmount = 0;
      }
    }
    
    // Record bet transaction
    const betTransaction = new Transaction({
      userId: user._id,
      telegramId: user.telegramId,
      amount: -betAmount,
      type: 'bet',
      game: gameType
    });
    
    await betTransaction.save();
    
    // Update user balance - subtract bet
    user.balance -= betAmount;
    
    // Record win transaction if applicable
    if (modifiedWinAmount > 0) {
      const winTransaction = new Transaction({
        userId: user._id,
        telegramId: user.telegramId,
        amount: modifiedWinAmount,
        type: 'win',
        game: gameType
      });
      
      await winTransaction.save();
      
      // Add win amount to balance
      user.balance += modifiedWinAmount;
    }
    
    await user.save();
    
    // Record game history
    const gameHistory = new GameHistory({
      userId: user._id,
      telegramId: user.telegramId,
      gameType,
      betAmount,
      outcome,
      winAmount: modifiedWinAmount,
      gameData
    });
    
    await gameHistory.save();
    
    res.status(200).json({
      user,
      gameHistory,
      modifiedWinAmount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get game history
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
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};