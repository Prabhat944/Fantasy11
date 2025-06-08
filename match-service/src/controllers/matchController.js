const cricketDataService = require('../service/cricketAPIService');
// const ContestParticipation = require('../models/ContestParticipation');
// const Team = require('../models/TeamSchema');
const getCountdown = require('../utils/countDown');
// const UserMatch = require('../models/UserMatchStore');
const mongoose = require('mongoose');
const redisClient = require('../utils/redisClient'); // Assuming your client is exported from here
const SERIES_MATCHES_CACHE_TTL = 3600; // Cache TTL for matches within a series: 1 hour (in seconds)



exports.getUpcomingMatches = async (req, res) => {
  try {
    const seriesList = await cricketDataService.upcomingSeriesList();

    if (!Array.isArray(seriesList) || seriesList.length === 0) {
      console.log('[getUpcomingMatches] No series found from service.');
      return res.json([]);
    }

    let allMatchesCollected = [];

    for (const series of seriesList) {
      const seriesId = series.id; // Ensure 'series.id' is the correct series identifier
      if (!seriesId) {
        console.warn('[getUpcomingMatches] Found a series without an ID:', series);
        continue;
      }

      const redisKey = `series:${seriesId}:matches`;
      let matchesForThisSeries = [];

      try {
        const cachedMatchesString = await redisClient.get(redisKey);
        if (cachedMatchesString) {
          matchesForThisSeries = JSON.parse(cachedMatchesString);
          console.log(`[getUpcomingMatches] Cache HIT for series matches: ${seriesId}`);
        } else {
          console.log(`[getUpcomingMatches] Cache MISS for series matches: ${seriesId}`);
          const seriesInfoResponse = await cricketDataService.getSeriesById(seriesId); // Parameter here is seriesId

          // *** CRITICAL: Adjust path to match list in seriesInfoResponse ***
          if (seriesInfoResponse && seriesInfoResponse.data && Array.isArray(seriesInfoResponse.data.matchList)) {
            matchesForThisSeries = seriesInfoResponse.data.matchList;
          } else {
            console.warn(`[getUpcomingMatches] No 'matchList' array in series_info for ${seriesId}. Response:`, JSON.stringify(seriesInfoResponse ? seriesInfoResponse.data : 'No response data'));
            matchesForThisSeries = [];
          }
          // *****************************************************************

          if (matchesForThisSeries.length > 0) {
            await redisClient.setEx(redisKey, SERIES_MATCHES_CACHE_TTL, JSON.stringify(matchesForThisSeries));
            console.log(`[getUpcomingMatches] Cached matches for series ${seriesId}.`);
          }
        }
      } catch (error) {
        console.error(`[getUpcomingMatches] Error processing series ${seriesId}:`, error.message);
      }

      if (Array.isArray(matchesForThisSeries) && matchesForThisSeries.length > 0) {
        allMatchesCollected.push(...matchesForThisSeries);
      }
    }

    if (allMatchesCollected.length === 0) {
      console.log('[getUpcomingMatches] No matches collected.');
      return res.json([]);
    }

    const uniqueMatchesMap = new Map();
    allMatchesCollected.forEach(match => {
      if (match && match.id) {
        uniqueMatchesMap.set(match.id, match);
      }
    });
    const uniqueMatchesArray = Array.from(uniqueMatchesMap.values());

    // -------- ADDING FILTER FOR TRULY UPCOMING MATCHES --------
    const now = new Date();
    const trulyUpcomingMatches = uniqueMatchesArray.filter(match => {
      if (!match) return false;

      const matchDateStr = match.dateTimeGMT || match.start_time; // Ensure your match objects have one of these
      if (!matchDateStr) {
        console.warn(`[getUpcomingMatches] Match ID ${match.id || 'N/A'} lacks a date (dateTimeGMT/start_time). Excluding.`);
        return false;
      }

      const matchTime = new Date(matchDateStr);
      if (isNaN(matchTime.getTime())) {
        console.warn(`[getUpcomingMatches] Match ID ${match.id || 'N/A'} has invalid date: ${matchDateStr}. Excluding.`);
        return false;
      }

      // Condition 1: Match time must be in the future
      const isFuture = matchTime > now;

      // Condition 2: Check match status if available (recommended)
      // Ensure match.status is a field in your match objects from the API
      let statusIsAppropriateForUpcoming = true;
      if (match.status) {
        const lowerStatus = String(match.status).toLowerCase();
        // Define statuses that mean a match is NOT upcoming
        const nonUpcomingStatuses = ['completed', 'live', 'ended', 'cancelled', 'abandoned', 'result', 'nodata'];
        if (nonUpcomingStatuses.includes(lowerStatus)) {
          statusIsAppropriateForUpcoming = false;
        }
      }
      return isFuture && statusIsAppropriateForUpcoming;
    });
    // -----------------------------------------------------------

    if (trulyUpcomingMatches.length === 0) {
        console.log('[getUpcomingMatches] No truly upcoming matches found after filtering.');
        return res.json([]);
    }

    const enrichedMatches = trulyUpcomingMatches.map(match => { // Use trulyUpcomingMatches here
      const matchTime = match.dateTimeGMT || match.start_time;
      return {
        ...match,
        dateTime: matchTime,
        countdown: getCountdown(matchTime, 'future')
      };
    }).filter(Boolean);

    enrichedMatches.sort((a, b) => {
      const dateA = new Date(a.dateTime);
      const dateB = new Date(b.dateTime);
      // No need for isValidDate checks here if filtered correctly, but doesn't hurt
      return dateA - dateB;
    });

    return res.json(enrichedMatches);

  } catch (error) {
    console.error('[getUpcomingMatches] Top-level error:', error);
    return res.status(500).json({ message: 'Failed to fetch upcoming matches', error: error.message });
  }
};

