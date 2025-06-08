const Team = require('../models/TeamSchema');

exports.cloneTeamUtil = async (userId, teamId, updatedPlayers = null, updatedCaptain = null, updatedViceCaptain = null) => {
  // 1. Find the original team
  const originalTeam = await Team.findOne({ _id: teamId, user: userId });
  if (!originalTeam) throw new Error('Original team not found.');

  const matchId = originalTeam.matchId;

  // 2. Apply updated values or fallback to original
  const players = updatedPlayers || originalTeam.players;
  const captain = updatedCaptain || originalTeam.captain;
  const viceCaptain = updatedViceCaptain || originalTeam.viceCaptain;

  // 3. Validate 11 unique players
  const uniquePlayers = new Set(players);
  if (players.length !== 11 || uniquePlayers.size !== 11) {
    throw new Error('Team must have exactly 11 unique players.');
  }

  // 4. Validate captain and vice-captain must be in the selected 11 players
  if (!players.includes(captain) || !players.includes(viceCaptain)) {
    throw new Error('Captain and Vice-Captain must be part of the selected 11 players.');
  }

  // 5. Limit user to max 10 teams per match
  const teamCount = await Team.countDocuments({ user: userId, matchId });
  if (teamCount >= 10) {
    throw new Error('Maximum 10 teams allowed per match.');
  }

  // 6. Check for duplicate team (same players + same cap + same vc)
  const existingTeam = await Team.findOne({
    user: userId,
    matchId,
    players: { $size: 11, $all: players },
    captain,
    viceCaptain,
  });

  if (existingTeam) {
    throw new Error('A team with the same players, captain, and vice-captain already exists.');
  }

  // 7. Save new cloned team
  const newTeam = new Team({
    user: userId,
    matchId,
    players,
    captain,
    viceCaptain,
  });

  return await newTeam.save();
};
