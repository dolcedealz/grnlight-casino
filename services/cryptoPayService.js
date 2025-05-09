const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ExchangeRate = require('../models/ExchangeRate');

/**
 * Сервис для работы с Crypto Pay API
 */
class CryptoPayService {
  constructor() {
    this.API_KEY = process.env.CRYPTO_PAY_API_KEY;
    this.API_URL = 'https://pay.crypt.bot/api';
    this.WEBHOOK_SECRET = process.env.CRYPTO_PAY_WEBHOOK_SECRET;
    
    // Поддерживаемые валюты
    this.SUPPORTED_CURRENCIES = [
      'BTC', 'TON', 'ETH', 'USDT', 'USDC', 'BUSD', 
      'BNB', 'USDT_TRC20', 'USDT_BSC', 'TRX'
    ];
    
    // Соответствие валют Crypto Pay и нашей системы
    this.CURRENCY_MAPPING = {
      'USDT': 'usdt',
      'USDT_TRC20': 'usdt',
      'USDT_BSC': 'usdt',
      'BUSD': 'usdt',
      'USDC': 'usdt',
      'BTC': 'btc',
      'ETH': 'eth',
      'BNB': 'bnb',
      'TON': 'ton',
      'TRX': 'trx'
    };
    
    // Сеть для конвертации в рубли
    this.RUB_EXCHANGE_RATES = {};
    
    // Инициализация
    this.init();
  }
  
  /**
   * Инициализация сервиса
   */
  async init() {
    try {
      // Проверка подключения к API
      const appInfo = await this.getMe();
      console.log(`CryptoPay API инициализирован: ${appInfo.name}`);
      
      // Загрузка текущих курсов обмена
      await this.updateExchangeRates();
      
      // Обновление курсов каждый час
      setInterval(() => this.updateExchangeRates(), 60 * 60 * 1000);
    } catch (error) {
      console.error('Ошибка инициализации CryptoPay API:', error.message);
    }
  }
  
