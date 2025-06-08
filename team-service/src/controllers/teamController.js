const cricketDataService = require('../services/cricketService');
const Team = require('../models/TeamSchema');
const { cloneTeamUtil } = require('../utils/teamUtils');
const { getPlayerSelectionStats } = require('./statsController');


exports.createTeam = async (req, res) => {
    const userId = req.user._id;
    const { matchId, playerIds, captainId, viceCaptainId } = req.body;
    console.log("tag here",{ matchId, playerIds, captainId, viceCaptainId })
    // 1. Basic validations
    if (!matchId || !Array.isArray(playerIds) || playerIds.length !== 11 || !captainId || !viceCaptainId) {
      return res.status(400).json({
        message: 'matchId, exactly 11 playerIds, captainId, and viceCaptainId are required.'
      });
    }
    console.log("tag here duplicate",{ matchId, playerIds, captainId, viceCaptainId })

    // 2. Check for duplicate players
    const uniquePlayers = new Set(playerIds);
    if (uniquePlayers.size !== 11) {
      return res.status(400).json({ message: 'Duplicate players are not allowed in the team.' });
    }
    console.log("tag here uniquePlayers",{ matchId, playerIds, captainId, viceCaptainId })

    // 3. Captain and VC must be part of players
    if (!playerIds.includes(captainId) || !playerIds.includes(viceCaptainId)) {
      return res.status(400).json({ message: 'Captain and Vice-Captain must be in the selected players.' });
    }
    console.log("tag here playerIds.includes",{ matchId, playerIds, captainId, viceCaptainId })

    try {
      // 4. Limit teams per match
      const teamCount = await Team.countDocuments({ user: userId, matchId });
      console.log("tag here teamCount",{ matchId, playerIds, captainId, viceCaptainId })

      if (teamCount >= 10) {
        return res.status(400).json({ message: 'Maximum 10 teams allowed per match.' });
      }
  
      // 5. Validate player IDs against match squad
      const matchSquadResponse = await cricketDataService.matchSquad(matchId);
      console.log("tag here matchSquadResponse",matchSquadResponse)

      const teams = matchSquadResponse.data;
      const allPlayers = teams.flatMap(team => team.players);
      const squadMap = new Map(allPlayers.map(p => [p.id, p]));
      const validPlayerIds = Array.from(squadMap.keys());
      console.log("tag here teams",{validPlayerIds,squadMap})

      const isValid = playerIds.every(id => validPlayerIds.includes(id));
      if (!isValid) {
        return res.status(400).json({ message: 'Some player IDs are invalid or not in the squad.' });
      }
      console.log("tag here isValid",{isValid})

      // 6. Role validation
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
      console.log("tag here roleCount",{roleCount})

      if (
         roleCount.bat < 1 || roleCount.ar < 1 || roleCount.bowl < 1 ||
        roleCount.wk > 8 || roleCount.bat > 8 || roleCount.ar > 8 || roleCount.bowl > 8
      ) {
        return res.status(400).json({
          message: 'Team must have at least 1 and at most 8 players from each role (WK, BAT, AR, BOWL).'
        });
      }
      console.log("tag here before existingTeams",{roleCount})

      // 7. Check for duplicate team
      const existingTeams = await Team.find({ user: userId, matchId });
      console.log("tag here after existingTeams",{existingTeams})

      const duplicate = existingTeams.find(team => {
        const samePlayers =
          team.players.length === playerIds.length &&
          team.players.every(p => playerIds.includes(p.toString()));
        const sameCapVc = team.captain === captainId && team.viceCaptain === viceCaptainId;
        return samePlayers && sameCapVc;
      });
      console.log("tag here after duplicate",{duplicate})

      if (duplicate) {
        return res.status(400).json({ message: 'Duplicate team with same players, captain and vice-captain already exists.' });
      }
      console.log("tag here before save duplicate",{duplicate})

      // 8. Save team
      const newTeam = new Team({
        user: userId,
        matchId,
        players: playerIds,
        captain: captainId,
        viceCaptain: viceCaptainId
      });
      console.log("tag here after newTeam",{newTeam})

      await newTeam.save();
      console.log("tag here after newTeam save",{newTeam})

      await getPlayerSelectionStats(newTeam.matchId);
      console.log("tag here after newTeam save getPlayerSelectionStats",{newTeam})

      res.status(201).json({ message: 'Team created successfully', team: newTeam });
    } catch (err) {
      console.error('❌ Error creating team:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
};
  
    
exports.getUserTeams = async (req, res) => {
    const userId = req.user._id;
    const { matchId } = req.query;
  
    if (!matchId) {
      return res.status(400).json({ message: 'matchId is required in query' });
    }
  
    try {
      const teams = await Team.find({ user: userId, matchId });
  
      const matchSquadResponse = await cricketDataService.matchSquad(matchId);
      const teamsData = matchSquadResponse.data;
      const allPlayers = teamsData.flatMap(team => team.players);
      const squadMap = new Map(allPlayers.map(player => [player.id, player]));
  
      const enrichedTeams = teams.map(team => ({
        ...team.toObject(),
        players: team.players.map(pId => squadMap.get(pId) || { id: pId, name: 'Unknown' }),
        captain: squadMap.get(team.captain) || { id: team.captain, name: 'Unknown' },
        viceCaptain: squadMap.get(team.viceCaptain) || { id: team.viceCaptain, name: 'Unknown' }
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
