const mongoose = require('mongoose');
require('dotenv').config();

// Adjust paths if needed
const OfferProgress = require('../models/OfferProgress');
const MatchOffer = require('../models/MatchOffer');

const MONGO_URI = process.env.MONGO_URI;

const fixOfferStatuses = async () => {
    if (!MONGO_URI) {
        console.error('❌ MONGO_URI not found in .env file.');
        return;
    }

    console.log('Connecting to database to fix statuses...');
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Database connected.');

        // 1. Find all active offers to get their requirements
        const activeOffers = await MatchOffer.find({ isActive: true }).lean();
        const offerRequirements = new Map(activeOffers.map(o => [o.matchId, o.requiredContests]));

        // 2. Find all progress docs that are "IN_PROGRESS"
        const progressesToFix = await OfferProgress.find({ status: 'IN_PROGRESS' });

        if (progressesToFix.length === 0) {
            console.log('No "IN_PROGRESS" documents found to fix.');
            return;
        }

        let fixedCount = 0;
        console.log(`Found ${progressesToFix.length} documents to check...`);

        // 3. Loop through and check if they should be updated
        for (const progress of progressesToFix) {
            const requiredCount = offerRequirements.get(progress.matchId);

            if (requiredCount && progress.contestsJoinedCount >= requiredCount) {
                progress.status = 'COMPLETED';
                await progress.save();
                fixedCount++;
                console.log(`   -> Updated status to COMPLETED for user ${progress.userId} in match ${progress.matchId}`);
            }
        }
        
        console.log(`✅ Finished. Total documents updated: ${fixedCount}`);

    } catch (error) {
        console.error('❌ An error occurred during the status fix process:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🚫 Database disconnected.');
    }
};

// Run the script
fixOfferStatuses();