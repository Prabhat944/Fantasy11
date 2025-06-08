const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
// const authMiddleware = require('../middleware/authMiddleware'); // If needed for initiating payment

// router.post('/initiate', authMiddleware, paymentController.initiatePayment);
router.post('/initiate', paymentController.initiatePayment); // Auth might be done by API Gateway
router.post('/callback/:gateway', paymentController.handlePaymentCallback); // Webhook from gateway (usually public)
// router.get('/status/:transactionId', authMiddleware, paymentController.getPaymentStatus);

module.exports = router;