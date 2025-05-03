const User = require('../models/User');
const Dispute = require('../models/Dispute');
const Transaction = require('../models/Transaction');

// Получение информации о споре
exports.getDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    
    const dispute = await Dispute.findById(disputeId);
    
    if (!dispute) {
      return res.status(404).json({ message: 'Спор не найден' });
    }
    
    // Получаем информацию об участниках
    const creator = await User.findOne({ telegramId: dispute.creatorId });
    const opponent = await User.findOne({ telegramId: dispute.opponentId });
    
    res.status(200).json({
      dispute,
      creator: {
        telegramId: creator.telegramId,
        firstName: creator.firstName,
        username: creator.username
      },
      opponent: {
        telegramId: opponent.telegramId,
        firstName: opponent.firstName,
        username: opponent.username
      }
    });
  } catch (error) {
    console.error('Ошибка получения спора:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Выбор стороны монеты
exports.chooseSide = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { telegramId, side } = req.body;
    
    const dispute = await Dispute.findById(disputeId);
    
    if (!dispute) {
      return res.status(404).json({ message: 'Спор не найден' });
    }
    
    if (dispute.status !== 'accepted') {
      return res.status(400).json({ message: 'Спор не в статусе принятого' });
    }
    
    // Проверяем, является ли пользователь участником спора
    if (telegramId !== dispute.creatorId && telegramId !== dispute.opponentId) {
      return res.status(403).json({ message: 'Вы не участник этого спора' });
    }
    
    // Сохраняем выбор
    if (telegramId === dispute.creatorId) {
      dispute.gameData.creatorChoice = side;
    } else {
      dispute.gameData.opponentChoice = side;
    }
    
    // Если оба выбрали, меняем статус
    if (dispute.gameData.creatorChoice && dispute.gameData.opponentChoice) {
      dispute.status = 'in_progress';
    }
    
    await dispute.save();
    
    res.status(200).json({ dispute });
  } catch (error) {
    console.error('Ошибка выбора стороны:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Подбрасывание монеты и определение победителя
exports.flipCoin = async (req, res) => {
  try {
    const { disputeId } = req.params;
    
    const dispute = await Dispute.findById(disputeId);
    
    if (!dispute) {
      return res.status(404).json({ message: 'Спор не найден' });
    }
    
    if (dispute.status !== 'in_progress') {
      return res.status(400).json({ message: 'Спор не готов к подбрасыванию монеты' });
    }
    
    // Подбрасываем монету
    const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
    dispute.gameData.coinSide = coinResult;
    
    // Определяем победителя
    let winnerId;
    let loserId;
    let result;
    
    if (dispute.gameData.creatorChoice === coinResult) {
      winnerId = dispute.creatorId;
      loserId = dispute.opponentId;
      result = 'creator_won';
    } else {
      winnerId = dispute.opponentId;
      loserId = dispute.creatorId;
      result = 'opponent_won';
    }
    
    // Обновляем статус спора
    dispute.winnerId = winnerId;
    dispute.result = result;
    dispute.status = 'completed';
    dispute.completedAt = new Date();
    
    await dispute.save();
    
    // Обновляем балансы
    const winner = await User.findOne({ telegramId: winnerId });
    const loser = await User.findOne({ telegramId: loserId });
    
    // Списываем со счета проигравшего
    loser.balance -= dispute.amount;
    await loser.save();
    
    // Начисляем победителю (удвоенная сумма минус комиссия)
    const commission = 0; // Можно добавить комиссию казино
    const winAmount = (dispute.amount * 2) - commission;
    winner.balance += winAmount;
    await winner.save();
    
    // Записываем транзакции
    // Транзакция для проигравшего
    const loserTransaction = new Transaction({
      userId: loser._id,
      telegramId: loser.telegramId,
      amount: -dispute.amount,
      type: 'bet',
      game: 'dispute'
    });
    await loserTransaction.save();
    
    // Транзакция для победителя
    const winnerTransaction = new Transaction({
      userId: winner._id,
      telegramId: winner.telegramId,
      amount: winAmount,
      type: 'win',
      game: 'dispute'
    });
    await winnerTransaction.save();
    
    // Возвращаем результат
    res.status(200).json({
      coinResult,
      winnerId,
      result,
      winAmount,
      dispute
    });
  } catch (error) {
    console.error('Ошибка подбрасывания монеты:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получение активных споров пользователя
exports.getUserDisputes = async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    const disputes = await Dispute.find({
      $or: [
        { creatorId: parseInt(telegramId) },
        { opponentId: parseInt(telegramId) }
      ],
      status: { $in: ['pending', 'accepted', 'in_progress'] }
    }).sort({ createdAt: -1 });
    
    res.status(200).json(disputes);
  } catch (error) {
    console.error('Ошибка получения споров пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Отмена спора (только создателем и только если статус pending)
exports.cancelDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { telegramId } = req.body;
    
    const dispute = await Dispute.findById(disputeId);
    
    if (!dispute) {
      return res.status(404).json({ message: 'Спор не найден' });
    }
    
    if (dispute.status !== 'pending') {
      return res.status(400).json({ message: 'Можно отменить только ожидающий спор' });
    }
    
    if (dispute.creatorId !== parseInt(telegramId)) {
      return res.status(403).json({ message: 'Только создатель может отменить спор' });
    }
    
    dispute.status = 'cancelled';
    await dispute.save();
    
    res.status(200).json({ message: 'Спор отменен', dispute });
  } catch (error) {
    console.error('Ошибка отмены спора:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};