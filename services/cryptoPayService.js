const fetch = require('node-fetch');
const ExchangeRate = require('../models/ExchangeRate');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Конфигурация Crypto Pay API
const CRYPTO_PAY_API_TOKEN = process.env.CRYPTO_PAY_API_TOKEN;
const CRYPTO_PAY_API_URL = process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://grnlight-casino.onrender.com';

// Вывод отладочной информации о конфигурации
console.log('Используется CRYPTO_PAY_API_URL:', CRYPTO_PAY_API_URL);
console.log('Используется CRYPTO_PAY_API_TOKEN:', CRYPTO_PAY_API_TOKEN ? 
  CRYPTO_PAY_API_TOKEN.substring(0, 5) + '...' : 'не задан');

/**
 * Нормализация имени актива для API
 * @param {string} asset - Имя актива, возможно с суффиксом сети
 * @returns {string} - Нормализованное имя актива
 */
function normalizeAssetName(asset) {
  // Список поддерживаемых активов
  const supportedAssets = [
    'USDT', 'TON', 'SOL', 'TRX', 'GRAM', 'BTC', 'ETH', 
    'DOGE', 'LTC', 'NOT', 'TRUMP', 'MELANIA', 'PEPE', 
    'WIF', 'BONK', 'MAJOR', 'MY', 'DOGS', 'MEMHASH', 
    'BNB', 'HMSTR', 'CATI', 'USDC'
  ];
  
  // Если актив содержит подчеркивание, берем только часть до него
  if (asset.includes('_')) {
    const baseName = asset.split('_')[0];
    if (supportedAssets.includes(baseName)) {
      return baseName;
    }
  }
  
  // Проверяем, есть ли актив в списке поддерживаемых
  if (supportedAssets.includes(asset)) {
    return asset;
  }
  
  // Проверяем, есть ли актив в списке в верхнем регистре
  const upperAsset = asset.toUpperCase();
  if (supportedAssets.includes(upperAsset)) {
    return upperAsset;
  }
  
  // По умолчанию возвращаем USDT, если актив неизвестен
  console.warn(`Неизвестный актив: ${asset}, используем USDT`);
  return 'USDT';
}

/**
 * Функция проверки доступности API
 * @returns {Promise<Object>} - Результат проверки
 */
