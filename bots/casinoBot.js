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
      const isValidParticipant = String(dispute.creatorTelegramId) === String(userId) || 
                                 String(dispute.opponentTelegramId) === String(userId);
      
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
      const userRole = String(dispute.creatorTelegramId) === String(userId) ? 'creator' : 'opponent';
      
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
                              // Используем web_app для кнопки
                              { text: '🎮 Присоединиться к спору', web_app: { url: roomUrl } }
                          ]]
                      }
                  }
              );
              console.log(`Уведомление отправлено участнику ${otherParticipantId}`);
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
      const dispute = await Dispute.findById(disputeId)
          .populate('creator', 'telegramId firstName lastName username')
          .populate('opponent', 'telegramId firstName lastName username');
      
      if (!dispute) {
          ctx.reply('❌ Спор не найден');
          return;
      }
      
      // Получаем данные пользователя
      const userId = ctx.from.id;
      
      // Проверяем, является ли пользователь участником спора
      const isValidParticipant = String(dispute.creatorTelegramId) === String(userId) || 
                                String(dispute.opponentTelegramId) === String(userId);
      
      if (!isValidParticipant) {
          ctx.reply('❌ Вы не являетесь участником этого спора');
          return;
      }
      
      // Определяем роль пользователя и обновляем соответствующее поле
      const userRole = String(dispute.creatorTelegramId) === String(userId) ? 'creator' : 'opponent';
      
      // Обновляем статус готовности в базе данных с явным преобразованием в boolean
      if (userRole === 'creator') {
          dispute.creatorReady = Boolean(ready);
      } else {
          dispute.opponentReady = Boolean(ready);
      }
      
      await dispute.save();
      
      // Определяем, готовы ли оба игрока
      const bothReady = dispute.creatorReady && dispute.opponentReady;
      
      // Формируем URL для комнаты спора
      const roomUrl = `${process.env.WEBAPP_URL}?dispute=${disputeId}`;
      
      // Отправляем сообщение ОБОИМ участникам
      const otherParticipantId = userRole === 'creator' ? dispute.opponentTelegramId : dispute.creatorTelegramId;
      
      // Более явное и гарантированное уведомление обоих участников
      if (otherParticipantId) {
          try {
              await bot.telegram.sendMessage(
                  otherParticipantId,
                  `📢 Участник ${ctx.from.first_name} ${ready ? 'готов' : 'отменил готовность'} к спору.\n\n${bothReady ? '⚠️ Оба участника готовы! Начинается подбрасывание монетки!' : ''}`,
                  {
                      reply_markup: {
                          inline_keyboard: [[
                              // Используем web_app для кнопки
                              { text: '🎮 Перейти к спору', web_app: { url: roomUrl } }
                          ]]
                      }
                  }
              );
              console.log(`Уведомление о готовности отправлено пользователю ${otherParticipantId}`);
          } catch (notifyError) {
              console.error('Ошибка отправки уведомления о готовности:', notifyError);
          }
      }
      
      // Уведомляем также инициатора действия
      await ctx.reply(`✅ Вы ${ready ? 'подтвердили' : 'отменили'} готовность к спору`);
      
      // Если оба игрока готовы и пользователь - создатель, запускаем определение результата
      if (bothReady && userRole === 'creator') {
          // Запускаем с небольшой задержкой, чтобы обеспечить корректное обновление UI
          setTimeout(() => {
              determineDisputeResult(dispute);
          }, 3000);
      }
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
      const isValidParticipant = String(dispute.creatorTelegramId) === String(userId) || 
                                 String(dispute.opponentTelegramId) === String(userId);
      
      if (!isValidParticipant) {
          ctx.reply('❌ Вы не являетесь участником этого спора');
          return;
      }
      
      // Определяем роль пользователя
      const userRole = String(dispute.creatorTelegramId) === String(userId) ? 'creator' : 'opponent';
      
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
      
      // Получаем ID пользователя, который запустил команду
      const userId = ctx.from.id;
      
      // Определяем роль пользователя
      const isCreator = String(dispute.creatorTelegramId) === String(userId);
      const isOpponent = String(dispute.opponentTelegramId) === String(userId);
      
      // Формируем URL для комнаты спора с учетом роли
      let roomUrl;
      
      if (isCreator) {
          roomUrl = `${process.env.WEBAPP_URL}?dispute=${dispute._id}&isCreator=true`;
      } else if (isOpponent) {
          roomUrl = `${process.env.WEBAPP_URL}?dispute=${dispute._id}&isCreator=false`;
      } else {
          // Пользователь не является участником спора
          ctx.reply('❌ Вы не являетесь участником этого спора');
          return;
      }
      
      // Отправляем сообщение с кнопкой для открытия спора
      await ctx.reply(
          `🎮 <b>Спор готов к разрешению!</b>\n\n`
          + `<b>Тема:</b> ${dispute.question}\n`
          + `<b>Сумма:</b> ${dispute.bet.amount} ⭐\n\n`
          + `Нажмите кнопку ниже, чтобы открыть спор и бросить монетку:`,
          {
              parse_mode: 'HTML',
              reply_markup: {
                  inline_keyboard: [
                      [{ text: '🎮 Открыть комнату спора', web_app: { url: roomUrl } }]
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

// Обработчик inline режима
bot.on('inline_query', async (ctx) => {
  try {
    // Проверяем наличие объекта inlineQuery
    if (!ctx.inlineQuery) {
      console.error('inlineQuery отсутствует в контексте');
      return;
    }
    
    console.log('Получен inline запрос от пользователя:', ctx.from.id, 'Запрос:', ctx.inlineQuery.query || '');
    
    // Проверяем наличие запроса
    const query = (ctx.inlineQuery.query || '').trim();
    
    if (!query) {
      // Если запрос пустой, показываем инструкцию
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'help',
        title: 'Создать спор',
        description: 'Введите: [сумма] [вопрос]. Например: 100 Кто победит в матче?',
        input_message_content: {
          message_text: 'Для создания спора введите сумму и вопрос. Например: @' + (ctx.botInfo ? ctx.botInfo.username : 'bot') + ' 100 Кто победит в матче?'
        }
      }], {cache_time: 1}); // Уменьшаем время кеширования до 1 секунды
      return;
    }
    
    // Находим первое число в запросе (сумма)
    const parts = query.split(' ');
    const amount = parseInt(parts[0]);
    
    // Проверяем, что минимум 2 части - сумма и хотя бы одно слово вопроса
    if (parts.length < 2) {
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'format_error',
        title: 'Неверный формат',
        description: 'Необходимо ввести сумму и вопрос',
        input_message_content: {
          message_text: 'Для создания спора введите сумму и вопрос. Например: @' + (ctx.botInfo ? ctx.botInfo.username : 'bot') + ' 100 Кто победит в матче?'
        }
      }], {cache_time: 1});
      return;
    }
    
    const question = parts.slice(1).join(' ');
    
    if (isNaN(amount) || amount <= 0 || !question) {
      // Неверный формат запроса
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'error',
        title: 'Неверный формат запроса',
        description: 'Введите: [сумма] [вопрос]. Например: 100 Кто победит в матче?',
        input_message_content: {
          message_text: 'Для создания спора введите сумму и вопрос. Например: @' + (ctx.botInfo ? ctx.botInfo.username : 'bot') + ' 100 Кто победит в матче?'
        }
      }], {cache_time: 1});
      return;
    }
    
    // Получаем данные пользователя с таймаутом
    const user = await Promise.race([
      User.findOne({ telegramId: ctx.from.id }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Таймаут БД')), 3000))
    ]).catch(err => {
      console.error('Ошибка запроса пользователя:', err);
      return null;
    });
    
    if (!user) {
      // Пользователь не зарегистрирован или таймаут БД
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'not_registered',
        title: 'Вы не зарегистрированы или ошибка БД',
        description: 'Сначала отправьте /start боту',
        input_message_content: {
          message_text: 'Для создания спора сначала отправьте /start боту @' + (ctx.botInfo ? ctx.botInfo.username : 'bot')
        }
      }], {cache_time: 1});
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
      }], {cache_time: 1});
      return;
    }
    
    // Создаем временную запись о споре
    const tempDispute = new Dispute({
      creator: user._id,
      creatorTelegramId: String(ctx.from.id),
      question: question,
      bet: {
        amount: amount
      },
      status: 'pending'
    });
    
    // Сохраняем и получаем ID
    await tempDispute.save();
    const disputeId = tempDispute._id.toString();
    
    console.log(`Создана временная запись спора: ${disputeId}`);
    
    // Формируем результат для отправки, используя ID спора вместо закодированного вопроса
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
          [{ text: '✅ Принять спор', callback_data: `accept_${disputeId}` }]
        ]
      }
    }], {cache_time: 1});
    
    console.log('Inline запрос успешно обработан, временный ID спора:', disputeId);
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
    }], {cache_time: 1});
  }
});

