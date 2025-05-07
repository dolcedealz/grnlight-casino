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

 // Обработчик web_app_data - улучшенная версия
bot.on('web_app_data', async (ctx) => {
  try {
      // Получаем данные от веб-приложения
      const rawData = ctx.webAppData.data;
      console.log('Получены данные из веб-приложения:', rawData);
      
      let data;
      try {
          // Пробуем распарсить JSON данные
          data = JSON.parse(rawData);
      } catch (e) {
          // Если не JSON, то обрабатываем как строку
          console.log('Данные не в формате JSON, обрабатываем как строку');
          data = rawData;
      }
      
      // Обработка различных типов данных от веб-приложения
      if (typeof data === 'object' && data.type) {
          // Обработка типизированных данных (объект)
          switch(data.type) {
              case 'dispute_room_connect':
                  // Обработка подключения к комнате спора
                  await handleDisputeRoomConnect(ctx, data);
                  break;
                  
              case 'player_ready':
                  // Обработка статуса готовности игрока
                  await handlePlayerReady(ctx, data);
                  break;
                  
              case 'dispute_result':
                  // Обработка результата спора
                  await handleDisputeResult(ctx, data);
                  break;
                  
              case 'dispute_result_final':
                  // Обработка финального результата спора
                  await handleDisputeResultFinal(ctx, data);
                  break;
                  
              default:
                  console.log(`Неизвестный тип данных: ${data.type}`);
                  ctx.reply('Получены неизвестные данные.');
          }
      } else if (typeof data === 'string' && data.startsWith('dispute_result_')) {
          // Обработка результата спора (старый формат)
          await handleLegacyDisputeResult(ctx, data);
      } else {
          // Обработка других данных
          console.log('Обработка неструктурированных данных');
          ctx.reply('Данные успешно получены.');
      }
  } catch (error) {
      console.error('Ошибка обработки данных веб-приложения:', error);
      ctx.reply('❌ Произошла ошибка при обработке данных');
  }
});

// Обработчик подключения к комнате спора
async function handleDisputeRoomConnect(ctx, data) {
  try {
      console.log('Обработка подключения к комнате спора:', data);
      
      const { disputeId, roomId, isCreator } = data;
      
      // Получаем данные спора из базы данных
      const dispute = await Dispute.findById(disputeId)
          .populate('creator', 'firstName username')
          .populate('opponent', 'firstName username');
      
      if (!dispute) {
          ctx.reply('❌ Спор не найден');
          return;
      }
      
      // Получаем данные пользователя
      const userId = ctx.from.id;
      
      // Проверяем, является ли пользователь участником спора
      const isValidParticipant = dispute.creatorTelegramId === userId || dispute.opponentTelegramId === userId;
      
      if (!isValidParticipant) {
          ctx.reply('❌ Вы не являетесь участником этого спора');
          return;
      }
      
      // Обновляем ID комнаты в споре, если его нет
      if (!dispute.roomId) {
          dispute.roomId = roomId;
          await dispute.save();
      }
      
      // Определяем роль пользователя
      const userRole = dispute.creatorTelegramId === userId ? 'creator' : 'opponent';
      
      // Отправляем уведомление другому участнику о подключении к комнате
      const otherParticipantId = userRole === 'creator' ? dispute.opponentTelegramId : dispute.creatorTelegramId;
      
      if (otherParticipantId) {
          try {
              // Формируем URL для комнаты спора
              const roomUrl = `${process.env.WEBAPP_URL}?dispute=${disputeId}`;
              
              await bot.telegram.sendMessage(
                  otherParticipantId,
                  `🎮 Участник спора ${ctx.from.first_name} присоединился к комнате.\n\nПрисоединяйтесь, чтобы определить победителя!`,
                  {
                      reply_markup: {
                          inline_keyboard: [[
                              { text: '🎮 Присоединиться к спору', web_app: { url: roomUrl } }
                          ]]
                      }
                  }
              );
          } catch (notifyError) {
              console.error('Ошибка отправки уведомления другому участнику:', notifyError);
          }
      }
      
      ctx.reply('✅ Вы успешно подключились к комнате спора');
  } catch (error) {
      console.error('Ошибка при обработке подключения к комнате спора:', error);
      ctx.reply('❌ Произошла ошибка при подключении к комнате спора');
  }
}

