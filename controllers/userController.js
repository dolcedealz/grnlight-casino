const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Register or update user
exports.registerUser = async (req, res) => {
  try {
    const { telegramId, firstName, lastName, username } = req.body;

    // Check if user already exists
    let user = await User.findOne({ telegramId });

    if (user) {
      // Update existing user
      user.firstName = firstName;
      user.lastName = lastName;
      user.username = username;
      await user.save();
      return res.status(200).json(user);
    }

    // Create new user
    user = new User({
      telegramId,
      firstName,
      lastName,
      username
    });

    await user.save();
    res.status(201).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await User.findOne({ telegramId });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user balance
exports.updateBalance = async (req, res) => {
  try {
    const { telegramId, amount, type } = req.body;
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.isBanned) {
      return res.status(403).json({ message: 'User is banned' });
    }
    
    // Update balance
    user.balance += amount;
    await user.save();
    
    // Record transaction
    const transaction = new Transaction({
      userId: user._id,
      telegramId: user.telegramId,
      amount,
      type
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

// Get transaction history
exports.getTransactions = async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const transactions = await Transaction.find({ 
      userId: user._id 
    }).sort({ createdAt: -1 });
    
    res.status(200).json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};