exports.testApiConnection = async () => {
  try {
    console.log('Тестирование соединения с Crypto Pay API...');
    
    // Запрос списка доступных активов как самый простой способ проверки
    const response = await fetch(`${CRYPTO_PAY_API_URL}/getAssets`, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error('Ошибка при тестировании API:', data);
      return {
        success: false,
        error: data.error
      };
    }
    
    console.log('Соединение с Crypto Pay API успешно установлено!');
    console.log('Доступные активы:', data.result.map(asset => asset.currency).join(', '));
    return {
      success: true,
      assets: data.result
    };
  } catch (error) {
    console.error('Ошибка при тестировании соединения с API:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Создание счета на оплату
 * @param {string} telegramId - ID пользователя в Telegram
 * @param {number} amount - Сумма счета
 * @param {string} currency - Валюта (USDT, BTC, TON, и т.д.)
 * @param {string} description - Описание платежа
 * @returns {Promise<Object>} - Данные созданного счета
 */
exports.createInvoice = async (telegramId, amount, currency, description = '') => {
  try {
    // Проверка пользователя
    const user = await User.findOne({ telegramId });
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Создание описания платежа, если не указано
    if (!description) {
      description = `Пополнение баланса Greenlight Casino: ${user.firstName} (ID: ${telegramId})`;
    }
    
    // Нормализуем валюту
    const normalizedAsset = normalizeAssetName(currency);
    if (normalizedAsset !== currency) {
      console.log(`Валюта нормализована: ${currency} -> ${normalizedAsset}`);
    }
    
    // Формирование данных для запроса
    const payload = JSON.stringify({ 
      type: 'deposit',
      userId: user._id.toString(),
      telegramId: telegramId,
      amount: amount
    });
    
    // Создание данных для запроса
    const requestBody = {
      asset: normalizedAsset,
      amount: amount.toString(),
      description: description,
      hidden_message: `Payment for user ${telegramId}`,
      paid_btn_name: 'return',
      paid_btn_url: WEBAPP_URL,
      payload: payload
    };
    
    console.log('Отправляемые данные в Crypto Pay API:', requestBody);
    
    // Создание инвойса через API
    const response = await fetch(`${CRYPTO_PAY_API_URL}/createInvoice`, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    console.log('Ответ от Crypto Pay API:', data);
    
    if (!data.ok) {
      console.error('Ошибка от Crypto Pay API:', data);
      // Корректно обрабатываем объект ошибки
      const errorMessage = typeof data.error === 'object' ? 
        JSON.stringify(data.error) : data.error;
      throw new Error(`Ошибка API: ${errorMessage}`);
    }
    
    // Сохраняем информацию о счете в профиле пользователя
    user.addCryptoPayInvoice(data.result);
    await user.save();
    
    console.log(`Создан счет на оплату: ID ${data.result.invoice_id}, ${amount} ${normalizedAsset} для пользователя ${telegramId}`);
    
    return data.result;
  } catch (error) {
    console.error('Ошибка создания счета:', error);
    throw error;
  }
};

/**
 * Получение информации о счете
 * @param {string} invoiceId - ID счета
 * @returns {Promise<Object>} - Данные счета
 */
exports.getInvoice = async (invoiceId) => {
  try {
    const response = await fetch(`${CRYPTO_PAY_API_URL}/getInvoice`, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invoice_id: invoiceId
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Ошибка API: ${data.error}`);
    }
    
    return data.result;
  } catch (error) {
    console.error('Ошибка получения информации о счете:', error);
    throw error;
  }
};

/**
 * Обработка webhook-уведомлений от Crypto Pay
 * @param {Object} update - Данные обновления
 * @param {string} signature - Подпись для верификации
 * @returns {Promise<Object>} - Результат обработки
 */
exports.handleUpdate = async (update, signature) => {
  try {
    // Проверяем подпись, если предоставлена
    // TODO: Реализовать проверку подписи
    
    // Обрабатываем только уведомления о платежах
    if (update.update_type !== 'invoice_paid') {
      return { status: 'skipped', reason: 'not_invoice_paid' };
    }
    
    const invoice = update.payload;
    
    // Проверяем, существует ли инвойс
    const invoiceData = await this.getInvoice(invoice.invoice_id);
    
    // Если инвойс уже обработан, пропускаем
    if (invoiceData.paid && invoiceData.processed) {
      return { status: 'skipped', reason: 'already_processed' };
    }
    
    // Если инвойс оплачен, но не обработан
    if (invoiceData.paid && !invoiceData.processed) {
      // Парсим payload инвойса
      const payload = JSON.parse(invoiceData.payload || '{}');
      
      if (payload.type === 'deposit' && payload.telegramId) {
        // Находим пользователя
        const user = await User.findOne({ telegramId: payload.telegramId });
        
        if (!user) {
          throw new Error(`Пользователь с ID ${payload.telegramId} не найден`);
        }
        
        // Определяем валюту и сумму
        let currency = 'stars'; // По умолчанию звезды
        let amount = parseFloat(payload.amount);
        
        // Если валюта не звезды, производим конвертацию
        if (invoiceData.asset !== 'STARS') {
          // Получаем курсы обмена
          const rates = await this.getExchangeRates();
          
          // Конвертируем в USDT
          if (invoiceData.asset === 'USDT' || invoiceData.asset === 'USDT_TRC20' || invoiceData.asset === 'USDT_BEP20') {
            // Если это USDT, просто добавляем на USDT баланс
            currency = 'usdt';
          } else if (invoiceData.asset === 'TON' || invoiceData.asset === 'BTC' || invoiceData.asset === 'ETH') {
            // Конвертируем в USDT через курсы
            const assetRate = rates.rates[invoiceData.asset.toLowerCase()] || 1;
            amount = amount * assetRate;
            currency = 'usdt';
          }
        }
        
        // Добавляем средства на баланс пользователя
        await user.addFunds(amount, currency);
        
        // Создаем запись о транзакции
        const transaction = new Transaction({
          userId: user._id,
          telegramId: user.telegramId,
          amount: amount,
          type: 'deposit',
          game: 'none',
          cryptoDetails: {
            invoiceId: invoiceData.invoice_id,
            asset: invoiceData.asset,
            amount: invoiceData.amount,
            status: 'paid'
          }
        });
        
        await transaction.save();
        
        // Отмечаем инвойс как обработанный
        await this.markInvoiceAsProcessed(invoice.invoice_id);
        
        console.log(`Баланс пользователя ${user.telegramId} пополнен: ${amount} ${currency}`);
        
        // Отправляем уведомление пользователю
        await this.sendNotification(user.telegramId, 
          `✅ Ваш баланс успешно пополнен!\n\n${amount} ${getCurrencySymbol(currency)}\n\nСпасибо за использование Greenlight Casino!`
        );
        
        return { 
          status: 'success', 
          user: user.telegramId, 
          amount: amount, 
          currency: currency 
        };
      }
    }
    
    return { status: 'skipped', reason: 'unknown' };
  } catch (error) {
    console.error('Ошибка обработки webhook:', error);
    throw error;
  }
};

/**
 * Отметка инвойса как обработанного
 * @param {string} invoiceId - ID инвойса
 * @returns {Promise<boolean>} - Результат операции
 */
exports.markInvoiceAsProcessed = async (invoiceId) => {
  try {
    const response = await fetch(`${CRYPTO_PAY_API_URL}/updateInvoice`, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invoice_id: invoiceId,
        status: 'processed'
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Ошибка API: ${data.error}`);
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка отметки инвойса как обработанного:', error);
    return false;
  }
};

/**
 * Выполнение перевода средств пользователю
 * @param {string} telegramId - ID пользователя в Telegram
 * @param {number} amount - Сумма перевода
 * @param {string} currency - Валюта (USDT, BTC, TON, и т.д.)
 * @param {string} comment - Комментарий к переводу
 * @returns {Promise<Object>} - Результат перевода
 */
exports.transfer = async (telegramId, amount, currency, comment = '') => {
  try {
    // Проверка пользователя
    const user = await User.findOne({ telegramId });
    if (!user) {
      throw new Error('Пользователь не найден');
    }
    
    // Нормализуем валюту
    const normalizedAsset = normalizeAssetName(currency);
    if (normalizedAsset !== currency) {
      console.log(`Валюта нормализована: ${currency} -> ${normalizedAsset}`);
    }
    
    // Проверка баланса пользователя
    let userBalance = 0;
    let withdrawCurrency = '';
    
    if (normalizedAsset === 'USDT') {
      userBalance = user.usdtBalance;
      withdrawCurrency = 'usdt';
    } else if (['TON', 'BTC', 'ETH', 'BNB'].includes(normalizedAsset)) {
      // Для криптовалют другого типа проверяем USDT баланс
      // и конвертируем по текущему курсу
      userBalance = user.usdtBalance;
      withdrawCurrency = 'usdt';
      
      // Получаем курсы обмена
      const rates = await this.getExchangeRates();
      const assetRate = rates.rates[normalizedAsset.toLowerCase()] || 1;
      
      // Рассчитываем, сколько USDT нужно для вывода
      amount = amount / assetRate;
    } else {
      throw new Error(`Неподдерживаемая валюта для вывода: ${normalizedAsset}`);
    }
    
    // Определяем комиссию (например, 1%)
    const fee = amount * 0.01;
    const totalAmount = amount + fee;
    
    // Проверяем достаточность средств
    if (userBalance < totalAmount) {
      throw new Error(`Недостаточно средств для вывода. Доступно: ${userBalance} ${withdrawCurrency.toUpperCase()}, требуется (с комиссией): ${totalAmount} ${withdrawCurrency.toUpperCase()}`);
    }
    
    // Списываем средства с баланса пользователя
    await user.withdrawFunds(totalAmount, withdrawCurrency);
    
    // Запрос на перевод средств
    const response = await fetch(`${CRYPTO_PAY_API_URL}/transfer`, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: telegramId,
        asset: normalizedAsset,
        amount: amount.toString(),
        spend_id: `withdraw_${Date.now()}_${telegramId}`,
        comment: comment || 'Вывод средств из Greenlight Casino'
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      // В случае ошибки, возвращаем средства пользователю
      await user.addFunds(totalAmount, withdrawCurrency);
      throw new Error(`Ошибка API: ${data.error}`);
    }
    
    // Сохраняем информацию о переводе
    user.addCryptoPayTransfer(data.result);
    await user.save();
    
    // Создаем запись о транзакции
    const transaction = new Transaction({
      userId: user._id,
      telegramId: user.telegramId,
      amount: -amount, // Отрицательная сумма для вывода
      type: 'withdrawal',
      game: 'none',
      cryptoDetails: {
        transferId: data.result.transfer_id,
        asset: normalizedAsset,
        amount: amount.toString(),
        status: 'completed'
      }
    });
    
    await transaction.save();
    
    // Создаем отдельную запись для комиссии
    const feeTransaction = new Transaction({
      userId: user._id,
      telegramId: user.telegramId,
      amount: -fee, // Отрицательная сумма для комиссии
      type: 'withdrawal',
      game: 'none',
      cryptoDetails: {
        transferId: data.result.transfer_id,
        asset: normalizedAsset,
        amount: fee.toString(),
        status: 'fee'
      }
    });
    
    await feeTransaction.save();
    
    console.log(`Выполнен вывод средств для пользователя ${telegramId}: ${amount} ${normalizedAsset}, комиссия: ${fee} ${withdrawCurrency.toUpperCase()}`);
    
    // Отправляем уведомление пользователю
    await this.sendNotification(telegramId, 
      `✅ Вывод средств успешно выполнен!\n\n` +
      `Сумма: ${amount} ${normalizedAsset}\n` +
      `Комиссия: ${fee} ${withdrawCurrency.toUpperCase()}\n` +
      `Итого списано: ${totalAmount} ${withdrawCurrency.toUpperCase()}\n\n` +
      `Спасибо за использование Greenlight Casino!`
    );
    
    return {
      success: true,
      transferId: data.result.transfer_id,
      amount: amount,
      fee: fee,
      total: totalAmount,
      currency: normalizedAsset
    };
  } catch (error) {
    console.error('Ошибка перевода средств:', error);
    throw error;
  }
};

/**
 * Обновление и получение курсов обмена
 * @returns {Promise<Object>} - Актуальные курсы обмена
 */
exports.updateExchangeRates = async () => {
  try {
    // Проверяем, есть ли актуальные курсы в базе
    const latestRates = await ExchangeRate.findOne({ base: 'usdt' })
      .sort({ updatedAt: -1 })
      .limit(1);
    
    // Если курсы были обновлены менее часа назад, возвращаем их
    if (latestRates && 
        (new Date() - new Date(latestRates.updatedAt)) < 3600000) {
      return latestRates;
    }
    
    // Запрашиваем доступные активы из Crypto Pay API
    const response = await fetch(`${CRYPTO_PAY_API_URL}/getExchangeRates`, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Ошибка API: ${data.error}`);
    }
    
    // Преобразуем полученные курсы в нужный формат
    const rates = {
      usdt: 1, // Базовая валюта
      rub: 90, // Устанавливаем дефолтное значение
      stars: 100 // Устанавливаем дефолтное значение
    };
    
    // Обрабатываем курсы из API
    data.result.forEach(rate => {
      if (rate.source === 'USDT') {
        const target = rate.target.toLowerCase();
        
        if (target === 'rub') {
          rates.rub = parseFloat(rate.rate);
        } else if (['btc', 'ton', 'eth', 'bnb'].includes(target)) {
          rates[target] = parseFloat(rate.rate);
        }
      }
    });
    
    // Сохраняем новые курсы в базу
    const exchangeRate = new ExchangeRate({
      base: 'usdt',
      rates: rates,
      updatedAt: new Date()
    });
    
    await exchangeRate.save();
    
    console.log('Курсы обмена обновлены:', rates);
    
    return exchangeRate;
  } catch (error) {
    console.error('Ошибка обновления курсов обмена:', error);
    
    // В случае ошибки, возвращаем дефолтные курсы
    return {
      base: 'usdt',
      rates: {
        usdt: 1,
        rub: 90,
        stars: 100,
        btc: 0.000033,
        ton: 0.2,
        eth: 0.0004,
        bnb: 0.004
      },
      updatedAt: new Date()
    };
  }
};

/**
 * Получение курсов обмена
 * @returns {Promise<Object>} - Актуальные курсы обмена
 */
exports.getExchangeRates = async () => {
  try {
    return await this.updateExchangeRates();
  } catch (error) {
    console.error('Ошибка получения курсов обмена:', error);
    throw error;
  }
};

/**
 * Отправка уведомления пользователю через Telegram бот
 * @param {string} telegramId - ID пользователя в Telegram
 * @param {string} message - Текст уведомления
 * @returns {Promise<boolean>} - Результат отправки
 */
exports.sendNotification = async (telegramId, message) => {
  try {
    const botToken = process.env.CASINO_BOT_TOKEN;
    
    if (!botToken) {
      console.error('Не указан токен бота для отправки уведомлений');
      return false;
    }
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Ошибка API Telegram: ${data.description}`);
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка отправки уведомления:', error);
    return false;
  }
};

/**
 * Получение символа валюты
 * @param {string} currency - Код валюты
 * @returns {string} - Символ валюты
 */
function getCurrencySymbol(currency) {
  switch (currency.toLowerCase()) {
    case 'usdt':
      return 'USDT';
    case 'rub':
      return '₽';
    case 'stars':
      return '⭐';
    case 'btc':
      return 'BTC';
    case 'ton':
      return 'TON';
    case 'eth':
      return 'ETH';
    case 'bnb':
      return 'BNB';
    default:
      return currency.toUpperCase();
  }
}