// Обработчик статуса готовности игрока
async function handlePlayerReady(ctx, data) {
  try {
      console.log('Обработка статуса готовности игрока:', data);
      
      const { disputeId, isCreator, ready } = data;
      
      // Получаем данные спора из базы данных
      const dispute = await Dispute.findById(disputeId);
      
      if (!dispute) {
          ctx.reply('❌ Спор не найден');
          return;
      }
      
      // Получаем данные пользователя
      const userId = ctx.from.id;
      
      // Проверяем, является ли пользователь участником спора
      const isValidParticipant = dispute.creatorTelegramId === userId || dispute.opponentTelegramId === userId;
      
      if (!isValidParticipant) {
          ctx.reply('❌ Вы не являетесь участником этого спора');
          return;
      }
      
      // Определяем роль пользователя
      const userRole = dispute.creatorTelegramId === userId ? 'creator' : 'opponent';
      
      // Проверяем совпадение роли
      if ((userRole === 'creator' && !isCreator) || (userRole === 'opponent' && isCreator)) {
          ctx.reply('❌ Несоответствие роли пользователя');
          return;
      }
      
      // Обновляем статус готовности
      if (userRole === 'creator') {
          dispute.creatorReady = ready;
      } else {
          dispute.opponentReady = ready;
      }
      
      await dispute.save();
      
      // Определяем, готовы ли оба игрока
      const bothReady = dispute.creatorReady && dispute.opponentReady;
      
      // Отправляем уведомление другому участнику
      const otherParticipantId = userRole === 'creator' ? dispute.opponentTelegramId : dispute.creatorTelegramId;
      
      if (otherParticipantId) {
          try {
              await bot.telegram.sendMessage(
                  otherParticipantId,
                  `📢 Участник ${ctx.from.first_name} ${ready ? 'готов' : 'отменил готовность'} к спору.\n\n${bothReady ? '⚠️ Оба участника готовы! Начинается подбрасывание монетки!' : ''}`
              );
          } catch (notifyError) {
              console.error('Ошибка отправки уведомления о готовности:', notifyError);
          }
      }
      
      // Если оба игрока готовы и пользователь - создатель, запускаем определение результата
      if (bothReady && userRole === 'creator') {
          // Запускаем с небольшой задержкой, чтобы обеспечить корректное обновление UI
          setTimeout(() => {
              determineDisputeResult(dispute);
          }, 3000);
      }
      
      ctx.reply(`✅ Статус готовности обновлен: ${ready ? 'готов' : 'не готов'}`);
  } catch (error) {
      console.error('Ошибка при обработке статуса готовности:', error);
      ctx.reply('❌ Произошла ошибка при обновлении статуса готовности');
  }
}

// Определение результата спора
async function determineDisputeResult(dispute) {
  try {
      console.log(`Определение результата спора ${dispute._id}`);
      
      // Проверяем, что спор активен
      if (dispute.status !== 'active') {
          console.log(`Спор ${dispute._id} не активен, статус: ${dispute.status}`);
          return;
      }
      
      // Генерируем случайный результат - "heads" или "tails"
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      
      // Определяем победителя
      const creatorWins = (dispute.creatorSide === result);
      const winner = creatorWins ? dispute.creator : dispute.opponent;
      const winnerId = creatorWins ? dispute.creator : dispute.opponent;
      const winnerTelegramId = creatorWins ? dispute.creatorTelegramId : dispute.opponentTelegramId;
      
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
      const winnerUser = await User.findOne({ telegramId: winnerTelegramId });
      if (winnerUser) {
          winnerUser.balance += winAmount;
          await winnerUser.save();
          
          // Записываем транзакцию выигрыша
          const winTransaction = new Transaction({
              userId: winnerUser._id,
              telegramId: winnerTelegramId,
              amount: winAmount,
              type: 'win',
              game: 'dispute'
          });
          
          await winTransaction.save();
      }
      
      console.log(`Спор ${dispute._id} завершен. Результат: ${result}. Победитель: ${winnerTelegramId}`);
      
      // Отправляем уведомления обоим участникам
      await notifyDisputeResult(dispute, result, creatorWins, winAmount);
      
      // Обновляем сообщение в чате, если доступны messageId и chatId
      if (dispute.messageId && dispute.chatId) {
          try {
              // Определяем стороны на русском
              const resultText = result === 'heads' ? 'Орёл' : 'Решка';
              const creatorSideText = dispute.creatorSide === 'heads' ? 'Орёл' : 'Решка';
              const opponentSideText = dispute.opponentSide === 'heads' ? 'Орёл' : 'Решка';
              
              // Определяем победителя
              const winnerName = creatorWins ? 
                  (dispute.creator.firstName || 'Создатель') : 
                  (dispute.opponent.firstName || 'Оппонент');
              const winnerSide = creatorWins ? creatorSideText : opponentSideText;
              
              // Формируем текст сообщения
              const messageText = `🎉 <b>Спор завершен!</b>\n\n`
                  + `<b>Тема:</b> ${dispute.question}\n`
                  + `<b>Сумма:</b> ${dispute.bet.amount} ⭐\n\n`
                  + `<b>Создатель:</b> ${dispute.creator.firstName || 'Создатель'} (${creatorSideText})\n`
                  + `<b>Оппонент:</b> ${dispute.opponent.firstName || 'Оппонент'} (${opponentSideText})\n\n`
                  + `<b>Результат:</b> Выпал ${resultText}!\n`
                  + `<b>Победитель:</b> ${winnerName} (${winnerSide})\n`
                  + `<b>Выигрыш:</b> ${winAmount} ⭐`;
              
              // Отправляем обновление сообщения
              await bot.telegram.editMessageText(
                  dispute.chatId,
                  dispute.messageId,
                  null,
                  messageText,
                  { parse_mode: 'HTML' }
              );
              
              console.log(`Сообщение спора ${dispute._id} успешно обновлено`);
          } catch (messageError) {
              console.error('Ошибка обновления сообщения спора:', messageError);
          }
      }
  } catch (error) {
      console.error('Ошибка при определении результата спора:', error);
  }
}

