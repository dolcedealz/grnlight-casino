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

  // Обработчик inline запросов для создания споров
  bot.on('inline_query', async (ctx) => {
    try {
      console.log('Получен inline запрос:', ctx.inlineQuery.query);
      const query = ctx.inlineQuery.query.trim();
      
      // Проверяем пользователя
      const user = await User.findOne({ telegramId: ctx.from.id });
      
      if (!user) {
        return ctx.answerInlineQuery([{
          type: 'article',
          id: 'not_registered',
          title: '❌ Необходима регистрация',
          description: 'Сначала запустите бота командой /start',
          input_message_content: {
            message_text: `⚠️ Для создания споров необходимо сначала запустить бота @${ctx.botInfo.username} командой /start`
          }
        }]);
      }

      // Если запрос пустой - показываем инструкцию
      if (!query) {
        return ctx.answerInlineQuery([{
          type: 'article',
          id: 'help',
          title: '🎲 Создать спор',
          description: 'Введите: сумма вопрос (например: 100 Кто победит в матче?)',
          input_message_content: {
            message_text: '💡 Для создания спора введите:\n\nСумма Вопрос\n\nПример: 100 Кто победит в матче Реал-Барселона?'
          }
        }]);
      }

      // Парсим запрос: сумма и вопрос
      const match = query.match(/^(\d+)\s+(.+)$/);
      
      if (!match) {
        return ctx.answerInlineQuery([{
          type: 'article',
          id: 'invalid_format',
          title: '❌ Неверный формат',
          description: 'Используйте формат: сумма вопрос',
          input_message_content: {
            message_text: '❌ Неверный формат. Используйте: сумма вопрос\n\nПример: 100 Кто победит в матче?'
          }
        }]);
      }

      const [, amountStr, question] = match;
      const amount = parseInt(amountStr);

      // Проверяем сумму
      if (amount <= 0) {
        return ctx.answerInlineQuery([{
          type: 'article',
          id: 'invalid_amount',
          title: '❌ Неверная сумма',
          description: 'Сумма должна быть больше 0',
          input_message_content: {
            message_text: '❌ Сумма спора должна быть больше 0'
          }
        }]);
      }

      // Проверяем баланс
      if (user.balance < amount) {
        return ctx.answerInlineQuery([{
          type: 'article',
          id: 'insufficient_balance',
          title: '❌ Недостаточно средств',
          description: `Ваш баланс: ${user.balance} ⭐`,
          input_message_content: {
            message_text: `❌ Недостаточно средств для создания спора.\n\nВаш баланс: ${user.balance} ⭐\nНеобходимо: ${amount} ⭐`
          }
        }]);
      }

      // Создаем ID для спора
      const temporaryId = `${ctx.from.id}_${Date.now()}`;
      
      // Сокращаем callback_data для соответствия ограничению в 64 байта
      const shortQuestion = question.substring(0, 20);
      const callbackData = `ia_${ctx.from.id}_${amount}_${Date.now()}`;

      // Возвращаем результат
      await ctx.answerInlineQuery([{
        type: 'article',
        id: temporaryId,
        title: `🎲 Спор на ${amount} ⭐`,
        description: question,
        input_message_content: {
          message_text: `🎲 Предложение спора\n\n💰 Ставка: ${amount} ⭐\n❓ ${question}\n\n👤 От: @${ctx.from.username || ctx.from.first_name}`
        },
        reply_markup: {
          inline_keyboard: [[
            {
              text: '✅ Принять спор',
              callback_data: callbackData
            }
          ]]
        }
      }], {
        cache_time: 0
      });

    } catch (error) {
      console.error('Ошибка в inline_query:', error);
      
      ctx.answerInlineQuery([{
        type: 'article',
        id: 'error',
        title: '❌ Ошибка',
        description: 'Произошла ошибка, попробуйте позже',
        input_message_content: {
          message_text: '❌ Произошла ошибка при создании спора. Попробуйте позже.'
        }
      }]);
    }
  });

  // Обработчик для принятия спора через inline кнопку
  bot.action(/ia_(\d+)_(\d+)_(\d+)/, async (ctx) => {
    try {
      const [, creatorId, amountStr, timestamp] = ctx.match;
      const amount = parseInt(amountStr);
      
      console.log('Inline accept:', { creatorId, amount, timestamp });

      // Проверяем, не пытается ли создатель принять свой же спор
      if (ctx.from.id.toString() === creatorId) {
        return ctx.answerCbQuery('❌ Вы не можете принять свой собственный спор!');
      }

      // Проверяем пользователей
      const creator = await User.findOne({ telegramId: creatorId });
      const opponent = await User.findOne({ telegramId: ctx.from.id });

      if (!creator || !opponent) {
        return ctx.answerCbQuery('❌ Пользователь не найден');
      }

      // Проверяем балансы
      if (creator.balance < amount) {
        return ctx.answerCbQuery('❌ У создателя недостаточно средств');
      }

      if (opponent.balance < amount) {
        return ctx.answerCbQuery(`❌ Недостаточно средств. Требуется: ${amount} ⭐`);
      }

      // Извлекаем вопрос из сообщения
      const messageText = ctx.update.callback_query.message.text;
      const questionMatch = messageText.match(/❓ (.+)\n\n/);
      const question = questionMatch ? questionMatch[1] : 'Спор';

      // Создаем спор в базе данных
      const dispute = new Dispute({
        creator: creator._id,
        opponent: opponent._id,
        question: question,
        bet: {
          amount: amount,
          creatorChoice: null,
          opponentChoice: null
        },
        status: 'active'
      });

      await dispute.save();

      // Обновляем сообщение
      await ctx.editMessageText(
        `✅ Спор принят!\n\n` +
        `💰 Ставка: ${amount} ⭐\n` +
        `❓ ${question}\n\n` +
        `👥 Участники: @${creator.username} vs @${opponent.username}\n\n` +
        `Теперь оба участника должны сделать свой выбор в боте.`
      );

      // Отправляем уведомления обоим участникам
      const message = `🎲 Спор активен!\n\n❓ ${question}\n💰 Ставка: ${amount} ⭐\n\nСделайте свой выбор:`;
      
      const keyboard = {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Да', callback_data: `ch_${dispute._id}_y` },
            { text: '❌ Нет', callback_data: `ch_${dispute._id}_n` }
          ]]
        }
      };

      // Уведомляем создателя
      await bot.telegram.sendMessage(creator.telegramId, 
        message + `\n\nОппонент: @${opponent.username}`, 
        keyboard
      );

      // Уведомляем оппонента
      await bot.telegram.sendMessage(opponent.telegramId,
        message + `\n\nСоздатель: @${creator.username}`,
        keyboard
      );

      ctx.answerCbQuery('✅ Спор успешно принят!');

    } catch (error) {
      console.error('Ошибка при принятии inline спора:', error);
      ctx.answerCbQuery('❌ Произошла ошибка');
    }
  });

  // Обработчик выбора в споре
  bot.action(/ch_(.+)_(y|n)/, async (ctx) => {
    try {
      const [, disputeId, choice] = ctx.match;
      const userChoice = choice === 'y';
      
      const dispute = await Dispute.findById(disputeId)
        .populate('creator', 'telegramId username')
        .populate('opponent', 'telegramId username');
      
      if (!dispute) {
        return ctx.answerCbQuery('❌ Спор не найден');
      }

      // Определяем, кто делает выбор
      const isCreator = dispute.creator.telegramId === ctx.from.id;
      const isOpponent = dispute.opponent.telegramId === ctx.from.id;

      if (!isCreator && !isOpponent) {
        return ctx.answerCbQuery('❌ Вы не участвуете в этом споре');
      }

      // Сохраняем выбор
      if (isCreator) {
        if (dispute.bet.creatorChoice !== null) {
          return ctx.answerCbQuery('❌ Вы уже сделали свой выбор');
        }
        dispute.bet.creatorChoice = userChoice;
      } else {
        if (dispute.bet.opponentChoice !== null) {
          return ctx.answerCbQuery('❌ Вы уже сделали свой выбор');
        }
        dispute.bet.opponentChoice = userChoice;
      }

      await dispute.save();

      // Обновляем сообщение
      await ctx.editMessageText(
        `✅ Ваш выбор принят: ${userChoice ? 'Да' : 'Нет'}\n\n` +
        `❓ ${dispute.question}\n` +
        `💰 Ставка: ${dispute.bet.amount} ⭐\n\n` +
        (dispute.bet.creatorChoice !== null && dispute.bet.opponentChoice !== null ? 
          '⏳ Оба участника сделали выбор. Ожидайте результатов голосования.' : 
          '⏳ Ожидаем выбор второго участника...')
      );

      // Если оба сделали выбор, начинаем голосование
      if (dispute.bet.creatorChoice !== null && dispute.bet.opponentChoice !== null) {
        dispute.status = 'voting';
        await dispute.save();

        // Здесь нужно реализовать логику отправки на голосование
        // Например, отправить в общий чат для голосования
        // или запустить автоматическое определение победителя
      }

      ctx.answerCbQuery('✅ Выбор сохранен');

    } catch (error) {
      console.error('Ошибка при выборе в споре:', error);
      ctx.answerCbQuery('❌ Произошла ошибка');
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
  
  // Команда для создания спора (старый способ)
  bot.command('dispute', async (ctx) => {
    try {
      ctx.replyWithHTML(
        '<b>🎲 Создание спора</b>\n\n' +
        'Теперь вы можете создавать споры прямо в любом чате!\n\n' +
        '1. В любом чате напишите: @' + ctx.botInfo.username + '\n' +
        '2. Введите сумму и вопрос, например: 100 Кто победит в матче?\n' +
        '3. Отправьте спор собеседнику\n\n' +
        'Или используйте старый способ:\n' +
        '/dispute @username сумма'
      );
    } catch (error) {
      console.error('Ошибка в команде dispute:', error);
      ctx.reply('Произошла ошибка');
    }
  });
  
  // Help command - обновляем, добавляя информацию о спорах
  bot.help((ctx) => {
    console.log('Получена команда /help от пользователя:', ctx.from.id);
    ctx.replyWithHTML(`<b>Welcome to Greenlight Casino!</b> 🎩✨

Available commands:
/start - Start the bot and get the game link
/balance - Check your current Stars balance
/dispute - Create a dispute (see new inline method!)
/help - Show this help message
/test - Test the bot functionality

To create a dispute:
1. In any chat, type @${ctx.botInfo.username}
2. Enter: amount question (e.g., 100 Who will win?)
3. Send to your opponent

Games available:
🎰 Slots
🎲 Roulette
🔢 Guess the Number
💣 Miner
📈 Crush
🎲 Disputes (use inline mode!)

Good luck and enjoy the Gatsby-inspired experience!`);
  });
  
  // Handle other messages
  bot.on('message', (ctx) => {
    console.log('Получено сообщение от пользователя:', ctx.from.id);
    ctx.reply('Use /start to begin playing or /help for more information.');
  });
  
  return bot;
};