// Обработчик callback-запросов для принятия споров
bot.action(/^accept_([a-f0-9]+)$/, async (ctx) => {
  try {
    console.log('Получен callback запрос на принятие спора');
    
    // Извлекаем ID спора из callback_data
    const disputeId = ctx.match[1];
    console.log('ID спора:', disputeId);
    
    // ВАЖНО: Логируем ID пользователя, который принимает спор и его тип
    console.log('Пользователь принимающий спор (ID):', ctx.from.id, 'Тип:', typeof ctx.from.id);
    
    // Получаем данные спора из базы данных
    const dispute = await Dispute.findById(disputeId);
    
    if (!dispute) {
      await ctx.answerCbQuery('Ошибка: спор не найден или устарел', true);
      return;
    }
    
    // Логируем данные спора для отладки
    console.log('Данные спора:', {
      id: dispute._id,
      creator: dispute.creator,
      creatorTelegramId: dispute.creatorTelegramId,
      typeCTID: typeof dispute.creatorTelegramId,
      question: dispute.question,
      betAmount: dispute.bet.amount,
      status: dispute.status
    });
    
    // Получаем сумму и вопрос из спора
    const amount = dispute.bet.amount;
    const question = dispute.question;
    const creatorId = dispute.creatorTelegramId;
    
    console.log('ID создателя:', creatorId, 'Тип:', typeof creatorId);
    
    // Не позволяем пользователю принять свой же спор - используем строковое сравнение
    if (String(ctx.from.id) === String(creatorId)) {
      await ctx.answerCbQuery('Вы не можете принять свой собственный спор!', true);
      return;
    }
    
    // Получаем данные пользователей
    const creator = await User.findOne({ telegramId: creatorId });
    const opponent = await User.findOne({ telegramId: ctx.from.id });
    
    // Логируем данные обоих пользователей
    console.log('Данные создателя:', creator ? {id: creator._id, telegramId: creator.telegramId, name: creator.firstName} : 'не найден');
    console.log('Данные оппонента:', opponent ? {id: opponent._id, telegramId: opponent.telegramId, name: opponent.firstName} : 'не найден');
    
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
    
    // Безопасно получаем messageId и chatId
    let messageId = null;
    let chatId = null;
    
    if (ctx.callbackQuery && ctx.callbackQuery.message) {
      messageId = ctx.callbackQuery.message.message_id;
      chatId = ctx.callbackQuery.message.chat.id;
      console.log('ID сообщения:', messageId, 'ID чата:', chatId);
    }
    
    // Обновляем спор, сохраняя telegramId как строки для безопасности
    dispute.opponent = opponent._id;
    dispute.opponentTelegramId = String(ctx.from.id);
    dispute.status = 'active';
    dispute.creatorSide = Math.random() < 0.5 ? 'heads' : 'tails';
    dispute.opponentSide = dispute.creatorSide === 'heads' ? 'tails' : 'heads';
    dispute.creatorReady = false;
    dispute.opponentReady = false;
    dispute.messageId = messageId;
    dispute.chatId = chatId;
    
    console.log('Обновленные данные спора перед сохранением:', {
      opponentId: dispute.opponent,
      opponentTelegramId: dispute.opponentTelegramId,
      creatorSide: dispute.creatorSide,
      opponentSide: dispute.opponentSide,
      status: dispute.status
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
    
    // Формируем URL для комнаты спора с явным указанием роли для обоих игроков
    const creatorRoomUrl = `${process.env.WEBAPP_URL}?dispute=${dispute._id}&isCreator=true`;
    const opponentRoomUrl = `${process.env.WEBAPP_URL}?dispute=${dispute._id}&isCreator=false`;
    console.log('URL комнаты спора для создателя:', creatorRoomUrl);
    console.log('URL комнаты спора для оппонента:', opponentRoomUrl);
    
    // ВАЖНО: Гарантированная отправка сообщений обоим участникам
    try {
      // 1. Отправляем уведомление СОЗДАТЕЛЮ (он точно взаимодействовал с ботом)
      await bot.telegram.sendMessage(
        creatorId,
        `🎲 <b>Ваш спор принят!</b>\n\nПользователь ${opponent.firstName} принял ваш спор по теме "${question}".\n\nНажмите кнопку ниже, чтобы открыть комнату спора:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎮 Открыть комнату спора', web_app: { url: creatorRoomUrl } }]
            ]
          }
        }
      );
      console.log(`Уведомление отправлено создателю ${creatorId}`);
      
      // 2. Используем bot.telegram.sendMessage вместо ctx.reply для оппонента
      await bot.telegram.sendMessage(
        ctx.from.id, // ID оппонента
        `🎲 <b>Вы приняли спор!</b>\n\nВы приняли спор от пользователя ${creator.firstName} по теме "${question}".\n\nНажмите кнопку ниже, чтобы открыть комнату спора:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎮 Открыть комнату спора', web_app: { url: opponentRoomUrl } }]
            ]
          }
        }
      );
      console.log(`Уведомление отправлено оппоненту ID ${ctx.from.id}`);
    } catch (notifyError) {
      console.error('Ошибка отправки уведомлений:', notifyError);
    }
    
    // Обновляем сообщение в чате
    if (messageId && chatId) {
      try {
        await ctx.editMessageText(
          `🏆 <b>Спор начинается!</b>\n\n`
          + `<b>Тема:</b> ${question}\n`
          + `<b>Сумма:</b> ${amount} ⭐\n\n`
          + `<b>Создатель:</b> ${creator.firstName} (${dispute.creatorSide === 'heads' ? 'Орёл' : 'Решка'})\n`
          + `<b>Оппонент:</b> ${opponent.firstName} (${dispute.opponentSide === 'heads' ? 'Орёл' : 'Решка'})\n\n`
          + `<b>Статус:</b> Спор принят\n\n`
          + `Нажмите кнопку ниже, чтобы открыть комнату спора:`,
          { 
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎮 Открыть комнату спора', web_app: { url: `${process.env.WEBAPP_URL}?dispute=${dispute._id}` } }]
              ]
            }
          }
        );
        console.log('Сообщение в чате обновлено');
      } catch (editError) {
        console.error('Ошибка при обновлении сообщения:', editError);
      }
    }
    
    await ctx.answerCbQuery('Вы приняли спор! Теперь нужно подбросить монетку.');
    
    console.log(`Спор ${dispute._id} успешно принят`);
  } catch (error) {
    console.error('Ошибка при обработке принятия спора:', error);
    await ctx.answerCbQuery('Произошла ошибка при принятии спора', true);
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