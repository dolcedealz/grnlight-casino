// controllers/disputeController.js
const Dispute = require('../models/Dispute');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Get dispute by ID
exports.getDisputeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const dispute = await Dispute.findById(id);
    
    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }
    
    // Get creator and opponent details
    const creator = await User.findOne({ telegramId: dispute.creatorTelegramId });
    const opponent = await User.findOne({ telegramId: dispute.opponentTelegramId });
    
    // Format response
    const response = {
      id: dispute._id,
      creator: {
        telegramId: dispute.creatorTelegramId,
        username: creator ? creator.username : 'Unknown',
        side: dispute.creatorSide
      },
      opponent: {
        telegramId: dispute.opponentTelegramId,
        username: opponent ? opponent.username : 'Unknown',
        side: dispute.opponentSide
      },
      amount: dispute.amount,
      subject: dispute.subject,
      status: dispute.status,
      result: dispute.result,
      winnerId: dispute.winnerTelegramId,
      commissionAmount: dispute.commissionAmount,
      createdAt: dispute.createdAt,
      completedAt: dispute.completedAt
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update dispute result
exports.updateDisputeResult = async (req, res) => {
  try {
    const { disputeId, result, winnerId } = req.body;
    
    const dispute = await Dispute.findById(disputeId);
    
    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }
    
    // Only allow updating pending or accepted disputes
    if (dispute.status !== 'accepted') {
      return res.status(400).json({ message: 'This dispute cannot be updated' });
    }
    
    // Validate result
    if (result !== 'heads' && result !== 'tails') {
      return res.status(400).json({ message: 'Invalid result' });
    }
    
    // Validate winner
    if (winnerId !== dispute.creatorTelegramId && winnerId !== dispute.opponentTelegramId) {
      return res.status(400).json({ message: 'Invalid winner ID' });
    }
    
    // Find winner and loser
    const winner = await User.findOne({ telegramId: winnerId });
    const loser = await User.findOne({ 
      telegramId: winnerId === dispute.creatorTelegramId ? 
        dispute.opponentTelegramId : dispute.creatorTelegramId 
    });
    
    if (!winner || !loser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Calculate win amount with 5% commission
    const totalAmount = dispute.amount * 2;
    const commission = Math.floor(totalAmount * 0.05);
    const winAmount = totalAmount - commission;
    
    // Update dispute
    dispute.result = result;
    dispute.status = 'completed';
    dispute.completedAt = new Date();
    dispute.winnerId = winner._id;
    dispute.winnerTelegramId = winnerId;
    dispute.commissionAmount = commission;
    
    // Update winner's balance
    winner.balance += winAmount;
    await winner.save();
    
    // Record transaction
    const winTransaction = new Transaction({
      userId: winner._id,
      telegramId: winnerId,
      amount: winAmount,
      type: 'win',
      game: 'dispute'
    });
    
    await winTransaction.save();
    
    // Save dispute
    await dispute.save();
    
    res.status(200).json({ 
      success: true,
      dispute: {
        id: dispute._id,
        result,
        winnerId,
        winAmount,
        commission
      }
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user disputes
exports.getUserDisputes = async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    // Find user
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Find disputes where user is creator or opponent
    const disputes = await Dispute.find({
      $or: [
        { creatorTelegramId: parseInt(telegramId) },
        { opponentTelegramId: parseInt(telegramId) }
      ]
    }).sort({ createdAt: -1 });
    
    // Format response
    const formattedDisputes = await Promise.all(disputes.map(async (dispute) => {
      // Determine if user won
      const userWon = dispute.status === 'completed' && 
        dispute.winnerTelegramId === parseInt(telegramId);
      
      // Get opponent info
      const opponentId = parseInt(telegramId) === dispute.creatorTelegramId ? 
        dispute.opponentTelegramId : dispute.creatorTelegramId;
      
      const opponent = await User.findOne({ telegramId: opponentId });
      
      return {
        id: dispute._id,
        subject: dispute.subject,
        amount: dispute.amount,
        status: dispute.status,
        result: dispute.result,
        userSide: parseInt(telegramId) === dispute.creatorTelegramId ? 
          dispute.creatorSide : dispute.opponentSide,
        opponent: {
          telegramId: opponentId,
          username: opponent ? opponent.username : 'Unknown'
        },
        userWon: userWon,
        createdAt: dispute.createdAt,
        completedAt: dispute.completedAt
      };
    }));
    
    res.status(200).json(formattedDisputes);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};