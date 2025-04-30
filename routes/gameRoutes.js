// routes/gameRoutes.js
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// Обработка результата игры
router.post('/play', gameController.processGameResult);

// Получение истории игр
router.get('/history/:telegramId', gameController.getGameHistory);

// Новый маршрут: получение статистики игр пользователя
router.get('/stats/:telegramId', gameController.getUserGameStats);

module.exports = router;