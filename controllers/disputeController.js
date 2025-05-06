const Dispute = require('../models/Dispute');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

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
        const { creatorTelegramId, question, betAmount } = req.body;
        
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
            status: 'pending'
        });
        
        await dispute.save();
        
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
        const dispute = await Dispute.findById(disputeId);
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
            game: 'dispute'
        });
        
        const opponentTransaction = new Transaction({
            userId: opponent._id,
            telegramId: opponent.telegramId,
            amount: -dispute.bet.amount,
            type: 'bet',
            game: 'dispute'
        });
        
        await creatorTransaction.save();
        await opponentTransaction.save();
        
        res.status(200).json(dispute);
    } catch (error) {
        console.error('Ошибка при принятии спора:', error);
        res.status(500).json({ message: 'Server error' });
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
            game: 'dispute'
        });
        
        await winTransaction.save();
        
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