// Отправка уведомлений о результате спора
async function notifyDisputeResult(dispute, result, creatorWins, winAmount) {
  try {
      // Определяем сторону на русском
      const resultText = result === 'heads' ? 'Орёл' : 'Решка';
      
      // Сообщение для победителя
      const winnerMessage = `🎉 Результат спора: выпал ${resultText}!\n\n`
          + `🏆 Вы выиграли ${winAmount} ⭐!\n\n`
          + `❓ ${dispute.question}`;
      
      // Сообщение для проигравшего
      const loserMessage = `🎲 Результат спора: выпал ${resultText}!\n\n`
          + `😢 К сожалению, вы проиграли.\n\n`
          + `❓ ${dispute.question}`;
      
      // Отправляем уведомления
      if (dispute.creatorTelegramId) {
          await bot.telegram.sendMessage(
              dispute.creatorTelegramId,
              creatorWins ? winnerMessage : loserMessage
          );
      }
      
      if (dispute.opponentTelegramId) {
          await bot.telegram.sendMessage(
              dispute.opponentTelegramId,
              creatorWins ? loserMessage : winnerMessage
          );
      }
      
      console.log(`Уведомления о результате спора ${dispute._id} отправлены участникам`);
  } catch (error) {
      console.error('Ошибка отправки уведомлений о результате спора:', error);
  }
}

// Обработчик результата спора
async function handleDisputeResult(ctx, data) {
  try {
      console.log('Обработка результата спора:', data);
      
      const { disputeId, result } = data;
      
      // Получаем данные спора из базы данных
      const dispute = await Dispute.findById(disputeId);
      
      if (!dispute) {
          ctx.reply('❌ Спор не найден');
          return;
      }
      
      // Получаем данные пользователя
      const userId = ctx.from.id;
      
      // Проверяем, является ли пользователь участником спора
      const isValidParticipant = dispute.creatorTelegramId === userId || dispute.opponentTelegramId === userId;
      
      if (!isValidParticipant) {
          ctx.reply('❌ Вы не являетесь участником этого спора');
          return;
      }
      
      // Определяем роль пользователя
      const userRole = dispute.creatorTelegramId === userId ? 'creator' : 'opponent';
      
      // Только создатель может определять результат
      if (userRole !== 'creator') {
          ctx.reply('❌ Только создатель спора может определять результат');
          return;
      }
      
      // Запускаем определение результата
      await determineDisputeResult(dispute);
      
      ctx.reply('✅ Результат спора определен');
  } catch (error) {
      console.error('Ошибка при обработке результата спора:', error);
      ctx.reply('❌ Произошла ошибка при определении результата спора');
  }
}

// Обработчик финального результата спора
async function handleDisputeResultFinal(ctx, data) {
  try {
      console.log('Обработка финального результата спора:', data);
      
      const { disputeId, result, playerWon } = data;
      
      // Получаем данные спора из базы данных
      const dispute = await Dispute.findById(disputeId);
      
      if (!dispute) {
          ctx.reply('❌ Спор не найден');
          return;
      }
      
      // Обновляем сообщение в чате, если доступны messageId и chatId
      if (dispute.status === 'completed') {
          ctx.reply('✅ Спор уже завершен');
      } else {
          // Запускаем определение результата, если спор еще не завершен
          await determineDisputeResult(dispute);
          ctx.reply('✅ Результат спора определен');
      }
  } catch (error) {
      console.error('Ошибка при обработке финального результата спора:', error);
      ctx.reply('❌ Произошла ошибка при обработке финального результата спора');
  }
}

