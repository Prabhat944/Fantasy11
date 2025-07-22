const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middleware/authMiddelware');
const adminAuthMiddleware = require('../middleware/adminAuthMiddelware')
const { generalLimiter, financialLimiter } = require('../middleware/rateLimiters');

router.get('/', authMiddleware, generalLimiter, walletController.getWalletDetails);

router.post('/deposit', authMiddleware, financialLimiter, walletController.depositFunds);
router.post('/win', authMiddleware, walletController.addWinningAmount);
router.post('/cashback', authMiddleware, walletController.addGstTdsCashback);
router.post('/bonus', authMiddleware, walletController.addBonus);

router.post('/deduct', authMiddleware, walletController.deductFunds);
router.post('/withdraw', authMiddleware, financialLimiter, walletController.withdrawFunds);

// NEW: Route for refunding funds
router.post('/refund', authMiddleware, walletController.refundFunds);

router.post('/referral-bonus', walletController.addReferralBonus);

router.get('/transactions', authMiddleware, generalLimiter, walletController.getTransactionsHistory);

router.post('/wallet/convert-bonus', authMiddleware, financialLimiter, walletController.convertBonusToDeposit);

router.post('/withdrawals/:transactionId/status', adminAuthMiddleware, async (req, res) => {
    console.log('>>> Reached /api/wallet/withdrawals/:transactionId/status route <<<');
    const { transactionId } = req.params;
    console.log('check transictionId', req.params.transactionId);
    const { status, remarks } = req.body; // status: 'Approved', 'Completed', 'Rejected', 'Failed'

    if (!status) {
        return res.status(400).json({ message: 'Status is required.' });
    }
    // You might want to validate 'status' against your enum: ['Pending', 'Processing', 'Completed', 'Failed']
    if (!['Approved', 'Completed', 'Rejected', 'Failed', 'Processing'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    try {
        const updatedTransaction = await walletController.updateWithdrawalStatus(transactionId, status, remarks);
        if (!updatedTransaction) {
            return res.status(404).json({ message: 'Withdrawal transaction not found.' });
        }
        res.status(200).json({ message: `Withdrawal transaction ${transactionId} status updated to ${status}.`, transaction: updatedTransaction });
    } catch (error) {
        console.error(`Error updating withdrawal status for ${transactionId}:`, error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

router.get('/details/:userId', adminAuthMiddleware, walletController.getWalletDetailsById);
module.exports = router;
