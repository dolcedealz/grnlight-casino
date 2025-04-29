const { Telegraf } = require('telegraf');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GameHistory = require('../models/GameHistory');

// Экспортируем функцию, которая создает и возвращает бота
module.exports = (token) => {
  console.log('Создание Admin бота с токеном:', token);
  
  // Initialize the bot with passed token
  const bot = new Telegraf(token);
  
  // Admin IDs - add your Telegram ID here
  const ADMIN_IDS = [8052397593]; // Add your Telegram ID here
  
  // Middleware to check if user is admin
  const isAdmin = async (ctx, next) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) {
      return ctx.reply('Access denied. You are not an admin.');
    }
    
    // Check if user exists in database and make them admin if needed
    let user = await User.findOne({ telegramId: ctx.from.id });
    
    if (!user) {
      user = new User({
        telegramId: ctx.from.id,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name || '',
        username: ctx.from.username || '',
        isAdmin: true
      });
      
      await user.save();
    } else if (!user.isAdmin) {
      user.isAdmin = true;
      await user.save();
    }
    
    return next();
  };
  
  // Apply admin check to all commands
  bot.use(isAdmin);
  
  // Остальной код бота...

// Start command
bot.start((ctx) => {
  ctx.reply(`
Welcome to Greenlight Casino Admin Panel, ${ctx.from.first_name}!

Available commands:
/users - List all users
/user [telegramId] - Get user details
/winrate [telegramId] [rate] - Set user win rate (0-1)
/setbalance [telegramId] [amount] - Set user balance
/ban [telegramId] - Ban/unban user
/stats - Get casino statistics

For detailed user statistics, use the Admin Web Interface.
  `);
});

// List users command
bot.command('users', async (ctx) => {
  try {
    const users = await User.find().limit(20).sort({ createdAt: -1 });
    
    if (users.length === 0) {
      return ctx.reply('No users found.');
    }
    
    let message = 'Recent users:\n\n';
    
    for (const user of users) {
      message += `ID: ${user.telegramId}\n`;
      message += `Name: ${user.firstName} ${user.lastName || ''}\n`;
      message += `Username: ${user.username ? '@' + user.username : 'N/A'}\n`;
      message += `Balance: ${user.balance} Stars\n`;
      message += `Win Rate: ${user.winRate}\n`;
      message += `Status: ${user.isBanned ? '🚫 BANNED' : '✅ Active'}\n\n`;
    }
    
    ctx.reply(message);
  } catch (error) {
    console.error('Users command error:', error);
    ctx.reply('Error retrieving users.');
  }
});

// Get user details
bot.command('user', async (ctx) => {
  try {
    const telegramId = ctx.message.text.split(' ')[1];
    
    if (!telegramId) {
      return ctx.reply('Please provide a Telegram ID. Usage: /user [telegramId]');
    }
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('User not found.');
    }
    
    // Get transaction statistics
    const deposits = await Transaction.aggregate([
      { $match: { telegramId: parseInt(telegramId), type: 'deposit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const bets = await Transaction.aggregate([
      { $match: { telegramId: parseInt(telegramId), type: 'bet' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const wins = await Transaction.aggregate([
      { $match: { telegramId: parseInt(telegramId), type: 'win' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    let message = `User Details:\n\n`;
    message += `ID: ${user.telegramId}\n`;
    message += `Name: ${user.firstName} ${user.lastName || ''}\n`;
    message += `Username: ${user.username ? '@' + user.username : 'N/A'}\n`;
    message += `Balance: ${user.balance} Stars\n`;
    message += `Win Rate: ${user.winRate}\n`;
    message += `Status: ${user.isBanned ? '🚫 BANNED' : '✅ Active'}\n\n`;
    message += `Statistics:\n`;
    message += `Total Deposits: ${deposits[0]?.total || 0} Stars\n`;
    message += `Total Bets: ${bets[0]?.total || 0} Stars\n`;
    message += `Total Wins: ${wins[0]?.total || 0} Stars\n`;
    
    ctx.reply(message);
  } catch (error) {
    console.error('User command error:', error);
    ctx.reply('Error retrieving user data.');
  }
});

// Set win rate
bot.command('winrate', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const telegramId = args[1];
    const winRate = parseFloat(args[2]);
    
    if (!telegramId || isNaN(winRate)) {
      return ctx.reply('Please provide a Telegram ID and win rate. Usage: /winrate [telegramId] [rate]');
    }
    
    if (winRate < 0 || winRate > 1) {
      return ctx.reply('Win rate must be between 0 and 1.');
    }
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('User not found.');
    }
    
    user.winRate = winRate;
    await user.save();
    
    ctx.reply(`Win rate for user ${user.firstName} (ID: ${user.telegramId}) has been set to ${winRate}.`);
  } catch (error) {
    console.error('Winrate command error:', error);
    ctx.reply('Error updating win rate.');
  }
});

// Set balance
bot.command('setbalance', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const telegramId = args[1];
    const balance = parseInt(args[2]);
    
    if (!telegramId || isNaN(balance)) {
      return ctx.reply('Please provide a Telegram ID and balance amount. Usage: /setbalance [telegramId] [amount]');
    }
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('User not found.');
    }
    
    // Record transaction
    const transaction = new Transaction({
      userId: user._id,
      telegramId: user.telegramId,
      amount: balance - user.balance,
      type: 'admin_adjustment'
    });
    
    await transaction.save();
    
    // Update balance
    user.balance = balance;
    await user.save();
    
    ctx.reply(`Balance for user ${user.firstName} (ID: ${user.telegramId}) has been set to ${balance} Stars.`);
  } catch (error) {
    console.error('Setbalance command error:', error);
    ctx.reply('Error updating balance.');
  }
});

// Ban/unban user
bot.command('ban', async (ctx) => {
  try {
    const telegramId = ctx.message.text.split(' ')[1];
    
    if (!telegramId) {
      return ctx.reply('Please provide a Telegram ID. Usage: /ban [telegramId]');
    }
    
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('User not found.');
    }
    
    user.isBanned = !user.isBanned;
    await user.save();
    
    ctx.reply(`User ${user.firstName} (ID: ${user.telegramId}) has been ${user.isBanned ? 'banned' : 'unbanned'}.`);
  } catch (error) {
    console.error('Ban command error:', error);
    ctx.reply('Error toggling ban status.');
  }
});

// Statistics command
bot.command('stats', async (ctx) => {
  try {
    const totalUsers = await User.countDocuments();
    const activePlayers = await User.countDocuments({ isBanned: false });
    
    const totalDeposits = await Transaction.aggregate([
      { $match: { type: 'deposit' } },
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
    
    let message = 'Casino Statistics:\n\n';
    message += `Total Users: ${totalUsers}\n`;
    message += `Active Players: ${activePlayers}\n`;
    message += `Banned Users: ${totalUsers - activePlayers}\n\n`;
    message += `Financial:\n`;
    message += `Total Deposits: ${totalDeposits[0]?.total || 0} Stars\n`;
    message += `Total Bets: ${totalBets[0]?.total || 0} Stars\n`;
    message += `Total Wins: ${totalWins[0]?.total || 0} Stars\n`;
    message += `Casino Profit: ${(totalBets[0]?.total || 0) - (totalWins[0]?.total || 0)} Stars\n\n`;
    message += `Games Played:\n`;
    
    for (const game of gameStats) {
      message += `${game._id}: ${game.count} games\n`;
    }
    
    ctx.reply(message);
  } catch (error) {
    console.error('Stats command error:', error);
    ctx.reply('Error retrieving statistics.');
  }
});

return bot;
};