// Обработчик результата спора (старый формат)
async function handleLegacyDisputeResult(ctx, data) {
  try {
      console.log('Обработка результата спора (старый формат):', data);
      
      // Парсим данные из строки формата "dispute_result_DISPUTE_ID_RESULT"
      const parts = data.split('_');
      const disputeId = parts[2];
      const result = parts[3]; // 'heads' или 'tails'
      
      if (!disputeId || !result || (result !== 'heads' && result !== 'tails')) {
          ctx.reply('❌ Неверный формат данных');
          return;
      }
      
      // Получаем данные спора из базы данных
      const dispute = await Dispute.findById(disputeId);
      
      if (!dispute) {
          ctx.reply('❌ Спор не найден');
          return;
      }
      
      // Если спор уже завершен, не делаем ничего
      if (dispute.status === 'completed') {
          ctx.reply('✅ Спор уже завершен');
          return;
      }
      
      // Запускаем определение результата
      await determineDisputeResult(dispute);
      
      ctx.reply('✅ Результат спора определен');
  } catch (error) {
      console.error('Ошибка при обработке результата спора (старый формат):', error);
      ctx.reply('❌ Произошла ошибка при определении результата спора');
  }
}

// Обработчик параметра dispute для команды start
async function handleDisputeStartParam(ctx) {
  try {
      console.log('Обработка параметра dispute в команде start');
      
      // Получаем ID спора из параметра start
      const startCommand = ctx.message.text;
      const disputeParam = startCommand.split('dispute_')[1];
      
      if (!disputeParam) {
          ctx.reply('❌ Некорректный параметр');
          return;
      }
      
      // Получаем спор из базы данных
      const dispute = await Dispute.findById(disputeParam);
      
      if (!dispute) {
          ctx.reply('❌ Спор не найден');
          return;
      }
      
      // Проверяем, является ли пользователь участником спора
      const userId = ctx.from.id;
      const isCreator = dispute.creatorTelegramId === userId;
      const isOpponent = dispute.opponentTelegramId === userId;
      
      if (!isCreator && !isOpponent) {
          ctx.reply('❌ Вы не являетесь участником этого спора');
          return;
      }
      
      // Формируем URL для комнаты спора
      const roomUrl = `${process.env.WEBAPP_URL}?dispute=${dispute._id}`;
      
      // Отправляем сообщение с кнопкой для открытия спора
      await ctx.reply(
          `🎮 Спор готов к разрешению!\n\n`
          + `<b>Тема:</b> ${dispute.question}\n`
          + `<b>Сумма:</b> ${dispute.bet.amount} ⭐\n\n`
          + `Нажмите кнопку ниже, чтобы открыть спор и бросить монетку:`,
          {
              parse_mode: 'HTML',
              reply_markup: {
                  inline_keyboard: [
                      [{ text: 'Открыть спор 👑', web_app: { url: roomUrl } }]
                  ]
              }
          }
      );
      
      console.log(`Отправлена ссылка на спор ${dispute._id} пользователю ${userId}`);
  } catch (error) {
      console.error('Ошибка при обработке параметра dispute:', error);
      ctx.reply('❌ Произошла ошибка при открытии спора');
  }
}

