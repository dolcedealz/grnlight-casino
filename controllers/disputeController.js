const User = require('../models/User');
const Dispute = require('../models/Dispute');
const Transaction = require('../models/Transaction');

// Создание спора (используется как для inline, так и для обычных споров)
exports.createDispute = async (req, res) => {
  try {
    const { creatorId, opponentId, question, amount, createdVia = 'web' } = req.body;
    
    // Находим пользователей
    const creator = await User.findOne({ telegramId: creatorId });
    const opponent = await User.findOne({ telegramId: opponentId });
    
    if (!creator || !opponent) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    // Проверяем баланс создателя
    if (creator.balance < amount) {
      return res.status(400).json({ message: 'Недостаточно средств у создателя' });
    }
    
    // Создаем спор
    const dispute = new Dispute({
      creator: creator._id,
      opponent: opponent._id,
      question: question,
      bet: {
        amount: amount
      },
      metadata: {
        createdVia: createdVia
      },
      status: 'pending'
    });
    
    await dispute.save();
    
    res.status(201).json(dispute);
  } catch (error) {
    console.error('Ошибка создания спора:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Принятие спора
exports.acceptDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { userId } = req.body;
    
    const dispute = await Dispute.findById(disputeId).populate('creator opponent');
    
    if (!dispute) {
      return res.status(404).json({ message: 'Спор не найден' });
    }
    
    if (dispute.status !== 'pending') {
      return res.status(400).json({ message: 'Спор уже обработан' });
    }
    
    // Проверяем, что принимает именно оппонент
    const user = await User.findOne({ telegramId: userId });
    if (!user || user._id.toString() !== dispute.opponent._id.toString()) {
      return res.status(403).json({ message: 'Только оппонент может принять спор' });
    }
    
    // Проверяем баланс оппонента
    if (dispute.opponent.balance < dispute.bet.amount) {
      return res.status(400).json({ message: 'Недостаточно средств' });
    }
    
    // Принимаем спор
    dispute.status = 'active';
    await dispute.save();
    
    res.status(200).json(dispute);
  } catch (error) {
    console.error('Ошибка принятия спора:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Отклонение спора
exports.declineDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { userId } = req.body;
    
    const dispute = await Dispute.findById(disputeId);
    
    if (!dispute) {
      return res.status(404).json({ message: 'Спор не найден' });
    }
    
    if (dispute.status !== 'pending') {
      return res.status(400).json({ message: 'Спор уже обработан' });
    }
    
    // Проверяем, что отклоняет именно оппонент
    const user = await User.findOne({ telegramId: userId });
    if (!user || user._id.toString() !== dispute.opponent.toString()) {
      return res.status(403).json({ message: 'Только оппонент может отклонить спор' });
    }
    
    // Отклоняем спор
    dispute.status = 'cancelled';
    await dispute.save();
    
    res.status(200).json(dispute);
  } catch (error) {
    console.error('Ошибка отклонения спора:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Сделать выбор в споре (Да/Нет)
exports.makeChoice = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { userId, choice } = req.body;
    
    const dispute = await Dispute.findById(disputeId).populate('creator opponent');
    
    if (!dispute) {
      return res.status(404).json({ message: 'Спор не найден' });
    }
    
    if (dispute.status !== 'active') {
      return res.status(400).json({ message: 'Спор не активен' });
    }
    
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    // Определяем, кто делает выбор
    const isCreator = user._id.toString() === dispute.creator._id.toString();
    const isOpponent = user._id.toString() === dispute.opponent._id.toString();
    
    if (!isCreator && !isOpponent) {
      return res.status(403).json({ message: 'Вы не участвуете в этом споре' });
    }
    
    // Сохраняем выбор
    if (isCreator) {
      if (dispute.bet.creatorChoice !== null) {
        return res.status(400).json({ message: 'Вы уже сделали свой выбор' });
      }
      dispute.bet.creatorChoice = choice;
    } else {
      if (dispute.bet.opponentChoice !== null) {
        return res.status(400).json({ message: 'Вы уже сделали свой выбор' });
      }
      dispute.bet.opponentChoice = choice;
    }
    
    await dispute.save();
    
    // Если оба сделали выбор, начинаем голосование
    if (dispute.bet.creatorChoice !== null && dispute.bet.opponentChoice !== null) {
      await dispute.startVoting(24); // 24 часа на голосование
    }
    
    res.status(200).json(dispute);
  } catch (error) {
    console.error('Ошибка выбора в споре:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Голосование
exports.vote = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { voterId, voteFor } = req.body;
    
    const dispute = await Dispute.findById(disputeId).populate('creator opponent');
    
    if (!dispute) {
      return res.status(404).json({ message: 'Спор не найден' });
    }
    
    if (dispute.status !== 'voting') {
      return res.status(400).json({ message: 'Голосование не активно' });
    }
    
    const voter = await User.findOne({ telegramId: voterId });
    if (!voter) {
      return res.status(404).json({ message: 'Голосующий не найден' });
    }
    
    // Проверяем, что голосует не участник спора
    if (voter._id.toString() === dispute.creator._id.toString() || 
        voter._id.toString() === dispute.opponent._id.toString()) {
      return res.status(403).json({ message: 'Участники спора не могут голосовать' });
    }
    
    // Находим, за кого голосуем
    const voteForUser = await User.findOne({ telegramId: voteFor });
    if (!voteForUser) {
      return res.status(404).json({ message: 'Пользователь для голосования не найден' });
    }
    
    // Добавляем голос
    await dispute.addVote(voter._id, voteForUser._id);
    
    res.status(200).json({ message: 'Голос принят', dispute });
  } catch (error) {
    console.error('Ошибка голосования:', error);
    res.status(500).json({ message: error.message || 'Ошибка сервера' });
  }
};

// Завершение голосования и определение победителя
exports.resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    
    const dispute = await Dispute.findById(disputeId).populate('creator opponent');
    
    if (!dispute) {
      return res.status(404).json({ message: 'Спор не найден' });
    }
    
    if (dispute.status !== 'voting') {
      return res.status(400).json({ message: 'Спор не в статусе голосования' });
    }
    
    // Проверяем, истекло ли время голосования
    if (dispute.voting.endedAt > new Date()) {
      return res.status(400).json({ message: 'Голосование еще не завершено' });
    }
    
    // Завершаем голосование
    await dispute.resolveByVoting();
    
    // Обрабатываем результат
    if (!dispute.result.isDraw) {
      const winner = await User.findById(dispute.result.winner);
      const loser = await User.findById(dispute.result.loser);
      
      // Обновляем балансы
      winner.balance += dispute.bet.amount * 2;
      loser.balance -= dispute.bet.amount;
      
      await winner.save();
      await loser.save();
      
      // Создаем транзакции
      await Transaction.create({
        userId: winner._id,
        telegramId: winner.telegramId,
        amount: dispute.bet.amount * 2,
        type: 'win',
        game: 'dispute'
      });
      
      await Transaction.create({
        userId: loser._id,
        telegramId: loser.telegramId,
        amount: -dispute.bet.amount,
        type: 'bet',
        game: 'dispute'
      });
    } else {
      // В случае ничьей возвращаем деньги
      const creator = await User.findById(dispute.creator);
      const opponent = await User.findById(dispute.opponent);
      
      // Здесь можно реализовать логику возврата средств
    }
    
    res.status(200).json(dispute);
  } catch (error) {
    console.error('Ошибка завершения спора:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получение активных споров для голосования
exports.getActiveVotings = async (req, res) => {
  try {
    const disputes = await Dispute.find({
      status: 'voting',
      'voting.endedAt': { $gt: new Date() }
    }).populate('creator opponent', 'username firstName');
    
    res.status(200).json(disputes);
  } catch (error) {
    console.error('Ошибка получения активных голосований:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получение споров пользователя
exports.getUserDisputes = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    const disputes = await Dispute.find({
      $or: [
        { creator: user._id },
        { opponent: user._id }
      ]
    }).populate('creator opponent', 'username firstName')
      .sort({ createdAt: -1 });
    
    res.status(200).json(disputes);
  } catch (error) {
    console.error('Ошибка получения споров пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получение информации о конкретном споре
exports.getDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    
    const dispute = await Dispute.findById(disputeId)
      .populate('creator opponent', 'username firstName telegramId')
      .populate('result.winner result.loser', 'username firstName')
      .populate('voting.votes.voter voting.votes.voteFor', 'username firstName');
    
    if (!dispute) {
      return res.status(404).json({ message: 'Спор не найден' });
    }
    
    res.status(200).json(dispute);
  } catch (error) {
    console.error('Ошибка получения спора:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Отмена спора
exports.cancelDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { userId } = req.body;
    
    const dispute = await Dispute.findById(disputeId);
    
    if (!dispute) {
      return res.status(404).json({ message: 'Спор не найден' });
    }
    
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    // Проверяем права на отмену
    if (dispute.creator.toString() !== user._id.toString() || dispute.status !== 'pending') {
      return res.status(403).json({ message: 'Только создатель может отменить ожидающий спор' });
    }
    
    await dispute.cancel();
    
    res.status(200).json({ message: 'Спор отменен', dispute });
  } catch (error) {
    console.error('Ошибка отмены спора:', error);
    res.status(500).json({ message: error.message || 'Ошибка сервера' });
  }
};

// Автоматическая проверка и завершение истекших голосований
exports.checkExpiredVotings = async (req, res) => {
  try {
    await Dispute.checkAndResolveExpiredVotings();
    res.status(200).json({ message: 'Проверка завершена' });
  } catch (error) {
    console.error('Ошибка проверки истекших голосований:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};