const pointRules = require('./pointRules'); // Make sure this path is correct

function calculatePoints(perf, format) {
  const rules = pointRules[format?.toUpperCase()];
  // console.log('Using format:', format, 'Found rules:', !!rules); // Optional: for debugging

  if (!rules) {
    console.warn(`No point rules found for format: ${format}. Player will get 0 points.`);
    return 0;
  }

  let points = 0;
  const { batting, bowling, fielding } = perf || {}; // 'perf' contains the player's aggregated stats

  // ---- START: MODIFICATION FOR PLAYER_IN POINTS ----
  // Add points for being in the Playing XI, if the rule exists for the format
  if (rules.player_in && typeof rules.player_in.live === 'number') {
    points += rules.player_in.live;
  }
  // ---- END: MODIFICATION FOR PLAYER_IN POINTS ----

  // BATTING
  if (batting && rules.batting) {
    const batRules = rules.batting;
    points += (batting.runs || 0) * (batRules.run || 0);
    points += (batting.fours || 0) * (batRules.boundaryBonus || 0);
    points += (batting.sixes || 0) * (batRules.sixBonus || 0);

    if (batting.isDuck && (batting.ballsFaced || 0) > 0) {
      points += (batRules.duck || 0);
    }

    const runs = batting.runs || 0;
    // Ensure century/halfCentury bonuses are only applied if they exist in the rules for that format
    if (runs >= 100 && batRules.century !== undefined) {
      points += batRules.century;
    } else if (runs >= 50 && batRules.halfCentury !== undefined) {
      points += batRules.halfCentury;
    }

    if (batRules.strikeRate && Array.isArray(batRules.strikeRate) && (batting.ballsFaced || 0) > 0) {
      const sr = (runs / batting.ballsFaced) * 100;
      for (const rule of batRules.strikeRate) {
        if (rule.minBalls && batting.ballsFaced < rule.minBalls) continue;
        if (rule.below !== undefined && sr < rule.below) points += rule.points;
        if (rule.above !== undefined && sr > rule.above) points += rule.points;
      }
    }
  }

  // BOWLING
  if (bowling && rules.bowling) {
    const bowlRules = rules.bowling;
    const wickets = bowling.wickets || 0;

    points += wickets * (bowlRules.wicket || 0);
    points += (bowling.maidenOvers || 0) * (bowlRules.maiden || 0);

    // Wicket Haul Bonuses
    if (bowlRules["3w"] !== undefined && wickets >= 3) points += bowlRules["3w"];
    // Note: If a player gets 4w, they usually also qualify for 3w. 
    // Ensure your rules aren't cumulative if not intended (e.g., 4w bonus is additional to 3w, or replaces it).
    // The current logic is cumulative if "4w" points are separate from "3w" points.
    if (bowlRules["4w"] !== undefined && wickets >= 4) points += bowlRules["4w"];
    if (bowlRules["5w"] !== undefined && wickets >= 5) points += bowlRules["5w"];

    // Specific Dismissal Type Bonuses
    points += (bowling.lbwCount || 0) * (bowlRules.lbwBonus || 0);
    points += (bowling.bowledCount || 0) * (bowlRules.bowledBonus || 0);
    points += (bowling.caughtAndBowledCount || 0) * (bowlRules.caughtAndBowledBonus || 0);

    // Economy Rate
    if (bowlRules.economyRate && Array.isArray(bowlRules.economyRate) && (bowling.overs || 0) > 0) {
      const oversStr = bowling.overs?.toString() || "0";
      const oversFloat = parseFloat(oversStr); // e.g., 5.2
      const completedOvers = Math.floor(oversFloat); // 5
      const partialBalls = Math.round((oversFloat - completedOvers) * 10); // 2 (from 0.2 * 10)
      const ballsBowled = completedOvers * 6 + partialBalls;

      if (ballsBowled > 0) {
        const economy = ((bowling.runsConceded || 0) / ballsBowled) * 6;
        for (const rule of bowlRules.economyRate) {
          // Ensure overs comparison is with the numeric value of overs
          if (parseFloat(bowling.overs) < (rule.minOvers || 0)) continue;
          if (rule.below !== undefined && economy < rule.below) points += rule.points;
          if (rule.above !== undefined && economy > rule.above) points += rule.points;
        }
      }
    }
  }

  // FIELDING
  if (fielding && rules.fielding) {
    const fieldRules = rules.fielding;
    points += (fielding.catches || 0) * (fieldRules.catch || 0);
    points += (fielding.stumpings || 0) * (fieldRules.stumping || 0);
    points += (fielding.runOutsThrower || 0) * (fieldRules.runOutThrower || 0);
    points += (fielding.runOutsCatcher || 0) * (fieldRules.runOutsCatcher || 0);
    points += (fielding.runOutsDirectHit || 0) * (fieldRules.runOutDirectHit || 0);
  }

  return points;
}

module.exports = calculatePoints; // If this is in its own file