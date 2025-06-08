// services/matchSyncService.js (or a similar utility file)
const cricketDataService = require('../services/cricketService'); // Adjusted path
const Match = require('../models/Match'); // Adjust path
// const redisClient = require('../utils/redisClient'); // Keep if you decide to use Redis caching within this sync

// const SYNC_SERIES_MATCHES_CACHE_TTL = 600; // Example: Cache for 10 minutes if using Redis here

async function syncUpcomingMatchesWithDB() {
  console.log(`[${new Date().toISOString()}] Starting: Sync upcoming matches (next 24h) with DB...`);
  let matchesSavedOrUpdated = 0;
  let matchesFailed = 0;
  let totalMatchesCollectedFromService = 0;

  try {
    const seriesList = await cricketDataService.upcomingSeriesList();

    if (!Array.isArray(seriesList) || seriesList.length === 0) {
      console.log(`[${new Date().toISOString()}] No series found from service to sync.`);
      return { success: true, fetched: 0, saved: 0, failed: 0, message: "No series found." };
    }
    console.log(`[${new Date().toISOString()}] Found ${seriesList.length} series lists from service.`);

    let allMatchesCollected = [];

    for (const series of seriesList) {
      const seriesId = series.id;
      if (!seriesId) {
        console.warn(`[${new Date().toISOString()}] Found a series without an ID during sync:`, series);
        continue;
      }

      // For this DB sync, we are fetching fresh from the service each time
      // If cricketDataService.getSeriesById is very slow/expensive, consider caching here with a short TTL.
      let matchesForThisSeries = [];
      try {
        const seriesInfoResponse = await cricketDataService.getSeriesById(seriesId);
        if (seriesInfoResponse && seriesInfoResponse.data && Array.isArray(seriesInfoResponse.data.matchList)) {
            matchesForThisSeries = seriesInfoResponse.data.matchList;
        } else {
            console.warn(`[${new Date().toISOString()}] No 'matchList' array in series_info for ${seriesId} during sync.`);
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error processing series ${seriesId} during sync:`, error.message);
      }

      if (Array.isArray(matchesForThisSeries) && matchesForThisSeries.length > 0) {
        allMatchesCollected.push(...matchesForThisSeries);
      }
    }

    totalMatchesCollectedFromService = allMatchesCollected.length;
    if (totalMatchesCollectedFromService === 0) {
      console.log(`[${new Date().toISOString()}] No matches collected from any series to sync.`);
      return { success: true, fetched: 0, saved: 0, failed: 0, message: "No matches collected from any series." };
    }
    console.log(`[${new Date().toISOString()}] Fetched ${totalMatchesCollectedFromService} matches in total from service before filtering.`);

    // ------------ MODIFIED FILTER ------------
    // Filter for matches starting from now and within the next 24 hours
    const now = new Date();
    const lookAheadLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    console.log(`[${new Date().toISOString()}] Current time for filter: ${now.toISOString()}`);
    console.log(`[${new Date().toISOString()}] Look ahead limit for filter (24h): ${lookAheadLimit.toISOString()}`);

    const matchesToStoreInDB = allMatchesCollected.filter(match => {
        if (!match || !match.id || !match.dateTimeGMT) {
            // console.warn(`[SYNC FILTER] Invalid match data or missing ID/dateTimeGMT:`, match ? match.id : 'N/A');
            return false;
        }
        
        const matchTime = new Date(match.dateTimeGMT);
        if (isNaN(matchTime.getTime())) {
            // console.warn(`[SYNC FILTER] Invalid match time for match ID ${match.id}: ${match.dateTimeGMT}`);
            return false; // Invalid date
        }

        // Match must be in the future (later than now) AND within the next 24 hours (less than or equal to lookAheadLimit)
        const shouldStore = matchTime > now && matchTime <= lookAheadLimit;
        // if (shouldStore) {
        //   console.log(`[SYNC FILTER] Match ID ${match.id} (${match.name}) at ${matchTime.toISOString()} IS within 24h window.`);
        // } else {
        //   console.log(`[SYNC FILTER] Match ID ${match.id} (${match.name}) at ${matchTime.toISOString()} IS NOT within 24h window.`);
        // }
        return shouldStore;
    });
    // ------------ END OF MODIFIED FILTER ------------

    console.log(`[${new Date().toISOString()}] Filtered down to ${matchesToStoreInDB.length} matches scheduled within the next 24 hours.`);

    if (matchesToStoreInDB.length === 0) {
        console.log(`[${new Date().toISOString()}] No matches found within the next 24 hours to store in DB.`);
    }

    for (const apiMatch of matchesToStoreInDB) { // Iterate over the filtered list
      // The check for !apiMatch || !apiMatch.id is already done in the filter, but good for safety
      if (!apiMatch || !apiMatch.id) { 
        matchesFailed++;
        continue;
      }

      try {
        const matchDataForDB = {
          externalMatchId: apiMatch.id,
          name: apiMatch.name,
          matchType: apiMatch.matchType ? apiMatch.matchType.toLowerCase() : 'other',
          status: apiMatch.status === "Match not started" ? "Upcoming" : apiMatch.status, 
          venue: apiMatch.venue,
          date: apiMatch.date,
          dateTimeGMT: new Date(apiMatch.dateTimeGMT),
          teams: apiMatch.teams || [],
          teamInfo: apiMatch.teamInfo || [],
          fantasyEnabled: apiMatch.fantasyEnabled || false,
        };

        const result = await Match.updateOne(
          { externalMatchId: apiMatch.id },
          { $set: matchDataForDB },
          { upsert: true }
        );
        
        if (result.upsertedCount > 0) {
            matchesSavedOrUpdated++;
            console.log(`   [DB SYNC] Inserted match: ${apiMatch.name} (ID: ${apiMatch.id}) (Starts: ${matchDataForDB.dateTimeGMT.toISOString()})`);
        } else if (result.modifiedCount > 0) {
            matchesSavedOrUpdated++;
            console.log(`   [DB SYNC] Updated match: ${apiMatch.name} (ID: ${apiMatch.id}) (Starts: ${matchDataForDB.dateTimeGMT.toISOString()})`);
        } else if (result.matchedCount > 0) {
            // This means it matched but $set didn't change anything - already up-to-date
            // console.log(`   [DB SYNC] Match already up-to-date: ${apiMatch.name} (ID: ${apiMatch.id})`);
            matchesSavedOrUpdated++; // Still count as "processed" or "verified"
        }

      } catch (dbError) {
        matchesFailed++;
        console.error(`[${new Date().toISOString()}] Error saving match ID ${apiMatch.id} (${apiMatch.name}) to DB:`, dbError.message);
      }
    }

    console.log(`[${new Date().toISOString()}] Finished: Sync upcoming matches (next 24h) with DB. Total Collected from Service: ${totalMatchesCollectedFromService}, Filtered for Next 24h: ${matchesToStoreInDB.length}, Saved/Updated in DB: ${matchesSavedOrUpdated}, Failed: ${matchesFailed}.`);
    return { success: true, fetched: totalMatchesCollectedFromService, upcomingIn24h: matchesToStoreInDB.length, saved: matchesSavedOrUpdated, failed: matchesFailed };

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Top-level error in syncUpcomingMatchesWithDB:`, error.message, error.stack);
    return { success: false, fetched: totalMatchesCollectedFromService, saved: matchesSavedOrUpdated, failed: matchesFailed, error: error.message };
  }
}

module.exports = { syncUpcomingMatchesWithDB };