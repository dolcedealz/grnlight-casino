const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/disputeController');

// Получение информации о споре
router.get('/:disputeId', disputeController.getDispute);

// Выбор стороны монеты
router.post('/:disputeId/choose-side', disputeController.chooseSide);

// Подбрасывание монеты
router.post('/:disputeId/flip', disputeController.flipCoin);

// Получение активных споров пользователя
router.get('/user/:telegramId', disputeController.getUserDisputes);

// Отмена спора
router.post('/:disputeId/cancel', disputeController.cancelDispute);

module.exports = router;