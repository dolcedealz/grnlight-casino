const Dispute = require('../models/Dispute');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GameHistory = require('../models/GameHistory');
const fetch = require('node-fetch');

// Получение всех активных споров
exports.getAllDisputes = async (req, res) => {
    try {
        const disputes = await Dispute.find({ status: 'active' })
            .populate('creator', 'telegramId firstName lastName username')
            .populate('opponent', 'telegramId firstName lastName username')
            .sort({ createdAt: -1 });
        
        res.status(200).json(disputes);
    } catch (error) {
        console.error('Ошибка при получении списка споров:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Получение спора по ID
exports.getDisputeById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const dispute = await Dispute.findById(id)
            .populate('creator', 'telegramId firstName lastName username')
            .populate('opponent', 'telegramId firstName lastName username');
        
        if (!dispute) {
            return res.status(404).json({ message: 'Спор не найден' });
        }
        
        res.status(200).json(dispute);
    } catch (error) {
        console.error('Ошибка при получении спора:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Создание нового спора
exports.createDispute = async (req, res) => {
    try {
        const { creatorTelegramId, question, betAmount, messageId, chatId } = req.body;
        
        // Проверяем создателя
        const creator = await User.findOne({ telegramId: creatorTelegramId });
        if (!creator) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        // Проверяем баланс
        if (creator.balance < betAmount) {
            return res.status(400).json({ message: 'Недостаточно средств' });
        }
        
        // Создаем новый спор
        const dispute = new Dispute({
            creator: creator._id,
            creatorTelegramId,
            question,
            bet: {
                amount: betAmount,
                creatorChoice: null,
                opponentChoice: null
            },
            status: 'pending',
            // Добавляем информацию о сообщении
            messageId,
            chatId,
            // Инициализируем статусы готовности
            creatorReady: false,
            opponentReady: false
        });
        
        await dispute.save();
        
        // Логируем успешное создание
        console.log(`Создан новый спор: ${dispute._id} от ${creator.firstName} (${creatorTelegramId})`);
        
        res.status(201).json(dispute);
    } catch (error) {
        console.error('Ошибка при создании спора:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Принятие спора
exports.acceptDispute = async (req, res) => {
    try {
        const { disputeId, opponentTelegramId } = req.body;
        
        // Проверяем спор
        const dispute = await Dispute.findById(disputeId)
            .populate('creator', 'telegramId firstName lastName username');
        
        if (!dispute) {
            return res.status(404).json({ message: 'Спор не найден' });
        }
        
        if (dispute.status !== 'pending') {
            return res.status(400).json({ message: 'Спор уже принят или завершен' });
        }
        
        // Проверяем оппонента
        const opponent = await User.findOne({ telegramId: opponentTelegramId });
        if (!opponent) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        // Проверяем, не пытается ли создатель принять свой же спор
        if (dispute.creatorTelegramId === opponentTelegramId) {
            return res.status(400).json({ message: 'Вы не можете принять свой собственный спор' });
        }
        
        // Проверяем баланс
        if (opponent.balance < dispute.bet.amount) {
            return res.status(400).json({ message: 'Недостаточно средств' });
        }
        
        // Создаем случайные стороны для спора
        const creatorSide = Math.random() < 0.5 ? 'heads' : 'tails';
        const opponentSide = creatorSide === 'heads' ? 'tails' : 'heads';
        
        // Обновляем спор
        dispute.opponent = opponent._id;
        dispute.opponentTelegramId = opponentTelegramId;
        dispute.status = 'active';
        dispute.creatorSide = creatorSide;
        dispute.opponentSide = opponentSide;
        
        // Добавляем новые поля для режима монетки
        dispute.creatorReady = false;
        dispute.opponentReady = false;
        
        await dispute.save();
        
        // Блокируем средства обоих участников
        const creator = await User.findById(dispute.creator);
        creator.balance -= dispute.bet.amount;
        opponent.balance -= dispute.bet.amount;
        
        await creator.save();
        await opponent.save();
        
        // Записываем транзакции
        const creatorTransaction = new Transaction({
            userId: creator._id,
            telegramId: creator.telegramId,
            amount: -dispute.bet.amount,
            type: 'bet',
            game: 'dispute',
            disputeId: dispute._id
        });
        
        const opponentTransaction = new Transaction({
            userId: opponent._id,
            telegramId: opponent.telegramId,
            amount: -dispute.bet.amount,
            type: 'bet',
            game: 'dispute',
            disputeId: dispute._id
        });
        
        await creatorTransaction.save();
        await opponentTransaction.save();
        
        // Обновляем сообщение в чате Telegram
        await this.updateDisputeMessage(dispute);
        
        // Логируем успешное принятие
        console.log(`Спор ${dispute._id} принят пользователем ${opponent.firstName} (${opponentTelegramId})`);
        
        res.status(200).json(dispute);
    } catch (error) {
        console.error('Ошибка при принятии спора:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Редактирование сообщения после принятия спора
exports.updateDisputeMessage = async (dispute) => {
    try {
        if (!dispute.messageId || !dispute.chatId) {
            console.error('Отсутствует информация о сообщении для спора:', dispute._id);
            return;
        }
        
        // Получаем токен бота из конфигурации
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            console.error('Токен Telegram бота не настроен');
            return;
        }
        
        // Проверяем, есть ли данные об участниках
        if (!dispute.creator || !dispute.opponent) {
            console.error('Отсутствуют данные об участниках спора:', dispute._id);
            return;
        }
        
        // Загружаем информацию о создателе и оппоненте, если нужно
        const creator = typeof dispute.creator === 'object' ? 
            dispute.creator : 
            await User.findById(dispute.creator);
            
        const opponent = typeof dispute.opponent === 'object' ? 
            dispute.opponent : 
            await User.findById(dispute.opponent);
        
        if (!creator || !opponent) {
            console.error('Не удалось загрузить данные участников спора:', dispute._id);
            return;
        }
        
        // Формируем URL для комнаты спора
        const roomUrl = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=dispute_${dispute._id}`;
        
        // Формируем клавиатуру для редактирования сообщения
        const inlineKeyboard = {
            inline_keyboard: [
                [
                    {
                        text: 'Открыть спор 👑',
                        url: roomUrl
                    }
                ]
            ]
        };
        
        // Определяем стороны на русском
        const creatorSideText = dispute.creatorSide === 'heads' ? 'Орёл' : 'Решка';
        const opponentSideText = dispute.opponentSide === 'heads' ? 'Орёл' : 'Решка';
        
        // Формируем текст сообщения
        const messageText = `🏆 <b>Спор начинается!</b>\n\n`
            + `<b>Тема:</b> ${dispute.question}\n`
            + `<b>Сумма:</b> ${dispute.bet.amount} ⭐\n\n`
            + `<b>Создатель:</b> ${creator.firstName} (${creatorSideText})\n`
            + `<b>Оппонент:</b> ${opponent.firstName} (${opponentSideText})\n\n`
            + `<b>Статус:</b> Спор принят\n\n`
            + `Нажмите кнопку ниже, чтобы открыть спор и бросить монетку!`;
        
        // Выполняем запрос к API Telegram для редактирования сообщения
        const response = await fetch(
            `https://api.telegram.org/bot${botToken}/editMessageText`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: dispute.chatId,
                    message_id: dispute.messageId,
                    text: messageText,
                    reply_markup: inlineKeyboard,
                    parse_mode: 'HTML'
                })
            }
        );
        
        const result = await response.json();
        if (!result.ok) {
            console.error('Ошибка редактирования сообщения:', result.description);
        } else {
            console.log(`Сообщение для спора ${dispute._id} успешно обновлено`);
        }
        
        return result;
    } catch (error) {
        console.error('Ошибка обновления сообщения спора:', error);
        return null;
    }
};

// Получение результата спора
exports.getDisputeResult = async (req, res) => {
    try {
        const { disputeId } = req.body;
        
        // Проверяем спор
        const dispute = await Dispute.findById(disputeId)
            .populate('creator', 'telegramId firstName lastName username')
            .populate('opponent', 'telegramId firstName lastName username');
        
        if (!dispute) {
            return res.status(404).json({ message: 'Спор не найден' });
        }
        
        if (dispute.status !== 'active') {
            return res.status(400).json({ message: 'Спор не активен или уже завершен' });
        }
        
        // Генерируем результат - "heads" или "tails"
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        
        // Определяем победителя
        const creatorWins = (dispute.creatorSide === result);
        const winner = creatorWins ? dispute.creator : dispute.opponent;
        const winnerId = creatorWins ? dispute.creator._id : dispute.opponent._id;
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
        const winnerUser = await User.findById(winnerId);
        winnerUser.balance += winAmount;
        await winnerUser.save();
        
        // Записываем транзакцию выигрыша
        const winTransaction = new Transaction({
            userId: winnerId,
            telegramId: winnerTelegramId,
            amount: winAmount,
            type: 'win',
            game: 'dispute',
            disputeId: dispute._id
        });
        
        await winTransaction.save();
        
        // Записываем в историю игр
        const gameHistory = new GameHistory({
            userId: winnerId,
            telegramId: winnerTelegramId,
            gameType: 'dispute',
            betAmount: dispute.bet.amount,
            outcome: 'win',
            winAmount: winAmount,
            gameData: {
                disputeId: dispute._id,
                question: dispute.question,
                opponentId: creatorWins ? dispute.opponentTelegramId : dispute.creatorTelegramId,
                coinResult: result
            },
            disputeId: dispute._id
        });
        
        await gameHistory.save();
        
        // Добавляем запись проигравшему
        const loserId = creatorWins ? dispute.opponent._id : dispute.creator._id;
        const loserTelegramId = creatorWins ? dispute.opponentTelegramId : dispute.creatorTelegramId;
        
        const loseHistory = new GameHistory({
            userId: loserId,
            telegramId: loserTelegramId,
            gameType: 'dispute',
            betAmount: dispute.bet.amount,
            outcome: 'lose',
            winAmount: 0,
            gameData: {
                disputeId: dispute._id,
                question: dispute.question,
                opponentId: creatorWins ? dispute.creatorTelegramId : dispute.opponentTelegramId,
                coinResult: result
            },
            disputeId: dispute._id
        });
        
        await loseHistory.save();
        
        // Отправляем сообщение о результате в чат
        await this.sendDisputeResultMessage(dispute, result, creatorWins);
        
        // Логируем успешное завершение
        console.log(`Спор ${dispute._id} завершен. Победитель: ${winnerUser.firstName} (${winnerTelegramId}). Результат: ${result}`);
        
        res.status(200).json({
            dispute,
            result,
            winnerTelegramId,
            winAmount,
            commission
        });
    } catch (error) {
        console.error('Ошибка при получении результата спора:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Отправка сообщения о результате спора
exports.sendDisputeResultMessage = async (dispute, result, creatorWins) => {
    try {
        if (!dispute.messageId || !dispute.chatId) {
            console.error('Отсутствует информация о сообщении для спора:', dispute._id);
            return;
        }
        
        // Получаем токен бота из конфигурации
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            console.error('Токен Telegram бота не настроен');
            return;
        }
        
        // Определяем стороны на русском
        const resultText = result === 'heads' ? 'Орёл' : 'Решка';
        const creatorSideText = dispute.creatorSide === 'heads' ? 'Орёл' : 'Решка';
        const opponentSideText = dispute.opponentSide === 'heads' ? 'Орёл' : 'Решка';
        
        // Определяем победителя
        const winnerName = creatorWins ? 
            (dispute.creator && dispute.creator.firstName ? dispute.creator.firstName : 'Создатель') : 
            (dispute.opponent && dispute.opponent.firstName ? dispute.opponent.firstName : 'Оппонент');
            
        const winnerSide = creatorWins ? creatorSideText : opponentSideText;
        
        // Формируем текст сообщения
        const messageText = `🎉 <b>Спор завершен!</b>\n\n`
            + `<b>Тема:</b> ${dispute.question}\n`
            + `<b>Сумма:</b> ${dispute.bet.amount} ⭐\n\n`
            + `<b>Создатель:</b> ${dispute.creator && dispute.creator.firstName ? dispute.creator.firstName : 'Создатель'} (${creatorSideText})\n`
            + `<b>Оппонент:</b> ${dispute.opponent && dispute.opponent.firstName ? dispute.opponent.firstName : 'Оппонент'} (${opponentSideText})\n\n`
            + `<b>Результат:</b> Выпал ${resultText}!\n`
            + `<b>Победитель:</b> ${winnerName} (${winnerSide})\n`
            + `<b>Выигрыш:</b> ${dispute.bet.amount * 2 - dispute.commission} ⭐`;
        
        // Выполняем запрос к API Telegram для редактирования сообщения
        const response = await fetch(
            `https://api.telegram.org/bot${botToken}/editMessageText`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: dispute.chatId,
                    message_id: dispute.messageId,
                    text: messageText,
                    parse_mode: 'HTML'
                })
            }
        );
        
        const result = await response.json();
        if (!result.ok) {
            console.error('Ошибка отправки результата спора:', result.description);
        } else {
            console.log(`Сообщение с результатом спора ${dispute._id} успешно отправлено`);
        }
        
        return result;
    } catch (error) {
        console.error('Ошибка отправки результата спора:', error);
        return null;
    }
};

// Получение истории споров пользователя
exports.getUserDisputeHistory = async (req, res) => {
    try {
        const { telegramId } = req.params;
        
        const user = await User.findOne({ telegramId });
        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        // Находим все споры, где пользователь является создателем или оппонентом
        const disputes = await Dispute.find({
            $or: [
                { creatorTelegramId: telegramId },
                { opponentTelegramId: telegramId }
            ]
        })
        .populate('creator', 'telegramId firstName lastName username')
        .populate('opponent', 'telegramId firstName lastName username')
        .sort({ createdAt: -1 });
        
        res.status(200).json(disputes);
    } catch (error) {
        console.error('Ошибка при получении истории споров:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Создание комнаты для спора
exports.createDisputeRoom = async (req, res) => {
    try {
        const { disputeId, roomId, userTelegramId } = req.body;
        
        console.log('Создание комнаты для спора:', { disputeId, roomId, userTelegramId });
        
        // Проверяем существование спора
        const dispute = await Dispute.findById(disputeId)
            .populate('creator', 'telegramId firstName lastName username')
            .populate('opponent', 'telegramId firstName lastName username');
        
        if (!dispute) {
            return res.status(404).json({ message: 'Спор не найден' });
        }
        
        // Проверяем, что пользователь является участником спора
        const isCreator = dispute.creatorTelegramId == userTelegramId;
        const isOpponent = dispute.opponentTelegramId == userTelegramId;
        
        if (!isCreator && !isOpponent) {
            console.log('Пользователь не является участником спора:', userTelegramId);
            console.log('Создатель:', dispute.creatorTelegramId);
            console.log('Оппонент:', dispute.opponentTelegramId);
            return res.status(403).json({ 
                message: 'Вы не являетесь участником этого спора',
                debug: { 
                    userTelegramId, 
                    creatorTelegramId: dispute.creatorTelegramId, 
                    opponentTelegramId: dispute.opponentTelegramId,
                    isCreator, 
                    isOpponent
                }
            });
        }
        
        // Проверяем статус спора
        if (dispute.status !== 'active') {
            return res.status(400).json({ message: 'Спор не активен или уже завершен' });
        }
        
        // Если комната уже существует, используем её
        if (!dispute.roomId) {
            dispute.roomId = roomId;
            await dispute.save();
        }
        
        // Отправляем уведомление другому участнику
        if (isCreator && dispute.opponentTelegramId) {
            await this.notifyDisputeParticipant(dispute.opponentTelegramId, dispute);
        } else if (isOpponent && dispute.creatorTelegramId) {
            await this.notifyDisputeParticipant(dispute.creatorTelegramId, dispute);
        }
        
        // Логируем создание комнаты
        console.log(`Создана комната для спора ${dispute._id}. RoomID: ${dispute.roomId || roomId}`);
        
        res.status(200).json({ 
            success: true, 
            roomId: dispute.roomId || roomId,
            dispute: {
                _id: dispute._id,
                question: dispute.question,
                bet: dispute.bet,
                creatorSide: dispute.creatorSide,
                opponentSide: dispute.opponentSide,
                creator: dispute.creator,
                opponent: dispute.opponent,
                status: dispute.status,
                creatorReady: dispute.creatorReady,
                opponentReady: dispute.opponentReady
            }
        });
    } catch (error) {
        console.error('Ошибка создания комнаты спора:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Уведомление участника спора
exports.notifyDisputeParticipant = async (telegramId, dispute) => {
    try {
        // Получаем токен бота из конфигурации
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            console.error('Токен Telegram бота не настроен');
            return;
        }
        
        // Формируем URL для комнаты спора
        const roomUrl = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=dispute_${dispute._id}`;
        
        // Формируем текст уведомления
        const messageText = `🔔 <b>Приглашение в комнату спора</b>\n\n`
            + `Другой участник открыл комнату для разрешения спора:\n\n`
            + `<b>Тема:</b> ${dispute.question}\n`
            + `<b>Сумма:</b> ${dispute.bet.amount} ⭐\n\n`
            + `Присоединитесь, чтобы определить победителя!`;
        
        // Формируем клавиатуру для уведомления
        const inlineKeyboard = {
            inline_keyboard: [
                [
                    {
                        text: 'Присоединиться к спору 👑',
                        web_app: { url: `${process.env.WEBAPP_URL}?dispute=${dispute._id}` }
                    }
                ]
            ]
        };
        
        // Выполняем запрос к API Telegram для отправки уведомления
        const response = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: telegramId,
                    text: messageText,
                    reply_markup: inlineKeyboard,
                    parse_mode: 'HTML'
                })
            }
        );
        
        const result = await response.json();
        if (!result.ok) {
            console.error('Ошибка отправки уведомления участнику:', result.description);
        } else {
            console.log(`Уведомление для участника спора ${dispute._id} отправлено пользователю ${telegramId}`);
        }
        
        return result;
    } catch (error) {
        console.error('Ошибка отправки уведомления участнику:', error);
        return null;
    }
};

// Обновление статуса готовности игрока
// Обновление статуса готовности игрока
exports.updatePlayerReadyStatus = async (req, res) => {
    try {
        const { disputeId, userTelegramId, ready } = req.body;
        
        console.log('Обновление статуса готовности:', { disputeId, userTelegramId, ready });
        
        // Проверяем существование спора
        const dispute = await Dispute.findById(disputeId)
            .populate('creator', 'telegramId firstName lastName username')
            .populate('opponent', 'telegramId firstName lastName username');
        
        if (!dispute) {
            console.log('Спор не найден:', disputeId);
            return res.status(404).json({ message: 'Спор не найден', success: false });
        }
        
        // Проверяем, что пользователь является участником спора
        const isCreator = dispute.creatorTelegramId == userTelegramId;
        const isOpponent = dispute.opponentTelegramId == userTelegramId;
        
        if (!isCreator && !isOpponent) {
            console.log('Пользователь не является участником спора:', userTelegramId);
            return res.status(403).json({ 
                message: 'Вы не являетесь участником этого спора',
                success: false 
            });
        }
        
        // Обновляем статус готовности с явным преобразованием в boolean
        if (isCreator) {
            dispute.creatorReady = ready === true || ready === 'true';
            console.log(`Статус создателя обновлен: ${dispute.creatorReady}`);
        } else if (isOpponent) {
            dispute.opponentReady = ready === true || ready === 'true';
            console.log(`Статус оппонента обновлен: ${dispute.opponentReady}`);
        }
        
        await dispute.save();
        
        // Проверяем, готовы ли оба игрока
        const bothReady = dispute.creatorReady && dispute.opponentReady;
        
        console.log(`Обновлен статус готовности для спора ${dispute._id}. Создатель: ${dispute.creatorReady}, Оппонент: ${dispute.opponentReady}, Оба: ${bothReady}`);
        
        // Возвращаем текущий статус обоих игроков
        res.status(200).json({ 
            success: true, 
            bothReady,
            creatorReady: dispute.creatorReady,
            opponentReady: dispute.opponentReady,
        });
        
    } catch (error) {
        console.error('Ошибка обновления статуса готовности:', error);
        res.status(500).json({ message: 'Server error', error: error.message, success: false });
    }
};

// Получение статуса комнаты спора - улучшенная версия
exports.getDisputeRoomStatus = async (req, res) => {
    try {
        const { disputeId } = req.params;
        
        // Проверяем существование спора
        const dispute = await Dispute.findById(disputeId)
            .populate('creator', 'telegramId firstName lastName username')
            .populate('opponent', 'telegramId firstName lastName username');
        
        if (!dispute) {
            return res.status(404).json({ message: 'Спор не найден', success: false });
        }
        
        // Возвращаем детальный статус комнаты
        res.status(200).json({
            success: true,
            disputeId: dispute._id,
            roomId: dispute.roomId,
            creatorReady: dispute.creatorReady === true,
            opponentReady: dispute.opponentReady === true,
            bothReady: dispute.creatorReady === true && dispute.opponentReady === true,
            status: dispute.status,
            result: dispute.result,
            winnerTelegramId: dispute.winnerTelegramId,
            creatorTelegramId: dispute.creatorTelegramId,
            opponentTelegramId: dispute.opponentTelegramId,
            // Добавляем метку времени для предотвращения кэширования
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Ошибка получения статуса комнаты спора:', error);
        res.status(500).json({ message: 'Server error', success: false });
    }
};

// Определение результата спора
exports.determineDisputeResult = async (dispute) => {
    try {
        // Проверяем, что спор активен
        if (dispute.status !== 'active') {
            throw new Error(`Спор ${dispute._id} не активен, статус: ${dispute.status}`);
        }
        
        console.log(`Определение результата спора ${dispute._id}`);
        
        // Генерируем случайный результат - "heads" или "tails"
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        
        // Определяем победителя
        const creatorWins = (dispute.creatorSide === result);
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
        
        // Записываем в историю игр
        await this.addGameHistoryRecords(dispute, result, winAmount);
        
        // Оповещаем участников о результате
        await this.notifyPlayersAboutResult(dispute, result, creatorWins, winAmount);
        
        // Результат для возврата
        return {
            dispute,
            result,
            winnerTelegramId,
            creatorWins,
            winAmount,
            commission
        };
    } catch (error) {
        console.error('Ошибка определения результата спора:', error);
        throw error;
    }
};

// Добавление записей в историю игр
exports.addGameHistoryRecords = async (dispute, result, winAmount) => {
    try {
        // Определяем победителя и проигравшего
        const creatorWins = (dispute.creatorSide === result);
        const winnerId = creatorWins ? dispute.creator : dispute.opponent;
        const winnerTelegramId = creatorWins ? dispute.creatorTelegramId : dispute.opponentTelegramId;
        const loserId = creatorWins ? dispute.opponent : dispute.creator;
        const loserTelegramId = creatorWins ? dispute.opponentTelegramId : dispute.creatorTelegramId;
        
        // Получаем объекты пользователей
        const winnerUser = await User.findOne({ telegramId: winnerTelegramId });
        const loserUser = await User.findOne({ telegramId: loserTelegramId });
        
        if (!winnerUser || !loserUser) {
            throw new Error('Не удалось найти участников спора');
        }
        
        // Запись для победителя
        const winnerHistory = new GameHistory({
            userId: winnerUser._id,
            telegramId: winnerTelegramId,
            gameType: 'dispute',
            betAmount: dispute.bet.amount,
            outcome: 'win',
            winAmount: winAmount,
            gameData: {
                disputeId: dispute._id,
                question: dispute.question,
                opponentId: loserTelegramId,
                coinResult: result
            },
            disputeId: dispute._id
        });
        
        // Запись для проигравшего
        const loserHistory = new GameHistory({
            userId: loserUser._id,
            telegramId: loserTelegramId,
            gameType: 'dispute',
            betAmount: dispute.bet.amount,
            outcome: 'lose',
            winAmount: 0,
            gameData: {
                disputeId: dispute._id,
                question: dispute.question,
                opponentId: winnerTelegramId,
                coinResult: result
            },
            disputeId: dispute._id
        });
        
        await winnerHistory.save();
        await loserHistory.save();
        
        console.log(`Записи истории игр для спора ${dispute._id} добавлены`);
    } catch (error) {
        console.error('Ошибка добавления записей в историю игр:', error);
    }
};

// Оповещение участников о результате
exports.notifyPlayersAboutResult = async (dispute, result, creatorWins, winAmount) => {
    try {
        // Определяем стороны на русском
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
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            console.error('Токен Telegram бота не настроен');
            return;
        }
        
        if (dispute.creatorTelegramId) {
            try {
                await fetch(
                    `https://api.telegram.org/bot${botToken}/sendMessage`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: dispute.creatorTelegramId,
                            text: creatorWins ? winnerMessage : loserMessage
                        })
                    }
                );
            } catch (error) {
                console.error('Ошибка отправки уведомления создателю:', error);
            }
        }
        
        if (dispute.opponentTelegramId) {
            try {
                await fetch(
                    `https://api.telegram.org/bot${botToken}/sendMessage`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: dispute.opponentTelegramId,
                            text: creatorWins ? loserMessage : winnerMessage
                        })
                    }
                );
            } catch (error) {
                console.error('Ошибка отправки уведомления оппоненту:', error);
            }
        }
        
        // Обновляем сообщение в чате, если доступно
        if (dispute.messageId && dispute.chatId) {
            await this.sendDisputeResultMessage(dispute, result, creatorWins);
        }
        
        console.log(`Уведомления о результате спора ${dispute._id} отправлены участникам`);
    } catch (error) {
        console.error('Ошибка оповещения участников о результате:', error);
    }
};

