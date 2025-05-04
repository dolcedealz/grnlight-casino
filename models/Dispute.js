const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  opponent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  question: {
    type: String,
    required: true
  },
  bet: {
    amount: {
      type: Number,
      required: true
    },
    creatorChoice: {
      type: Boolean,
      default: null
    },
    opponentChoice: {
      type: Boolean,
      default: null
    }
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'voting', 'resolved', 'cancelled'],
    default: 'pending'
  },
  result: {
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    loser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    isDraw: {
      type: Boolean,
      default: false
    }
  },
  voting: {
    startedAt: {
      type: Date,
      default: null
    },
    endedAt: {
      type: Date,
      default: null
    },
    votes: [{
      voter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      voteFor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      votedAt: {
        type: Date,
        default: Date.now
      }
    }],
    totalVotes: {
      type: Number,
      default: 0
    }
  },
  metadata: {
    createdVia: {
      type: String,
      enum: ['inline', 'command', 'web'],
      default: 'command'
    },
    inlineMessageId: String,
    chatId: String
  }
}, {
  timestamps: true
});

// Индексы для оптимизации запросов
disputeSchema.index({ creator: 1, opponent: 1 });
disputeSchema.index({ status: 1 });
disputeSchema.index({ 'voting.endedAt': 1 });

// Виртуальные свойства
disputeSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

disputeSchema.virtual('isVoting').get(function() {
  return this.status === 'voting';
});

disputeSchema.virtual('isResolved').get(function() {
  return this.status === 'resolved';
});

disputeSchema.virtual('canVote').get(function() {
  return this.status === 'voting' && (!this.voting.endedAt || this.voting.endedAt > new Date());
});

// Методы экземпляра
disputeSchema.methods.activate = async function() {
  this.status = 'active';
  await this.save();
  return this;
};

disputeSchema.methods.startVoting = async function(duration = 24) {
  this.status = 'voting';
  this.voting.startedAt = new Date();
  this.voting.endedAt = new Date(Date.now() + duration * 60 * 60 * 1000); // duration в часах
  await this.save();
  return this;
};

disputeSchema.methods.addVote = async function(voterId, voteForId) {
  // Проверяем, может ли голосовать
  if (!this.canVote) {
    throw new Error('Голосование завершено или не начато');
  }

  // Проверяем, не голосовал ли уже
  const existingVote = this.voting.votes.find(v => 
    v.voter.toString() === voterId.toString()
  );

  if (existingVote) {
    throw new Error('Вы уже голосовали');
  }

  // Проверяем, что голос за одного из участников
  if (voteForId.toString() !== this.creator.toString() && 
      voteForId.toString() !== this.opponent.toString()) {
    throw new Error('Можно голосовать только за участников спора');
  }

  // Добавляем голос
  this.voting.votes.push({
    voter: voterId,
    voteFor: voteForId,
    votedAt: new Date()
  });

  this.voting.totalVotes += 1;
  await this.save();
  return this;
};

disputeSchema.methods.resolveByVoting = async function() {
  if (this.status !== 'voting') {
    throw new Error('Спор не находится в статусе голосования');
  }

  // Подсчитываем голоса
  const votesForCreator = this.voting.votes.filter(v => 
    v.voteFor.toString() === this.creator.toString()
  ).length;

  const votesForOpponent = this.voting.votes.filter(v => 
    v.voteFor.toString() === this.opponent.toString()
  ).length;

  // Определяем победителя
  if (votesForCreator > votesForOpponent) {
    this.result.winner = this.creator;
    this.result.loser = this.opponent;
  } else if (votesForOpponent > votesForCreator) {
    this.result.winner = this.opponent;
    this.result.loser = this.creator;
  } else {
    this.result.isDraw = true;
  }

  this.status = 'resolved';
  this.voting.endedAt = new Date();

  await this.save();
  return this;
};

disputeSchema.methods.cancel = async function() {
  if (this.status === 'resolved') {
    throw new Error('Нельзя отменить завершенный спор');
  }
  
  this.status = 'cancelled';
  await this.save();
  return this;
};

// Статические методы
disputeSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

disputeSchema.statics.findByParticipant = function(userId) {
  return this.find({
    $or: [
      { creator: userId },
      { opponent: userId }
    ]
  });
};

disputeSchema.statics.findPendingForUser = function(userId) {
  return this.find({
    opponent: userId,
    status: 'pending'
  });
};

disputeSchema.statics.findActiveVotings = function() {
  return this.find({
    status: 'voting',
    'voting.endedAt': { $gt: new Date() }
  });
};

// Автоматическое завершение голосования
disputeSchema.statics.checkAndResolveExpiredVotings = async function() {
  const expiredVotings = await this.find({
    status: 'voting',
    'voting.endedAt': { $lte: new Date() }
  });

  for (const dispute of expiredVotings) {
    try {
      await dispute.resolveByVoting();
    } catch (error) {
      console.error(`Failed to resolve dispute ${dispute._id}:`, error);
    }
  }
};

// Middleware для проверки баланса перед сохранением
disputeSchema.pre('save', async function(next) {
  if (this.isNew) {
    const User = mongoose.model('User');
    
    // Проверяем баланс создателя
    const creator = await User.findById(this.creator);
    if (!creator || creator.balance < this.bet.amount) {
      throw new Error('Недостаточно средств у создателя');
    }

    // Если спор уже принят, проверяем баланс оппонента
    if (this.status === 'active') {
      const opponent = await User.findById(this.opponent);
      if (!opponent || opponent.balance < this.bet.amount) {
        throw new Error('Недостаточно средств у оппонента');
      }
    }
  }
  
  next();
});

module.exports = mongoose.model('Dispute', disputeSchema);