const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/disputeController');

// Создание спора
router.post('/create', disputeController.createDispute);

// Принятие спора
router.post('/:disputeId/accept', disputeController.acceptDispute);

// Отклонение спора
router.post('/:disputeId/decline', disputeController.declineDispute);

// Сделать выбор в споре (Да/Нет)
router.post('/:disputeId/choose', disputeController.makeChoice);

// Голосование
router.post('/:disputeId/vote', disputeController.vote);

// Завершение спора
router.post('/:disputeId/resolve', disputeController.resolveDispute);

// Получение активных голосований
router.get('/active-votings', disputeController.getActiveVotings);

// Получение информации о конкретном споре
router.get('/:disputeId', disputeController.getDispute);

// Получение споров пользователя
router.get('/user/:userId', disputeController.getUserDisputes);

// Отмена спора
router.post('/:disputeId/cancel', disputeController.cancelDispute);

// Проверка истекших голосований (можно вызывать по cron)
router.post('/check-expired', disputeController.checkExpiredVotings);

module.exports = router;