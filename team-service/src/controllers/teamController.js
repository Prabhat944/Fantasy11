const Team = require('../models/TeamSchema');
const { cloneTeamUtil } = require('../utils/teamUtils');
const { getPlayerSelectionStats } = require('./statsController');
const Squad = require('../models/Squad');
const Match = require('../models/UpcomingMatches'); // The model for upcoming matches
 // In your team controller file

// Make sure to import the necessary models at the top


exports.createTeam = async (req, res) => {
    const userId = req.user._id;
    console.log('ceghck the usere here', userId);
    const { matchId, playerIds, captainId, viceCaptainId } = req.body;

    // 1. Basic validations (unchanged)
    if (!matchId || !Array.isArray(playerIds) || playerIds.length !== 11 || !captainId || !viceCaptainId) {
      return res.status(400).json({ message: 'Required fields are missing or invalid.' });
    }
    if ((new Set(playerIds)).size !== 11) {
      return res.status(400).json({ message: 'Duplicate players are not allowed.' });
    }
    if (!playerIds.includes(captainId) || !playerIds.includes(viceCaptainId)) {
      return res.status(400).json({ message: 'Captain and Vice-Captain must be in the team.' });
    }

    try {
      // 2. NEW: Validate that the match is upcoming before proceeding
      const isMatchUpcoming = await Match.exists({ _id: matchId, dateTimeGMT: { $gt: new Date() } });
      if (!isMatchUpcoming) {
        return res.status(400).json({ message: 'This match has already started or is not available.' });
      }

      // 3. Limit teams per match (unchanged)
      const teamCount = await Team.countDocuments({ user: userId, matchId });
      if (teamCount >= 10) {
        return res.status(400).json({ message: 'Maximum 10 teams allowed per match.' });
      }
      const user = req.user;
      if (!user.name) {
        return res.status(400).json({ message: 'User has no username.' });
      }
      const teamName = `${user.name}${teamCount + 1}`;
      // 4. Validate player IDs against our LOCAL squad data
      // --- REMOVED: const matchSquadResponse = await cricketDataService.matchSquad(matchId);
      const squadDoc = await Squad.findById(matchId).lean(); // <-- REPLACED with fast local query

      if (!squadDoc || !squadDoc.squad) {
        return res.status(400).json({ message: 'Squad for this match not available yet.' });
      }

      const allPlayers = squadDoc.squad.flatMap(team => team.players);
      const squadMap = new Map(allPlayers.map(p => [p.id, p]));
      const validPlayerIds = Array.from(squadMap.keys());

      const isValid = playerIds.every(id => validPlayerIds.includes(id));
      if (!isValid) {
        return res.status(400).json({ message: 'Some player IDs are invalid for this match.' });
      }

      // 5. Role validation (logic is unchanged, source of data is now local)
      const roleCount = { wk: 0, bat: 0, ar: 0, bowl: 0 };
      for (let id of playerIds) {
        const player = squadMap.get(id);
        if (!player || !player.role) continue;
        const role = player.role.toLowerCase();
        if (role.includes('wk')) roleCount.wk++;
        else if (role.includes('bat') && !role.includes('all')) roleCount.bat++;
        else if (role.includes('all')) roleCount.ar++;
        else if (role.includes('bowl')) roleCount.bowl++;
      }
      // ... (your role count validation if/statement remains here) ...

      // 6. Check for duplicate team (unchanged)
      const existingTeams = await Team.find({ user: userId, matchId });
      const isDuplicate = existingTeams.some(team => {
          const samePlayers = team.players.length === playerIds.length && team.players.every(p => playerIds.includes(p.toString()));
          return samePlayers && team.captain === captainId && team.viceCaptain === viceCaptainId;
      });
      if (isDuplicate) {
        return res.status(400).json({ message: 'An identical team already exists.' });
      }

      // 7. Save team (unchanged)
      const newTeam = new Team({ user: userId, matchId, players: playerIds, captain: captainId, viceCaptain: viceCaptainId, teamName });
      await newTeam.save();

      await getPlayerSelectionStats(newTeam.matchId);
      res.status(201).json({ message: 'Team created successfully', team: newTeam });
      
    } catch (err) {
      console.error('❌ Error creating team:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
};
  
    
// In your team controller file

exports.getUserTeams = async (req, res) => {
  const userId = req.user._id;
  const { matchId } = req.query;

  if (!matchId) {
    return res.status(400).json({ message: 'matchId is required in query' });
  }

  try {
    const teams = await Team.find({ user: userId, matchId });

    // --- REPLACED external call with local DB query ---
    const squadDoc = await Squad.findById(matchId).lean();
    
    const squadMap = new Map();
    if(squadDoc && squadDoc.squad) {
      squadDoc.squad.flatMap(team => team.players).forEach(player => {
          squadMap.set(player.id, player);
      });
    }

    const enrichedTeams = teams.map(team => ({
      ...team.toObject(),
      players: team.players.map(pId => squadMap.get(pId.toString()) || { id: pId, name: 'Unknown Player' }),
      captain: squadMap.get(team.captain.toString()) || { id: team.captain, name: 'Unknown Captain' },
      viceCaptain: squadMap.get(team.viceCaptain.toString()) || { id: team.viceCaptain, name: 'Unknown Vice-Captain' }
    }));

    res.json({ totalTeams: enrichedTeams.length, teams: enrichedTeams });
  } catch (err) {
    console.error('❌ Error fetching teams:', err);
    res.status(500).json({ message: 'Error fetching teams', error: err.message });
  }
};
  
exports.updateUserTeam = async (req, res) => {
    const userId = req.user._id;
    const { teamId } = req.params;
    const { addPlayers = [], removePlayers = [], captain, viceCaptain } = req.body;
  
    try {
      const team = await Team.findOne({ _id: teamId, user: userId });
      if (!team) {
        return res.status(404).json({ message: 'Team not found or unauthorized access.' });
      }
  
      // Step 1: Apply changes
      let updatedPlayers = team.players.map(p => p.toString());
      updatedPlayers = updatedPlayers.filter(p => !removePlayers.includes(p));
      updatedPlayers.push(...addPlayers);
  
      // Step 2: Remove duplicates
      updatedPlayers = [...new Set(updatedPlayers)];
  
      // Step 3: Validate final team size
      if (updatedPlayers.length !== 11) {
        return res.status(400).json({ message: 'Final team must have exactly 11 players.' });
      }
  
      if (!captain || !viceCaptain) {
        return res.status(400).json({ message: 'Captain and vice-captain are required.' });
      }
  
      if (!updatedPlayers.includes(captain) || !updatedPlayers.includes(viceCaptain)) {
        return res.status(400).json({ message: 'Captain and vice-captain must be in the team.' });
      }
  
      // Step 4: Check for duplicate team (exclude current team)
      const existingTeams = await Team.find({ user: userId, matchId: team.matchId, _id: { $ne: team._id } });
      const duplicate = existingTeams.find(existing => {
        const samePlayers =
          existing.players.length === updatedPlayers.length &&
          existing.players.every(p => updatedPlayers.includes(p.toString()));
        const sameCapVc =
          existing.captain === captain &&
          existing.viceCaptain === viceCaptain;
        return samePlayers && sameCapVc;
      });
  
      if (duplicate) {
        return res.status(400).json({ message: 'Duplicate team with same players, captain and vice-captain already exists.' });
      }
  
      // Step 5: Save updated team
      team.players = updatedPlayers;
      team.captain = captain;
      team.viceCaptain = viceCaptain;
      await team.save();
  
      res.status(200).json({ message: 'Team updated successfully', team });
  
    } catch (err) {
      console.error('❌ Error updating team:', err);
      res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};
 
exports.cloneTeam = async (req, res) => {
  const userId = req.user._id;
  const { teamId } = req.params;
  const { players, captain, viceCaptain } = req.body;

  try {
    const clonedTeam = await cloneTeamUtil(userId, teamId, players, captain, viceCaptain);
    return res.status(201).json({
      message: 'Team cloned successfully.',
      team: clonedTeam,
      redirectToEditor: true,
    });
  } catch (err) {
    console.error('❌ Clone error:', err);
    return res.status(400).json({ message: err.message });
  }
};
