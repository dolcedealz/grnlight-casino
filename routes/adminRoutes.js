// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Все админские маршруты должны проходить через проверку админских прав
router.use(adminController.isAdmin);

// Получение всех пользователей
router.get('/users', adminController.getAllUsers);

// Обновление шанса выигрыша пользователя
router.post('/user/winrate', adminController.updateWinRate);

// Обновление баланса пользователя
router.post('/user/balance', adminController.updateUserBalance);

// Блокировка/разблокировка пользователя
router.post('/user/ban', adminController.toggleBan);

// Получение статистики казино
router.get('/statistics', adminController.getStatistics);

// Новый маршрут: получение детальной статистики пользователя
router.get('/user/stats/:telegramId', adminController.getUserDetailedStats);

module.exports = router;