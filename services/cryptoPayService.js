// services/cryptoPayService.js
const fetch = require('node-fetch');
const crypto = require('crypto');
const ExchangeRate = require('../models/ExchangeRate');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Конфигурация Crypto Pay API
const CRYPTO_PAY_API_TOKEN = process.env.CRYPTO_PAY_API_TOKEN;
const CRYPTO_PAY_API_URL = process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://grnlight-casino.onrender.com';
const REQUEST_TIMEOUT = 15000; // Таймаут для запросов к API в миллисекундах

// Защищенный вывод отладочной информации о конфигурации
console.log('Используется CRYPTO_PAY_API_URL:', CRYPTO_PAY_API_URL);
console.log('Токен Crypto Pay настроен:', !!CRYPTO_PAY_API_TOKEN);

// Создаем кеш для предотвращения двойной обработки платежей
const processedPayments = new Map();

/**
 * Унифицированный метод для запросов к API с таймаутом и обработкой ошибок
 * @param {string} endpoint - Конечная точка API
 * @param {Object} body - Тело запроса
 * @param {string} operation - Название операции для логирования
 * @returns {Promise<Object>} - Ответ API
 */
async function makeApiRequest(endpoint, body, operation) {
    try {
        // Добавляем таймаут к запросу
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        
        const response = await fetch(`${CRYPTO_PAY_API_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Crypto-Pay-API-Token': CRYPTO_PAY_API_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Проверяем HTTP статус ответа
        if (!response.ok) {
            const text = await response.text();
            console.error(`Ошибка HTTP при ${operation}: ${response.status} ${response.statusText}`, text);
            throw new Error(`Ошибка HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Проверяем успешность запроса по API
        if (!data.ok) {
            let errorMessage;
            if (typeof data.error === 'object') {
                errorMessage = JSON.stringify(data.error);
            } else {
                errorMessage = data.error || 'Неизвестная ошибка API';
            }
            
            console.error(`Ошибка API при ${operation}:`, errorMessage);
            throw new Error(`Ошибка API: ${errorMessage}`);
        }
        
        return data.result;
    } catch (error) {
        // Специальная обработка ошибки таймаута
        if (error.name === 'AbortError') {
            console.error(`Таймаут запроса при ${operation}`);
            throw new Error(`Превышено время ожидания ответа от платежной системы`);
        }
        
        console.error(`Ошибка при ${operation}:`, error);
        throw error;
    }
}

/**
 * Нормализация имени актива для API
 * @param {string} asset - Имя актива, возможно с суффиксом сети
 * @returns {string} - Нормализованное имя актива
 */
function normalizeAssetName(asset) {
    if (!asset || typeof asset !== 'string') {
        console.warn('Передан пустой или некорректный актив, используем USDT');
        return 'USDT';
    }

    // Приводим к верхнему регистру для единообразия
    const upperAsset = asset.toUpperCase();
    
    // Список поддерживаемых активов
    const supportedAssets = [
        'USDT', 'TON', 'SOL', 'TRX', 'GRAM', 'BTC', 'ETH', 
        'DOGE', 'LTC', 'NOT', 'TRUMP', 'MELANIA', 'PEPE', 
        'WIF', 'BONK', 'MAJOR', 'MY', 'DOGS', 'MEMHASH', 
        'BNB', 'HMSTR', 'CATI', 'USDC'
    ];
    
    // Если актив содержит подчеркивание, берем только часть до него
    if (upperAsset.includes('_')) {
        const baseName = upperAsset.split('_')[0];
        if (supportedAssets.includes(baseName)) {
            return baseName;
        }
    }
    
    // Проверяем, есть ли актив в списке поддерживаемых
    if (supportedAssets.includes(upperAsset)) {
        return upperAsset;
    }
    
    // По умолчанию возвращаем USDT, если актив неизвестен
    console.warn(`Неизвестный актив: ${asset}, используем USDT`);
    return 'USDT';
}

/**
 * Проверка доступности API
 * @returns {Promise<Object>} - Результат проверки
 */
exports.testApiConnection = async () => {
    try {
        console.log('Тестирование соединения с Crypto Pay API...');
        
        // Запрос списка доступных активов как самый простой способ проверки
        const assets = await makeApiRequest('getAssets', {}, 'тестирование соединения');
        
        console.log('Соединение с Crypto Pay API успешно установлено!');
        console.log('Доступные активы:', assets.map(asset => asset.currency).join(', '));
        
        return {
            success: true,
            assets: assets
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
 * Создание идемпотентного идентификатора для операций
 * @param {string} operation - Тип операции
 * @param {string} userId - ID пользователя
 * @param {string} currency - Валюта
 * @param {number} amount - Сумма
 * @returns {string} - Уникальный идентификатор операции
 */
function generateIdempotencyKey(operation, userId, currency, amount) {
    const now = Date.now();
    const data = `${operation}:${userId}:${currency}:${amount}:${now}`;
    
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Создание счета на оплату с улучшенной логикой
 * @param {string} telegramId - ID пользователя в Telegram
 * @param {number} amount - Сумма счета
 * @param {string} currency - Валюта (USDT, BTC, TON, и т.д.)
 * @param {string} description - Описание платежа
 * @returns {Promise<Object>} - Данные созданного счета
 */
exports.createInvoice = async (telegramId, amount, currency, description = '') => {
    try {
        // Валидация параметров
        if (!telegramId) {
            throw new Error('Не указан ID пользователя');
        }
        
        if (!amount || isNaN(amount) || amount <= 0) {
            throw new Error('Некорректная сумма');
        }
        
        // Проверка лимитов
        if (amount < 1) {
            throw new Error('Минимальная сумма пополнения: 1 USD');
        }
        
        if (amount > 10000) {
            throw new Error('Максимальная сумма пополнения: 10000 USD');
        }
        
        // Проверка пользователя
        const user = await User.findOne({ telegramId });
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        
        // Проверка бана
        if (user.isBanned) {
            throw new Error('Ваш аккаунт заблокирован. Обратитесь к администратору');
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
        
        // Создаем уникальный идентификатор для предотвращения дублирования
        const idempotencyKey = generateIdempotencyKey('invoice', telegramId, normalizedAsset, amount);
        
        // Формирование данных для запроса
        const payload = JSON.stringify({ 
            type: 'deposit',
            userId: user._id.toString(),
            telegramId: telegramId,
            amount: amount,
            idempotencyKey: idempotencyKey
        });
        
        // Создание данных для запроса
        const requestBody = {
            asset: normalizedAsset,
            amount: amount.toString(),
            description: description,
            hidden_message: `Пополнение баланса для пользователя ${telegramId}`,
            paid_btn_name: 'callback', // Callback для перенаправления в приложение
            paid_btn_url: WEBAPP_URL,
            payload: payload,
            allow_anonymous: false,
            allow_comments: false
        };
        
        console.log('Отправка запроса на создание инвойса:', { 
            telegramId, 
            amount, 
            currency: normalizedAsset,
            idempotencyKey 
        });
        
        // Создание инвойса через API
        const invoice = await makeApiRequest('createInvoice', requestBody, 'создание инвойса');
        
        // Сохраняем информацию о счете в профиле пользователя
        await user.addCryptoPayInvoice({
            invoice_id: invoice.invoice_id,
            amount: amount,
            currency: normalizedAsset,
            status: invoice.status,
            created_at: invoice.created_at,
            description: description,
            external_id: idempotencyKey
        });
        
        console.log(`Создан счет на оплату: ID ${invoice.invoice_id}, ${amount} ${normalizedAsset} для пользователя ${telegramId}`);
        
        return invoice;
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
        if (!invoiceId) {
            throw new Error('Не указан ID счета');
        }
        
        return await makeApiRequest('getInvoice', { invoice_id: invoiceId }, 'получение информации о счете');
    } catch (error) {
        console.error('Ошибка получения информации о счете:', error);
        throw error;
    }
};

/**
 * Проверка подписи webhook-уведомления с повышенной безопасностью
 * @param {Object} update - Данные обновления
 * @param {string} signature - Подпись от Crypto Pay
 * @returns {boolean} - Результат проверки
 */
function verifySignature(update, signature) {
    if (!signature || !CRYPTO_PAY_API_TOKEN) {
        console.warn('Отсутствует подпись или API токен для проверки');
        return false;
    }
    
    try {
        // Приведение update к строке в едином формате для вычисления хеша
        const data = typeof update === 'string' ? update : JSON.stringify(update);
        
        // Создаем HMAC подпись
        const hmac = crypto.createHmac('sha256', CRYPTO_PAY_API_TOKEN)
                         .update(data)
                         .digest('hex');
        
        // Проверка подписи с защитой от timing-атак
        const isValid = crypto.timingSafeEqual(
            Buffer.from(hmac, 'hex'),
            Buffer.from(signature, 'hex')
        );
        
        if (!isValid) {
            console.warn('Неверная подпись webhook-уведомления');
        }
        
        return isValid;
    } catch (error) {
        console.error('Ошибка при проверке подписи:', error);
        return false;
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
        // Проверяем подпись
        if (!verifySignature(update, signature)) {
            console.error('Неверная подпись webhook-уведомления');
            return { status: 'error', reason: 'invalid_signature' };
        }
        
        // Проверяем структуру данных
        if (!update || !update.update_type) {
            console.error('Некорректный формат webhook-уведомления');
            return { status: 'error', reason: 'invalid_format' };
        }
        
        // Обрабатываем только уведомления о платежах
        if (update.update_type !== 'invoice_paid') {
            return { status: 'skipped', reason: 'not_invoice_paid' };
        }
        
        // Проверяем наличие данных invoice
        if (!update.payload || !update.payload.invoice_id) {
            console.error('Отсутствуют данные invoice в уведомлении');
            return { status: 'error', reason: 'missing_invoice_data' };
        }
        
        const invoice = update.payload;
        const invoiceId = invoice.invoice_id;
        
        // Проверяем, не обрабатывали ли мы уже этот инвойс (идемпотентность)
        if (processedPayments.has(invoiceId)) {
            console.log(`Инвойс ${invoiceId} уже был обработан ранее`);
            return { status: 'skipped', reason: 'already_processed', invoiceId };
        }
        
        // Устанавливаем флаг обработки до завершения всех операций
        processedPayments.set(invoiceId, Date.now());
        
        // Проверяем, существует ли инвойс
        try {
            const invoiceData = await this.getInvoice(invoiceId);
            
            // Если инвойс уже обработан, пропускаем
            if (invoiceData.paid && invoiceData.processed) {
                console.log(`Инвойс ${invoiceId} уже обработан на стороне API`);
                return { status: 'skipped', reason: 'already_processed_by_api', invoiceId };
            }
            
            // Если инвойс оплачен, но не обработан
            if (invoiceData.paid && !invoiceData.processed) {
                // Безопасный парсинг payload инвойса
                let payload = {};
                try {
                    payload = JSON.parse(invoiceData.payload || '{}');
                } catch (parseError) {
                    console.error('Ошибка парсинга payload инвойса:', parseError);
                    return { status: 'error', reason: 'invalid_payload', invoiceId };
                }
                
                // Проверяем корректность payload
                if (!payload.type || !payload.telegramId) {
                    console.error('Некорректный формат payload инвойса');
                    return { status: 'error', reason: 'invalid_payload_format', invoiceId };
                }
                
                if (payload.type === 'deposit' && payload.telegramId) {
                    // Находим пользователя
                    const user = await User.findOne({ telegramId: payload.telegramId });
                    
                    if (!user) {
                        console.error(`Пользователь с ID ${payload.telegramId} не найден`);
                        return { 
                            status: 'error', 
                            reason: 'user_not_found', 
                            invoiceId,
                            telegramId: payload.telegramId 
                        };
                    }
                    
                    // Проверяем, не заблокирован ли пользователь
                    if (user.isBanned) {
                        console.warn(`Попытка пополнения для заблокированного пользователя ${payload.telegramId}`);
                        return { 
                            status: 'error', 
                            reason: 'user_banned', 
                            invoiceId,
                            telegramId: payload.telegramId 
                        };
                    }
                    
                    // Определяем валюту и сумму
                    let currency = 'stars'; // По умолчанию звезды
                    let amount = parseFloat(payload.amount);
                    
                    if (isNaN(amount) || amount <= 0) {
                        console.error('Некорректная сумма в payload инвойса');
                        return { status: 'error', reason: 'invalid_amount', invoiceId };
                    }
                    
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
                    
                    // Транзакционно добавляем средства на баланс пользователя
                    try {
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
                        
                        // Сохраняем транзакцию
                        await transaction.save();
                        
                        // Добавляем средства на баланс пользователя
                        await user.addFunds(amount, currency);
                        
                        // Отмечаем инвойс как обработанный
                        await this.markInvoiceAsProcessed(invoiceId);
                        
                        console.log(`Баланс пользователя ${user.telegramId} пополнен: ${amount} ${currency}`);
                        
                        // Отправляем уведомление пользователю
                        await this.sendNotification(user.telegramId, 
                            `✅ Ваш баланс успешно пополнен!\n\n${amount} ${getCurrencySymbol(currency)}\n\nСпасибо за использование Greenlight Casino!`
                        );
                        
                        return { 
                            status: 'success', 
                            user: user.telegramId, 
                            amount: amount, 
                            currency: currency,
                            invoiceId
                        };
                    } catch (transactionError) {
                        console.error('Ошибка при обработке транзакции:', transactionError);
                        return { 
                            status: 'error', 
                            reason: 'transaction_error', 
                            details: transactionError.message,
                            invoiceId 
                        };
                    }
                }
            }
            
            return { status: 'skipped', reason: 'invoice_not_ready', invoiceId };
        } catch (invoiceError) {
            console.error('Ошибка при обработке инвойса:', invoiceError);
            return { status: 'error', reason: 'invoice_processing_error', details: invoiceError.message, invoiceId };
        } finally {
            // Через 10 минут удалим запись из кеша для экономии памяти
            setTimeout(() => {
                processedPayments.delete(invoiceId);
            }, 600000);
        }
    } catch (error) {
        console.error('Ошибка обработки webhook:', error);
        return { status: 'error', reason: 'general_error', details: error.message };
    }
};

/**
 * Отметка инвойса как обработанного
 * @param {string} invoiceId - ID инвойса
 * @returns {Promise<boolean>} - Результат операции
 */
exports.markInvoiceAsProcessed = async (invoiceId) => {
    try {
        await makeApiRequest('updateInvoice', {
            invoice_id: invoiceId,
            status: 'processed'
        }, 'отметка инвойса как обработанного');
        
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
        // Валидация параметров
        if (!telegramId) {
            throw new Error('Не указан ID пользователя');
        }
        
        if (!amount || isNaN(amount) || amount <= 0) {
            throw new Error('Некорректная сумма');
        }
        
        // Проверка лимитов
        if (amount < 3) {
            throw new Error('Минимальная сумма вывода: 3 USD');
        }
        
        if (amount > 5000) {
            throw new Error('Максимальная сумма вывода: 5000 USD');
        }
        
        // Проверка пользователя
        const user = await User.findOne({ telegramId });
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        
        // Проверка бана
        if (user.isBanned) {
            throw new Error('Ваш аккаунт заблокирован. Обратитесь к администратору');
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
        
        // Определяем комиссию (например, 3%)
        const fee = amount * 0.03;
        const totalAmount = amount + fee;
        
        // Проверяем достаточность средств с учетом минимального остатка
        if (userBalance < totalAmount) {
            throw new Error(`Недостаточно средств для вывода. Доступно: ${userBalance.toFixed(2)} ${withdrawCurrency.toUpperCase()}, требуется (с комиссией): ${totalAmount.toFixed(2)} ${withdrawCurrency.toUpperCase()}`);
        }
        
        // Создаем идемпотентный ключ для операции
        const spendId = generateIdempotencyKey('transfer', telegramId, normalizedAsset, amount);
        
        // Транзакционно обрабатываем операцию вывода
        try {
            // Списываем средства с баланса пользователя
            await user.withdrawFunds(totalAmount, withdrawCurrency);
            
            // Записываем транзакцию списания
            const withdrawTransaction = new Transaction({
                userId: user._id,
                telegramId: user.telegramId,
                amount: -totalAmount,
                type: 'withdrawal',
                game: 'none',
                cryptoDetails: {
                    asset: normalizedAsset,
                    amount: amount.toString(),
                    status: 'pending',
                    spendId: spendId
                }
            });
            
            await withdrawTransaction.save();
            
            // Запрос на перевод средств
            const transferData = await makeApiRequest('transfer', {
                user_id: telegramId,
                asset: normalizedAsset,
                amount: amount.toString(),
                spend_id: spendId,
                comment: comment || 'Вывод средств из Greenlight Casino'
            }, 'перевод средств');
            
            // Обновляем информацию о переводе в профиле пользователя
            user.addCryptoPayTransfer({
                transfer_id: transferData.transfer_id,
                user_id: telegramId,
                amount: amount,
                currency: normalizedAsset,
                status: transferData.status,
                created_at: Math.floor(Date.now() / 1000),
                comment: comment || 'Вывод средств из Greenlight Casino'
            });
            
            await user.save();
            
            // Обновляем статус транзакции
            withdrawTransaction.cryptoDetails.status = 'completed';
            withdrawTransaction.cryptoDetails.transferId = transferData.transfer_id;
            await withdrawTransaction.save();
            
            // Создаем отдельную запись для комиссии
            const feeTransaction = new Transaction({
                userId: user._id,
                telegramId: user.telegramId,
                amount: -fee,
                type: 'withdrawal',
                game: 'none',
                cryptoDetails: {
                    transferId: transferData.transfer_id,
                    asset: normalizedAsset,
                    amount: fee.toString(),
                    status: 'fee',
                    spendId: spendId
                }
            });
            
            await feeTransaction.save();
            
            console.log(`Выполнен вывод средств для пользователя ${telegramId}: ${amount} ${normalizedAsset}, комиссия: ${fee.toFixed(2)} ${withdrawCurrency.toUpperCase()}`);
            
            // Отправляем уведомление пользователю
            await this.sendNotification(telegramId, 
                `✅ Вывод средств успешно выполнен!\n\n` +
                `Сумма: ${amount.toFixed(2)} ${normalizedAsset}\n` +
                `Комиссия: ${fee.toFixed(2)} ${withdrawCurrency.toUpperCase()}\n` +
                `Итого списано: ${totalAmount.toFixed(2)} ${withdrawCurrency.toUpperCase()}\n\n` +
                `Спасибо за использование Greenlight Casino!`
            );
            
            return {
                success: true,
                transferId: transferData.transfer_id,
                amount: amount,
                fee: fee,
                total: totalAmount,
                currency: normalizedAsset
            };
        } catch (error) {
            // В случае ошибки в процессе вывода, возвращаем средства пользователю
            console.error('Ошибка при выводе средств:', error);
            
            try {
                // Возвращаем средства на баланс
                await user.addFunds(totalAmount, withdrawCurrency);
                
                // Создаем запись о возврате средств
                const refundTransaction = new Transaction({
                    userId: user._id,
                    telegramId: user.telegramId,
                    amount: totalAmount,
                    type: 'deposit',
                    game: 'none',
                    cryptoDetails: {
                        asset: normalizedAsset,
                        amount: amount.toString(),
                        status: 'refunded',
                        spendId: spendId
                    }
                });
                
                await refundTransaction.save();
                
                // Уведомляем пользователя о проблеме
                await this.sendNotification(telegramId, 
                    `❌ Произошла ошибка при выводе средств\n\n` +
                    `Ваши средства были возвращены на баланс.\n\n` +
                    `Причина: ${error.message}\n\n` +
                    `Пожалуйста, попробуйте позже или обратитесь в поддержку.`
                );
            } catch (refundError) {
                console.error('Критическая ошибка при возврате средств:', refundError);
                // В этом случае требуется вмешательство оператора для ручной корректировки
            }
            
            throw error;
        }
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
        // Проверяем, есть ли актуальные курсы в базе (не старше 1 часа)
        const latestRates = await ExchangeRate.findOne({ base: 'usdt' })
            .sort({ updatedAt: -1 })
            .limit(1);
        
        // Если курсы были обновлены менее часа назад, возвращаем их
        if (latestRates && 
            (new Date() - new Date(latestRates.updatedAt)) < 3600000) {
            return latestRates;
        }
        
        // Запрашиваем актуальные курсы обмена из внешнего API
        const exchangeRates = await makeApiRequest('getExchangeRates', {}, 'получение курсов обмена');
        
        // Преобразуем полученные курсы в нужный формат
        const rates = {
            usdt: 1, // Базовая валюта
            rub: 90, // Устанавливаем дефолтное значение
            stars: 100 // Устанавливаем дефолтное значение
        };
        
        // Обрабатываем курсы из API
        exchangeRates.forEach(rate => {
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
        
        // В случае ошибки, возвращаем последние известные курсы или дефолтные
        const lastKnownRates = await ExchangeRate.findOne({ base: 'usdt' })
            .sort({ updatedAt: -1 })
            .limit(1)
            .catch(() => null);
            
        if (lastKnownRates) {
            console.log('Используем последние известные курсы обмена');
            return lastKnownRates;
        }
        
        // Если нет сохраненных курсов, возвращаем дефолтные
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
        
        // Добавляем таймаут к запросу
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: telegramId,
                text: message,
                parse_mode: 'HTML'
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (!data.ok) {
            throw new Error(`Ошибка API Telegram: ${data.description}`);
        }
        
        return true;
    } catch (error) {
        // Игнорируем ошибки при отправке уведомлений, чтобы не блокировать основной процесс
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
    if (!currency) return '';
    
    const currencyMap = {
        'usdt': 'USDT',
        'rub': '₽',
        'stars': '⭐',
        'btc': 'BTC',
        'ton': 'TON',
        'eth': 'ETH',
        'bnb': 'BNB'
    };
    
    return currencyMap[currency.toLowerCase()] || currency.toUpperCase();
}