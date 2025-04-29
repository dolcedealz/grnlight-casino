const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// Process game result
router.post('/play', gameController.processGameResult);

// Get game history
router.get('/history/:telegramId', gameController.getGameHistory);

module.exports = router;