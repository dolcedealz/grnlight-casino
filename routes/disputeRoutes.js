// routes/disputeRoutes.js
const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/disputeController');

// Получение всех активных споров
router.get('/all', disputeController.getAllDisputes);

// Получение спора по ID
router.get('/:id', disputeController.getDisputeById);

// Создание нового спора
router.post('/create', disputeController.createDispute);

// Принятие спора
router.post('/accept', disputeController.acceptDispute);

// Получение результата спора
router.post('/result', disputeController.getDisputeResult);

// Получение истории споров пользователя
router.get('/history/:telegramId', disputeController.getUserDisputeHistory);

// Создание комнаты для спора
router.post('/room/create', disputeController.createDisputeRoom);

// Обновление статуса готовности игрока
router.post('/room/ready', disputeController.updatePlayerReadyStatus);

// Получение статуса комнаты спора
router.get('/room/:disputeId', disputeController.getDisputeRoomStatus);

// Закрытие комнаты спора
router.post('/room/close', disputeController.closeDisputeRoom);

module.exports = router;