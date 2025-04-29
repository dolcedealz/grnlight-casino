const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Register or update user
router.post('/register', userController.registerUser);

// Get user profile
router.get('/profile/:telegramId', userController.getUserProfile);

// Update user balance
router.post('/balance', userController.updateBalance);

// Get transaction history
router.get('/transactions/:telegramId', userController.getTransactions);

module.exports = router;