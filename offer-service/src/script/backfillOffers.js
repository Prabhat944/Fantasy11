const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

// Make sure these paths are correct for your Offer Service
const OfferProgress = require('../models/OfferProgress');
const MatchOffer = require('../models/MatchOffer');

const MONGO_URI = process.env.MONGO_URI;
const CONTEST_SERVICE_URL = process.env.CONTEST_SERVICE_URL;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

const createAndBackfillOffers = async () => {
    if (!CONTEST_SERVICE_URL || !INTERNAL_API_TOKEN || !MONGO_URI) {
        console.error('❌ Please define MONGO_URI, CONTEST_SERVICE_URL, and INTERNAL_API_TOKEN in your .env file.');
        return;
    }

    console.log('Connecting to Offer Service database...');
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Database connected.');

        // 1. Find all matches that have an active offer
        const activeOffers = await MatchOffer.find({ isActive: true }).lean();
        console.log(`Found ${activeOffers.length} active offers to process...`);

        // 2. Loop through each offer
        for (const offer of activeOffers) {
            const { matchId } = offer;
            console.log(`--- Processing Match ID: ${matchId} ---`);

            // 3. Get all participants for this match via an API call to the Contest Service
            const participantsResponse = await axios.get(
                `${CONTEST_SERVICE_URL}/api/v1/user/internal/participants-by-match/${matchId}`,
                { headers: { 'Authorization': `Bearer ${INTERNAL_API_TOKEN}` } }
            );
            
            // The API returns an array of full participation objects
            const participations = participantsResponse.data.userIds;

            if (!participations || participations.length === 0) {
                console.log('   -> No participations found for this match via API. Skipping.');
                continue;
            }

            // Extract the unique user IDs from the participation objects
            const uniqueUserIds = [...new Set(participations.map(p => p.user))];
            console.log(`   -> Found ${uniqueUserIds.length} unique users for this match.`);

            // 4. For each unique user, get their contest list and update their progress
            for (const userId of uniqueUserIds) {
                console.log(`      -> Now processing details for userId: ${userId}`);
                
                // Make the second API call to get the specific contests for this user/match
                const contestDetailsResponse = await axios.get(
                    `${CONTEST_SERVICE_URL}/api/v1/user/internal/participations-by-user-match`,
                    {
                        params: { userId, matchId },
                        headers: { 'Authorization': `Bearer ${INTERNAL_API_TOKEN}` }
                    }
                );
                
                const { contestIds } = contestDetailsResponse.data;
                // This log will tell us if the second API call is returning contests or an empty array
                console.log(`      -> API returned ${contestIds ? contestIds.length : 0} contests for this user.`);

                if (!contestIds || contestIds.length === 0) {
                    console.log(`      -> Skipping user because no specific contests were found.`);
                    continue;
                }

                // 5. Use findOneAndUpdate with "upsert" to create or update the document in one database operation
                const progress = await OfferProgress.findOneAndUpdate(
                    { userId, matchId }, 
                    { 
                        $set: {
                            userId,
                            matchId,
                            offerId: offer._id,
                            joinedContests: contestIds,
                            contestsJoinedCount: contestIds.length
                        }
                    },
                    { upsert: true, new: true } 
                );
                
                console.log(`      -> ✅ Processed progress for user ${userId} with ${progress.contestsJoinedCount} contests.`);
            }
        }

    } catch (error) {
        if(error.response) {
            console.error('❌ An API error occurred:', { status: error.response.status, data: error.response.data });
        } else {
            console.error('❌ An error occurred during the process:', error);
        }
    } finally {
        await mongoose.disconnect();
        console.log('🚫 Database disconnected.');
    }
};

// Run the script
createAndBackfillOffers();