// Отправка уведомления о статусе готовности
exports.sendReadyStatusNotification = async (dispute, isFromCreator) => {
    try {
        // Получаем токен бота из конфигурации
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            console.error('Токен Telegram бота не настроен');
            return;
        }
        
        // Загружаем информацию о пользователях, если нужно
        let creator = dispute.creator;
        let opponent = dispute.opponent;
        
        if (typeof creator !== 'object' || !creator.firstName) {
            creator = await User.findById(dispute.creator);
        }
        
        if (typeof opponent !== 'object' || !opponent.firstName) {
            opponent = await User.findById(dispute.opponent);
        }
        
        // Определяем получателя уведомления
        const recipientTelegramId = isFromCreator ? dispute.opponentTelegramId : dispute.creatorTelegramId;
        const senderName = isFromCreator ? 
            (creator && creator.firstName ? creator.firstName : 'Создатель') : 
            (opponent && opponent.firstName ? opponent.firstName : 'Оппонент');
        
        // Определяем статус отправителя
        const isReady = isFromCreator ? dispute.creatorReady : dispute.opponentReady;
        
        // Формируем текст уведомления
        const messageText = `🔄 <b>Обновление статуса спора</b>\n\n`
            + `Участник ${senderName} ${isReady ? 'готов' : 'отменил готовность'} к подбрасыванию монетки.\n\n`
            + `<b>Тема спора:</b> ${dispute.question}\n`
            + `<b>Сумма:</b> ${dispute.bet.amount} ⭐`;
        
        // Добавляем кнопку для открытия игры, если оба участника готовы
        let replyMarkup = {};
        
        if (dispute.creatorReady && dispute.opponentReady) {
            replyMarkup = {
                inline_keyboard: [
                    [
                        {
                            text: '🎮 Открыть комнату спора',
                            web_app: { url: `${process.env.WEBAPP_URL}?dispute=${dispute._id}` }
                        }
                    ]
                ]
            };
        }
        
        // Выполняем запрос к API Telegram для отправки уведомления
        const response = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: recipientTelegramId,
                    text: messageText,
                    parse_mode: 'HTML',
                    reply_markup: dispute.creatorReady && dispute.opponentReady ? replyMarkup : {}
                })
            }
        );
        
        const result = await response.json();
        if (!result.ok) {
            console.error('Ошибка отправки уведомления о готовности:', result.description);
        } else {
            console.log(`Уведомление о готовности для спора ${dispute._id} отправлено`);
        }
        
        return result;
    } catch (error) {
        console.error('Ошибка отправки уведомления о готовности:', error);
        return null;
    }
};