/**
 * @desc Fetch recent matches
 */
exports.getRecentMatches = async (req, res) => {
  try {
    const matches = await cricketDataService.recentMatchesList();
    return res.json(matches);
  } catch (error) {
    console.error('[getRecentMatches]', error);
    return res.status(500).json({ message: 'Failed to fetch recent matches', error: error.message });
  }
};

exports.getMyMatches = async (req, res) => {
  try {
    const userId = req.user?._id;
    console.log('[getMyMatches] For User:', userId);

    // Step 1: Fetch more details from ContestParticipation
    // Select fields relevant to contest outcomes: isWinner, prizeWon, rank, totalPoints
    const participations = await ContestParticipation.find({ user: userId })
      .select('matchId contestId isWinner prizeWon rank totalPoints') // Added outcome fields
      .lean(); // Use .lean() for plain JS objects, good for performance

    const matchIds = participations.map(p => p.matchId?.toString().trim()).filter(id => id); // Filter out any null/undefined matchIds

    if (!matchIds.length) {
      return res.json({ upcoming: [], live: [], completed: [] });
    }

    // Step 2: Restructure how contest details are stored per match
    // This will replace 'contestsByMatch'
    const userContestDetailsByMatch = {};
    participations.forEach(p => {
      const mid = p.matchId.toString().trim();
      if (!userContestDetailsByMatch[mid]) {
        userContestDetailsByMatch[mid] = [];
      }
      userContestDetailsByMatch[mid].push({
        contestId: p.contestId.toString(), // Convert ObjectId to string
        isWinner: p.isWinner,
        prizeWon: p.prizeWon,
        rank: p.rank,
        totalPoints: p.totalPoints
      });
    });

    // User teams logic (remains mostly the same)
    const userTeams = await Team.find({ user: userId, matchId: { $in: matchIds } }).lean(); // Added .lean()

    const teamsCountByMatch = {};
    const userTeamsByMatch = {};

    userTeams.forEach(team => {
      const mid = team.matchId.toString().trim();
      teamsCountByMatch[mid] = (teamsCountByMatch[mid] || 0) + 1;
      userTeamsByMatch[mid] = userTeamsByMatch[mid] || [];
      userTeamsByMatch[mid].push({
        _id: team._id.toString(), // Convert ObjectId to string
        players: team.players,
        captain: team.captain,
        viceCaptain: team.viceCaptain
      });
    });

    // Fetching external match data (remains the same)
    const [recentMatchesResponse, upcomingMatchesResponse] = await Promise.all([
      cricketDataService.recentMatchesList(),
      cricketDataService.upcomingMatchesList()
    ]);
// console.log('check for upcoming matches', upcomingMatchesResponse)
    const externalMatches = [...(recentMatchesResponse?.data || []), ...(upcomingMatchesResponse?.data || [])]; // Ensure upcoming also checks .data
    // console.log('check externalMatches', externalMatches);
    const externalMatchMap = {};
    externalMatches.forEach(m => {
      const mid = (m.match_id || m.id)?.toString();
      if (mid) externalMatchMap[mid] = m;
    });

    const savedMatches = await UserMatch.find({ user: userId, matchId: { $in: matchIds } }).lean(); // Added .lean()
    const savedMatchMap = {};
    savedMatches.forEach(m => {
      savedMatchMap[m.matchId.toString().trim()] = m.matchInfo; // Ensure key is string
    });

    const categorizedMatches = { upcoming: [], live: [], completed: [] };
    const seenMatches = new Set();

    // Use a Set of unique match IDs from participations
    const uniqueMatchIds = [...new Set(matchIds)]; 

    uniqueMatchIds.forEach(mid => {
      if (seenMatches.has(mid)) return; // Should not be strictly necessary with uniqueMatchIds, but good for safety
      seenMatches.add(mid);

      const matchInfoFromExternal = externalMatchMap[mid];
      const matchInfoFromSaved = savedMatchMap[mid];
      
      let matchDetailsToUse = null;

      // Prioritize fresher external data if available, otherwise use saved data
      if (matchInfoFromExternal) {
        matchDetailsToUse = matchInfoFromExternal.data || matchInfoFromExternal; // Handle if externalMatchMap stores the full response or just data
      } else if (matchInfoFromSaved) {
        matchDetailsToUse = matchInfoFromSaved;
      }
      
      // console.log('Processing match ID:', mid);
      // console.log('Match details to use:', matchDetailsToUse ? matchDetailsToUse.name : 'No details found');

      if (!matchDetailsToUse) {
        console.warn(`No match details found for matchId: ${mid}`);
        return; // Skip if no match details can be found
      }

      // Ensure matchDetailsToUse has the necessary fields (id might be match_id from some sources)
      const currentMatchId = (matchDetailsToUse.id || matchDetailsToUse.match_id)?.toString().trim();
      if (!currentMatchId){
        console.warn(`Match details for ${mid} does not have a usable ID field.`);
        return;
      }

      const matchTime = matchDetailsToUse.dateTimeGMT || matchDetailsToUse.start_time || matchDetailsToUse.dateTime; // More fallbacks for time
      const isStarted = matchDetailsToUse.matchStarted !== undefined ? matchDetailsToUse.matchStarted : (matchDetailsToUse.status && matchDetailsToUse.status !== 'Match not started');
      const isEnded = matchDetailsToUse.matchEnded !== undefined ? matchDetailsToUse.matchEnded : (matchDetailsToUse.status && (matchDetailsToUse.status.includes('won') || matchDetailsToUse.status.includes('drawn') || matchDetailsToUse.status.includes('tied')));
      
      const matchMeta = {
        ...matchDetailsToUse,
        id: currentMatchId, // Ensure consistent ID
        countdown: !isStarted && matchTime ? getCountdown(matchTime, 'future') : undefined,
        ago: isEnded && matchTime ? getCountdown(matchTime, 'past') : undefined,
        userTeamsCount: teamsCountByMatch[mid] || 0,
        // Step 3: Use the new structure for contest details
        userContestDetails: userContestDetailsByMatch[mid] || [], // Changed from userContestsJoined
        userTeams: userTeamsByMatch[mid] || []
      };
      
      // console.log('Match Meta for categorization:', matchMeta.name, 'isStarted:', isStarted, 'isEnded:', isEnded);

      if (!isStarted) {
        categorizedMatches.upcoming.push(matchMeta);
      } else if (isStarted && !isEnded) {
        categorizedMatches.live.push(matchMeta);
      } else if (isEnded) { // Only push to completed if explicitly ended
        categorizedMatches.completed.push(matchMeta);
      } else {
        // Optional: could categorize as 'live' or 'other' if status is ambiguous
        console.warn(`Match ${mid} has unclear status: isStarted=${isStarted}, isEnded=${isEnded}. Categorizing as live by default if started.`);
        if(isStarted) categorizedMatches.live.push(matchMeta);
      }
    });

    // Sort matches within each category if needed (e.g., by date)
    // Example: categorizedMatches.upcoming.sort((a, b) => new Date(a.dateTimeGMT) - new Date(b.dateTimeGMT));
    // Example: categorizedMatches.completed.sort((a, b) => new Date(b.dateTimeGMT) - new Date(a.dateTimeGMT));


    return res.json(categorizedMatches);
  } catch (error) {
    console.error('[getMyMatches] Error:', error);
    return res.status(500).json({ message: 'Failed to fetch user matches', error: error.message });
  }
};



/**
 * @desc Get detailed match information
 */
exports.getMatchDetails = async (req, res) => {
  try {
    const { matchId } = req.params;
    const matchDetails = await cricketDataService.getMatchById(matchId);

    return res.json(matchDetails);
  } catch (error) {
    console.error('[getMatchDetails]', error);
    return res.status(500).json({ message: 'Failed to fetch match details', error: error.message });
  }
};



exports.getMatchSquad = async (req, res) => {
    try {
      const { id } = req.query;
      const squad = await cricketDataService.matchSquad(id);
      res.json({ squad });
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch match squad', error: err.message });
    }
  };
  