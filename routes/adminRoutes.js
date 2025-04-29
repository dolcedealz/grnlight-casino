const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// All admin routes should go through admin check middleware
router.use(adminController.isAdmin);

// Get all users
router.get('/users', adminController.getAllUsers);

// Update user win rate
router.post('/user/winrate', adminController.updateWinRate);

// Update user balance
router.post('/user/balance', adminController.updateUserBalance);

// Ban/unban user
router.post('/user/ban', adminController.toggleBan);

// Get casino statistics
router.get('/statistics', adminController.getStatistics);

module.exports = router;