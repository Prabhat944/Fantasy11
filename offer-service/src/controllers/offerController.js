const MatchOffer = require('../models/MatchOffer');
const OfferProgress = require('../models/OfferProgress');
const axios = require('axios');
const DepositOffer = require('../models/DepositOffer');

// This is the URL for the Wallet Service endpoint we created in Step 1
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL ; // Replace with your Wallet Service URL
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;
// Called by the Contest Service every time a user joins a contest
exports.trackOfferProgress = async (req, res) => {
    // 1. Get contestId from the request body now
    const { userId, matchId, contestId } = req.body;
    console.log(`--- Tracking offer progress for user: ${userId}, match: ${matchId}, contest: ${contestId} ---`);

    try {
        const offer = await MatchOffer.findOne({ matchId: matchId, isActive: true }).lean();
        
        if (!offer) {
            console.log(`Info: No active offer for this match. Stopping.`);
            return res.status(200).json({ message: 'No active offer for this match.' });
        }

        let progress = await OfferProgress.findOne({ userId, matchId });
        
        if (!progress) {
            progress = new OfferProgress({ userId, matchId });
            console.log(`New progress tracker created for user ${userId} and match ${matchId}`);
        }
        
        // 2. Add the new contest ID to the array, only if it's not already there
        if (!progress.joinedContests.includes(contestId)) {
            progress.joinedContests.push(contestId);
        }

        // 3. Set the count based on the array's length for accuracy
        progress.contestsJoinedCount = progress.joinedContests.length;
        console.log(`User ${userId} contest count for match ${matchId} is now: ${progress.contestsJoinedCount}`);

        // Check for completion
        if (progress.contestsJoinedCount >= offer.requiredContests && progress.status !== 'COMPLETED') {
            progress.status = 'COMPLETED';
            console.log(`User ${userId} has COMPLETED the offer!`);
            // Add logic here to trigger the bonus conversion
        }
        
        await progress.save();
        res.status(200).json({ message: 'Progress tracked successfully.', progress });

    } catch (error) {
        console.error('❌ CRITICAL ERROR saving offer progress:', error);
        res.status(500).json({ message: 'Failed to track progress.' });
    }
};

exports.getUnprocessedMatchOffers = async (req, res) => {
    try {
        const offers = await MatchOffer.find({ isProcessed: false, isActive: true }).select('matchId').lean();
        res.status(200).json(offers);
    } catch (error) {
        console.error('Error fetching unprocessed match offers:', error);
        res.status(500).json({ message: 'Failed to fetch unprocessed offers.' });
    }
};
// This function should be called AFTER a match is finished.
// This function should be called AFTER a match is finished.
exports.processCompletedMatchOffers = async (req, res) => {
    const { matchId } = req.params;

    try {
        const offer = await MatchOffer.findOne({ matchId: matchId, isProcessed: false });
        if (!offer) {
            return res.status(404).json({ message: `No unprocessed offer found for match: ${matchId}` });
        }

        const completedProgress = await OfferProgress.find({
            matchId: matchId,
            status: 'COMPLETED'
        });

        let successCount = 0;
        for (const progress of completedProgress) {
            try {
                const walletResponse = await axios.get(
                    `${WALLET_SERVICE_URL}/api/wallet/details/${progress.userId}`,
                    {
                        headers: { 'Authorization': `Bearer ${INTERNAL_API_TOKEN}` }
                    }
                );

                if (!walletResponse.data || typeof walletResponse.data.signup_bonus_balance === 'undefined') {
                    console.error(`Invalid wallet details received for user ${progress.userId}`);
                    continue;
                }

                const signupBonus = walletResponse.data.signup_bonus_balance;

                if (signupBonus > 0) {
                    const amountToConvert = (signupBonus * offer.conversionPercentage) / 100;
                    const finalAmountToConvert = Math.min(amountToConvert, signupBonus);

                    if (finalAmountToConvert > 0) {
                        await axios.post(
                            `${WALLET_SERVICE_URL}/api/wallet/wallet/convert-bonus`,
                            {
                                userId: progress.userId,
                                amountToConvert: finalAmountToConvert,
                                reason: `Offer conversion for match: ${matchId}`
                            },
                            {
                                headers: { 'Authorization': `Bearer ${INTERNAL_API_TOKEN}` }
                            }
                        );
                    }
                }

                progress.status = 'PROCESSED';
                await progress.save();
                successCount++;

            } catch (processingError) {
                console.error(`⚠️ Failed to process offer for user ${progress.userId}:`,
                    processingError.response ? processingError.response.data : processingError.message);

                // ✅ Skip this user and continue to next one
                continue;
            }
        }

        // ✅ Mark the entire offer as processed after all users
        offer.isProcessed = true;
        await offer.save();

        console.log(`✅ Offer for match ${matchId} fully processed. Total users processed: ${successCount}`);
        res.status(200).json({
            message: `Successfully processed ${successCount} completed user offers for match ${matchId}.`
        });

    } catch (error) {
        console.error(`Error processing match offers for matchId ${matchId}:`, error);
        res.status(500).json({ message: 'Failed to process offers.' });
    }
};


// A function to create an offer for a match
exports.createMatchOffer = async (req, res) => {
    try {
        const offer = new MatchOffer(req.body);
        await offer.save();
        res.status(201).json(offer);
    } catch (error) {
        res.status(400).json({ message: 'Failed to create offer.', error: error.message });
    }
};


// For an admin to create a new deposit offer
exports.createDepositOffer = async (req, res) => {
    try {
        const offer = new DepositOffer(req.body);
        await offer.save();
        res.status(201).json({ message: 'Deposit offer created successfully', offer });
    } catch (error) {
        res.status(400).json({ message: 'Failed to create deposit offer', error: error.message });
    }
};

// For the Wallet Service to check for the currently active offer
// exports.getActiveDepositOffer = async (req, res) => {
//     try {
//         const now = new Date();
//         const activeOffer = await DepositOffer.findOne({
//             isActive: true,
//             startDate: { $lte: now },
//             endDate: { $gte: now }
//         }).lean();

//         if (!activeOffer) {
//             return res.status(404).json({ message: 'No active deposit offer found.' });
//         }
//         res.status(200).json(activeOffer);
//     } catch (error) {
//         res.status(500).json({ message: 'Server error fetching active offer.' });
//     }
// };

// In your Offer Service controller

exports.getActiveDepositOffer = async (req, res) => {
    try {
        const now = new Date();

        // We will run two database searches at the same time using Promise.all
        // This is more efficient than running them one after another.
        const [depositOffers, matchOffers] = await Promise.all([
            // Query 1: Find all active Deposit Offers
            DepositOffer.find({
                isActive: true,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean(),

            // Query 2: Find all Match Offers
            // Note: Your MatchOffer doesn't have active/date fields.
            // This query fetches all of them. You may need to add filters later.
            MatchOffer.find({}).lean() 
        ]);

        // Combine the two arrays into one single array
        const allOffers = [...depositOffers, ...matchOffers];

        res.status(200).json(allOffers);

    } catch (error) {
        console.error("Error fetching all active offers:", error);
        res.status(500).json({ message: 'Server error fetching all offers.' });
    }
};