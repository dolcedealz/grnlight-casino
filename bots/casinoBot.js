const { Telegraf } = require('telegraf');
const User = require('../models/User');
const Dispute = require('../models/Dispute'); // Добавляем модель для споров

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
  
  // Команда для создания спора
  bot.command('dispute', async (ctx) => {
    try {
      console.log('Получена команда /dispute от пользователя:', ctx.from.id);
      
      const args = ctx.message.text.split(' ');
      
      // Проверяем формат: /dispute @username amount
      if (args.length !== 3) {
        return ctx.reply(
          'Формат команды: /dispute @username сумма\n' +
          'Пример: /dispute @friend 100\n' +
          'Сумма должна быть в Stars ⭐'
        );
      }
      
      const opponentUsername = args[1].replace('@', '');
      const amount = parseInt(args[2]);
      
      // Валидация суммы
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply('Пожалуйста, укажите корректную сумму ставки (положительное число)');
      }
      
      // Получаем данные создателя спора
      const creator = await User.findOne({ telegramId: ctx.from.id });
      if (!creator) {
        return ctx.reply('Сначала начните работу с ботом через /start');
      }
      
      // Проверяем баланс создателя
      if (creator.balance < amount) {
        return ctx.reply(`Недостаточно средств. Ваш баланс: ${creator.balance} ⭐`);
      }
      
      // Находим оппонента по username
      const opponent = await User.findOne({ username: opponentUsername });
      if (!opponent) {
        return ctx.reply(
          'Пользователь не найден. Убедитесь, что:\n' +
          '1. Вы правильно указали username\n' +
          '2. Пользователь начал работу с ботом'
        );
      }
      
      // Проверяем, что это не спор с самим собой
      if (opponent.telegramId === creator.telegramId) {
        return ctx.reply('Вы не можете создать спор с самим собой');
      }
      
      // Создаем спор в базе данных
      const dispute = new Dispute({
        creatorId: creator.telegramId,
        opponentId: opponent.telegramId,
        amount: amount,
        status: 'pending'
      });
      
      await dispute.save();
      console.log('Спор создан:', dispute._id);
      
      // Отправляем подтверждение создателю
      await ctx.reply(
        `✅ Спор создан!\n\n` +
        `Оппонент: @${opponent.username}\n` +
        `Сумма: ${amount} ⭐\n` +
        `Статус: Ожидает подтверждения\n\n` +
        `ID спора: ${dispute._id}`
      );
      
      // Отправляем приглашение оппоненту
      try {
        await bot.telegram.sendMessage(opponent.telegramId, 
          `🎲 Новый спор!\n\n` +
          `@${ctx.from.username} предлагает вам спор на ${amount} ⭐\n\n` +
          `Чтобы принять или отклонить, используйте кнопки ниже:`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Принять спор', callback_data: `accept_dispute_${dispute._id}` },
                  { text: '❌ Отклонить', callback_data: `decline_dispute_${dispute._id}` }
                ]
              ]
            }
          }
        );
        console.log('Приглашение отправлено оппоненту');
      } catch (error) {
        console.error('Ошибка отправки сообщения оппоненту:', error);
        await ctx.reply('Не удалось отправить приглашение оппоненту. Возможно, он не начал диалог с ботом.');
      }
      
    } catch (error) {
      console.error('Ошибка создания спора:', error);
      ctx.reply('Произошла ошибка при создании спора. Попробуйте позже.');
    }
  });
  
  // Обработка принятия спора
  bot.action(/accept_dispute_(.+)/, async (ctx) => {
    try {
      const disputeId = ctx.match[1];
      console.log('Принятие спора:', disputeId);
      
      const dispute = await Dispute.findById(disputeId);
      
      if (!dispute) {
        return ctx.answerCbQuery('Спор не найден');
      }
      
      if (dispute.status !== 'pending') {
        return ctx.answerCbQuery('Этот спор уже обработан');
      }
      
      // Проверяем, что действие выполняет оппонент
      if (dispute.opponentId !== ctx.from.id) {
        return ctx.answerCbQuery('Это не ваше приглашение');
      }
      
      // Проверяем баланс оппонента
      const opponent = await User.findOne({ telegramId: ctx.from.id });
      if (opponent.balance < dispute.amount) {
        return ctx.answerCbQuery(`Недостаточно средств. Требуется: ${dispute.amount} ⭐`);
      }
      
      // Обновляем статус спора
      dispute.status = 'accepted';
      await dispute.save();
      
      // Уведомляем участников
      await ctx.editMessageText(
        `✅ Вы приняли спор!\n\n` +
        `Сумма: ${dispute.amount} ⭐\n\n` +
        `Нажмите кнопку ниже, чтобы начать:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ 
                text: '🎲 Начать спор', 
                web_app: { url: `${process.env.WEBAPP_URL}?disputeId=${dispute._id}` }
              }]
            ]
          }
        }
      );
      
      // Уведомляем создателя
      const creator = await User.findOne({ telegramId: dispute.creatorId });
      await bot.telegram.sendMessage(dispute.creatorId,
        `✅ @${opponent.username} принял ваш спор!\n\n` +
        `Сумма: ${dispute.amount} ⭐\n\n` +
        `Нажмите кнопку ниже, чтобы начать:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ 
                text: '🎲 Начать спор', 
                web_app: { url: `${process.env.WEBAPP_URL}?disputeId=${dispute._id}` }
              }]
            ]
          }
        }
      );
      
    } catch (error) {
      console.error('Ошибка принятия спора:', error);
      ctx.answerCbQuery('Произошла ошибка. Попробуйте позже.');
    }
  });
  
  // Обработка отклонения спора
  bot.action(/decline_dispute_(.+)/, async (ctx) => {
    try {
      const disputeId = ctx.match[1];
      console.log('Отклонение спора:', disputeId);
      
      const dispute = await Dispute.findById(disputeId);
      
      if (!dispute) {
        return ctx.answerCbQuery('Спор не найден');
      }
      
      if (dispute.status !== 'pending') {
        return ctx.answerCbQuery('Этот спор уже обработан');
      }
      
      // Проверяем, что действие выполняет оппонент
      if (dispute.opponentId !== ctx.from.id) {
        return ctx.answerCbQuery('Это не ваше приглашение');
      }
      
      // Обновляем статус спора
      dispute.status = 'declined';
      await dispute.save();
      
      // Обновляем сообщение у оппонента
      await ctx.editMessageText(
        `❌ Вы отклонили спор на ${dispute.amount} ⭐`
      );
      
      // Уведомляем создателя
      const creator = await User.findOne({ telegramId: dispute.creatorId });
      await bot.telegram.sendMessage(dispute.creatorId,
        `❌ @${ctx.from.username} отклонил ваш спор на ${dispute.amount} ⭐`
      );
      
    } catch (error) {
      console.error('Ошибка отклонения спора:', error);
      ctx.answerCbQuery('Произошла ошибка. Попробуйте позже.');
    }
  });
  
  // Help command - обновляем, добавляя информацию о спорах
  bot.help((ctx) => {
    console.log('Получена команда /help от пользователя:', ctx.from.id);
    ctx.reply(`
Welcome to Greenlight Casino! 🎩✨

Available commands:
/start - Start the bot and get the game link
/balance - Check your current Stars balance
/dispute @username amount - Challenge someone to a coin flip duel
/help - Show this help message
/test - Test the bot functionality

To play casino games, tap the Play button after using /start command.

Games available:
🎰 Slots
🎲 Roulette
🔢 Guess the Number
💣 Miner
📈 Crush
🪙 Coin Flip Duel (use /dispute command)

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