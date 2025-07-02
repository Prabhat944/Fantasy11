// In a file like utils/parseMatchData.js

const calculatePoints = require('./calculatePoints');
const PlayerPerformance = require('../models/PlayerPerformanceSchema');

/**
 * Parses ball-by-ball data to calculate and save player performance stats.
 * Initializes all players from the official squad first to ensure "Playing XI" points are awarded.
 * @param {Array} bbb - The ball-by-ball data array.
 * @param {string} matchId - The ID of the match.
 * @param {string} format - The match format (e.g., 'T20', 'ODI').
 * @param {Array} playingXI - An array of all players in the official squad for the match.
 */
async function parseMatchData(bbb, matchId, format, playingXI = []) {
  console.log(`[parseMatchData] Parsing data for matchId: ${matchId}, Format: ${format}`);
  const playerStats = {};
  const bowlerBallCounts = {};

  // Helper function to find fielder details from the notes or catcher/stumper objects
  function getFielderDetails(fieldDataFromBall, roleName, currentPlayerStatsMap) {
    let playerId = null;
    let playerName = null;
  
    if (fieldDataFromBall && typeof fieldDataFromBall.id === 'string') {
      playerId = fieldDataFromBall.id;
      playerName = fieldDataFromBall.name || currentPlayerStatsMap[playerId]?.name || `Player ${playerId}`;
      
      // Initialize fielder if not already in stats
      if (playerId && !currentPlayerStatsMap[playerId]) {
        currentPlayerStatsMap[playerId] = {
          name: playerName,
          batting: { ...initialBattingStats },
          bowling: { ...initialBowlingStats },
          fielding: { ...initialFieldingStats }
        };
      } else if (currentPlayerStatsMap[playerId] && !currentPlayerStatsMap[playerId].name && playerName) {
        currentPlayerStatsMap[playerId].name = playerName;
      }
    } else if (typeof fieldDataFromBall === 'string' && fieldDataFromBall.length > 0) {
      // This is a fallback for when fielder info is just a name string
      const nameInputLower = fieldDataFromBall.toLowerCase();
      playerName = fieldDataFromBall;
      
      let exactMatch = null, containsMatches = [];
      for (const id in currentPlayerStatsMap) {
        const existingPlayerNameLower = currentPlayerStatsMap[id]?.name?.toLowerCase();
        if (existingPlayerNameLower === nameInputLower) {
          exactMatch = { playerId: id, playerName: currentPlayerStatsMap[id].name };
          break;
        }
        if (existingPlayerNameLower?.includes(nameInputLower)) {
          containsMatches.push({ playerId: id, playerName: currentPlayerStatsMap[id].name });
        }
      }

      if (exactMatch) {
        playerId = exactMatch.playerId;
        playerName = exactMatch.playerName;
      } else if (containsMatches.length === 1) {
        playerId = containsMatches[0].playerId;
        playerName = containsMatches[0].playerName;
      }
    }
    return { playerId, playerName };
  }

  const initialBattingStats = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isDuck: false, strikeRate: "0.00" };
  const initialBowlingStats = { wickets: 0, overs: "0.0", runsConceded: 0, maidenOvers: 0, economy: "0.00", lbwCount: 0, bowledCount: 0, caughtAndBowledCount: 0 };
  const initialFieldingStats = { catches: 0, stumpings: 0, runOutsThrower: 0, runOutsCatcher: 0, runOutsDirectHit: 0 };

  // STEP 1: INITIALIZE ALL PLAYERS FROM THE OFFICIAL PLAYING XI FIRST
  for (const player of playingXI) {
    if (player && player.id && !playerStats[player.id]) {
      playerStats[player.id] = {
        name: player.name || `Player ${player.id}`,
        batting: { ...initialBattingStats },
        bowling: { ...initialBowlingStats },
        fielding: { ...initialFieldingStats },
      };
    }
  }

  // Fallback to ensure any player mentioned in BBB is included
  for (const ball of bbb) {
    const { batsman, bowler } = ball;
    if (batsman?.id && !playerStats[batsman.id]) {
      playerStats[batsman.id] = { name: batsman.name, batting: { ...initialBattingStats }, bowling: { ...initialBowlingStats }, fielding: { ...initialFieldingStats } };
    }
    if (bowler?.id && !playerStats[bowler.id]) {
      playerStats[bowler.id] = { name: bowler.name, batting: { ...initialBattingStats }, bowling: { ...initialBowlingStats }, fielding: { ...initialFieldingStats } };
    }
  }

  // STEP 2: PROCESS BALL-BY-BALL DATA
  for (const ball of bbb) {
    const { batsman, bowler, runs, extras, dismissal, catcher, stumpedBy, penalty, notes } = ball;
    const currentBatsmanId = batsman?.id;
    const currentBowlerId = bowler?.id;

    // Batting Stats
    if (currentBatsmanId && playerStats[currentBatsmanId]) {
      const batStats = playerStats[currentBatsmanId].batting;
      
      // Only add runs if they are not byes or leg byes
      if (penalty !== 'byes' && penalty !== 'leg byes') {
        batStats.runs += (runs || 0);
      }
      if (runs === 4) batStats.fours += 1;
      if (runs === 6) batStats.sixes += 1;
      
      // A ball is faced for any delivery that is not a wide
      if (penalty !== 'wide') {
        batStats.ballsFaced += 1;
      }
    }

    // Bowling Stats
    if (currentBowlerId && playerStats[currentBowlerId]) {
      const bowlStats = playerStats[currentBowlerId].bowling;
      bowlStats.runsConceded += (runs || 0) + (extras || 0);
      
      // A legal ball is counted for the over if it's not a wide or a no-ball
      if (penalty !== 'wide' && penalty !== 'no ball') {
        bowlerBallCounts[currentBowlerId] = (bowlerBallCounts[currentBowlerId] || 0) + 1;
      }
    }

    // Dismissal and Fielding Stats
    if (dismissal) {
      const dismissalType = (typeof dismissal === 'string' ? dismissal : dismissal.type || "").toLowerCase();
      
      // Wickets for the bowler (run outs don't count for the bowler)
      if (currentBowlerId && ['bowled', 'lbw', 'catch', 'caught', 'caught and bowled', 'stumped', 'hit wicket'].includes(dismissalType)) {
        const bowlStats = playerStats[currentBowlerId].bowling;
        bowlStats.wickets += 1;
        if (dismissalType === 'lbw') bowlStats.lbwCount += 1;
        if (dismissalType === 'bowled') bowlStats.bowledCount += 1;
        if (dismissalType === 'caught and bowled') bowlStats.caughtAndBowledCount += 1;
      }

      // Fielding points
      if (['catch', 'caught and bowled'].includes(dismissalType)) {
        const { playerId: catcherId } = getFielderDetails(catcher, 'Catcher', playerStats);
        if (catcherId) playerStats[catcherId].fielding.catches += 1;
      }
      if (dismissalType === 'stumped') {
        const { playerId: stumperId } = getFielderDetails(stumpedBy, 'Stumper', playerStats);
        if (stumperId) playerStats[stumperId].fielding.stumpings += 1;
      }
      if (dismissalType === 'run out') {
        // Here we assume 'notes' contains the primary fielder's name for direct hits.
        // A more complex API might provide separate thrower/catcher IDs.
        const { playerId: fielderId } = getFielderDetails(notes, 'Fielder (run out)', playerStats);
        if (fielderId) playerStats[fielderId].fielding.runOutsDirectHit += 1;
      }
    }
  }

  // STEP 3: FINAL CALCULATIONS AND SAVING
  for (const playerId in playerStats) {
    const stats = playerStats[playerId];

    // Finalize bowler stats
    if (bowlerBallCounts[playerId]) {
      const totalBalls = bowlerBallCounts[playerId];
      const completedOvers = Math.floor(totalBalls / 6);
      const remainingBalls = totalBalls % 6;
      stats.bowling.overs = `${completedOvers}.${remainingBalls}`; // Store as string for clarity
      stats.bowling.economy = totalBalls > 0 ? ((stats.bowling.runsConceded / totalBalls) * 6).toFixed(2) : "0.00";
    }

    // Finalize batting stats
    stats.batting.isDuck = stats.batting.ballsFaced > 0 && stats.batting.runs === 0;
    
    // Calculate final fantasy points
    stats.totalPoints = calculatePoints(stats, format);
  }

  // Save all processed player records to the database
  const savePromises = Object.entries(playerStats).map(([playerId, stats]) => {
    return PlayerPerformance.findOneAndUpdate(
      { matchId, playerId },
      {
        $set: {
          matchId,
          playerId,
          name: stats.name,
          format,
          batting: stats.batting,
          bowling: stats.bowling,
          fielding: stats.fielding,
          points: stats.totalPoints,
        }
      },
      { upsert: true, new: true }
    );
  });

  await Promise.all(savePromises);

  console.log(`[parseMatchData] Finished processing and saved stats for ${Object.keys(playerStats).length} players.`);
  return playerStats;
}

module.exports = parseMatchData;
