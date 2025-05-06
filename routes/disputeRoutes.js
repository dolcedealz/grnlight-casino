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

module.exports = router;