  /**
   * Базовый метод для выполнения API-запросов
   * @param {string} method - Метод API
   * @param {object} params - Параметры запроса
   * @returns {Promise<any>} - Результат запроса
   */
  async makeRequest(method, params = {}) {
    try {
      const url = `${this.API_URL}/${method}`;
      
      const response = await axios.post(url, params, {
        headers: {
          'Crypto-Pay-API-Token': this.API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.ok) {
        return response.data.result;
      } else {
        throw new Error(response.data?.error?.message || 'Неизвестная ошибка API');
      }
    } catch (error) {
      console.error(`Ошибка запроса к CryptoPay API (${method}):`, error.message);
      throw error;
    }
  }
  
  /**
   * Получение информации о приложении
   * @returns {Promise<any>}
   */
  async getMe() {
    return this.makeRequest('getMe');
  }
  
  /**
   * Получение и обновление курсов обмена
   * @returns {Promise<object>} - Курсы обмена
   */
  async updateExchangeRates() {
    try {
      // Получаем курсы из API
      const rates = await this.makeRequest('getExchangeRates');
      
      // Сохраняем USDT к рублю и другим валютам
      const exchangeRates = {
        base: 'usdt',
        rates: {
          usdt: 1,
          stars: 100 // По умолчанию 1 USDT = 100 звезд (можно настроить)
        },
        updatedAt: new Date()
      };
      
      // Находим курсы USDT к рублю
      const usdtToRubRate = rates.find(
        r => (r.source === 'USDT' || r.source === 'USDT_TRC20') && r.target === 'RUB'
      );
      
      if (usdtToRubRate) {
        exchangeRates.rates.rub = usdtToRubRate.rate;
        this.RUB_EXCHANGE_RATES['USDT'] = usdtToRubRate.rate;
      }
      
      // Сохраняем курсы других криптовалют к USDT
      rates.forEach(rate => {
        if (rate.target === 'USDT' || rate.target === 'USDT_TRC20') {
          this.RUB_EXCHANGE_RATES[rate.source] = rate.rate * (this.RUB_EXCHANGE_RATES['USDT'] || 90);
        }
      });
      
      // Сохраняем в базу данных
      await ExchangeRate.findOneAndUpdate(
        { base: 'usdt' },
        exchangeRates,
        { upsert: true, new: true }
      );
      
      console.log('Курсы обмена CryptoPay обновлены');
      return exchangeRates;
    } catch (error) {
      console.error('Ошибка обновления курсов обмена:', error.message);
      // Возвращаем последние сохраненные курсы
      return ExchangeRate.findOne({ base: 'usdt' }).sort({ updatedAt: -1 }).limit(1);
    }
  }
  
  /**
   * Создание счета на оплату
   * @param {number} telegramId - ID пользователя Telegram
   * @param {number} amount - Сумма к оплате
   * @param {string} currency - Валюта (BTC, TON, USDT_TRC20 и т.д.)
   * @param {string} description - Описание платежа
   * @returns {Promise<object>} - Созданный счет
   */
  async createInvoice(telegramId, amount, currency, description = 'Пополнение баланса') {
    try {
      // Проверка параметров
      if (!telegramId || !amount || !currency) {
        throw new Error('Не указаны обязательные параметры');
      }
      
      // Проверка поддерживаемой валюты
      if (!this.SUPPORTED_CURRENCIES.includes(currency)) {
        throw new Error(`Неподдерживаемая валюта: ${currency}`);
      }
      
      // Проверка пользователя
      const user = await User.findOne({ telegramId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      // Генерация уникального ID для отслеживания
      const externalId = `deposit_${telegramId}_${Date.now()}`;
      
      // Создание счета через API
      const invoice = await this.makeRequest('createInvoice', {
        asset: currency,
        amount: amount.toString(),
        description,
        paid_btn_name: 'viewApp',
        paid_btn_url: process.env.APP_URL || 'https://t.me/your_bot',
        payload: JSON.stringify({
          type: 'deposit',
          telegramId,
          externalId
        }),
        allow_comments: false,
        allow_anonymous: false
      });
      
      // Сохраняем информацию о счете в профиле пользователя
      const savedInvoice = user.addCryptoPayInvoice({
        invoice_id: invoice.invoice_id,
        amount: parseFloat(invoice.amount),
        currency: invoice.asset,
        status: invoice.status,
        created_at: Math.floor(Date.now() / 1000),
        description,
        external_id: externalId
      });
      
      // Сохраняем изменения пользователя
      await user.save();
      
      // Формируем данные для ответа
      return {
        success: true,
        invoiceId: invoice.invoice_id,
        amount: invoice.amount,
        currency: invoice.asset,
        status: invoice.status,
        payUrl: invoice.pay_url,
        externalId
      };
    } catch (error) {
      console.error('Ошибка создания счета:', error.message);
      throw error;
    }
  }
  
  /**
   * Проверка статуса счета
   * @param {string} invoiceId - ID счета
   * @returns {Promise<object>} - Информация о счете
   */
  async getInvoice(invoiceId) {
    try {
      // Получаем информацию о счете
      const invoices = await this.makeRequest('getInvoices', {
        invoice_ids: invoiceId
      });
      
      if (!invoices || !invoices.length) {
        throw new Error('Счет не найден');
      }
      
      return invoices[0];
    } catch (error) {
      console.error('Ошибка получения информации о счете:', error.message);
      throw error;
    }
  }
  
  /**
   * Перевод средств пользователю
   * @param {number} telegramId - ID пользователя Telegram
   * @param {number} amount - Сумма перевода
   * @param {string} currency - Валюта (BTC, TON, USDT_TRC20 и т.д.)
   * @param {string} comment - Комментарий к переводу
   * @returns {Promise<object>} - Результат перевода
   */
  async transfer(telegramId, amount, currency, comment = 'Вывод средств') {
    try {
      // Проверка параметров
      if (!telegramId || !amount || !currency) {
        throw new Error('Не указаны обязательные параметры');
      }
      
      // Проверка поддерживаемой валюты
      if (!this.SUPPORTED_CURRENCIES.includes(currency)) {
        throw new Error(`Неподдерживаемая валюта: ${currency}`);
      }
      
      // Проверка пользователя
      const user = await User.findOne({ telegramId });
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      // Проверка баланса
      // Определяем, какую валюту нужно списать
      const internalCurrency = this.CURRENCY_MAPPING[currency] || 'usdt';
      let userBalance;
      
      if (internalCurrency === 'usdt') {
        userBalance = user.usdtBalance;
      } else if (internalCurrency === 'rub') {
        userBalance = user.rubleBalance;
      } else {
        // Для других криптовалют можно добавить проверку, если необходимо
        throw new Error('Неподдерживаемая валюта для вывода');
      }
      
      // Проверка достаточности средств (с учетом комиссии)
      const fee = 0.01; // 1% комиссия
      const totalAmount = amount * (1 + fee);
      
      if (userBalance < totalAmount) {
        throw new Error('Недостаточно средств для вывода');
      }
      
      // Выполняем перевод через API
      const transfer = await this.makeRequest('transfer', {
        user_id: telegramId,
        asset: currency,
        amount: amount.toString(),
        spend_id: `withdrawal_${telegramId}_${Date.now()}`,
        comment
      });
      
      // Уменьшаем баланс пользователя (включая комиссию)
      await user.withdrawFunds(totalAmount, internalCurrency);
      
      // Сохраняем информацию о переводе
      const savedTransfer = user.addCryptoPayTransfer({
        transfer_id: transfer.transfer_id,
        user_id: telegramId,
        amount: parseFloat(transfer.amount),
        currency: transfer.asset,
        status: transfer.status,
        created_at: Math.floor(Date.now() / 1000),
        comment
      });
      
      // Сохраняем изменения пользователя
      await user.save();
      
      // Создаем запись в транзакциях
      const transaction = new Transaction({
        userId: user._id,
        telegramId,
        amount: -totalAmount,
        type: 'withdrawal',
        currency: internalCurrency,
        paymentMethod: 'crypto',
        paymentDetails: {
          transferId: transfer.transfer_id,
          currency,
          fee: amount * fee
        },
        status: 'completed'
      });
      
      await transaction.save();
      
      // Возвращаем результат
      return {
        success: true,
        transferId: transfer.transfer_id,
        amount,
        fee: amount * fee,
        total: totalAmount,
        currency,
        status: transfer.status
      };
    } catch (error) {
      console.error('Ошибка перевода средств:', error.message);
      throw error;
    }
  }
  
  /**
   * Обработка уведомления о платеже (webhook)
   * @param {object} updateData - Данные уведомления
   * @param {string} signature - Подпись запроса
   * @returns {Promise<object>} - Результат обработки
   */
  async handleUpdate(updateData, signature) {
    try {
      // Проверка подписи для безопасности
      if (!this.verifySignature(updateData, signature)) {
        throw new Error('Неверная подпись запроса');
      }
      
      // Обработка обновления в зависимости от типа
      const update = updateData.update;
      
      if (update.type === 'invoice') {
        return this.handleInvoiceUpdate(update.invoice);
      } else if (update.type === 'transfer') {
        return this.handleTransferUpdate(update.transfer);
      } else {
        throw new Error(`Неизвестный тип обновления: ${update.type}`);
      }
    } catch (error) {
      console.error('Ошибка обработки уведомления:', error.message);
      throw error;
    }
  }
  
  /**
   * Проверка подписи запроса
   * @param {object} data - Данные запроса
   * @param {string} signature - Подпись
   * @returns {boolean} - Результат проверки
   */
  verifySignature(data, signature) {
    try {
      if (!this.WEBHOOK_SECRET) {
        console.warn('CRYPTO_PAY_WEBHOOK_SECRET не установлен, проверка подписи отключена');
        return true;
      }
      
      const message = JSON.stringify(data);
      const hmac = crypto.createHmac('sha256', this.WEBHOOK_SECRET);
      const calculatedSignature = hmac.update(message).digest('hex');
      
      return calculatedSignature === signature;
    } catch (error) {
      console.error('Ошибка проверки подписи:', error.message);
      return false;
    }
  }
  
  /**
   * Обработка обновления статуса счета
   * @param {object} invoice - Данные счета
   * @returns {Promise<object>} - Результат обработки
   */
  async handleInvoiceUpdate(invoice) {
    try {
      // Получаем payload из счета
      let payload = {};
      try {
        payload = JSON.parse(invoice.payload || '{}');
      } catch (e) {
        console.error('Ошибка парсинга payload:', e.message);
      }
      
      const telegramId = payload.telegramId;
      if (!telegramId) {
        throw new Error('ID пользователя не указан в payload');
      }
      
      // Находим пользователя
      const user = await User.findOne({ telegramId });
      if (!user) {
        throw new Error(`Пользователь не найден: ${telegramId}`);
      }
      
      // Обновляем статус счета в профиле пользователя
      const updatedInvoice = user.updateCryptoPayInvoice(
        invoice.invoice_id,
        invoice.status,
        invoice.paid_at
      );
      
      // Если счет оплачен, пополняем баланс
      if (invoice.status === 'paid' && ['active', 'expired'].includes(updatedInvoice.status)) {
        // Определяем внутреннюю валюту для пополнения
        const internalCurrency = this.CURRENCY_MAPPING[invoice.asset] || 'usdt';
        
        // Конвертируем сумму в соответствующую валюту (если необходимо)
        let amount = parseFloat(invoice.amount);
        
        // Пополняем баланс пользователя
        await user.addFunds(amount, internalCurrency);
        
        // Обновляем статус счета
        updatedInvoice.status = 'paid';
        
        // Создаем запись в транзакциях
        const transaction = new Transaction({
          userId: user._id,
          telegramId,
          amount,
          type: 'deposit',
          currency: internalCurrency,
          paymentMethod: 'crypto',
          paymentDetails: {
            invoiceId: invoice.invoice_id,
            currency: invoice.asset,
            rate: 1 // Если была конвертация, здесь будет курс
          },
          status: 'completed'
        });
        
        await transaction.save();
      }
      
      // Сохраняем изменения пользователя
      await user.save();
      
      // Отправляем уведомление пользователю (если включено)
      if (invoice.status === 'paid' && user.notifications.depositSuccess) {
        await this.sendDepositNotification(user, parseFloat(invoice.amount), invoice.asset);
      }
      
      return {
        success: true,
        telegramId,
        invoiceId: invoice.invoice_id,
        status: invoice.status
      };
    } catch (error) {
      console.error('Ошибка обработки обновления счета:', error.message);
      throw error;
    }
  }
  
  /**
   * Обработка обновления статуса перевода
   * @param {object} transfer - Данные перевода
   * @returns {Promise<object>} - Результат обработки
   */
  async handleTransferUpdate(transfer) {
    try {
      // Находим пользователя по ID получателя
      const user = await User.findOne({ telegramId: transfer.user_id });
      if (!user) {
        throw new Error(`Пользователь не найден: ${transfer.user_id}`);
      }
      
      // Обновляем статус перевода в профиле пользователя
      const transferInUser = user.cryptoPay?.transfers?.find(
        t => t.transferId === transfer.transfer_id
      );
      
      if (transferInUser) {
        transferInUser.status = transfer.status;
        if (transfer.completed_at) {
          transferInUser.completedAt = new Date(transfer.completed_at * 1000);
        }
      } else {
        // Если перевод не найден, добавляем его
        user.addCryptoPayTransfer({
          transfer_id: transfer.transfer_id,
          user_id: transfer.user_id,
          amount: parseFloat(transfer.amount),
          currency: transfer.asset,
          status: transfer.status,
          created_at: Math.floor(Date.now() / 1000),
          comment: transfer.comment
        });
      }
      
      // Сохраняем изменения пользователя
      await user.save();
      
      // Если перевод успешно выполнен, отправляем уведомление
      if (transfer.status === 'confirmed' && user.notifications.withdrawalSuccess) {
        await this.sendWithdrawalNotification(user, parseFloat(transfer.amount), transfer.asset);
      }
      
      return {
        success: true,
        telegramId: transfer.user_id,
        transferId: transfer.transfer_id,
        status: transfer.status
      };
    } catch (error) {
      console.error('Ошибка обработки обновления перевода:', error.message);
      throw error;
    }
  }
  
  /**
   * Отправка уведомления о пополнении
   * @param {object} user - Пользователь
   * @param {number} amount - Сумма
   * @param {string} currency - Валюта
   * @returns {Promise<void>}
   */
  async sendDepositNotification(user, amount, currency) {
    try {
      // Проверка бота и пользователя
      if (!global.bot || !user.telegramId) return;
      
      const message = `💰 *Счет успешно оплачен!*\n\n`
        + `Ваш баланс пополнен на *${amount} ${currency}*\n\n`
        + `Текущий баланс:\n`
        + `USDT: ${user.usdtBalance.toFixed(2)}\n`
        + `Рубли: ${user.rubleBalance.toFixed(2)}\n`
        + `Звезды: ${user.balance}`;
      
      await global.bot.telegram.sendMessage(user.telegramId, message, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('Ошибка отправки уведомления о пополнении:', error.message);
    }
  }
  
  /**
   * Отправка уведомления о выводе
   * @param {object} user - Пользователь
   * @param {number} amount - Сумма
   * @param {string} currency - Валюта
   * @returns {Promise<void>}
   */
  async sendWithdrawalNotification(user, amount, currency) {
    try {
      // Проверка бота и пользователя
      if (!global.bot || !user.telegramId) return;
      
      const message = `✅ *Вывод средств успешно выполнен!*\n\n`
        + `Сумма: *${amount} ${currency}*\n\n`
        + `Текущий баланс:\n`
        + `USDT: ${user.usdtBalance.toFixed(2)}\n`
        + `Рубли: ${user.rubleBalance.toFixed(2)}\n`
        + `Звезды: ${user.balance}`;
      
      await global.bot.telegram.sendMessage(user.telegramId, message, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('Ошибка отправки уведомления о выводе:', error.message);
    }
  }
}

module.exports = new CryptoPayService();