// Обработчик inline режима (ДОБАВЛЯЕМ НОВУЮ ФУНКЦИОНАЛЬНОСТЬ)
bot.on('inline_query', async (ctx) => {
  try {
    console.log('Получен inline запрос от пользователя:', ctx.from.id, 'Запрос:', ctx.inlineQuery.query);
    
    // Разбираем запрос: [сумма] [вопрос]
    const query = ctx.inlineQuery.query.trim();
    
    if (!query) {
      // Если запрос пустой, показываем инструкцию
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'help',
        title: 'Создать спор',
        description: 'Введите: [сумма] [вопрос]. Например: 100 Кто победит в матче?',
        input_message_content: {
          message_text: 'Для создания спора введите сумму и вопрос. Например: @' + ctx.botInfo.username + ' 100 Кто победит в матче?'
        }
      }]);
      return;
    }
    
    // Находим первое число в запросе (сумма)
    const parts = query.split(' ');
    const amount = parseInt(parts[0]);
    const question = parts.slice(1).join(' ');
    
    if (isNaN(amount) || amount <= 0 || !question) {
      // Неверный формат запроса
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'error',
        title: 'Неверный формат запроса',
        description: 'Введите: [сумма] [вопрос]. Например: 100 Кто победит в матче?',
        input_message_content: {
          message_text: 'Для создания спора введите сумму и вопрос. Например: @' + ctx.botInfo.username + ' 100 Кто победит в матче?'
        }
      }]);
      return;
    }
    
    // Получаем данные пользователя
    const user = await User.findOne({ telegramId: ctx.from.id });
    
    if (!user) {
      // Пользователь не зарегистрирован
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'not_registered',
        title: 'Вы не зарегистрированы',
        description: 'Сначала отправьте /start боту',
        input_message_content: {
          message_text: 'Для создания спора сначала отправьте /start боту @' + ctx.botInfo.username
        }
      }]);
      return;
    }
    
    if (user.balance < amount) {
      // Недостаточно средств
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'insufficient_funds',
        title: 'Недостаточно средств',
        description: `У вас ${user.balance} звезд, а для спора нужно ${amount}`,
        input_message_content: {
          message_text: `Для создания спора на ${amount} звезд нужно иметь достаточный баланс. Ваш текущий баланс: ${user.balance} звезд.`
        }
      }]);
      return;
    }
    
    // Формируем результат для отправки
    await ctx.answerInlineQuery([{
      type: 'article',
      id: 'create_dispute',
      title: `Спор на ${amount} звезд`,
      description: question,
      input_message_content: {
        message_text: `🎲 <b>Предлагаю заключить спор!</b>\n\n<b>Тема:</b> ${question}\n<b>Сумма:</b> ${amount} ⭐\n\nКто выиграет, решит подбрасывание монеты.`,
        parse_mode: 'HTML'
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Принять спор', callback_data: `accept_dispute_${ctx.from.id}_${amount}_${Buffer.from(question).toString('base64')}` }]
        ]
      }
    }]);
    
    console.log('Inline запрос успешно обработан');
  } catch (error) {
    console.error('Ошибка при обработке inline запроса:', error);
    // Отправляем ошибку пользователю
    await ctx.answerInlineQuery([{
      type: 'article',
      id: 'error',
      title: 'Произошла ошибка',
      description: 'Пожалуйста, попробуйте позже или обратитесь к администратору',
      input_message_content: {
        message_text: 'Произошла ошибка при создании спора. Пожалуйста, попробуйте позже или обратитесь к администратору.'
      }
    }]);
  }
});

