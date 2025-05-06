const { Telegraf } = require('telegraf');
const User = require('../models/User');
const Dispute = require('../models/Dispute'); // Добавляем модель для споров
const Transaction = require('../models/Transaction'); // Добавляем модель транзакций для споров

// Экспортируем функцию, которая создает и возвращает бота
module.exports = (token) => {
  console.log('Создание Casino бота с токеном:', token);
  
  // Initialize the bot with passed token
  const bot = new Telegraf(token);
  
  // Welcome message
  bot.start(async (ctx) => {
    try {
      // Проверяем, если команда содержит параметр для спора
      if (ctx.message && ctx.message.text.includes('dispute_')) {
        return handleDisputeStartParam(ctx);
      }
      
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
      console.log('Callback query:', ctx.update.callback_query);

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

      // Для inline сообщений извлекаем информацию по-другому
      let question = `Спор на ${amount} ⭐`;
      
      if (ctx.update.callback_query.message && ctx.update.callback_query.message.text) {
        // Обычное сообщение
        const messageText = ctx.update.callback_query.message.text;
        const questionMatch = messageText.match(/❓ (.+)\n\n/);
        if (questionMatch) {
          question = questionMatch[1];
        }
      } else if (ctx.update.callback_query.inline_message_id) {
        // Inline сообщение - вопрос недоступен напрямую, используем заглушку
        question = `Спор на ${amount} ⭐ от @${creator.username || creator.firstName}`;
      }

      // Создаем случайные стороны (орел/решка) для участников
      const creatorSide = Math.random() < 0.5 ? 'heads' : 'tails';
      const opponentSide = creatorSide === 'heads' ? 'tails' : 'heads';

      // Создаем спор в базе данных
      const dispute = new Dispute({
        creator: creator._id,
        opponent: opponent._id,
        creatorTelegramId: parseInt(creatorId),
        opponentTelegramId: ctx.from.id,
        question: question,
        bet: {
          amount: amount,
          creatorChoice: null,
          opponentChoice: null
        },
        creatorSide: creatorSide,
        opponentSide: opponentSide,
        status: 'active'
      });

      await dispute.save();

      // Блокируем средства обоих участников
      creator.balance -= amount;
      opponent.balance -= amount;
      
      await creator.save();
      await opponent.save();

      // Записываем транзакции
      const creatorTransaction = new Transaction({
        userId: creator._id,
        telegramId: parseInt(creatorId),
        amount: -amount,
        type: 'bet',
        game: 'dispute'
      });
      
      const opponentTransaction = new Transaction({
        userId: opponent._id,
        telegramId: ctx.from.id,
        amount: -amount,
        type: 'bet',
        game: 'dispute'
      });
      
      await creatorTransaction.save();
      await opponentTransaction.save();

      // Для inline сообщений не можем редактировать текст
      if (ctx.update.callback_query.inline_message_id) {
        // Отправляем уведомления участникам через личные сообщения
        const message = `🎲 Спор активен!\n\n❓ ${question}\n💰 Ставка: ${amount} ⭐\n\nВаша сторона: ${creatorSide === 'heads' ? 'Орел' : 'Решка'}\n\nСпор будет разрешен с помощью подбрасывания монеты.`;
        
        const keyboard = {
          reply_markup: {
            inline_keyboard: [[
              { text: '🎮 Открыть игру', web_app: { url: `${process.env.WEBAPP_URL}?dispute=${dispute._id}` } }
            ]]
          }
        };

        // Уведомляем создателя
        await bot.telegram.sendMessage(
          parseInt(creatorId), 
          message + `\n\nОппонент: @${opponent.username || opponent.firstName}`, 
          keyboard
        );

        // Уведомляем оппонента
        await bot.telegram.sendMessage(
          ctx.from.id,
          message.replace(`Ваша сторона: ${creatorSide === 'heads' ? 'Орел' : 'Решка'}`, `Ваша сторона: ${opponentSide === 'heads' ? 'Орел' : 'Решка'}`) + `\n\nСоздатель: @${creator.username || creator.firstName}`,
          keyboard
        );

        // Просто показываем уведомление
        return ctx.answerCbQuery('✅ Спор принят! Проверьте личные сообщения.');
      } else {
        // Обычное сообщение - можем его редактировать
        await ctx.editMessageText(
          `✅ Спор принят!\n\n` +
          `💰 Ставка: ${amount} ⭐\n` +
          `❓ ${question}\n\n` +
          `👥 Участники:\n` +
          `- @${creator.username || creator.firstName} (${creatorSide === 'heads' ? 'Орел' : 'Решка'})\n` +
          `- @${opponent.username || opponent.firstName} (${opponentSide === 'heads' ? 'Орел' : 'Решка'})\n\n` +
          `Спор будет разрешен с помощью подбрасывания монеты.`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🎮 Открыть игру', web_app: { url: `${process.env.WEBAPP_URL}?dispute=${dispute._id}` } }
              ]]
            }
          }
        );

        // Отправляем уведомления участникам
        const message = `🎲 Спор активен!\n\n❓ ${question}\n💰 Ставка: ${amount} ⭐\n\nВаша сторона: ${creatorSide === 'heads' ? 'Орел' : 'Решка'}\n\nСпор будет разрешен с помощью подбрасывания монеты.`;
        
        const keyboard = {
          reply_markup: {
            inline_keyboard: [[
              { text: '🎮 Открыть игру', web_app: { url: `${process.env.WEBAPP_URL}?dispute=${dispute._id}` } }
            ]]
          }
        };

        // Уведомляем создателя
        await bot.telegram.sendMessage(
          parseInt(creatorId), 
          message + `\n\nОппонент: @${opponent.username || opponent.firstName}`, 
          keyboard
        );

        // Уведомляем оппонента
        await bot.telegram.sendMessage(
          ctx.from.id,
          message.replace(`Ваша сторона: ${creatorSide === 'heads' ? 'Орел' : 'Решка'}`, `Ваша сторона: ${opponentSide === 'heads' ? 'Орел' : 'Решка'}`) + `\n\nСоздатель: @${creator.username || creator.firstName}`,
          keyboard
        );

        ctx.answerCbQuery('✅ Спор успешно принят!');
      }

    } catch (error) {
      console.error('Ошибка при принятии inline спора:', error);
      ctx.answerCbQuery('❌ Произошла ошибка');
    }
  });

  // Обработчик данных из веб-приложения - добавляем обработку результатов спора
  bot.on('web_app_data', async (ctx) => {
    try {
      const data = ctx.webAppData.data;
      console.log('Получены данные из веб-приложения:', data);
      
      // Проверяем, если это результат спора
      if (data.startsWith('dispute_result_')) {
        const parts = data.split('_');
        const disputeId = parts[2];
        const result = parts[3]; // 'heads' или 'tails'
        
        console.log(`Обработка результата спора: ${disputeId}, результат: ${result}`);
        
        const dispute = await Dispute.findById(disputeId)
          .populate('creator', 'telegramId username firstName')
          .populate('opponent', 'telegramId username firstName');
        
        if (!dispute) {
          return ctx.reply('❌ Спор не найден');
        }
        
        if (dispute.status === 'completed') {
          return ctx.reply('❌ Этот спор уже завершен');
        }
        
        // Определяем победителя на основе результата и сторон
        const creatorWins = (dispute.creatorSide === result);
        const winnerId = creatorWins ? dispute.creator._id : dispute.opponent._id;
        const winnerTelegramId = creatorWins ? dispute.creatorTelegramId : dispute.opponentTelegramId;
        const loserId = creatorWins ? dispute.opponent._id : dispute.creator._id;
        const loserTelegramId = creatorWins ? dispute.opponentTelegramId : dispute.creatorTelegramId;
        
        // Получаем информацию о пользователях
        const winner = creatorWins ? dispute.creator : dispute.opponent;
        const loser = creatorWins ? dispute.opponent : dispute.creator;
        
        // Вычисляем сумму выигрыша с комиссией 5%
        const totalAmount = dispute.bet.amount * 2;
        const commission = Math.floor(totalAmount * 0.05);
        const winAmount = totalAmount - commission;
        
        // Обновляем спор
        dispute.result = result;
        dispute.winner = winnerId;
        dispute.winnerTelegramId = winnerTelegramId;
        dispute.commission = commission;
        dispute.status = 'completed';
        dispute.completedAt = new Date();
        
        await dispute.save();
        
        // Обновляем баланс победителя
        const winnerUser = await User.findById(winnerId);
        if (winnerUser) {
          winnerUser.balance += winAmount;
          await winnerUser.save();
          
          // Записываем транзакцию выигрыша
          const winTransaction = new Transaction({
            userId: winnerId,
            telegramId: winnerTelegramId,
            amount: winAmount,
            type: 'win',
            game: 'dispute'
          });
          
          await winTransaction.save();
        }
        
        // Отправляем уведомления обоим участникам
        // Сообщение для победителя
        const winnerMessage = `🎲 Результат спора: ${result === 'heads' ? 'Орел' : 'Решка'}\n\n` +
                             `🏆 Вы выиграли ${winAmount} ⭐!\n\n` +
                             `❓ ${dispute.question}\n\n` +
                             `Комиссия: ${commission} ⭐ (5%)`;
        
        // Сообщение для проигравшего
        const loserMessage = `🎲 Результат спора: ${result === 'heads' ? 'Орел' : 'Решка'}\n\n` +
                            `😢 К сожалению, вы проиграли.\n\n` +
                            `❓ ${dispute.question}\n\n` +
                            `Победитель: @${winner.username || winner.firstName}`;
        
        // Отправляем сообщения
        if (winner.telegramId) {
          await bot.telegram.sendMessage(winner.telegramId, winnerMessage);
        }
        
        if (loser.telegramId) {
          await bot.telegram.sendMessage(loser.telegramId, loserMessage);
        }
        
        // Отвечаем на событие web_app_data
        return ctx.reply('✅ Результат спора успешно обработан!');
      }
      
      // Обрабатываем другие данные из веб-приложения...
      
    } catch (error) {
      console.error('Ошибка обработки данных веб-приложения:', error);
      ctx.reply('❌ Произошла ошибка при обработке данных');
    }
  });

  // Обработчик параметра /start для споров
  const handleDisputeStartParam = async (ctx) => {
    try {
      const match = ctx.message.text.match(/\/start dispute_(.+)/);
      if (!match) return false;
      
      const disputeId = match[1];
      console.log(`Обработка параметра dispute_${disputeId}`);
      
      const dispute = await Dispute.findById(disputeId);
      
      if (!dispute) {
        return ctx.reply('❌ Спор не найден');
      }
      
      // Проверяем, участвует ли пользователь в споре
      if (ctx.from.id !== dispute.creatorTelegramId && ctx.from.id !== dispute.opponentTelegramId) {
        return ctx.reply('❌ Вы не являетесь участником этого спора');
      }
      
      // Определяем сторону пользователя
      const userSide = ctx.from.id === dispute.creatorTelegramId ? dispute.creatorSide : dispute.opponentSide;
      
      // Запускаем мини-приложение
      return ctx.reply('Запустите игру, чтобы увидеть результат спора:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Открыть игру', web_app: { url: `${process.env.WEBAPP_URL}?dispute=${disputeId}` } }]
          ]
        }
      });
      
    } catch (error) {
      console.error('Ошибка обработки параметра спора:', error);
      return ctx.reply('❌ Произошла ошибка при открытии спора');
    }
  };

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
        'Принцип работы: оба участника делают ставку, а победитель определяется подбрасыванием монеты.'
      );
    } catch (error) {
      console.error('Ошибка в команде dispute:', error);
      ctx.reply('Произошла ошибка');
    }
  });
  
  // Help command - обновляем, добавляя информацию о спорах
  bot.help((ctx) => {
    console.log('Получена команда /help от пользователя:', ctx.from.id);
    ctx.replyWithHTML(`<b>Здарова чепуха лудомановская!</b> 🎩✨

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