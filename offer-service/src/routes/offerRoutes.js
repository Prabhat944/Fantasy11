const express = require('express');
const router = express.Router();

// Import the controller functions
const {
    createMatchOffer,
    trackOfferProgress,
    processCompletedMatchOffers,
    createDepositOffer,
    getActiveDepositOffer,
    getUnprocessedMatchOffers
} = require('../controllers/offerController');
// Import your authentication middleware
// We need both the admin and standard user middleware
const authMiddleware = require('../middleware/authMiddleware'); // For user-authenticated requests
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware'); // For admin-only actions

// --- Offer Service Routes ---


/**
 * @route   POST /api/offers/create
 * @desc    Admin creates a new offer for a specific match
 * @access  Private (Admin Only)
 */
router.post('/create-offer', adminAuthMiddleware, createMatchOffer);

router.get('/unprocessed-match-offers', adminAuthMiddleware, getUnprocessedMatchOffers);
/**
 * @route   POST /api/offers/track-progress
 * @desc    Called by Contest Service to track a user's progress for an offer
 * @access  Private (Requires a valid user token, forwarded by the Contest Service)
 */
router.post('/track-progress', authMiddleware, trackOfferProgress);


/**
 * @route   POST /api/offers/process-match/:matchId
 * @desc    Admin or cron job triggers the processing of a completed match's offer
 * @access  Private (Admin Only)
 */
router.post('/process-match/:matchId', adminAuthMiddleware, processCompletedMatchOffers);

router.post('/deposit-offer/create', adminAuthMiddleware, createDepositOffer);

// Internal route for the Wallet Service to use
router.get('/deposit-offer/active', getActiveDepositOffer);

module.exports = router;