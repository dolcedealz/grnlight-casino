const { Telegraf } = require('telegraf');
const User = require('../models/User');

// Экспортируем функцию, которая создает и возвращает бота
module.exports = (token) => {
  console.log('Создание Casino бота с токеном:', token);
  
  // Initialize the bot with passed token
  const bot = new Telegraf(token);
  
  // Welcome message
  bot.start(async (ctx) => {
    try {
      console.log('Получена команда /start от пользователя:', ctx.from.id);
      
      const { id, first_name, last_name, username } = ctx.from;
      console.log('Данные пользователя:', { id, first_name, last_name, username });
      
      // Register user if they don't exist
      console.log('Проверка наличия пользователя в базе данных...');
      let user = await User.findOne({ telegramId: id });
      
      if (!user) {
        console.log('Пользователь не найден, создаём нового...');
        user = new User({
          telegramId: id,
          firstName: first_name,
          lastName: last_name || '',
          username: username || ''
        });
        
        console.log('Сохраняем пользователя в базу данных...');
        await user.save();
        console.log('Пользователь создан и сохранён в базе данных');
      } else {
        console.log('Пользователь найден в базе данных');
      }
      
      // Create welcome message with mini app button
      console.log('Отправка приветственного сообщения...');
      console.log('WEBAPP_URL:', process.env.WEBAPP_URL);
      
      await ctx.reply(`Welcome to Greenlight Casino, ${first_name}! 🎰✨\n\nTap the button below to start playing.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Play Greenlight Casino', web_app: { url: process.env.WEBAPP_URL || 'https://grnlight-casino.onrender.com' } }]
          ]
        }
      });
      console.log('Приветственное сообщение отправлено');
    } catch (error) {
      console.error('Подробная ошибка при выполнении команды /start:', error);
      ctx.reply('Sorry, there was an error. Please try again later.');
    }
  });

  // Простая тестовая команда
  bot.command('test', (ctx) => {
    try {
      console.log('Получена команда /test от пользователя:', ctx.from.id);
      ctx.reply('Тестовая команда работает!');
    } catch (error) {
      console.error('Ошибка при выполнении команды /test:', error);
      ctx.reply('Ошибка в тестовой команде');
    }
  });
  
  // Balance command
  bot.command('balance', async (ctx) => {
    try {
      console.log('Получена команда /balance от пользователя:', ctx.from.id);
      const { id } = ctx.from;
      
      console.log('Поиск пользователя в базе данных...');
      const user = await User.findOne({ telegramId: id });
      
      if (!user) {
        console.log('Пользователь не найден');
        return ctx.reply('You need to start the bot first. Please send /start.');
      }
      
      console.log('Пользователь найден, баланс:', user.balance);
      ctx.reply(`Your current balance: ${user.balance} Stars ⭐`);
    } catch (error) {
      console.error('Ошибка при выполнении команды /balance:', error);
      ctx.reply('Sorry, there was an error. Please try again later.');
    }
  });
  
  // Help command
  bot.help((ctx) => {
    console.log('Получена команда /help от пользователя:', ctx.from.id);
    ctx.reply(`
Welcome to Greenlight Casino! 🎩✨

Available commands:
/start - Start the bot and get the game link
/balance - Check your current Stars balance
/help - Show this help message
/test - Test the bot functionality

To play, tap the Play button after using /start command.

Games available:
🎰 Slots
🎲 Roulette
🔢 Guess the Number
💣 Miner
📈 Crush

Good luck and enjoy the Gatsby-inspired experience!
    `);
  });
  
  // Handle other messages
  bot.on('message', (ctx) => {
    console.log('Получено сообщение от пользователя:', ctx.from.id);
    ctx.reply('Use /start to begin playing or /help for more information.');
  });
  
  return bot;
};
