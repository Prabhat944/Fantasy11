const calculatePoints = require('./calculatePoints'); // Path to point calculation logic
const PlayerPerformance = require('../models/PlayerPerformanceSchema'); // Mongo model

async function parseMatchData(bbb, matchId, format) {
  console.log('Checking format:', format);
  const playerStats = {};
  const overWiseBowlerRuns = {};
  const bowlerBallCounts = {};

  function getFielderDetails(fieldDataFromBall, roleName, currentPlayerStatsMap) {
    let playerId = null;
    let playerName = null;
  
    if (fieldDataFromBall && typeof fieldDataFromBall.id === 'string') { // Check if it's an object with an ID
      playerId = fieldDataFromBall.id;
      playerName = fieldDataFromBall.name || currentPlayerStatsMap[playerId]?.name || `Player ${playerId}`;
      
      // Ensure player is in playerStats and their name is updated/set if necessary
      if (playerId) {
        if (!currentPlayerStatsMap[playerId]) {
          // This fielder might not have batted/bowled yet, initialize them
          currentPlayerStatsMap[playerId] = {
            name: playerName, // Use the name from bbb if available
            batting: { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isDuck: false, strikeRate: "0.00" },
            bowling: { wickets: 0, overs: 0, runsConceded: 0, maidenOvers: 0, economy: "0.00", lbwCount: 0, bowledCount: 0, caughtAndBowledCount: 0 },
            fielding: { catches: 0, stumpings: 0, runOutsThrower: 0, runOutsCatcher: 0, runOutsDirectHit: 0 }
          };
          console.log(`[INFO] Initialized new player in playerStats from direct ID: ${playerId}, Name: ${playerName}`);
        } else if (!currentPlayerStatsMap[playerId].name && playerName && playerName !== `Player ${playerId}`) {
          // Update name if it was a placeholder or missing
          currentPlayerStatsMap[playerId].name = playerName;
        }
      }
    } else if (typeof fieldDataFromBall === 'string' && fieldDataFromBall.length > 0) {
      // Fallback to current name matching logic if it's still a string
      // (You could keep the enhanced name matching here as a fallback)
      console.warn(`[WARNING] Catcher data for ${roleName} is a string: "${fieldDataFromBall}". Attempting name match. Best to have IDs in source data.`);
      // ... (insert the improved name matching logic here from the last response if you need this fallback) ...
      // For now, if we strictly go by "IDs only" from bbb, this branch would be an error or do nothing.
      // However, since your bbb currently sends strings for catchers, you NEED the name matching.
      // So, let's keep the improved string matching logic.
      const nameInputLower = fieldDataFromBall.toLowerCase();
      playerName = fieldDataFromBall; 
  
      let exactMatch = null;
      const containsMatches = [];
  
      for (const id in currentPlayerStatsMap) {
        const existingPlayer = currentPlayerStatsMap[id];
        if (existingPlayer && existingPlayer.name) {
          const existingPlayerNameLower = existingPlayer.name.toLowerCase();
          if (existingPlayerNameLower === nameInputLower) {
            exactMatch = { playerId: id, playerName: existingPlayer.name };
            break; 
          }
          if (existingPlayerNameLower.includes(nameInputLower)) {
            containsMatches.push({ playerId: id, playerName: existingPlayer.name });
          }
        }
      }
  
      if (exactMatch) {
        playerId = exactMatch.playerId;
        playerName = exactMatch.playerName;
      } else if (containsMatches.length === 1) {
        playerId = containsMatches[0].playerId;
        playerName = containsMatches[0].playerName;
      } else if (containsMatches.length > 1) {
        console.warn(`[WARNING] Ambiguous partial name match for ${roleName}: Input "${fieldDataFromBall}" matched multiple. ID not assigned.`);
      }
    }
    return { playerId, playerName };
  }

  const initialBattingStats = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isDuck: false, strikeRate: "0.00" };
  const initialBowlingStats = {
    wickets: 0, overs: 0, runsConceded: 0, maidenOvers: 0, economy: "0.00",
    lbwCount: 0, bowledCount: 0, caughtAndBowledCount: 0
  };
  const initialFieldingStats = { catches: 0, stumpings: 0, runOutsThrower: 0, runOutsCatcher: 0, runOutsDirectHit: 0 };

  // Initialize players
  for (const ball of bbb) {
    const { batsman, bowler } = ball;
    if (batsman?.id && !playerStats[batsman.id]) {
      playerStats[batsman.id] = {
        name: batsman.name || `Player ${batsman.id}`,
        batting: { ...initialBattingStats },
        bowling: { ...initialBowlingStats },
        fielding: { ...initialFieldingStats },
      };
    }
    if (bowler?.id && !playerStats[bowler.id]) {
      playerStats[bowler.id] = {
        name: bowler.name || `Player ${bowler.id}`,
        batting: { ...initialBattingStats },
        bowling: { ...initialBowlingStats },
        fielding: { ...initialFieldingStats },
      };
    }
  }

  // Process ball-by-ball data
  for (const ball of bbb) {
    const { batsman, bowler, runs, extras, dismissal, catcher, stumpedBy, over, penalty, notes } = ball;
    const currentBatsmanId = batsman?.id;
    const currentBowlerId = bowler?.id;

    // Batting
    if (currentBatsmanId && playerStats[currentBatsmanId]) {
      const stats = playerStats[currentBatsmanId].batting;
      stats.runs += (runs || 0);
      const isLegalBall = !penalty || (penalty !== 'wide' && penalty !== 'no ball');
      if (isLegalBall) stats.ballsFaced += 1;
      if (runs === 4) stats.fours += 1;
      if (runs === 6) stats.sixes += 1;
    }

    // Bowling
    if (currentBowlerId && playerStats[currentBowlerId]) {
      const stats = playerStats[currentBowlerId].bowling;
      const totalRunsOnBall = (runs || 0) + (extras || 0);
      stats.runsConceded += totalRunsOnBall;
      const overKey = `${currentBowlerId}_${over}`;
      overWiseBowlerRuns[overKey] = (overWiseBowlerRuns[overKey] || 0) + totalRunsOnBall;
      const isLegal = !penalty || (penalty !== 'wide' && penalty !== 'no ball');
      if (isLegal) bowlerBallCounts[currentBowlerId] = (bowlerBallCounts[currentBowlerId] || 0) + 1;
    }

    // Dismissals
    if (dismissal) {
      const dismissalType = (typeof dismissal === 'string' ? dismissal : dismissal.type || "").toLowerCase();

      if (currentBowlerId && ['bowled', 'lbw', 'catch', 'caught', 'caught and bowled', 'stumped', 'hit wicket'].includes(dismissalType) && dismissalType !== 'run out') {
        const stats = playerStats[currentBowlerId].bowling;
        stats.wickets += 1;
        if (dismissalType === 'lbw') stats.lbwCount += 1;
        else if (dismissalType === 'bowled') stats.bowledCount += 1;
        else if (dismissalType === 'caught and bowled') stats.caughtAndBowledCount += 1;
      }

      if (['catch', 'caught and bowled'].includes(dismissalType)) {
        console.log(`[CATCH DEBUG] Dismissal: ${dismissalType}. Raw ball.catcher data:`, JSON.stringify(ball.catcher)); // LOG 1

        const { playerId: catcherId, playerName } = getFielderDetails(catcher, 'Catcher', playerStats);
        console.log(`[CATCH DEBUG] Resolved Catcher ID: ${catcherId}, Resolved Catcher Name: ${playerName}`); // LOG 2

        if (catcherId) {
          if (!playerStats[catcherId]) {
            console.log(`[CATCH DEBUG] Initializing new player in playerStats for catcherId: ${catcherId}, Name: ${playerName}`);

            playerStats[catcherId] = {
              name: playerName,
              batting: { ...initialBattingStats },
              bowling: { ...initialBowlingStats },
              fielding: { ...initialFieldingStats }
            };
          }
          playerStats[catcherId].fielding.catches += 1;
        }
      }

      if (dismissalType === 'stumped') {
        const { playerId: stumperId, playerName } = getFielderDetails(stumpedBy, 'Stumper', playerStats);
        if (stumperId) {
          if (!playerStats[stumperId]) {
            playerStats[stumperId] = {
              name: playerName,
              batting: { ...initialBattingStats },
              bowling: { ...initialBowlingStats },
              fielding: { ...initialFieldingStats }
            };
          }
          playerStats[stumperId].fielding.stumpings += 1;
        }
      }

      if (dismissalType === 'run out') {
        const { playerId: fielderId, playerName } = getFielderDetails(notes, 'Fielder (run out)', playerStats);
        if (fielderId) {
          if (!playerStats[fielderId]) {
            playerStats[fielderId] = {
              name: playerName,
              batting: { ...initialBattingStats },
              bowling: { ...initialBowlingStats },
              fielding: { ...initialFieldingStats }
            };
          }
          playerStats[fielderId].fielding.runOutsDirectHit += 1;
        }
      }
    }
  }

  // Final calculations
  for (const playerId in playerStats) {
    const stats = playerStats[playerId];

    if (bowlerBallCounts[playerId]) {
      const totalBalls = bowlerBallCounts[playerId];
      const completedOvers = Math.floor(totalBalls / 6);
      const remainingBalls = totalBalls % 6;
      stats.bowling.overs = parseFloat(`${completedOvers}.${remainingBalls}`);
      stats.bowling.economy = stats.bowling.overs > 0 ? ((stats.bowling.runsConceded / totalBalls) * 6).toFixed(2) : "0.00";
    }

    stats.batting.isDuck = stats.batting.ballsFaced > 0 && stats.batting.runs === 0;
    stats.totalPoints = calculatePoints(stats, format);
  }

  // ✅ SAVE TO DATABASE
  for (const playerId in playerStats) {
    const stats = playerStats[playerId];
    try {
      await PlayerPerformance.findOneAndUpdate(
        { matchId, playerId },
        {
          $set: {
            matchId,
            playerId,
            playerName: stats.name,
            format,
            batting: stats.batting,
            bowling: stats.bowling,
            fielding: stats.fielding,
            points: stats.totalPoints,
          }
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error(`Failed to save stats for player ${playerId}:`, error);
    }
  }

  return playerStats;
}

module.exports = parseMatchData;
