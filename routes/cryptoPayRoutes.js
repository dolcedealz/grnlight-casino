const express = require('express');
const router = express.Router();
const cryptoPayService = require('../services/cryptoPayService');
const User = require('../models/User');

// Middleware для проверки авторизации
const auth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

/**
 * @route POST /api/crypto/webhook
 * @desc Обработка webhook-уведомлений от Crypto Pay
 * @access Public (с проверкой подписи)
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['crypto-pay-api-signature'];
    
    // Обработка уведомления
    const result = await cryptoPayService.handleUpdate(req.body, signature);
    
    res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error('Ошибка обработки webhook:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * @route POST /api/crypto/invoice
 * @desc Создание счета на оплату
 * @access Private
 */
router.post('/invoice', auth, async (req, res) => {
  try {
    const { telegramId, amount, currency, description } = req.body;
    
    // Проверка параметров
    if (!telegramId || !amount || !currency) {
      return res.status(400).json({ message: 'Не указаны обязательные параметры' });
    }
    
    // Создание счета
    const invoice = await cryptoPayService.createInvoice(
      telegramId, 
      amount, 
      currency, 
      description
    );
    
    res.status(200).json(invoice);
  } catch (error) {
    console.error('Ошибка создания счета:', error.message);
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route GET /api/crypto/invoice/:id
 * @desc Проверка статуса счета
 * @access Private
 */
router.get('/invoice/:id', auth, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    
    // Проверка счета
    const invoice = await cryptoPayService.getInvoice(invoiceId);
    
    res.status(200).json(invoice);
  } catch (error) {
    console.error('Ошибка проверки счета:', error.message);
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route POST /api/crypto/transfer
 * @desc Перевод средств пользователю
 * @access Private
 */
router.post('/transfer', auth, async (req, res) => {
  try {
    const { telegramId, amount, currency, comment } = req.body;
    
    // Проверка параметров
    if (!telegramId || !amount || !currency) {
      return res.status(400).json({ message: 'Не указаны обязательные параметры' });
    }
    
    // Перевод средств
    const transfer = await cryptoPayService.transfer(
      telegramId, 
      amount, 
      currency, 
      comment
    );
    
    res.status(200).json(transfer);
  } catch (error) {
    console.error('Ошибка перевода средств:', error.message);
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route GET /api/crypto/rates
 * @desc Получение текущих курсов обмена
 * @access Public
 */
router.get('/rates', async (req, res) => {
  try {
    // Обновление и получение курсов
    const rates = await cryptoPayService.updateExchangeRates();
    
    res.status(200).json(rates);
  } catch (error) {
    console.error('Ошибка получения курсов обмена:', error.message);
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route POST /api/crypto/convert
 * @desc Конвертация между валютами
 * @access Private
 */
router.post('/convert', auth, async (req, res) => {
  try {
    const { telegramId, fromCurrency, toCurrency, amount } = req.body;
    
    // Проверка параметров
    if (!telegramId || !fromCurrency || !toCurrency || !amount) {
      return res.status(400).json({ message: 'Не указаны обязательные параметры' });
    }
    
    // Находим пользователя
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    // Выполняем конвертацию
    const result = await user.convertCurrency(fromCurrency, toCurrency, amount);
    
    // Сохраняем изменения
    await user.save();
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Ошибка конвертации валют:', error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;