// Обработчик callback-запросов для принятия споров (ИСПРАВЛЕННАЯ ВЕРСИЯ)
bot.action(/accept_dispute_(\d+)_(\d+)_(.+)/, async (ctx) => {
  try {
    console.log('Получен callback запрос на принятие спора');
    
    // Извлекаем данные из callback_data
    const creatorId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);
    const questionBase64 = ctx.match[3];
    const question = Buffer.from(questionBase64, 'base64').toString();
    
    // Не позволяем пользователю принять свой же спор
    if (ctx.from.id === creatorId) {
      await ctx.answerCbQuery('Вы не можете принять свой собственный спор!', true);
      return;
    }
    
    // Получаем данные пользователей
    const creator = await User.findOne({ telegramId: creatorId });
    const opponent = await User.findOne({ telegramId: ctx.from.id });
    
    if (!creator || !opponent) {
      await ctx.answerCbQuery('Ошибка: один из пользователей не найден', true);
      return;
    }
    
    // Проверяем баланс обоих пользователей
    if (creator.balance < amount) {
      await ctx.answerCbQuery('Создатель спора не имеет достаточно средств', true);
      await ctx.editMessageText(`🎲 <b>Спор отменен</b>\n\nСоздатель спора не имеет достаточно средств (${amount} ⭐)`, { parse_mode: 'HTML' });
      return;
    }
    
    if (opponent.balance < amount) {
      await ctx.answerCbQuery('У вас недостаточно средств для принятия спора', true);
      return;
    }
    
    // Безопасно получаем messageId и chatId, если они есть
    let messageId = null;
    let chatId = null;
    
    if (ctx.callbackQuery && ctx.callbackQuery.message) {
      messageId = ctx.callbackQuery.message.message_id;
      chatId = ctx.callbackQuery.message.chat.id;
    }
    
    // Создаем новый спор
    const dispute = new Dispute({
      creator: creator._id,
      creatorTelegramId: creatorId,
      opponent: opponent._id,
      opponentTelegramId: ctx.from.id,
      question,
      bet: {
        amount: amount
      },
      status: 'active',
      // Определяем случайные стороны монетки
      creatorSide: Math.random() < 0.5 ? 'heads' : 'tails',
      // Инициализируем статусы готовности
      creatorReady: false,
      opponentReady: false,
      // Сохраняем информацию о сообщении для обновления (если доступна)
      messageId: messageId,
      chatId: chatId
    });
    
    // Устанавливаем сторону оппонента противоположную создателю
    dispute.opponentSide = dispute.creatorSide === 'heads' ? 'tails' : 'heads';
    
    await dispute.save();
    
    // Блокируем средства обоих участников
    creator.balance -= amount;
    opponent.balance -= amount;
    
    await creator.save();
    await opponent.save();
    
    // Записываем транзакции
    const creatorTransaction = new Transaction({
      userId: creator._id,
      telegramId: creatorId,
      amount: -amount,
      type: 'bet',
      game: 'dispute',
      disputeId: dispute._id
    });
    
    const opponentTransaction = new Transaction({
      userId: opponent._id,
      telegramId: ctx.from.id,
      amount: -amount,
      type: 'bet',
      game: 'dispute',
      disputeId: dispute._id
    });
    
    await creatorTransaction.save();
    await opponentTransaction.save();
    
    // Формируем URL для комнаты спора
    const roomUrl = `${process.env.WEBAPP_URL}?dispute=${dispute._id}`;
    
    // Обновляем сообщение, только если есть message_id и chat.id
    if (messageId && chatId) {
      try {
        await ctx.editMessageText(
          `🏆 <b>Спор начинается!</b>\n\n`
          + `<b>Тема:</b> ${question}\n`
          + `<b>Сумма:</b> ${amount} ⭐\n\n`
          + `<b>Создатель:</b> ${creator.firstName} (${dispute.creatorSide === 'heads' ? 'Орёл' : 'Решка'})\n`
          + `<b>Оппонент:</b> ${opponent.firstName} (${dispute.opponentSide === 'heads' ? 'Орёл' : 'Решка'})\n\n`
          + `<b>Статус:</b> Спор принят\n\n`
          + `Нажмите кнопку ниже, чтобы открыть спор и бросить монетку!`,
          { 
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Открыть спор 👑', web_app: { url: roomUrl } }]
              ]
            }
          }
        );
      } catch (editError) {
        console.error('Ошибка при обновлении сообщения:', editError);
        // Продолжаем выполнение даже при ошибке обновления сообщения
      }
    } else {
      // Если нет информации о сообщении, отправляем новое
      try {
        await ctx.reply(
          `🏆 <b>Спор начинается!</b>\n\n`
          + `<b>Тема:</b> ${question}\n`
          + `<b>Сумма:</b> ${amount} ⭐\n\n`
          + `<b>Создатель:</b> ${creator.firstName} (${dispute.creatorSide === 'heads' ? 'Орёл' : 'Решка'})\n`
          + `<b>Оппонент:</b> ${opponent.firstName} (${dispute.opponentSide === 'heads' ? 'Орёл' : 'Решка'})\n\n`
          + `<b>Статус:</b> Спор принят\n\n`
          + `Нажмите кнопку ниже, чтобы открыть спор и бросить монетку!`,
          { 
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Открыть спор 👑', web_app: { url: roomUrl } }]
              ]
            }
          }
        );
      } catch (replyError) {
        console.error('Ошибка при отправке нового сообщения:', replyError);
      }
    }
    
    // Отправляем уведомления обоим участникам
    try {
      await bot.telegram.sendMessage(
        creatorId,
        `🎮 Ваш спор по теме "${question}" был принят пользователем ${opponent.firstName}!\n\nНажмите кнопку ниже, чтобы открыть комнату спора:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Открыть спор 👑', web_app: { url: roomUrl } }]
            ]
          }
        }
      );
    } catch (notifyError) {
      console.error('Ошибка отправки уведомления создателю:', notifyError);
    }
    
    await ctx.answerCbQuery('Вы приняли спор! Теперь нужно подбросить монетку.');
    
    console.log(`Спор ${dispute._id} успешно создан и принят`);
  } catch (error) {
    console.error('Ошибка при обработке принятия спора:', error);
    await ctx.answerCbQuery('Произошла ошибка при принятии спора', true);
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