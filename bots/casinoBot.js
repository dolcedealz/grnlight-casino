const { Telegraf, session } = require('telegraf');
const User = require('../models/User');
const Dispute = require('../models/Dispute');
const Transaction = require('../models/Transaction');
const cryptoPayService = require('../services/cryptoPayService');
const ExchangeRate = require('../models/ExchangeRate');

// Максимальное время ожидания для API-запросов
const API_TIMEOUT = 10000; // 10 секунд
// Время жизни сессии для операций пополнения/вывода (в миллисекундах)
const SESSION_TTL = 15 * 60 * 1000; // 15 минут

// Экспортируем функцию, которая создает и возвращает бота
module.exports = (token) => {
  console.log('Создание Casino бота с токеном:', token ? 'Указан' : 'Не указан');
  
  if (!token) {
    console.error('ОШИБКА: Не указан токен для Casino бота!');
    throw new Error('Необходимо указать токен для Casino бота');
  }

  // Инициализация бота с поддержкой сессий
  const bot = new Telegraf(token);
  
  // Настройка middleware для сессий с TTL
  bot.use(session({ 
    ttl: SESSION_TTL,
    getSessionKey: (ctx) => {
      if (ctx.from && ctx.from.id) {
        return `${ctx.from.id}:${ctx.chat.id}`;
      }
      return null;
    }
  }));

  // Middleware для логирования
  bot.use(async (ctx, next) => {
    try {
      const startTime = Date.now();
      await next();
      const responseTime = Date.now() - startTime;
      if (ctx.from && ctx.from.id) {
        console.log(
          `[${new Date().toISOString()}] Запрос от ID ${ctx.from.id} (${ctx.from.username || 'нет юзернейма'}) ` +
          `обработан за ${responseTime}ms`
        );
      }
    } catch (error) {
      console.error(`Ошибка в middleware:`, error);
      // Пробуем отправить сообщение об ошибке пользователю
      try {
        await ctx.reply('Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.');
      } catch (replyError) {
        console.error('Не удалось отправить сообщение об ошибке:', replyError);
      }
    }
  });

  // Middleware для проверки пользователя и создания сессии
  bot.use(async (ctx, next) => {
    try {
      // Создаем пустую сессию, если её нет
      ctx.session = ctx.session || {};

      // Проверяем наличие идентификатора пользователя
      if (ctx.from && ctx.from.id) {
        // Если это не команда start и у нас нет пользователя, проверим его в базе
        if (!ctx.session.user && !ctx.message?.text?.startsWith('/start')) {
          const user = await User.findOne({ telegramId: ctx.from.id })
            .catch(err => {
              console.error(`Ошибка при поиске пользователя ${ctx.from.id}:`, err);
              return null;
            });

          if (user) {
            ctx.session.user = {
              id: user._id,
              telegramId: user.telegramId,
              firstName: user.firstName,
              balance: user.balance,
              usdtBalance: user.usdtBalance || 0,
              rubleBalance: user.rubleBalance || 0
            };
          } else if (!ctx.message?.text?.startsWith('/start')) {
            // Если это не команда start и нет пользователя, предложим зарегистрироваться
            await ctx.reply('Пожалуйста, зарегистрируйтесь с помощью команды /start');
            return; // Не продолжаем обработку
          }
        }
      }

      await next();
    } catch (error) {
      console.error(`Ошибка проверки пользователя:`, error);
      await next();
    }
  });

  // Команда start - регистрация пользователя
  bot.start(async (ctx) => {
    try {
      // Проверяем, если команда содержит параметр для спора
      if (ctx.message && ctx.message.text.includes('dispute_')) {
        return handleDisputeStartParam(ctx);
      }
      
      console.log('Получена команда /start от пользователя:', ctx.from.id);
      
      const { id, first_name, last_name, username } = ctx.from;
      console.log('Данные пользователя:', { id, first_name, last_name, username });
      
      // Находим пользователя или создаем нового с таймаутом
      let user = await Promise.race([
        User.findOne({ telegramId: id }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Таймаут при поиске пользователя')), API_TIMEOUT)
        )
      ]);

      if (!user) {
        console.log('Пользователь не найден, создаём нового...');
        user = new User({
          telegramId: id,
          firstName: first_name,
          lastName: last_name || '',
          username: username || ''
        });
        
        // Сохраняем пользователя с таймаутом
        await Promise.race([
          user.save(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Таймаут при сохранении пользователя')), API_TIMEOUT)
          )
        ]);
        console.log('Пользователь создан и сохранён в базе данных');
      } else {
        console.log('Пользователь найден в базе данных');
        
        // Обновляем информацию о пользователе, если она изменилась
        if (user.firstName !== first_name || 
            (last_name && user.lastName !== last_name) ||
            (username && user.username !== username)) {
          
          user.firstName = first_name;
          if (last_name) user.lastName = last_name;
          if (username) user.username = username;
          
          await user.save();
          console.log('Данные пользователя обновлены');
        }
      }
      
      // Сохраняем пользователя в сессии
      ctx.session.user = {
        id: user._id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        balance: user.balance,
        usdtBalance: user.usdtBalance || 0,
        rubleBalance: user.rubleBalance || 0
      };
      
      // Отправляем приветственное сообщение с кнопкой для игры
      const webAppUrl = process.env.WEBAPP_URL || 'https://grnlight-casino.onrender.com';
      
      await ctx.reply(
        `👋 Добро пожаловать в Greenlight Casino, ${first_name}! 🎰✨\n\n` +
        `💰 Ваш баланс: ${user.balance} ⭐\n` +
        `💵 USDT: ${user.usdtBalance || 0} USDT\n` +
        `💸 Рубли: ${user.rubleBalance || 0} ₽\n\n` +
        `📱 Нажмите кнопку ниже, чтобы начать игру!`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎮 Играть в Greenlight Casino', web_app: { url: webAppUrl } }]
            ]
          }
        }
      );
      
      // Отправляем инструкцию по доступным командам
      await ctx.reply(
        `📋 *Доступные команды:*\n\n` +
        `/balance - проверить баланс\n` +
        `/deposit - пополнить баланс\n` +
        `/withdraw - вывести средства\n` +
        `/exchange - обменять валюту\n` +
        `/help - справка по командам`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Ошибка при выполнении команды /start:', error);
      ctx.reply('Произошла ошибка при регистрации. Пожалуйста, попробуйте снова позже или обратитесь в поддержку.');
    }
  });

  // Команда help - справка
  bot.command('help', async (ctx) => {
    try {
      await ctx.reply(
        `📋 *Доступные команды Greenlight Casino:*\n\n` +
        `/start - начало работы и регистрация\n` +
        `/balance - проверить текущий баланс\n` +
        `/deposit - пополнить баланс\n` +
        `/withdraw - вывести средства\n` +
        `/exchange - обменять валюту\n\n` +
        `💬 *Другие возможности:*\n` +
        `• Споры - создавайте споры с другими пользователями и разрешайте их подбрасыванием монеты\n` +
        `• Игры - доступны в веб-приложении через кнопку "Играть"\n\n` +
        `❓ При возникновении вопросов обращайтесь в поддержку`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Ошибка при выполнении команды /help:', error);
      ctx.reply('Произошла ошибка при отображении справки. Пожалуйста, попробуйте позже.');
    }
  });

  // Команда balance - проверка баланса
  bot.command('balance', async (ctx) => {
    try {
      // Получаем пользователя из базы для получения актуальных данных
      const user = await User.findOne({ telegramId: ctx.from.id });
      if (!user) {
        return ctx.reply('Пожалуйста, зарегистрируйтесь с помощью команды /start');
      }
      
      // Обновляем информацию в сессии
      if (ctx.session) {
        ctx.session.user = {
          id: user._id,
          telegramId: user.telegramId,
          firstName: user.firstName,
          balance: user.balance,
          usdtBalance: user.usdtBalance || 0,
          rubleBalance: user.rubleBalance || 0
        };
      }
      
      // Получаем текущие курсы обмена
      const rates = await ExchangeRate.findOne({ base: 'usdt' })
        .sort({ updatedAt: -1 })
        .limit(1)
        .catch(err => {
          console.error('Ошибка при получении курсов обмена:', err);
          return null;
        });
      
      const usdtToRub = rates?.rates?.rub || 90;
      const usdtToStars = rates?.rates?.stars || 100;
      
      // Рассчитываем общий баланс в USDT
      const starsInUsdt = user.balance / usdtToStars;
      const rubInUsdt = user.rubleBalance / usdtToRub;
      const totalBalance = (user.usdtBalance || 0) + starsInUsdt + rubInUsdt;
      
      // Отправляем информацию о балансе
      await ctx.reply(
        `💰 *Ваш баланс:*\n\n` +
        `USDT: *${(user.usdtBalance || 0).toFixed(2)} USDT*\n` +
        `Рубли: *${(user.rubleBalance || 0).toFixed(2)} ₽*\n` +
        `Звезды: *${user.balance} ⭐*\n\n` +
        `Общий баланс (в USDT): *${totalBalance.toFixed(2)} USDT*\n\n` +
        `📊 *Текущие курсы:*\n` +
        `1 USDT = ${usdtToRub.toFixed(2)} ₽\n` +
        `1 USDT = ${usdtToStars} ⭐\n\n` +
        `🔄 Используйте /exchange для обмена валют\n` +
        `💰 Используйте /deposit для пополнения\n` +
        `📤 Используйте /withdraw для вывода средств`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Ошибка при выполнении команды /balance:', error);
      ctx.reply('Произошла ошибка при получении баланса. Пожалуйста, попробуйте позже.');
    }
  });

  // Команда deposit - пополнение баланса
  bot.command('deposit', async (ctx) => {
    try {
      // Очищаем предыдущие данные сессии, связанные с пополнением
      if (ctx.session) {
        delete ctx.session.deposit;
        delete ctx.session.withdraw;
        delete ctx.session.exchange;
      }
      
      // Проверяем, есть ли пользователь
      const user = await User.findOne({ telegramId: ctx.from.id });
      if (!user) {
        return ctx.reply('Пожалуйста, зарегистрируйтесь с помощью команды /start');
      }

      // Проверяем, доступен ли сервис криптоплатежей
      const serviceStatus = await cryptoPayService.testApiConnection()
        .catch(err => {
          console.error('Ошибка при проверке доступности криптоплатежей:', err);
          return { success: false };
        });

      if (!serviceStatus.success) {
        return ctx.reply(
          '❌ Сервис криптоплатежей временно недоступен. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
        );
      }
      
      // Выбор криптовалюты для пополнения
      const assets = serviceStatus.assets || [
        { currency: 'USDT', is_blockchain: true },
        { currency: 'TON', is_blockchain: true },
        { currency: 'BTC', is_blockchain: true }
      ];
      
      // Формируем клавиатуру с доступными валютами
      const keyboard = [];
      const supportedAssets = assets.filter(asset => asset.is_blockchain).map(asset => asset.currency);

      // Группируем валюты по 2 в ряд
      for (let i = 0; i < supportedAssets.length; i += 2) {
        const row = [];
        row.push({ text: supportedAssets[i], callback_data: `deposit_${supportedAssets[i]}` });
        
        if (i + 1 < supportedAssets.length) {
          row.push({ text: supportedAssets[i + 1], callback_data: `deposit_${supportedAssets[i + 1]}` });
        }
        
        keyboard.push(row);
      }

      // Инициализируем сессию для пополнения
      ctx.session.deposit = { 
        state: 'selecting_currency',
        timestamp: Date.now()
      };
      
      // Отправляем сообщение с выбором валюты
      await ctx.reply(
        '💰 *Пополнение баланса*\n\nВыберите криптовалюту для пополнения:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
    } catch (error) {
      console.error('Ошибка при выполнении команды /deposit:', error);
      ctx.reply('Произошла ошибка при подготовке пополнения. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработка выбора валюты для пополнения
  bot.action(/^deposit_(.+)$/, async (ctx) => {
    try {
      // Проверяем сессию и её актуальность
      if (!ctx.session || !ctx.session.deposit || 
          ctx.session.deposit.state !== 'selecting_currency' ||
          Date.now() - ctx.session.deposit.timestamp > SESSION_TTL) {
        
        await ctx.answerCbQuery('Сессия устарела. Пожалуйста, начните заново с команды /deposit');
        return ctx.reply('Пожалуйста, начните процесс пополнения заново с помощью команды /deposit');
      }
      
      // Получаем выбранную валюту
      const currency = ctx.match[1];
      
      // Обновляем состояние сессии
      ctx.session.deposit.currency = currency;
      ctx.session.deposit.state = 'selecting_amount';
      ctx.session.deposit.timestamp = Date.now();
      
      // Формируем клавиатуру с предопределенными суммами
      await ctx.editMessageText(
        `💰 *Пополнение баланса*\n\nВыбрана валюта: *${currency}*\n\nВыберите сумму пополнения:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '10 USD', callback_data: `amount_${currency}_10` },
                { text: '30 USD', callback_data: `amount_${currency}_30` },
                { text: '50 USD', callback_data: `amount_${currency}_50` }
              ],
              [
                { text: '100 USD', callback_data: `amount_${currency}_100` },
                { text: '200 USD', callback_data: `amount_${currency}_200` },
                { text: '500 USD', callback_data: `amount_${currency}_500` }
              ],
              [
                { text: 'Другая сумма', callback_data: `amount_${currency}_custom` }
              ]
            ]
          }
        }
      );
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Ошибка при выборе валюты для пополнения:', error);
      await ctx.answerCbQuery('Произошла ошибка при выборе валюты');
      await ctx.reply('Произошла ошибка. Пожалуйста, начните заново с команды /deposit');
    }
  });

  // Обработка выбора суммы для пополнения
  bot.action(/^amount_(.+)_(\d+|custom)$/, async (ctx) => {
    try {
      // Проверяем сессию и её актуальность
      if (!ctx.session || !ctx.session.deposit || 
          ctx.session.deposit.state !== 'selecting_amount' ||
          Date.now() - ctx.session.deposit.timestamp > SESSION_TTL) {
        
        await ctx.answerCbQuery('Сессия устарела. Пожалуйста, начните заново с команды /deposit');
        return ctx.reply('Пожалуйста, начните процесс пополнения заново с помощью команды /deposit');
      }
      
      const [currency, amountStr] = ctx.match.slice(1);
      
      // Проверяем, соответствует ли валюта той, что была выбрана ранее
      if (currency !== ctx.session.deposit.currency) {
        await ctx.answerCbQuery('Несоответствие валюты. Пожалуйста, начните заново');
        return ctx.reply('Обнаружено несоответствие валюты. Пожалуйста, начните заново с команды /deposit');
      }
      
      // Если выбрана опция "Другая сумма"
      if (amountStr === 'custom') {
        ctx.session.deposit.state = 'entering_custom_amount';
        ctx.session.deposit.timestamp = Date.now();
        
        await ctx.reply(
          `Введите сумму для пополнения в USD (например, 25):\n\n` +
          `Минимальная сумма: 5 USD\n` +
          `Максимальная сумма: 1000 USD`,
          { reply_markup: { force_reply: true } }
        );
        
        return ctx.answerCbQuery();
      }
      
      // Обрабатываем выбранную предопределенную сумму
      const amount = parseFloat(amountStr);
      await processDepositRequest(ctx, currency, amount);
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Ошибка при выборе суммы для пополнения:', error);
      await ctx.answerCbQuery('Произошла ошибка при выборе суммы');
      await ctx.reply('Произошла ошибка. Пожалуйста, начните заново с команды /deposit');
    }
  });

  // Обработка ввода кастомной суммы
  bot.on('text', async (ctx, next) => {
    try {
      // Проверяем, находится ли пользователь в режиме ввода суммы для пополнения
      if (ctx.session && ctx.session.deposit && 
          ctx.session.deposit.state === 'entering_custom_amount' &&
          Date.now() - ctx.session.deposit.timestamp < SESSION_TTL) {
        
        const amountText = ctx.message.text.trim();
        let amount = parseFloat(amountText.replace(',', '.'));
        
        // Проверка корректности введенной суммы
        if (isNaN(amount) || amount <= 0) {
          return ctx.reply('Пожалуйста, введите корректную положительную сумму в числовом формате.');
        }
        
        // Проверка минимальной и максимальной суммы
        if (amount < 5) {
          return ctx.reply('Минимальная сумма для пополнения: 5 USD. Пожалуйста, введите большую сумму.');
        }
        
        if (amount > 1000) {
          return ctx.reply('Максимальная сумма для пополнения: 1000 USD. Пожалуйста, введите меньшую сумму.');
        }
        
        // Округляем до 2 знаков после запятой
        amount = Math.round(amount * 100) / 100;
        
        const currency = ctx.session.deposit.currency;
        await processDepositRequest(ctx, currency, amount);
        
        return;
      }
      
      // Проверяем, находится ли пользователь в режиме ввода суммы для вывода
      if (ctx.session && ctx.session.withdraw && 
          ctx.session.withdraw.state === 'entering_amount' &&
          Date.now() - ctx.session.withdraw.timestamp < SESSION_TTL) {
        
        await handleWithdrawAmountInput(ctx);
        return;
      }
      
      // Проверяем, находится ли пользователь в режиме ввода суммы для обмена
      if (ctx.session && ctx.session.exchange && 
          ctx.session.exchange.state === 'entering_amount' &&
          Date.now() - ctx.session.exchange.timestamp < SESSION_TTL) {
        
        await handleExchangeAmountInput(ctx);
        return;
      }
      
      // Если это не связано с текущими операциями, передаем управление далее
      await next();
    } catch (error) {
      console.error('Ошибка при обработке текстового сообщения:', error);
      ctx.reply('Произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте еще раз или используйте команду /help.');
      await next();
    }
  });

  // Функция для обработки запроса на пополнение
  async function processDepositRequest(ctx, currency, amount) {
    try {
      // Проверяем пользователя
      const user = await User.findOne({ telegramId: ctx.from.id });
      if (!user) {
        return ctx.reply('Пользователь не найден. Пожалуйста, выполните команду /start');
      }
      
      // Описание для платежа
      const description = `Пополнение баланса Greenlight Casino: ${user.firstName} (ID: ${user.telegramId})`;
      
      // Отправляем сообщение о создании счета
      const statusMessage = await ctx.reply('⏳ Создание счета на оплату...');
      
      try {
        // Создаем счет через Crypto Pay API с таймаутом
        const invoice = await Promise.race([
          cryptoPayService.createInvoice(user.telegramId, amount, currency, description),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Таймаут при создании счета')), API_TIMEOUT)
          )
        ]);
        
        // Очищаем данные сессии
        if (ctx.session) {
          delete ctx.session.deposit;
        }
        
        // Редактируем сообщение со статусом
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMessage.message_id,
          null,
          `✅ Счет на оплату создан!\n\n` +
          `Сумма: ${amount} USD (${invoice.amount} ${invoice.asset})\n\n` +
          `Перейдите по ссылке для оплаты:`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💰 Оплатить', url: invoice.pay_url }]
              ]
            }
          }
        );
        
        // Отправляем инструкции и информацию о проверке
        await ctx.reply(
          `ℹ️ *Инструкция по оплате:*\n\n` +
          `1. Нажмите кнопку "Оплатить" выше\n` +
          `2. Следуйте инструкциям на странице оплаты\n` +
          `3. После успешной оплаты ваш баланс будет пополнен автоматически\n\n` +
          `⏱ Время на оплату: 60 минут\n` +
          `🔄 Статус можно проверить командой /balance\n\n` +
          `❓ Если возникли проблемы с оплатой, обратитесь в поддержку`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Ошибка при создании счета:', error);
        
        // Редактируем сообщение со статусом
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMessage.message_id,
          null,
          '❌ Произошла ошибка при создании счета на оплату'
        );
        
        // Отправляем дополнительную информацию об ошибке
        await ctx.reply(
          `К сожалению, не удалось создать счет на оплату.\n\n` +
          `Причина: ${error.message || 'Неизвестная ошибка'}\n\n` +
          `Пожалуйста, попробуйте позже или выберите другую валюту.`
        );
        
        // Очищаем данные сессии
        if (ctx.session) {
          delete ctx.session.deposit;
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке запроса на пополнение:', error);
      ctx.reply('Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.');
      
      // Очищаем данные сессии
      if (ctx.session) {
        delete ctx.session.deposit;
      }
    }
  }

  // Команда withdraw - вывод средств
  bot.command('withdraw', async (ctx) => {
    try {
      // Очищаем предыдущие данные сессии
      if (ctx.session) {
        delete ctx.session.deposit;
        delete ctx.session.withdraw;
        delete ctx.session.exchange;
      }
      
      // Проверяем, есть ли пользователь
      const user = await User.findOne({ telegramId: ctx.from.id }).catch(err => {
        console.error('Ошибка при поиске пользователя:', err);
        return null;
      });
      
      if (!user) {
        return ctx.reply('Пожалуйста, зарегистрируйтесь с помощью команды /start');
      }
      
      // Проверяем наличие средств
      const hasUsdtBalance = user.usdtBalance > 0;
      const hasRubleBalance = user.rubleBalance > 0;
      const hasStarsBalance = user.balance > 0;
      
      if (!hasUsdtBalance && !hasRubleBalance && !hasStarsBalance) {
        return ctx.reply(
          '❌ У вас нет средств для вывода.\n\n' +
          'Пожалуйста, пополните баланс с помощью команды /deposit или заработайте звезды в играх.'
        );
      }
      
      // Получаем текущие курсы обмена
      const rates = await ExchangeRate.findOne({ base: 'usdt' })
        .sort({ updatedAt: -1 })
        .limit(1)
        .catch(err => {
          console.error('Ошибка при получении курсов обмена:', err);
          return null;
        });
      
      const usdtToRub = rates?.rates?.rub || 90;
      const usdtToStars = rates?.rates?.stars || 100;
      
      // Рассчитываем эквиваленты в USDT
      const starsInUsdt = hasStarsBalance ? (user.balance / usdtToStars) : 0;
      const rubInUsdt = hasRubleBalance ? (user.rubleBalance / usdtToRub) : 0;
      const totalUsdt = (user.usdtBalance || 0) + starsInUsdt + rubInUsdt;
      
      // Проверяем минимальную сумму для вывода
      const MIN_WITHDRAW = 20; // минимум 20 USDT
      if (totalUsdt < MIN_WITHDRAW) {
        return ctx.reply(
          `❌ Недостаточно средств для вывода.\n\n` +
          `Минимальная сумма для вывода: ${MIN_WITHDRAW} USDT\n` +
          `Ваш общий баланс в USDT: ${totalUsdt.toFixed(2)} USDT\n\n` +
          `Пожалуйста, пополните баланс или заработайте больше звезд.`
        );
      }
      
      // Проверяем, доступен ли сервис криптоплатежей
      const serviceStatus = await cryptoPayService.testApiConnection()
        .catch(err => {
          console.error('Ошибка при проверке доступности криптоплатежей:', err);
          return { success: false };
        });

      if (!serviceStatus.success) {
        return ctx.reply(
          '❌ Сервис вывода средств временно недоступен. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
        );
      }
      
      // Формируем сообщение о доступных средствах
      let balanceInfo = `💰 *Ваш текущий баланс:*\n\n`;
      if (hasUsdtBalance) balanceInfo += `USDT: ${user.usdtBalance.toFixed(2)} USDT\n`;
      if (hasRubleBalance) balanceInfo += `Рубли: ${user.rubleBalance.toFixed(2)} ₽\n`;
      if (hasStarsBalance) balanceInfo += `Звезды: ${user.balance} ⭐\n`;
      
      balanceInfo += `\nОбщий баланс в USDT: ${totalUsdt.toFixed(2)} USDT\n\n`;
      balanceInfo += `📊 *Текущие курсы:*\n`;
      balanceInfo += `1 USDT = ${usdtToRub.toFixed(2)} ₽\n`;
      balanceInfo += `1 USDT = ${usdtToStars} ⭐\n\n`;
      balanceInfo += `Выберите валюту для вывода:`;
      
      // Формируем клавиатуру с доступными валютами для вывода
      const keyboard = [];
      
      // Если есть прямой баланс USDT или суммарный эквивалент больше минимума
      if (hasUsdtBalance || totalUsdt >= MIN_WITHDRAW) {
        keyboard.push([
          { text: 'USDT (TRC20)', callback_data: 'withdraw_USDT_TRC20' },
          { text: 'USDT (BEP20)', callback_data: 'withdraw_USDT_BEP20' }
        ]);
        
        keyboard.push([
          { text: 'TON', callback_data: 'withdraw_TON' },
          { text: 'BTC', callback_data: 'withdraw_BTC' }
        ]);
        
        keyboard.push([
          { text: 'ETH', callback_data: 'withdraw_ETH' },
          { text: 'BNB', callback_data: 'withdraw_BNB' }
        ]);
      }
      
      // Если клавиатура пуста (нет доступных вариантов)
      if (keyboard.length === 0) {
        return ctx.reply(
          '❌ В данный момент вывод средств недоступен.\n\n' +
          'Пожалуйста, обратитесь в поддержку или попробуйте позже.'
        );
      }
      
      // Инициализируем сессию для вывода
      ctx.session.withdraw = { 
        state: 'selecting_currency',
        timestamp: Date.now(),
        totalUsdt: totalUsdt,
        rates: {
          usdtToRub: usdtToRub,
          usdtToStars: usdtToStars
        }
      };
      
      // Отправляем сообщение с выбором валюты
      await ctx.reply(balanceInfo, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Ошибка при выполнении команды /withdraw:', error);
      ctx.reply('Произошла ошибка при подготовке вывода средств. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработка выбора валюты для вывода
  bot.action(/^withdraw_(.+)$/, async (ctx) => {
    try {
      // Проверяем сессию и её актуальность
      if (!ctx.session || !ctx.session.withdraw || 
          ctx.session.withdraw.state !== 'selecting_currency' ||
          Date.now() - ctx.session.withdraw.timestamp > SESSION_TTL) {
        
        await ctx.answerCbQuery('Сессия устарела. Пожалуйста, начните заново с команды /withdraw');
        return ctx.reply('Пожалуйста, начните процесс вывода заново с помощью команды /withdraw');
      }
      
      // Получаем выбранную валюту и опционально сеть
      const currencyInfo = ctx.match[1].split('_');
      const currency = currencyInfo[0];
      const network = currencyInfo.length > 1 ? currencyInfo[1] : null;
      
      // Обновляем состояние сессии
      ctx.session.withdraw.currency = currency;
      ctx.session.withdraw.network = network;
      ctx.session.withdraw.state = 'entering_amount';
      ctx.session.withdraw.timestamp = Date.now();
      
      // Формируем кошелек для отображения (TRC20, BEP20, и т.д.)
      const walletType = network ? `${currency} (${network})` : currency;
      
      // Получаем минимальную и максимальную суммы для вывода
      const minWithdraw = 20; // Минимум 20 USDT эквивалента
      const maxWithdraw = Math.min(1000, ctx.session.withdraw.totalUsdt); // Максимум 1000 USDT или весь баланс
      
      // Отправляем сообщение с запросом ввода суммы
      await ctx.editMessageText(
        `💰 *Вывод средств*\n\n` +
        `Выбрана валюта: *${walletType}*\n\n` +
        `Введите сумму для вывода в USD (например, 50):\n\n` +
        `Минимальная сумма: ${minWithdraw} USD\n` +
        `Максимальная сумма: ${maxWithdraw.toFixed(2)} USD\n\n` +
        `Доступно для вывода: ${ctx.session.withdraw.totalUsdt.toFixed(2)} USD`,
        {
          parse_mode: 'Markdown',
          reply_markup: { remove_keyboard: true }
        }
      );
      
      // Запрашиваем у пользователя ввод суммы
      await ctx.reply(
        'Введите сумму для вывода в USD:',
        { reply_markup: { force_reply: true } }
      );
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Ошибка при выборе валюты для вывода:', error);
      await ctx.answerCbQuery('Произошла ошибка при выборе валюты');
      await ctx.reply('Произошла ошибка. Пожалуйста, начните заново с команды /withdraw');
    }
  });

  // Обработчик ввода суммы для вывода
  async function handleWithdrawAmountInput(ctx) {
    try {
      const amountText = ctx.message.text.trim();
      let amount = parseFloat(amountText.replace(',', '.'));
      
      // Проверка корректности введенной суммы
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply('Пожалуйста, введите корректную положительную сумму в числовом формате.');
      }
      
      // Получаем данные из сессии
      const { currency, network, totalUsdt } = ctx.session.withdraw;
      
      // Проверка минимальной и максимальной суммы
      const MIN_WITHDRAW = 20;
      if (amount < MIN_WITHDRAW) {
        return ctx.reply(`Минимальная сумма для вывода: ${MIN_WITHDRAW} USD. Пожалуйста, введите большую сумму.`);
      }
      
      if (amount > totalUsdt) {
        return ctx.reply(`У вас недостаточно средств. Максимально доступно: ${totalUsdt.toFixed(2)} USD.`);
      }
      
      const MAX_WITHDRAW = 1000;
      if (amount > MAX_WITHDRAW) {
        return ctx.reply(`Максимальная сумма для вывода: ${MAX_WITHDRAW} USD. Пожалуйста, введите меньшую сумму.`);
      }
      
      // Округляем до 2 знаков после запятой
      amount = Math.round(amount * 100) / 100;
      
      // Обновляем состояние сессии
      ctx.session.withdraw.amount = amount;
      ctx.session.withdraw.state = 'entering_address';
      ctx.session.withdraw.timestamp = Date.now();
      
      // Форматируем полное название валюты с сетью
      const walletType = network ? `${currency} (${network})` : currency;
      
      // Запрашиваем адрес кошелька
      await ctx.reply(
        `Введите адрес кошелька ${walletType} для вывода средств:`,
        { reply_markup: { force_reply: true } }
      );
      
      // Устанавливаем обработчик следующего сообщения
      bot.use(async (nextCtx, next) => {
        // Если это сообщение от того же пользователя и сессия в правильном состоянии
        if (nextCtx.from && nextCtx.from.id === ctx.from.id && 
            nextCtx.message && nextCtx.message.text &&
            nextCtx.session && nextCtx.session.withdraw && 
            nextCtx.session.withdraw.state === 'entering_address') {
          
          // Обрабатываем ввод адреса
          await handleWithdrawAddressInput(nextCtx);
          return;
        }
        
        await next();
      });
    } catch (error) {
      console.error('Ошибка при вводе суммы для вывода:', error);
      ctx.reply('Произошла ошибка при обработке суммы вывода. Пожалуйста, попробуйте заново командой /withdraw');
      
      // Очищаем данные сессии
      if (ctx.session) {
        delete ctx.session.withdraw;
      }
    }
  }

  // Обработчик ввода адреса для вывода
  async function handleWithdrawAddressInput(ctx) {
    try {
      const address = ctx.message.text.trim();
      
      // Базовая валидация адреса
      if (!address || address.length < 10) {
        return ctx.reply('Пожалуйста, введите корректный адрес кошелька.');
      }
      
      // Получаем данные из сессии
      const { currency, network, amount } = ctx.session.withdraw;
      
      // Обновляем состояние сессии
      ctx.session.withdraw.address = address;
      ctx.session.withdraw.state = 'confirming';
      ctx.session.withdraw.timestamp = Date.now();
      
      // Форматируем полное название валюты с сетью
      const walletType = network ? `${currency} (${network})` : currency;
      
      // Отправляем запрос на подтверждение
      await ctx.reply(
        `📋 *Подтверждение вывода средств*\n\n` +
        `Валюта: ${walletType}\n` +
        `Сумма: ${amount} USD\n` +
        `Адрес: \`${address}\`\n\n` +
        `⚠️ Внимательно проверьте адрес! Отмена операции после подтверждения невозможна.\n\n` +
        `Подтвердите вывод средств:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Подтвердить', callback_data: 'confirm_withdraw' },
                { text: '❌ Отменить', callback_data: 'cancel_withdraw' }
              ]
            ]
          }
        }
      );
      
      // Удаляем временный обработчик сообщений
      const middleware = bot.middleware();
      middleware.use((ctx, next) => next());
    } catch (error) {
      console.error('Ошибка при вводе адреса для вывода:', error);
      ctx.reply('Произошла ошибка при обработке адреса. Пожалуйста, попробуйте заново командой /withdraw');
      
      // Очищаем данные сессии
      if (ctx.session) {
        delete ctx.session.withdraw;
      }
    }
  }

  // Обработка подтверждения вывода
  bot.action('confirm_withdraw', async (ctx) => {
    try {
      // Проверяем сессию и её актуальность
      if (!ctx.session || !ctx.session.withdraw || 
          ctx.session.withdraw.state !== 'confirming' ||
          Date.now() - ctx.session.withdraw.timestamp > SESSION_TTL) {
        
        await ctx.answerCbQuery('Сессия устарела. Пожалуйста, начните заново с команды /withdraw');
        return ctx.reply('Пожалуйста, начните процесс вывода заново с помощью команды /withdraw');
      }
      
      const { currency, network, amount, address } = ctx.session.withdraw;
      
      // Обновляем сообщение о статусе
      await ctx.editMessageText(
        `⏳ Обработка запроса на вывод средств...\n\n` +
        `Валюта: ${network ? `${currency} (${network})` : currency}\n` +
        `Сумма: ${amount} USD\n` +
        `Адрес: ${address}\n\n` +
        `Пожалуйста, подождите...`,
        { parse_mode: 'Markdown' }
      );
      
      await ctx.answerCbQuery();
      
      // Проверяем пользователя и его баланс
      const user = await User.findOne({ telegramId: ctx.from.id });
      if (!user) {
        return ctx.editMessageText('❌ Пользователь не найден. Пожалуйста, выполните команду /start');
      }
      
      // Получаем текущие курсы обмена
      const rates = await ExchangeRate.findOne({ base: 'usdt' })
        .sort({ updatedAt: -1 })
        .limit(1)
        .catch(err => {
          console.error('Ошибка при получении курсов обмена:', err);
          return null;
        });
      
      const usdtToRub = rates?.rates?.rub || ctx.session.withdraw.rates.usdtToRub || 90;
      const usdtToStars = rates?.rates?.stars || ctx.session.withdraw.rates.usdtToStars || 100;
      
      // Рассчитываем эквиваленты в USDT
      const starsInUsdt = user.balance / usdtToStars;
      const rubInUsdt = user.rubleBalance / usdtToRub;
      const totalUsdt = (user.usdtBalance || 0) + starsInUsdt + rubInUsdt;
      
      // Проверяем достаточность средств
      if (totalUsdt < amount) {
        return ctx.editMessageText(
          `❌ Недостаточно средств для вывода.\n\n` +
          `Требуется: ${amount} USD\n` +
          `Доступно: ${totalUsdt.toFixed(2)} USD\n\n` +
          `Пожалуйста, попробуйте вывести меньшую сумму.`
        );
      }
      
      // Процесс списания средств: сначала с USDT-баланса
      let remainingAmount = amount;
      let usdtUsed = 0;
      let rubUsed = 0;
      let starsUsed = 0;
      
      // 1. Списываем с USDT-баланса
      if (user.usdtBalance > 0) {
        usdtUsed = Math.min(user.usdtBalance, remainingAmount);
        user.usdtBalance -= usdtUsed;
        remainingAmount -= usdtUsed;
      }
      
      // 2. Списываем с рублевого баланса, если нужно
      if (remainingAmount > 0 && user.rubleBalance > 0) {
        const rubRequired = remainingAmount * usdtToRub;
        rubUsed = Math.min(user.rubleBalance, rubRequired);
        user.rubleBalance -= rubUsed;
        remainingAmount -= (rubUsed / usdtToRub);
      }
      
      // 3. Списываем со звездного баланса, если нужно
      if (remainingAmount > 0 && user.balance > 0) {
        const starsRequired = remainingAmount * usdtToStars;
        starsUsed = Math.min(user.balance, starsRequired);
        user.balance -= starsUsed;
        remainingAmount -= (starsUsed / usdtToStars);
      }
      
      // Если осталось что-то, значит произошла ошибка в расчетах
      if (remainingAmount > 0.01) {
        return ctx.editMessageText(
          `❌ Ошибка при расчете баланса.\n\n` +
          `Пожалуйста, обратитесь в поддержку или попробуйте позже.`
        );
      }
      
      // Создаем комментарий для перевода
      const comment = `Вывод средств - ${ctx.from.first_name} (ID: ${ctx.from.id})`;
      
      try {
        // Выполняем перевод через API
        const fullCurrency = network ? `${currency}_${network}` : currency;
        
        // Имитация перевода средств (в реальности здесь будет вызов API)
        const transfer = {
          success: true,
          transferId: `TR${Date.now()}`,
          amount: amount,
          fee: amount * 0.01, // 1% комиссия
          total: amount * 1.01,
          currency: fullCurrency
        };
        
        /*
        // Реальный вызов API перевода
        const transfer = await Promise.race([
          cryptoPayService.transfer(ctx.from.id, amount, fullCurrency, comment),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Таймаут при выполнении перевода')), API_TIMEOUT)
          )
        ]);
        */
        
        // Сохраняем изменения в базе данных
        await user.save();
        
        // Записываем транзакцию
        const transaction = new Transaction({
          userId: user._id,
          telegramId: user.telegramId,
          amount: -amount,
          type: 'withdrawal',
          game: 'none',
          cryptoDetails: {
            transferId: transfer.transferId,
            asset: fullCurrency,
            amount: amount.toString(),
            status: 'completed'
          }
        });
        
        await transaction.save();
        
        // Обновляем сообщение о статусе
        await ctx.editMessageText(
          `✅ *Вывод средств успешно выполнен!*\n\n` +
          `Валюта: ${network ? `${currency} (${network})` : currency}\n` +
          `Сумма: ${amount} USD\n` +
          `Комиссия: ${transfer.fee.toFixed(2)} USD\n` +
          `Адрес: \`${address}\`\n\n` +
          `ID транзакции: \`${transfer.transferId}\`\n\n` +
          `Средства будут зачислены в течение 10-30 минут.`,
          { parse_mode: 'Markdown' }
        );
        
        // Отправляем информацию о текущем балансе
        await ctx.reply(
          `💰 *Текущий баланс:*\n\n` +
          `USDT: ${user.usdtBalance.toFixed(2)} USDT\n` +
          `Рубли: ${user.rubleBalance.toFixed(2)} ₽\n` +
          `Звезды: ${user.balance} ⭐\n\n` +
          `Детали списания:\n` +
          `- USDT: ${usdtUsed.toFixed(2)} USDT\n` +
          `- Рубли: ${rubUsed.toFixed(2)} ₽\n` +
          `- Звезды: ${starsUsed} ⭐`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Ошибка при выполнении перевода:', error);
        
        await ctx.editMessageText(
          `❌ Ошибка при выполнении перевода.\n\n` +
          `Причина: ${error.message || 'Неизвестная ошибка'}\n\n` +
          `Ваши средства не были списаны. Пожалуйста, попробуйте позже или обратитесь в поддержку.`
        );
      }
      
      // Очищаем данные сессии
      delete ctx.session.withdraw;
    } catch (error) {
      console.error('Ошибка при подтверждении вывода:', error);
      await ctx.answerCbQuery('Произошла ошибка при обработке вывода');
      await ctx.reply('Произошла ошибка. Пожалуйста, начните заново с команды /withdraw');
      
      // Очищаем данные сессии
      if (ctx.session) {
        delete ctx.session.withdraw;
      }
    }
  });

  // Отмена вывода
  bot.action('cancel_withdraw', async (ctx) => {
    try {
      await ctx.editMessageText(
        '❌ Вывод средств отменен.\n\n' +
        'Вы можете начать процесс вывода заново с помощью команды /withdraw'
      );
      
      await ctx.answerCbQuery('Операция вывода отменена');
      
      // Очищаем данные сессии
      if (ctx.session) {
        delete ctx.session.withdraw;
      }
    } catch (error) {
      console.error('Ошибка при отмене вывода:', error);
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.reply('Произошла ошибка при отмене. Пожалуйста, попробуйте еще раз.');
    }
  });

  // Команда exchange - обмен валют
  bot.command('exchange', async (ctx) => {
    try {
      // Очищаем предыдущие данные сессии
      if (ctx.session) {
        delete ctx.session.deposit;
        delete ctx.session.withdraw;
        delete ctx.session.exchange;
      }
      
      // Проверяем, есть ли пользователь
      const user = await User.findOne({ telegramId: ctx.from.id }).catch(err => {
        console.error('Ошибка при поиске пользователя:', err);
        return null;
      });
      
      if (!user) {
        return ctx.reply('Пожалуйста, зарегистрируйтесь с помощью команды /start');
      }
      
      // Получаем текущие курсы обмена
      const rates = await ExchangeRate.findOne({ base: 'usdt' })
        .sort({ updatedAt: -1 })
        .limit(1)
        .catch(err => {
          console.error('Ошибка при получении курсов обмена:', err);
          return null;
        });
      
      const usdtToRub = rates?.rates?.rub || 90;
      const usdtToStars = rates?.rates?.stars || 100;
      const rubToStars = usdtToStars / usdtToRub;
      
      // Формируем сообщение о балансе и курсах
      const balanceInfo = 
        `💰 *Ваш текущий баланс:*\n\n` +
        `USDT: ${(user.usdtBalance || 0).toFixed(2)} USDT\n` +
        `Рубли: ${(user.rubleBalance || 0).toFixed(2)} ₽\n` +
        `Звезды: ${user.balance} ⭐\n\n` +
        `📊 *Текущие курсы:*\n` +
        `1 USDT = ${usdtToRub.toFixed(2)} ₽\n` +
        `1 USDT = ${usdtToStars} ⭐\n` +
        `1 ₽ = ${rubToStars.toFixed(2)} ⭐\n\n` +
        `Выберите обмен:`;
      
      // Формируем клавиатуру с возможными обменами
      const keyboard = [];
      
      // Формируем строки клавиатуры в зависимости от наличия средств
      if (user.usdtBalance > 0) {
        keyboard.push([
          { text: 'USDT → Рубли', callback_data: 'exchange_usdt_rub' },
          { text: 'USDT → Звезды', callback_data: 'exchange_usdt_stars' }
        ]);
      }
      
      if (user.rubleBalance > 0) {
        keyboard.push([
          { text: 'Рубли → USDT', callback_data: 'exchange_rub_usdt' },
          { text: 'Рубли → Звезды', callback_data: 'exchange_rub_stars' }
        ]);
      }
      
      if (user.balance > 0) {
        keyboard.push([
          { text: 'Звезды → USDT', callback_data: 'exchange_stars_usdt' },
          { text: 'Звезды → Рубли', callback_data: 'exchange_stars_rub' }
        ]);
      }
      
      // Если нет доступных обменов (нет средств вообще)
      if (keyboard.length === 0) {
        return ctx.reply(
          '❌ У вас нет средств для обмена.\n\n' +
          'Пожалуйста, пополните баланс с помощью команды /deposit или заработайте звезды в играх.'
        );
      }
      
      // Инициализируем сессию для обмена
      ctx.session.exchange = { 
        state: 'selecting_exchange',
        timestamp: Date.now(),
        rates: {
          usdtToRub: usdtToRub,
          usdtToStars: usdtToStars,
          rubToStars: rubToStars
        },
        balances: {
          usdt: user.usdtBalance || 0,
          rub: user.rubleBalance || 0,
          stars: user.balance
        }
      };
      
      // Отправляем сообщение с выбором обмена
      await ctx.reply(balanceInfo, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Ошибка при выполнении команды /exchange:', error);
      ctx.reply('Произошла ошибка при подготовке обмена валют. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработка выбора валют для обмена
  bot.action(/^exchange_(.+)_(.+)$/, async (ctx) => {
    try {
      // Проверяем сессию и её актуальность
      if (!ctx.session || !ctx.session.exchange || 
          ctx.session.exchange.state !== 'selecting_exchange' ||
          Date.now() - ctx.session.exchange.timestamp > SESSION_TTL) {
        
        await ctx.answerCbQuery('Сессия устарела. Пожалуйста, начните заново с команды /exchange');
        return ctx.reply('Пожалуйста, начните процесс обмена заново с помощью команды /exchange');
      }
      
      // Получаем выбранные валюты
      const [fromCurrency, toCurrency] = ctx.match.slice(1);
      
      // Проверяем, что валюты допустимы
      const validCurrencies = ['usdt', 'rub', 'stars'];
      if (!validCurrencies.includes(fromCurrency) || !validCurrencies.includes(toCurrency)) {
        await ctx.answerCbQuery('Неверные валюты для обмена');
        return ctx.reply('Ошибка: неверные валюты для обмена. Пожалуйста, попробуйте снова.');
      }
      
      // Проверяем наличие достаточного баланса
      const availableBalance = ctx.session.exchange.balances[fromCurrency];
      if (!availableBalance || availableBalance <= 0) {
        await ctx.answerCbQuery(`У вас нет ${fromCurrency.toUpperCase()} для обмена`);
        return ctx.reply(`У вас недостаточно средств в ${fromCurrency.toUpperCase()} для обмена. Пожалуйста, выберите другую валюту.`);
      }
      
      // Обновляем состояние сессии
      ctx.session.exchange.fromCurrency = fromCurrency;
      ctx.session.exchange.toCurrency = toCurrency;
      ctx.session.exchange.state = 'entering_amount';
      ctx.session.exchange.timestamp = Date.now();
      
      // Определяем курс обмена
      let rate;
      const { usdtToRub, usdtToStars, rubToStars } = ctx.session.exchange.rates;
      
      if (fromCurrency === 'usdt' && toCurrency === 'rub') {
        rate = usdtToRub;
      } else if (fromCurrency === 'usdt' && toCurrency === 'stars') {
        rate = usdtToStars;
      } else if (fromCurrency === 'rub' && toCurrency === 'usdt') {
        rate = 1 / usdtToRub;
      } else if (fromCurrency === 'rub' && toCurrency === 'stars') {
        rate = rubToStars;
      } else if (fromCurrency === 'stars' && toCurrency === 'usdt') {
        rate = 1 / usdtToStars;
      } else if (fromCurrency === 'stars' && toCurrency === 'rub') {
        rate = 1 / rubToStars;
      }
      
      ctx.session.exchange.rate = rate;
      
      // Получаем символы валют для отображения
      const currencySymbols = {
        usdt: 'USDT',
        rub: '₽',
        stars: '⭐'
      };
      
      // Формируем сообщение с курсом обмена
      const exchangeInfo = 
        `🔄 *Обмен валют*\n\n` +
        `Направление обмена: ${currencySymbols[fromCurrency]} → ${currencySymbols[toCurrency]}\n\n` +
        `Текущий курс: 1 ${currencySymbols[fromCurrency]} = ${rate.toFixed(6)} ${currencySymbols[toCurrency]}\n\n` +
        `Доступно: ${availableBalance.toFixed(2)} ${currencySymbols[fromCurrency]}\n\n` +
        `Введите сумму для обмена в ${currencySymbols[fromCurrency]}:`;
      
      // Отправляем запрос на ввод суммы
      await ctx.editMessageText(exchangeInfo, {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      });
      
      // Запрашиваем сумму для обмена
      await ctx.reply(
        `Введите сумму для обмена в ${currencySymbols[fromCurrency]}:`,
        { reply_markup: { force_reply: true } }
      );
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Ошибка при выборе валют для обмена:', error);
      await ctx.answerCbQuery('Произошла ошибка при выборе валют');
      await ctx.reply('Произошла ошибка. Пожалуйста, начните заново с команды /exchange');
    }
  });

  // Обработчик ввода суммы для обмена
  async function handleExchangeAmountInput(ctx) {
    try {
      const amountText = ctx.message.text.trim();
      let amount = parseFloat(amountText.replace(',', '.'));
      
      // Проверка корректности введенной суммы
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply('Пожалуйста, введите корректную положительную сумму в числовом формате.');
      }
      
      // Получаем данные из сессии
      const { fromCurrency, toCurrency, rate, balances } = ctx.session.exchange;
      
      // Проверка достаточности средств
      const availableBalance = balances[fromCurrency];
      if (amount > availableBalance) {
        return ctx.reply(`У вас недостаточно средств. Максимально доступно: ${availableBalance.toFixed(2)} ${fromCurrency.toUpperCase()}.`);
      }
      
      // Округляем до 2 знаков после запятой (кроме звезд, они целые)
      if (fromCurrency !== 'stars') {
        amount = Math.round(amount * 100) / 100;
      } else {
        amount = Math.floor(amount);
      }
      
      // Рассчитываем сумму к получению
      let toAmount = amount * rate;
      
      // Округляем получаемую сумму в зависимости от валюты
      if (toCurrency !== 'stars') {
        toAmount = Math.round(toAmount * 100) / 100;
      } else {
        toAmount = Math.floor(toAmount);
      }
      
      // Получаем символы валют для отображения
      const currencySymbols = {
        usdt: 'USDT',
        rub: '₽',
        stars: '⭐'
      };
      
      // Отправляем запрос на подтверждение обмена
      await ctx.reply(
        `📋 *Подтверждение обмена валют*\n\n` +
        `Направление: ${currencySymbols[fromCurrency]} → ${currencySymbols[toCurrency]}\n` +
        `Курс: 1 ${currencySymbols[fromCurrency]} = ${rate.toFixed(6)} ${currencySymbols[toCurrency]}\n\n` +
        `Сумма обмена: ${amount} ${currencySymbols[fromCurrency]}\n` +
        `Вы получите: ${toAmount} ${currencySymbols[toCurrency]}\n\n` +
        `Подтвердите операцию обмена:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Подтвердить', callback_data: `confirm_exchange_${amount}` },
                { text: '❌ Отменить', callback_data: 'cancel_exchange' }
              ]
            ]
          }
        }
      );
      
      // Обновляем состояние сессии
      ctx.session.exchange.amount = amount;
      ctx.session.exchange.toAmount = toAmount;
      ctx.session.exchange.state = 'confirming';
      ctx.session.exchange.timestamp = Date.now();
    } catch (error) {
      console.error('Ошибка при вводе суммы для обмена:', error);
      ctx.reply('Произошла ошибка при обработке суммы обмена. Пожалуйста, попробуйте заново командой /exchange');
      
      // Очищаем данные сессии
      if (ctx.session) {
        delete ctx.session.exchange;
      }
    }
  }

  // Обработка подтверждения обмена
  bot.action(/^confirm_exchange_(.+)$/, async (ctx) => {
    try {
      // Проверяем сессию и её актуальность
      if (!ctx.session || !ctx.session.exchange || 
          ctx.session.exchange.state !== 'confirming' ||
          Date.now() - ctx.session.exchange.timestamp > SESSION_TTL) {
        
        await ctx.answerCbQuery('Сессия устарела. Пожалуйста, начните заново с команды /exchange');
        return ctx.reply('Пожалуйста, начните процесс обмена заново с помощью команды /exchange');
      }
      
      // Проверяем совпадение суммы в callback_data и в сессии
      const callbackAmount = parseFloat(ctx.match[1]);
      
      if (Math.abs(callbackAmount - ctx.session.exchange.amount) > 0.01) {
        await ctx.answerCbQuery('Обнаружено несоответствие суммы. Пожалуйста, начните заново');
        return ctx.reply('Обнаружено несоответствие суммы. Пожалуйста, начните процесс обмена заново.');
      }
      
      const { fromCurrency, toCurrency, amount, toAmount, rate } = ctx.session.exchange;
      
      // Получаем символы валют для отображения
      const currencySymbols = {
        usdt: 'USDT',
        rub: '₽',
        stars: '⭐'
      };
      
      // Обновляем сообщение о статусе
      await ctx.editMessageText(
        `⏳ Выполнение обмена валют...\n\n` +
        `Из: ${amount} ${currencySymbols[fromCurrency]}\n` +
        `В: ${toAmount} ${currencySymbols[toCurrency]}\n\n` +
        `Пожалуйста, подождите...`,
        { parse_mode: 'Markdown' }
      );
      
      await ctx.answerCbQuery();
      
      // Получаем пользователя из базы данных
      const user = await User.findOne({ telegramId: ctx.from.id });
      if (!user) {
        return ctx.editMessageText('❌ Пользователь не найден. Пожалуйста, выполните команду /start');
      }
      
      // Проверка достаточности средств (актуальная)
      let availableBalance;
      
      if (fromCurrency === 'usdt') {
        availableBalance = user.usdtBalance || 0;
      } else if (fromCurrency === 'rub') {
        availableBalance = user.rubleBalance || 0;
      } else { // stars
        availableBalance = user.balance;
      }
      
      if (availableBalance < amount) {
        return ctx.editMessageText(
          `❌ Недостаточно средств для обмена.\n\n` +
          `Требуется: ${amount} ${currencySymbols[fromCurrency]}\n` +
          `Доступно: ${availableBalance.toFixed(2)} ${currencySymbols[fromCurrency]}\n\n` +
          `Пожалуйста, попробуйте обменять меньшую сумму.`
        );
      }
      
      try {
        // Выполняем конвертацию через метод модели
        const result = await user.convertCurrency(fromCurrency, toCurrency, amount);
        
        // Получаем обновленные балансы
        let updatedBalances = {
          usdt: user.usdtBalance || 0,
          rub: user.rubleBalance || 0,
          stars: user.balance
        };
        
        // Обновляем сообщение об успешном обмене
        await ctx.editMessageText(
          `✅ *Обмен валют успешно выполнен!*\n\n` +
          `Направление: ${currencySymbols[fromCurrency]} → ${currencySymbols[toCurrency]}\n` +
          `Курс: 1 ${currencySymbols[fromCurrency]} = ${rate.toFixed(6)} ${currencySymbols[toCurrency]}\n\n` +
          `Вы обменяли: ${amount} ${currencySymbols[fromCurrency]}\n` +
          `Вы получили: ${toAmount} ${currencySymbols[toCurrency]}\n\n` +
          `Ваш текущий баланс:\n` +
          `USDT: ${updatedBalances.usdt.toFixed(2)} USDT\n` +
          `Рубли: ${updatedBalances.rub.toFixed(2)} ₽\n` +
          `Звезды: ${updatedBalances.stars} ⭐`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Ошибка при выполнении обмена валют:', error);
        
        await ctx.editMessageText(
          `❌ Ошибка при выполнении обмена валют.\n\n` +
          `Причина: ${error.message || 'Неизвестная ошибка'}\n\n` +
          `Пожалуйста, попробуйте позже или обратитесь в поддержку.`
        );
      }
      
      // Очищаем данные сессии
      delete ctx.session.exchange;
    } catch (error) {
      console.error('Ошибка при подтверждении обмена:', error);
      await ctx.answerCbQuery('Произошла ошибка при обработке обмена');
      await ctx.reply('Произошла ошибка. Пожалуйста, начните заново с команды /exchange');
      
      // Очищаем данные сессии
      if (ctx.session) {
        delete ctx.session.exchange;
      }
    }
  });

  // Отмена обмена
  bot.action('cancel_exchange', async (ctx) => {
    try {
      await ctx.editMessageText(
        '❌ Обмен валют отменен.\n\n' +
        'Вы можете начать процесс обмена заново с помощью команды /exchange'
      );
      
      await ctx.answerCbQuery('Операция обмена отменена');
      
      // Очищаем данные сессии
      if (ctx.session) {
        delete ctx.session.exchange;
      }
    } catch (error) {
      console.error('Ошибка при отмене обмена:', error);
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.reply('Произошла ошибка при отмене. Пожалуйста, попробуйте еще раз.');
    }
  });

  // ===================== ОБРАБОТКА СПОРОВ =====================

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
      
      // Получаем спор из базы данных с таймаутом
      const dispute = await Promise.race([
        Dispute.findById(disputeParam),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Таймаут при поиске спора')), API_TIMEOUT)
        )
      ]);
      
      if (!dispute) {
        ctx.reply('❌ Спор не найден или истек таймаут запроса');
        return;
      }
      
      // Получаем ID пользователя, который запустил команду
      const userId = ctx.from.id;
      
      // Определяем роль пользователя
      const isCreator = String(dispute.creatorTelegramId) === String(userId);
      const isOpponent = String(dispute.opponentTelegramId) === String(userId);
      
      // Формируем URL для комнаты спора с учетом роли
      let roomUrl;
      const webAppUrl = process.env.WEBAPP_URL || 'https://grnlight-casino.onrender.com';
      
      if (isCreator) {
        roomUrl = `${webAppUrl}?dispute=${dispute._id}&isCreator=true`;
      } else if (isOpponent) {
        roomUrl = `${webAppUrl}?dispute=${dispute._id}&isCreator=false`;
      } else {
        // Пользователь не является участником спора
        ctx.reply('❌ Вы не являетесь участником этого спора');
        return;
      }
      
      // Отправляем сообщение с кнопкой для открытия спора
      await ctx.reply(
        `🎮 <b>Спор готов к разрешению!</b>\n\n` +
        `<b>Тема:</b> ${dispute.question}\n` +
        `<b>Сумма:</b> ${dispute.bet.amount} ⭐\n\n` +
        `Нажмите кнопку ниже, чтобы открыть спор и бросить монетку:`,
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
      ctx.reply('❌ Произошла ошибка при открытии спора. Пожалуйста, попробуйте позже.');
    }
  }
  
  // Обработчик web_app_data - улучшенная версия с валидацией
  bot.on('web_app_data', async (ctx) => {
    try {
      // Получаем данные от веб-приложения
      const rawData = ctx.webAppData.data;
      console.log('Получены данные из веб-приложения:', rawData);
      
      // Валидация данных
      if (!rawData) {
        return ctx.reply('❌ Получены пустые данные от веб-приложения');
      }
      
      let data;
      try {
        // Пробуем распарсить JSON данные
        data = JSON.parse(rawData);
        
        // Добавляем валидацию данных
        if (!data || typeof data !== 'object') {
          throw new Error('Некорректный формат данных');
        }
        
        // Проверяем наличие ожидаемых полей в зависимости от типа
        if (data.type && typeof data.type === 'string') {
          // Валидация в зависимости от типа данных
          switch(data.type) {
            case 'dispute_room_connect':
              if (!data.disputeId || !data.roomId) {
                throw new Error('Отсутствуют обязательные поля для подключения к комнате');
              }
              break;
            case 'player_ready':
              if (!data.disputeId || typeof data.ready === 'undefined') {
                throw new Error('Отсутствуют обязательные поля для статуса игрока');
              }
              break;
            case 'dispute_result':
              if (!data.disputeId) {
                throw new Error('Отсутствует ID спора');
              }
              break;
            case 'dispute_result_final':
              if (!data.disputeId) {
                throw new Error('Отсутствует ID спора');
              }
              break;
            default:
              console.log(`Неизвестный тип данных: ${data.type}`);
              throw new Error('Неподдерживаемый тип данных');
          }
        } else if (typeof data === 'string' && data.startsWith('dispute_result_')) {
          // Обработка данных в старом формате
          const parts = data.split('_');
          if (parts.length < 4) {
            throw new Error('Некорректный формат данных спора');
          }
        } else {
          throw new Error('Отсутствует тип данных');
        }
      } catch (e) {
        // В случае ошибки парсинга или валидации
        console.error('Ошибка обработки данных веб-приложения:', e.message);
        return ctx.reply('❌ Получены некорректные данные от веб-приложения');
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
            ctx.reply('Получен неподдерживаемый тип данных.');
        }
      } else if (typeof data === 'string' && data.startsWith('dispute_result_')) {
        // Обработка результата спора (старый формат)
        await handleLegacyDisputeResult(ctx, data);
      } else {
        // Обработка других данных
        ctx.reply('Неподдерживаемый формат данных.');
      }
    } catch (error) {
      console.error('Ошибка обработки данных веб-приложения:', error);
      ctx.reply('❌ Произошла ошибка при обработке данных. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик подключения к комнате спора
  async function handleDisputeRoomConnect(ctx, data) {
    try {
      console.log('Обработка подключения к комнате спора:', data);
      
      const { disputeId, roomId, isCreator } = data;
      
      // Получаем данные спора из базы данных с таймаутом
      const dispute = await Promise.race([
        Dispute.findById(disputeId).populate('creator', 'firstName username').populate('opponent', 'firstName username'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Таймаут при поиске спора')), API_TIMEOUT)
        )
      ]);
      
      if (!dispute) {
        ctx.reply('❌ Спор не найден или истек таймаут запроса');
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
          const webAppUrl = process.env.WEBAPP_URL || 'https://grnlight-casino.onrender.com';
          const roomUrl = `${webAppUrl}?dispute=${disputeId}`;
          
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
      
      const { disputeId, ready } = data;
      
      // Получаем данные спора из базы данных с таймаутом
      const dispute = await Promise.race([
        Dispute.findById(disputeId).populate('creator', 'telegramId firstName lastName username').populate('opponent', 'telegramId firstName lastName username'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Таймаут при поиске спора')), API_TIMEOUT)
        )
      ]);
      
      if (!dispute) {
        ctx.reply('❌ Спор не найден или истек таймаут запроса');
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
      const webAppUrl = process.env.WEBAPP_URL || 'https://grnlight-casino.onrender.com';
      const roomUrl = `${webAppUrl}?dispute=${disputeId}`;
      
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

// Константа тайм-аута для API запросов
const API_TIMEOUT = 5000; // 5 секунд

// Объект для хранения пользовательских сессий с учетом времени жизни
const userSessions = {};

// Функция для очистки устаревших сессий
function cleanupOldSessions() {
  const now = Date.now();
  Object.keys(userSessions).forEach(userId => {
    const session = userSessions[userId];
    // Удаляем сессии старше 10 минут
    if (now - session.lastActivity > 600000) {
      delete userSessions[userId];
    }
  });
}

// Регулярная очистка устаревших сессий
setInterval(cleanupOldSessions, 300000); // Каждые 5 минут

// Middleware для обработки сессий пользователей
bot.use((ctx, next) => {
  if (ctx.from) {
    const userId = ctx.from.id;
    
    // Создаем сессию если её нет
    if (!userSessions[userId]) {
      userSessions[userId] = {
        state: null,
        data: {},
        lastActivity: Date.now()
      };
    } else {
      // Обновляем время последней активности
      userSessions[userId].lastActivity = Date.now();
    }
    
    // Добавляем сессию в контекст
    ctx.session = userSessions[userId];
  }
  
  return next();
});

// Команда для отмены текущей операции
bot.command('cancel', (ctx) => {
  if (ctx.session) {
    // Сброс состояния сессии
    ctx.session.state = null;
    ctx.session.data = {};
    ctx.reply('❌ Текущая операция отменена.');
  } else {
    ctx.reply('Нет активных операций для отмены.');
  }
});

// Обработчик отмены операции
bot.action('cancel_operation', (ctx) => {
  if (ctx.session) {
    ctx.session.state = null;
    ctx.session.data = {};
  }
  
  ctx.reply('❌ Операция отменена.');
  ctx.answerCbQuery();
});

// Улучшенная команда для пополнения баланса
bot.command('deposit', async (ctx) => {
  try {
    // Проверяем, есть ли активная сессия
    if (ctx.session && ctx.session.state) {
      ctx.reply('У вас уже есть активная операция. Пожалуйста, завершите её или используйте /cancel для отмены.');
      return;
    }
    
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) {
      return ctx.reply('Сначала зарегистрируйтесь с помощью команды /start');
    }

    // Инициализируем сессию для депозита
    ctx.session.state = 'deposit_choose_currency';
    ctx.session.data = {};

    // Отображаем кнопки для выбора метода пополнения
    ctx.reply('Выберите валюту для пополнения:', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'USDT', callback_data: 'deposit_USDT' },
            { text: 'TON', callback_data: 'deposit_TON' }
          ],
          [
            { text: 'BTC', callback_data: 'deposit_BTC' },
            { text: 'ETH', callback_data: 'deposit_ETH' }
          ],
          [
            { text: 'BNB', callback_data: 'deposit_BNB' },
            { text: 'SOL', callback_data: 'deposit_SOL' }
          ],
          [
            { text: '❌ Отмена', callback_data: 'cancel_operation' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Ошибка команды deposit:', error);
    ctx.reply('Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.');
  }
});

// Улучшенный обработчик колбэков для пополнения
bot.action(/^deposit_(.+)$/, async (ctx) => {
  try {
    // Проверяем валидность сессии
    if (!ctx.session || ctx.session.state !== 'deposit_choose_currency') {
      return ctx.answerCbQuery('Сессия устарела или некорректна. Пожалуйста, начните заново.', true);
    }
    
    // Получаем чистую валюту без суффикса сети
    let currency = ctx.match[1]; 
    // Убираем суффикс _TRC20 или _BSC, если они есть
    if (currency.includes('_')) {
      currency = currency.split('_')[0];
    }
    
    // Сохраняем выбранную валюту в сессии
    ctx.session.data.currency = currency;
    ctx.session.state = 'deposit_choose_amount';
    
    // Отправляем сообщение о выборе суммы
    await ctx.reply(`Вы выбрали ${currency}. Выберите сумму пополнения:`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '10 USD', callback_data: `amount_10` },
            { text: '50 USD', callback_data: `amount_50` },
            { text: '100 USD', callback_data: `amount_100` }
          ],
          [
            { text: '200 USD', callback_data: `amount_200` },
            { text: '500 USD', callback_data: `amount_500` },
            { text: '1000 USD', callback_data: `amount_1000` }
          ],
          [
            { text: 'Другая сумма', callback_data: `amount_custom` }
          ],
          [
            { text: '❌ Отмена', callback_data: 'cancel_operation' }
          ]
        ]
      }
    });
    
    ctx.answerCbQuery();
  } catch (error) {
    console.error('Ошибка обработки deposit callback:', error);
    ctx.answerCbQuery('Ошибка обработки запроса. Пожалуйста, попробуйте позже.', true);
    // Сбрасываем сессию при ошибке
    if (ctx.session) {
      ctx.session.state = null;
      ctx.session.data = {};
    }
  }
});

// Улучшенный обработчик выбора суммы
bot.action(/^amount_(\d+|custom)$/, async (ctx) => {
  try {
    // Проверяем валидность сессии
    if (!ctx.session || ctx.session.state !== 'deposit_choose_amount' || !ctx.session.data.currency) {
      return ctx.answerCbQuery('Сессия устарела или некорректна. Пожалуйста, начните заново.', true);
    }
    
    const amountStr = ctx.match[1];
    const currency = ctx.session.data.currency;
    const telegramId = ctx.from.id;
    
    // Проверка пользователя
    const user = await User.findOne({ telegramId });
    if (!user) {
      ctx.session.state = null;
      ctx.session.data = {};
      return ctx.answerCbQuery('Пользователь не найден. Пожалуйста, начните заново.', true);
    }
    
    // Если выбрана опция "Другая сумма"
    if (amountStr === 'custom') {
      ctx.session.state = 'deposit_enter_amount';
      
      await ctx.reply(`Введите сумму для пополнения в ${currency} (например, 25):`, {
        reply_markup: {
          force_reply: true
        }
      });
      
      return ctx.answerCbQuery();
    }
    
    // Конвертируем строку в число и проверяем на допустимость
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > 10000) { // Устанавливаем разумный верхний предел
      ctx.session.state = null;
      ctx.session.data = {};
      return ctx.answerCbQuery('Недопустимая сумма. Пожалуйста, начните заново.', true);
    }
    
    // Устанавливаем состояние создания инвойса
    ctx.session.state = 'deposit_create_invoice';
    ctx.session.data.amount = amount;
    
    // Создаем счет через Crypto Pay API с таймаутом
    try {
      const invoice = await Promise.race([
        cryptoPayService.createInvoice(telegramId, amount, currency),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Таймаут создания счета')), API_TIMEOUT)
        )
      ]);
      
      // Сбрасываем состояние сессии после успешного создания счета
      ctx.session.state = null;
      ctx.session.data = {};
      
      // Отправляем сообщение со ссылкой на оплату
      await ctx.reply(`✅ Счет на оплату успешно создан!\n\nСумма: ${amount} ${currency}\n\nПерейдите по ссылке для оплаты:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Оплатить', url: invoice.pay_url }]
          ]
        }
      });
      
      ctx.answerCbQuery();
    } catch (invoiceError) {
      console.error('Ошибка создания счета:', invoiceError);
      ctx.session.state = null;
      ctx.session.data = {};
      
      ctx.reply(`❌ Ошибка при создании счета: ${invoiceError.message}`);
      ctx.answerCbQuery('Ошибка при создании счета. Пожалуйста, попробуйте позже.', true);
    }
  } catch (error) {
    console.error('Ошибка обработки выбора суммы:', error);
    ctx.answerCbQuery('Ошибка при создании счета. Пожалуйста, попробуйте позже.', true);
    
    // Сбрасываем сессию при ошибке
    if (ctx.session) {
      ctx.session.state = null;
      ctx.session.data = {};
    }
  }
});

// Улучшенный обработчик ввода кастомной суммы
bot.on('text', async (ctx, next) => {
  try {
    // Проверяем наличие и валидность сессии
    if (!ctx.session || !ctx.session.state) {
      return next();
    }
    
    // Обрабатываем ввод суммы для депозита
    if (ctx.session.state === 'deposit_enter_amount') {
      const amount = parseFloat(ctx.message.text.trim());
      const currency = ctx.session.data.currency;
      
      // Проверка корректности введенной суммы
      if (isNaN(amount) || amount <= 0) {
        ctx.reply('Пожалуйста, введите корректную сумму (положительное число).');
        return;
      }
      
      // Проверка на слишком большую или слишком маленькую сумму
      if (amount < 1 || amount > 10000) {
        ctx.reply('Сумма должна быть между 1 и 10000 USD.');
        return;
      }
      
      const telegramId = ctx.from.id;
      
      // Устанавливаем состояние создания инвойса
      ctx.session.state = 'deposit_create_invoice';
      ctx.session.data.amount = amount;
      
      // Создаем счет через Crypto Pay API с таймаутом
      try {
        const invoice = await Promise.race([
          cryptoPayService.createInvoice(telegramId, amount, currency),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Таймаут создания счета')), API_TIMEOUT)
          )
        ]);
        
        // Сбрасываем состояние сессии после успешного создания счета
        ctx.session.state = null;
        ctx.session.data = {};
        
        // Отправляем сообщение со ссылкой на оплату
        await ctx.reply(`✅ Счет на оплату успешно создан!\n\nСумма: ${amount} ${currency}\n\nПерейдите по ссылке для оплаты:`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Оплатить', url: invoice.pay_url }]
            ]
          }
        });
      } catch (invoiceError) {
        console.error('Ошибка создания счета:', invoiceError);
        ctx.session.state = null;
        ctx.session.data = {};
        
        ctx.reply(`❌ Ошибка при создании счета: ${invoiceError.message}`);
      }
      
      return;
    }
    
    // Если ни один обработчик не сработал, передаем управление дальше
    return next();
  } catch (error) {
    console.error('Ошибка обработки ввода текста:', error);
    
    // Сбрасываем сессию при ошибке
    if (ctx.session) {
      ctx.session.state = null;
      ctx.session.data = {};
    }
    
    ctx.reply('Произошла ошибка при обработке ввода. Пожалуйста, начните заново.');
    return next();
  }
});

// Улучшенная команда для вывода средств
bot.command('withdraw', async (ctx) => {
  try {
    // Проверяем, есть ли активная сессия
    if (ctx.session && ctx.session.state) {
      ctx.reply('У вас уже есть активная операция. Пожалуйста, завершите её или используйте /cancel для отмены.');
      return;
    }
    
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) {
      return ctx.reply('Сначала зарегистрируйтесь с помощью команды /start');
    }

    // Проверка наличия средств
    if (user.usdtBalance <= 0) {
      return ctx.reply('У вас недостаточно средств для вывода. Пожалуйста, пополните баланс.');
    }

    // Инициализируем сессию для вывода
    ctx.session.state = 'withdraw_choose_currency';
    ctx.session.data = {};

    // Отображаем информацию о балансе и кнопки для выбора валюты
    ctx.reply(`💰 Ваш текущий баланс:\n\nUSDT: ${user.usdtBalance.toFixed(2)}\nРубли: ${user.rubleBalance.toFixed(2)}\nЗвезды: ${user.balance}\n\nВыберите валюту для вывода:`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'USDT TRC20', callback_data: 'withdraw_USDT_TRC20' },
            { text: 'USDT BEP20', callback_data: 'withdraw_USDT_BSC' }
          ],
          [
            { text: 'Биткоин (BTC)', callback_data: 'withdraw_BTC' },
            { text: 'Ethereum (ETH)', callback_data: 'withdraw_ETH' }
          ],
          [
            { text: 'TON', callback_data: 'withdraw_TON' },
            { text: 'BNB', callback_data: 'withdraw_BNB' }
          ],
          [
            { text: '❌ Отмена', callback_data: 'cancel_operation' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Ошибка команды withdraw:', error);
    ctx.reply('Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.');
  }
});

// Улучшенный обработчик колбэков для вывода
bot.action(/^withdraw_(.+)$/, async (ctx) => {
  try {
    // Проверяем валидность сессии
    if (!ctx.session || ctx.session.state !== 'withdraw_choose_currency') {
      return ctx.answerCbQuery('Сессия устарела или некорректна. Пожалуйста, начните заново.', true);
    }
    
    const currency = ctx.match[1]; // USDT_TRC20, BTC, ETH, и т.д.
    const telegramId = ctx.from.id;
    
    // Находим пользователя с таймаутом
    const user = await Promise.race([
      User.findOne({ telegramId }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Таймаут при поиске пользователя')), API_TIMEOUT)
      )
    ]);
    
    if (!user) {
      ctx.session.state = null;
      ctx.session.data = {};
      return ctx.answerCbQuery('Пользователь не найден или истек таймаут запроса. Пожалуйста, начните заново.', true);
    }
    
    // Сохраняем выбор валюты
    ctx.session.state = 'withdraw_enter_amount';
    ctx.session.data.currency = currency;
    
    // Проверяем доступный баланс для вывода
    let availableBalance = user.usdtBalance;
    
    // Проверяем минимальную сумму вывода для разных валют
    let minWithdrawal = 10; // По умолчанию 10 USDT
    
    if (currency === 'BTC') {
      minWithdrawal = 50; // Повышенный минимум для BTC
    } else if (currency === 'ETH') {
      minWithdrawal = 30; // Повышенный минимум для ETH
    }
    
    // Запрашиваем сумму для вывода
    await ctx.reply(`Вы выбрали вывод в ${currency}.\n\nДоступно для вывода: ${availableBalance.toFixed(2)} USDT\nМинимальная сумма: ${minWithdrawal} USDT\n\nВведите сумму для вывода:`, {
      reply_markup: {
        force_reply: true
      }
    });
    
    ctx.answerCbQuery();
  } catch (error) {
    console.error('Ошибка обработки withdraw callback:', error);
    ctx.answerCbQuery('Ошибка обработки запроса. Пожалуйста, попробуйте позже.', true);
    
    // Сбрасываем сессию при ошибке
    if (ctx.session) {
      ctx.session.state = null;
      ctx.session.data = {};
    }
  }
});

// Обработчик обмена валют и вывода средств
bot.on('text', async (ctx, next) => {
  try {
    // Проверяем для вывода средств
    if (ctx.session && ctx.session.state === 'withdraw_enter_amount') {
      const amount = parseFloat(ctx.message.text.trim());
      const currency = ctx.session.data.currency;
      
      // Проверка корректности введенной суммы
      if (isNaN(amount) || amount <= 0) {
        ctx.reply('Пожалуйста, введите корректную сумму (положительное число).');
        return;
      }
      
      const telegramId = ctx.from.id;
      
      // Находим пользователя
      const user = await User.findOne({ telegramId });
      if (!user) {
        ctx.session.state = null;
        ctx.session.data = {};
        ctx.reply('Пользователь не найден. Пожалуйста, начните заново.');
        return;
      }
      
      // Проверяем минимальную сумму вывода для разных валют
      let minWithdrawal = 10; // По умолчанию 10 USDT
      
      if (currency === 'BTC') {
        minWithdrawal = 50; // Повышенный минимум для BTC
      } else if (currency === 'ETH') {
        minWithdrawal = 30; // Повышенный минимум для ETH
      }
      
      if (amount < minWithdrawal) {
        ctx.reply(`Минимальная сумма для вывода в ${currency}: ${minWithdrawal} USDT. Пожалуйста, введите бóльшую сумму.`);
        return;
      }
      
      // Проверяем достаточность средств (с учетом комиссии)
      const fee = amount * 0.01; // 1% комиссия
      const totalAmount = amount + fee;
      
      if (user.usdtBalance < totalAmount) {
        ctx.reply(`❌ Недостаточно средств для вывода.\n\nДоступно: ${user.usdtBalance.toFixed(2)} USDT\nТребуется (с комиссией): ${totalAmount.toFixed(2)} USDT\nКомиссия (1%): ${fee.toFixed(2)} USDT`);
        return;
      }
      
      // Запрашиваем подтверждение вывода
      ctx.session.state = 'withdraw_confirm';
      ctx.session.data.amount = amount;
      ctx.session.data.fee = fee;
      ctx.session.data.totalAmount = totalAmount;
      
      await ctx.reply(`⚠️ Подтвердите вывод средств:\n\nВалюта: ${currency}\nСумма: ${amount} USDT\nКомиссия (1%): ${fee.toFixed(2)} USDT\nИтого к списанию: ${totalAmount.toFixed(2)} USDT\n\nВы уверены?`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Подтвердить', callback_data: 'withdraw_confirm_yes' },
              { text: '❌ Отменить', callback_data: 'withdraw_confirm_no' }
            ]
          ]
        }
      });
      return;
    }
    
    // Проверяем для обмена валют
    if (ctx.session && ctx.session.state === 'exchange_enter_amount') {
      const amount = parseFloat(ctx.message.text.trim());
      
      // Проверка корректности введенной суммы
      if (isNaN(amount) || amount <= 0) {
        ctx.reply('Пожалуйста, введите корректную сумму (положительное число).');
        return;
      }
      
      const { fromCurrency, toCurrency, rates } = ctx.session.data;
      const telegramId = ctx.from.id;
      
      // Находим пользователя с таймаутом
      const user = await Promise.race([
        User.findOne({ telegramId }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Таймаут при поиске пользователя')), API_TIMEOUT)
        )
      ]);
      
      if (!user) {
        ctx.session.state = null;
        ctx.session.data = {};
        ctx.reply('Пользователь не найден или истек таймаут запроса. Пожалуйста, начните заново.');
        return;
      }
      
      // Проверяем достаточность средств
      let fromBalance;
      if (fromCurrency === 'usdt') {
        fromBalance = user.usdtBalance;
      } else if (fromCurrency === 'rub') {
        fromBalance = user.rubleBalance;
      } else {
        fromBalance = user.balance; // stars
      }
      
      if (fromBalance < amount) {
        ctx.reply(`❌ Недостаточно средств для обмена.\n\nДоступно: ${fromBalance.toFixed(2)} ${fromCurrency.toUpperCase()}\nТребуется: ${amount.toFixed(2)} ${fromCurrency.toUpperCase()}`);
        return;
      }
      
      // Запрашиваем подтверждение обмена
      ctx.session.state = 'exchange_confirm';
      ctx.session.data.amount = amount;
      
      // Рассчитываем предварительный результат обмена
      let estimatedAmount;
      const { usdtToRub, usdtToStars } = rates;
      
      if (fromCurrency === 'usdt' && toCurrency === 'rub') {
        estimatedAmount = amount * usdtToRub;
      } else if (fromCurrency === 'usdt' && toCurrency === 'stars') {
        estimatedAmount = amount * usdtToStars;
      } else if (fromCurrency === 'rub' && toCurrency === 'usdt') {
        estimatedAmount = amount / usdtToRub;
      } else if (fromCurrency === 'rub' && toCurrency === 'stars') {
        estimatedAmount = amount * (usdtToStars / usdtToRub);
      } else if (fromCurrency === 'stars' && toCurrency === 'usdt') {
        estimatedAmount = amount / usdtToStars;
      } else if (fromCurrency === 'stars' && toCurrency === 'rub') {
        estimatedAmount = amount * (usdtToRub / usdtToStars);
      }
      
      ctx.session.data.estimatedAmount = estimatedAmount;
      
      // Формируем сообщение с подтверждением
      const currencySymbols = {
        usdt: 'USDT',
        rub: '₽',
        stars: '⭐'
      };
      
      await ctx.reply(
        `⚠️ Подтвердите обмен валют:\n\nИз: ${amount.toFixed(2)} ${currencySymbols[fromCurrency]}\nВ: ~${estimatedAmount.toFixed(2)} ${currencySymbols[toCurrency]}\n\nВы уверены?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Подтвердить', callback_data: 'exchange_confirm_yes' },
                { text: '❌ Отменить', callback_data: 'exchange_confirm_no' }
              ]
            ]
          }
        }
      );
      return;
    }
    
    // Если ни один обработчик не сработал, передаем управление дальше
    return next();
  } catch (error) {
    console.error('Ошибка обработки ввода текста:', error);
    ctx.reply('Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.');
    
    // Сбрасываем сессию при ошибке
    if (ctx.session) {
      ctx.session.state = null;
      ctx.session.data = {};
    }
    
    return next();
  }
});

// Обработчик подтверждения вывода
bot.action(/^withdraw_confirm_(yes|no)$/, async (ctx) => {
  try {
    // Проверяем валидность сессии
    if (!ctx.session || ctx.session.state !== 'withdraw_confirm') {
      return ctx.answerCbQuery('Сессия устарела или некорректна. Пожалуйста, начните заново.', true);
    }
    
    const confirmation = ctx.match[1];
    
    if (confirmation === 'no') {
      ctx.session.state = null;
      ctx.session.data = {};
      await ctx.reply('❌ Вывод средств отменен.');
      return ctx.answerCbQuery();
    }
    
    // Продолжаем с выводом средств
    const { currency, amount, fee, totalAmount } = ctx.session.data;
    const telegramId = ctx.from.id;
    
    // Пытаемся выполнить перевод с таймаутом
    try {
      await ctx.reply('⏳ Выполняется вывод средств, пожалуйста, подождите...');
      
      const transfer = await Promise.race([
        cryptoPayService.transfer(telegramId, amount, currency, 'Вывод средств'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Таймаут операции вывода')), API_TIMEOUT * 2) // Увеличиваем таймаут для операции вывода
        )
      ]);
      
      // Сбрасываем сессию после успешного вывода
      ctx.session.state = null;
      ctx.session.data = {};
      
      // Отправляем сообщение об успешном выводе
      await ctx.reply(`✅ Вывод средств успешно выполнен!\n\nСумма: ${amount} ${currency}\nКомиссия: ${fee.toFixed(2)} USDT\nИтого списано: ${totalAmount.toFixed(2)} USDT\n\nСредства будут зачислены в ближайшее время.`);
      
      ctx.answerCbQuery();
    } catch (transferError) {
      console.error('Ошибка перевода средств:', transferError);
      
      // Сбрасываем сессию при ошибке
      ctx.session.state = null;
      ctx.session.data = {};
      
      await ctx.reply(`❌ Ошибка при выводе средств: ${transferError.message}\n\nПожалуйста, попробуйте позже или свяжитесь с поддержкой.`);
      ctx.answerCbQuery('Ошибка при выводе средств', true);
    }
  } catch (error) {
    console.error('Ошибка обработки подтверждения вывода:', error);
    ctx.answerCbQuery('Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.', true);
    
    // Сбрасываем сессию при ошибке
    if (ctx.session) {
      ctx.session.state = null;
      ctx.session.data = {};
    }
  }
});

// Обработчик подтверждения обмена валют
bot.action(/^exchange_confirm_(yes|no)$/, async (ctx) => {
  try {
    // Проверяем валидность сессии
    if (!ctx.session || ctx.session.state !== 'exchange_confirm') {
      return ctx.answerCbQuery('Сессия устарела или некорректна. Пожалуйста, начните заново.', true);
    }
    
    const confirmation = ctx.match[1];
    
    if (confirmation === 'no') {
      ctx.session.state = null;
      ctx.session.data = {};
      await ctx.reply('❌ Обмен валют отменен.');
      return ctx.answerCbQuery();
    }
    
    // Продолжаем с обменом валют
    const { fromCurrency, toCurrency, amount, estimatedAmount } = ctx.session.data;
    const telegramId = ctx.from.id;
    
    // Пытаемся выполнить конвертацию с таймаутом
    try {
      await ctx.reply('⏳ Выполняется обмен валют, пожалуйста, подождите...');
      
      const user = await User.findOne({ telegramId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      const result = await Promise.race([
        user.convertCurrency(fromCurrency, toCurrency, amount),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Таймаут операции обмена')), API_TIMEOUT)
        )
      ]);
      
      // Сбрасываем сессию после успешного обмена
      ctx.session.state = null;
      ctx.session.data = {};
      
      // Отправляем сообщение об успешном обмене
      const currencySymbols = {
        usdt: 'USDT',
        rub: '₽',
        stars: '⭐'
      };
      
      await ctx.reply(
        `✅ Обмен успешно выполнен!\n\n${amount.toFixed(2)} ${currencySymbols[fromCurrency]} → ${result.toAmount.toFixed(2)} ${currencySymbols[toCurrency]}\n\nКурс: ${result.rate.toFixed(6)}\n\nТекущий баланс:\nUSDT: ${user.usdtBalance.toFixed(2)}\nРубли: ${user.rubleBalance.toFixed(2)}\nЗвезды: ${user.balance}`
      );
      
      ctx.answerCbQuery();
    } catch (exchangeError) {
      console.error('Ошибка обмена валют:', exchangeError);
      
      // Сбрасываем сессию при ошибке
      ctx.session.state = null;
      ctx.session.data = {};
      
      await ctx.reply(`❌ Ошибка при обмене валют: ${exchangeError.message}\n\nПожалуйста, попробуйте позже или свяжитесь с поддержкой.`);
      ctx.answerCbQuery('Ошибка при обмене валют', true);
    }
  } catch (error) {
    console.error('Ошибка обработки подтверждения обмена:', error);
    ctx.answerCbQuery('Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.', true);
    
    // Сбрасываем сессию при ошибке
    if (ctx.session) {
      ctx.session.state = null;
      ctx.session.data = {};
    }
  }
});

// Улучшенная команда для обмена валют
bot.command('exchange', async (ctx) => {
  try {
    // Проверяем, есть ли активная сессия
    if (ctx.session && ctx.session.state) {
      ctx.reply('У вас уже есть активная операция. Пожалуйста, завершите её или используйте /cancel для отмены.');
      return;
    }
    
    const user = await Promise.race([
      User.findOne({ telegramId: ctx.from.id }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Таймаут при поиске пользователя')), API_TIMEOUT)
      )
    ]);
    
    if (!user) {
      return ctx.reply('Ошибка поиска пользователя или истек таймаут запроса. Пожалуйста, попробуйте позже.');
    }

    // Получаем текущие курсы обмена
    const rates = await Promise.race([
      cryptoPayService.getExchangeRates(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Таймаут получения курсов обмена')), API_TIMEOUT)
      )
    ]);
    
    // Извлекаем курсы обмена
    const usdtToRub = rates?.rates?.rub || 90;
    const usdtToStars = rates?.rates?.stars || 100;
    const rubToStars = usdtToStars / usdtToRub;
    
    // Инициализируем сессию для обмена
    ctx.session.state = 'exchange_choose_direction';
    ctx.session.data = {
      rates: {
        usdtToRub,
        usdtToStars,
        rubToStars
      }
    };

    // Отображаем информацию о балансе и курсах
    ctx.reply(`💰 Ваш текущий баланс:\n\nUSDT: ${user.usdtBalance.toFixed(2)}\nРубли: ${user.rubleBalance.toFixed(2)}\nЗвезды: ${user.balance}\n\n📊 Текущие курсы:\n1 USDT = ${usdtToRub.toFixed(2)} ₽\n1 USDT = ${usdtToStars} ⭐\n1 ₽ = ${rubToStars.toFixed(2)} ⭐\n\nВыберите обмен:`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'USDT → Рубли', callback_data: 'exchange_usdt_rub' },
            { text: 'USDT → Звезды', callback_data: 'exchange_usdt_stars' }
          ],
          [
            { text: 'Рубли → USDT', callback_data: 'exchange_rub_usdt' },
            { text: 'Рубли → Звезды', callback_data: 'exchange_rub_stars' }
          ],
          [
            { text: 'Звезды → USDT', callback_data: 'exchange_stars_usdt' },
            { text: 'Звезды → Рубли', callback_data: 'exchange_stars_rub' }
          ],
          [
            { text: '❌ Отмена', callback_data: 'cancel_operation' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Ошибка команды exchange:', error);
    ctx.reply('Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.');
  }
});

// Улучшенный обработчик колбэков для обмена валют
bot.action(/^exchange_(.+)_(.+)$/, async (ctx) => {
  try {
    // Проверяем валидность сессии
    if (!ctx.session || ctx.session.state !== 'exchange_choose_direction') {
      return ctx.answerCbQuery('Сессия устарела или некорректна. Пожалуйста, начните заново.', true);
    }
    
    const [fromCurrency, toCurrency] = ctx.match.slice(1);
    const telegramId = ctx.from.id;
    
    // Находим пользователя с таймаутом
    const user = await Promise.race([
      User.findOne({ telegramId }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Таймаут при поиске пользователя')), API_TIMEOUT)
      )
    ]);
    
    if (!user) {
      ctx.session.state = null;
      ctx.session.data = {};
      return ctx.answerCbQuery('Пользователь не найден или истек таймаут запроса. Пожалуйста, начните заново.', true);
    }
    
    // Определяем доступный баланс
    let availableBalance;
    if (fromCurrency === 'usdt') {
      availableBalance = user.usdtBalance;
    } else if (fromCurrency === 'rub') {
      availableBalance = user.rubleBalance;
    } else {
      availableBalance = user.balance; // stars
    }
    
    // Проверяем наличие средств
    if (availableBalance <= 0) {
      ctx.session.state = null;
      ctx.session.data = {};
      return ctx.answerCbQuery(`У вас нет доступных средств в ${fromCurrency.toUpperCase()} для обмена`, true);
    }
    
    // Сохраняем данные обмена в сессии
    ctx.session.data.fromCurrency = fromCurrency;
    ctx.session.data.toCurrency = toCurrency;
    ctx.session.state = 'exchange_enter_amount';
    
    // Формируем сообщение с текущим курсом
    let rateMessage = '';
    const { usdtToRub, usdtToStars, rubToStars } = ctx.session.data.rates;
    
    if (fromCurrency === 'usdt' && toCurrency === 'rub') {
      rateMessage = `1 USDT = ${usdtToRub.toFixed(2)} ₽`;
    } else if (fromCurrency === 'usdt' && toCurrency === 'stars') {
      rateMessage = `1 USDT = ${usdtToStars} ⭐`;
    } else if (fromCurrency === 'rub' && toCurrency === 'usdt') {
      rateMessage = `${usdtToRub.toFixed(2)} ₽ = 1 USDT`;
    } else if (fromCurrency === 'rub' && toCurrency === 'stars') {
      rateMessage = `1 ₽ = ${rubToStars.toFixed(2)} ⭐`;
    } else if (fromCurrency === 'stars' && toCurrency === 'usdt') {
      rateMessage = `${usdtToStars} ⭐ = 1 USDT`;
    } else if (fromCurrency === 'stars' && toCurrency === 'rub') {
      const starsToRub = usdtToRub / usdtToStars;
      rateMessage = `1 ⭐ = ${starsToRub.toFixed(4)} ₽`;
    }
    
    // Формируем запрос на ввод суммы
    const currencySymbols = {
      usdt: 'USDT',
      rub: '₽',
      stars: '⭐'
    };
    
    await ctx.reply(
      `Вы выбрали обмен ${currencySymbols[fromCurrency]} → ${currencySymbols[toCurrency]}\n\nКурс: ${rateMessage}\n\nДоступно: ${availableBalance.toFixed(2)} ${currencySymbols[fromCurrency]}\n\nВведите сумму для обмена:`,
      {
        reply_markup: {
          force_reply: true
        }
      }
    );
    
    ctx.answerCbQuery();
  } catch (error) {
    console.error('Ошибка обработки exchange callback:', error);
    ctx.answerCbQuery('Ошибка обработки запроса. Пожалуйста, попробуйте позже.', true);
    
    // Сбрасываем сессию при ошибке
    if (ctx.session) {
      ctx.session.state = null;
      ctx.session.data = {};
    }
  }
});

// Улучшенная команда проверки баланса
bot.command('balance', async (ctx) => {
  try {
    const user = await Promise.race([
      User.findOne({ telegramId: ctx.from.id }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Таймаут при поиске пользователя')), API_TIMEOUT)
      )
    ]);
    
    if (!user) {
      return ctx.reply('Ошибка поиска пользователя или истек таймаут запроса. Пожалуйста, попробуйте позже.');
    }
    
    // Получаем текущие курсы обмена
    const rates = await Promise.race([
      cryptoPayService.getExchangeRates(),
      new Promise((resolve) => {
        setTimeout(() => resolve({
          base: 'usdt',
          rates: {
            usdt: 1,
            rub: 90,
            stars: 100
          }
        }), API_TIMEOUT);
      })
    ]);
    
    const usdtToRub = rates?.rates?.rub || 90;
    const usdtToStars = rates?.rates?.stars || 100;
    
    // Рассчитываем общий баланс в USDT
    const totalBalance = user.usdtBalance + 
                        (user.rubleBalance / usdtToRub) + 
                        (user.balance / usdtToStars);
    
    // Отправляем информацию о балансе с кнопками для пополнения и вывода
    await ctx.reply(
      `💰 *Ваш баланс:*\n\n`+
      `USDT: *${user.usdtBalance.toFixed(2)} USDT*\n`+
      `Рубли: *${user.rubleBalance.toFixed(2)} ₽*\n`+
      `Звезды: *${user.balance} ⭐*\n\n`+
      `Общий баланс (в USDT): *${totalBalance.toFixed(2)} USDT*\n\n`+
      `📊 *Текущие курсы:*\n`+
      `1 USDT = ${usdtToRub.toFixed(2)} ₽\n`+
      `1 USDT = ${usdtToStars} ⭐`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💰 Пополнить', callback_data: 'quick_deposit' },
              { text: '📤 Вывести', callback_data: 'quick_withdraw' }
            ],
            [
              { text: '🔄 Обменять валюту', callback_data: 'quick_exchange' }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Ошибка команды balance:', error);
    ctx.reply('Произошла ошибка при получении баланса. Пожалуйста, попробуйте позже.');
  }
});

// Обработчик быстрых действий с баланса
bot.action(/^quick_(deposit|withdraw|exchange)$/, async (ctx) => {
  try {
    const action = ctx.match[1];
    
    // Отменяем предыдущую сессию, если она есть
    if (ctx.session && ctx.session.state) {
      ctx.session.state = null;
      ctx.session.data = {};
    }
    
    // Запускаем соответствующую команду
    if (action === 'deposit') {
      await ctx.answerCbQuery();
      // Имитируем команду /deposit
      await ctx.reply('Запускаю процесс пополнения...');
      await bot.handleUpdate({
        update_id: ctx.update.update_id,
        message: {
          message_id: ctx.update.callback_query.message.message_id,
          from: ctx.from,
          chat: ctx.chat,
          date: Math.floor(Date.now() / 1000),
          text: '/deposit',
          entities: [{ type: 'bot_command', offset: 0, length: 8 }]
        }
      });
    } else if (action === 'withdraw') {
      await ctx.answerCbQuery();
      // Имитируем команду /withdraw
      await ctx.reply('Запускаю процесс вывода средств...');
      await bot.handleUpdate({
        update_id: ctx.update.update_id,
        message: {
          message_id: ctx.update.callback_query.message.message_id,
          from: ctx.from,
          chat: ctx.chat,
          date: Math.floor(Date.now() / 1000),
          text: '/withdraw',
          entities: [{ type: 'bot_command', offset: 0, length: 9 }]
        }
      });
    } else if (action === 'exchange') {
      await ctx.answerCbQuery();
      // Имитируем команду /exchange
      await ctx.reply('Запускаю процесс обмена валют...');
      await bot.handleUpdate({
        update_id: ctx.update.update_id,
        message: {
          message_id: ctx.update.callback_query.message.message_id,
          from: ctx.from,
          chat: ctx.chat,
          date: Math.floor(Date.now() / 1000),
          text: '/exchange',
          entities: [{ type: 'bot_command', offset: 0, length: 9 }]
        }
      });
    }
  } catch (error) {
    console.error('Ошибка обработки быстрого действия:', error);
    ctx.answerCbQuery('Ошибка при выполнении действия. Пожалуйста, попробуйте позже.', true);
  }
});

// Команда help с улучшенным описанием
bot.command('help', (ctx) => {
  ctx.reply(
    `📋 *Список доступных команд:*\n\n`+
    `🎮 /start - Начать игру в Greenlight Casino\n`+
    `💰 /deposit - Пополнить баланс\n`+
    `📤 /withdraw - Вывести средства\n`+
    `🔄 /exchange - Обменять валюту\n`+
    `💼 /balance - Проверить баланс и курсы\n`+
    `❌ /cancel - Отменить текущую операцию\n\n`+
    `*Для пополнения баланса* используйте команду /deposit и выберите удобную для вас криптовалюту.\n\n`+
    `*Для участия в спорах* используйте встроенный механизм в интерфейсе казино.\n\n`+
    `При возникновении проблем, пожалуйста, обратитесь к администратору.`,
    { parse_mode: 'Markdown' }
  );
});

// Обработчик неизвестных команд
bot.on('text', (ctx, next) => {
  // Проверяем, является ли сообщение командой
  if (ctx.message.text.startsWith('/')) {
    // Получаем команду без параметров
    const command = ctx.message.text.split(' ')[0];
    
    // Если эта команда не обрабатывается другими обработчиками
    ctx.reply(`Неизвестная команда: ${command}\n\nИспользуйте /help для получения списка доступных команд.`);
    return;
  }
  
  // Если это не команда, передаем управление дальше
  return next();
});

// Обработчик всех остальных сообщений
bot.on('message', (ctx) => {
  // Логируем неизвестное сообщение для отладки
  console.log('Получено необработанное сообщение от пользователя:', ctx.from.id, 'Тип:', ctx.updateType);
  
  // Проверяем, активна ли сессия
  if (ctx.session && ctx.session.state) {
    ctx.reply('Для продолжения текущей операции, пожалуйста, следуйте инструкциям выше или используйте /cancel для отмены.');
  } else {
    ctx.reply('Используйте /start для начала игры или /help для получения справки.');
  }
});
return bot;
};