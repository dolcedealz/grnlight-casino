const User = require('../models/User');
const Transaction = require('../models/Transaction');
const fetch = require('node-fetch');

// Конфигурация Crypto Pay API
const CRYPTO_PAY_API_TOKEN = process.env.CRYPTO_PAY_API_TOKEN;
const CRYPTO_PAY_API_URL = process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api';

// Создание новой инвойса для пополнения
exports.createInvoice = async (req, res) => {
  try {
    const { telegramId, amount, asset } = req.body;
    
    // Проверка обязательных параметров
    if (!telegramId || !amount || !asset) {
      return res.status(400).json({ message: 'Необходимо указать telegramId, amount и asset' });
    }
    
    // Проверка пользователя
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    // Минимальная сумма пополнения
    if (amount < 10) {
      return res.status(400).json({ message: 'Минимальная сумма пополнения - 10 звезд' });
    }
    
    // Создание уникального описания платежа
    const description = `Пополнение баланса Greenlight Casino: ${user.firstName} (ID: ${telegramId})`;
    
    // Запрос к Crypto Pay API для создания инвойса
    const apiUrl = `${CRYPTO_PAY_API_URL}/createInvoice`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        asset: asset, // e.g., 'TON', 'BTC', 'USDT', etc.
        amount: amount.toString(),
        description: description,
        hidden_message: `Payment for user ${telegramId}`,
        paid_btn_name: 'return',
        paid_btn_url: process.env.WEBAPP_URL || 'https://grnlight-casino.onrender.com',
        payload: JSON.stringify({ 
          type: 'deposit',
          userId: user._id.toString(),
          telegramId: telegramId,
          amount: amount
        })
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error('Ошибка создания инвойса:', data.error);
      return res.status(500).json({ message: 'Ошибка создания инвойса', error: data.error });
    }
    
    // Записываем информацию о создании инвойса
    console.log(`Создан инвойс на ${amount} ${asset} для пользователя ${telegramId}, инвойс ID: ${data.result.invoice_id}`);
    
    // Возвращаем данные инвойса клиенту
    res.status(200).json({
      success: true,
      invoice: data.result
    });
  } catch (error) {
    console.error('Ошибка создания инвойса:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// Проверка статуса инвойса
exports.checkInvoice = async (req, res) => {
  try {
    const { invoice_id } = req.params;
    
    if (!invoice_id) {
      return res.status(400).json({ message: 'Необходимо указать invoice_id' });
    }
    
    // Запрос к Crypto Pay API для проверки статуса инвойса
    const apiUrl = `${CRYPTO_PAY_API_URL}/getInvoice`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invoice_id: invoice_id
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      return res.status(500).json({ message: 'Ошибка проверки статуса инвойса', error: data.error });
    }
    
    // Если инвойс оплачен, обновляем баланс пользователя
    if (data.result.status === 'paid' && !data.result.processed) {
      try {
        // Парсим payload для получения данных о пользователе и сумме
        const payload = JSON.parse(data.result.payload);
        
        if (payload.type === 'deposit' && payload.telegramId) {
          // Находим пользователя
          const user = await User.findOne({ telegramId: payload.telegramId });
          
          if (user) {
            // Определяем сумму пополнения
            const depositAmount = Number(payload.amount);
            
            // Обновляем баланс пользователя
            user.balance += depositAmount;
            await user.save();
            
            // Создаем запись о транзакции
            const transaction = new Transaction({
              userId: user._id,
              telegramId: user.telegramId,
              amount: depositAmount,
              type: 'deposit',
              game: 'none',
              cryptoDetails: {
                invoiceId: data.result.invoice_id,
                asset: data.result.asset,
                amount: data.result.amount,
                status: data.result.status
              }
            });
            
            await transaction.save();
            
            // Отмечаем инвойс как обработанный
            await markInvoiceAsProcessed(data.result.invoice_id);
            
            console.log(`Баланс пользователя ${user.telegramId} пополнен на ${depositAmount} звезд`);
          }
        }
      } catch (processError) {
        console.error('Ошибка обработки оплаченного инвойса:', processError);
      }
    }
    
    res.status(200).json({
      success: true,
      invoice: data.result
    });
  } catch (error) {
    console.error('Ошибка проверки инвойса:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// Вебхук для получения уведомлений об оплате
exports.handleWebhook = async (req, res) => {
  try {
    const { update_type, invoice } = req.body;
    
    // Проверка типа обновления
    if (update_type !== 'invoice_paid') {
      return res.status(200).send('OK');
    }
    
    console.log('Получено уведомление об оплате инвойса:', invoice.invoice_id);
    
    // Проверяем, существует ли такой инвойс
    const apiUrl = `${CRYPTO_PAY_API_URL}/getInvoice`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invoice_id: invoice.invoice_id
      })
    });
    
    const data = await response.json();
    
    if (!data.ok || data.result.status !== 'paid') {
      console.error('Невозможно подтвердить оплату инвойса:', invoice.invoice_id);
      return res.status(200).send('OK');
    }
    
    // Если инвойс уже обработан, пропускаем
    if (data.result.processed) {
      return res.status(200).send('OK');
    }
    
    // Обрабатываем оплату
    try {
      // Парсим payload
      const payload = JSON.parse(data.result.payload);
      
      if (payload.type === 'deposit' && payload.telegramId) {
        // Находим пользователя
        const user = await User.findOne({ telegramId: payload.telegramId });
        
        if (user) {
          // Определяем сумму пополнения
          const depositAmount = Number(payload.amount);
          
          // Обновляем баланс пользователя
          user.balance += depositAmount;
          await user.save();
          
          // Создаем запись о транзакции
          const transaction = new Transaction({
            userId: user._id,
            telegramId: user.telegramId,
            amount: depositAmount,
            type: 'deposit',
            game: 'none',
            cryptoDetails: {
              invoiceId: data.result.invoice_id,
              asset: data.result.asset,
              amount: data.result.amount,
              status: data.result.status
            }
          });
          
          await transaction.save();
          
          // Отмечаем инвойс как обработанный
          await markInvoiceAsProcessed(data.result.invoice_id);
          
          console.log(`Баланс пользователя ${user.telegramId} пополнен на ${depositAmount} звезд`);
          
          // Отправляем уведомление пользователю через бота
          try {
            const botToken = process.env.CASINO_BOT_TOKEN;
            if (botToken) {
              await sendNotification(
                botToken,
                user.telegramId,
                `✅ Ваш баланс успешно пополнен на ${depositAmount} ⭐\n\nСпасибо за использование Greenlight Casino!`
              );
            }
          } catch (notifyError) {
            console.error('Ошибка отправки уведомления:', notifyError);
          }
        }
      }
    } catch (processError) {
      console.error('Ошибка обработки вебхука:', processError);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка обработки вебхука:', error);
    res.status(200).send('OK'); // В любом случае отвечаем 200, чтобы не получать повторные вебхуки
  }
};

// Получение доступных активов
exports.getAssets = async (req, res) => {
  try {
    // Запрос к Crypto Pay API для получения доступных активов
    const apiUrl = `${CRYPTO_PAY_API_URL}/getAssets`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      return res.status(500).json({ message: 'Ошибка получения доступных активов', error: data.error });
    }
    
    res.status(200).json({
      success: true,
      assets: data.result
    });
  } catch (error) {
    console.error('Ошибка получения активов:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
};

// Вспомогательная функция для отметки инвойса как обработанного
async function markInvoiceAsProcessed(invoice_id) {
  try {
    const apiUrl = `${CRYPTO_PAY_API_URL}/updateInvoice`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invoice_id: invoice_id,
        status: 'processed'
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error('Ошибка обновления статуса инвойса:', data.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка отметки инвойса как обработанного:', error);
    return false;
  }
}

// Вспомогательная функция для отправки уведомлений через Telegram Bot API
async function sendNotification(botToken, chatId, message) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error('Ошибка отправки уведомления:', data.description);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка отправки уведомления:', error);
    return false;
  }
}