// Получение статуса комнаты спора
exports.getDisputeRoomStatus = async (req, res) => {
    try {
        const { disputeId } = req.params;
        
        // Проверяем существование спора
        const dispute = await Dispute.findById(disputeId)
            .populate('creator', 'telegramId firstName lastName username')
            .populate('opponent', 'telegramId firstName lastName username');
        
        if (!dispute) {
            return res.status(404).json({ message: 'Спор не найден' });
        }
        
        // Возвращаем статус комнаты
        res.status(200).json({
            disputeId: dispute._id,
            roomId: dispute.roomId,
            creatorReady: dispute.creatorReady,
            opponentReady: dispute.opponentReady,
            bothReady: dispute.creatorReady && dispute.opponentReady,
            status: dispute.status,
            result: dispute.result,
            winnerTelegramId: dispute.winnerTelegramId
        });
    } catch (error) {
        console.error('Ошибка получения статуса комнаты спора:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Закрытие комнаты спора
exports.closeDisputeRoom = async (req, res) => {
    try {
        const { disputeId, userTelegramId } = req.body;
        
        // Проверяем существование спора
        const dispute = await Dispute.findById(disputeId);
        if (!dispute) {
            return res.status(404).json({ message: 'Спор не найден' });
        }
        
        // Проверяем, что пользователь является участником спора
        const isCreator = dispute.creatorTelegramId == userTelegramId;
        const isOpponent = dispute.opponentTelegramId == userTelegramId;
        
        if (!isCreator && !isOpponent) {
            return res.status(403).json({ message: 'Вы не являетесь участником этого спора' });
        }
        
        // Сбрасываем статусы готовности, если спор еще активен
        if (dispute.status === 'active') {
            if (isCreator) {
                dispute.creatorReady = false;
            } else if (isOpponent) {
                dispute.opponentReady = false;
            }
            
            await dispute.save();
        }
        
        // Логируем закрытие комнаты
        console.log(`Комната спора ${dispute._id} закрыта пользователем ${userTelegramId}`);
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Ошибка закрытия комнаты спора:', error);
        res.status(500).json({ message: 'Server error' });
    }
};