const ContestParticipation = require('../models/ContestParticipation');
const Contest = require('../models/Contest');
const Team = require('../models/TeamSchema');
const { cloneContest } = require('../utils/cloneContest');
const Match = require('../models/UpcomingMatches')

exports.joinContest = async (req, res) => {
  const userId = req.user._id;
  const { matchId, contestId, teamId } = req.body;

  if (!matchId || !contestId || !teamId) {
    return res.status(400).json({ message: 'Required fields: matchId, contestId, teamId' });
  }

  try {
    // 1. Fetch all necessary data at once for efficiency.
    // We now populate the template to get the multi-entry limit.
    const [contest, team, isMatchUpcoming] = await Promise.all([
        Contest.findById(contestId).populate('contestTemplateId'),
        Team.findOne({ _id: teamId, user: userId, matchId }),
        Match.exists({ _id: matchId, dateTimeGMT: { $gt: new Date() } })
    ]);

    // 2. Perform all initial validations.
    if (!isMatchUpcoming) {
      return res.status(400).json({ message: 'This match has already started.' });
    }
    if (!contest) return res.status(404).json({ message: 'Contest not found' });
    if (!team) return res.status(400).json({ message: 'Invalid team for this match' });
    if (contest.filledSpots >= contest.totalSpots) {
      return res.status(400).json({ message: 'Contest is full' });
    }

    // 3. Get the multi-entry limit from the contest's template. Default to 1 if not set.
    const entryLimit = contest.contestTemplateId?.maxTeamsPerUser || 1;

    // 4. Find all of the user's existing entries for this specific contest.
    const existingParticipations = await ContestParticipation.find({ user: userId, contestId }).lean();

    // 5. Apply the new multi-entry rules.
    if (existingParticipations.length >= entryLimit) {
      return res.status(400).json({ message: `You have reached the entry limit of ${entryLimit} for this contest.` });
    }

    const isTeamAlreadyEntered = existingParticipations.some(p => p.teamId.toString() === teamId);
    if (isTeamAlreadyEntered) {
      return res.status(400).json({ message: 'You have already joined this contest with this specific team.' });
    }

    // 6. All checks passed. Proceed to join the contest.
    contest.participants.push(userId);
    contest.filledSpots += 1;
    await contest.save();

    const participation = await ContestParticipation.create({
      user: userId,
      matchId,
      contestId,
      teamId
    });

    return res.status(201).json({ message: 'Successfully joined contest', participation });

  } catch (err) {
    console.error('Error in joinContest:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.joinMultipleContests = async (req, res) => {
  const { matchId, teamId, count, contestTemplateId } = req.body;
  const userId = req.user._id;

  if (!matchId || !teamId || !count || count < 1 || !contestTemplateId) {
    return res.status(400).json({ message: 'Required: matchId, teamId, valid count, and contestTemplateId' });
  }

  try {
    // --- NEW, EFFICIENT VALIDATION STEP ---
    // 1. First, check if the match is actually upcoming and available for joining.
    const isMatchUpcoming = await Match.exists({ _id: matchId, dateTimeGMT: { $gt: new Date() } });
    if (!isMatchUpcoming) {
      return res.status(400).json({ message: "This match is not available for joining or has already started." });
    }

    // 2. Second, validate the user's team for this match.
    const team = await Team.findOne({ _id: teamId, user: userId, matchId });
    if (!team) return res.status(400).json({ message: 'Invalid team for this match' });
    
    let joinedCount = 0;
    
    // Find a base contest to use for cloning if we need to create new ones.
    const baseContestForCloning = await Contest.findOne({ contestTemplateId, matchId });
    if (!baseContestForCloning) {
        return res.status(404).json({ message: 'No contests found for this template and match.'});
    }

    // --- Core joining logic remains the same ---
    while (joinedCount < count) {
      const availableContest = await Contest.findOne({
        contestTemplateId: contestTemplateId,
        matchId: matchId,
        filledSpots: { $lt: baseContestForCloning.totalSpots },
        participants: { $ne: userId }
      }).sort({ filledSpots: -1 });

      let targetContest = availableContest;

      if (!targetContest) {
        // If no available contest is found, clone a new one.
        targetContest = await cloneContest(baseContestForCloning);
      }
      
      // Final check to ensure we don't double-join the same contest instance
      const alreadyInThisInstance = await ContestParticipation.exists({ user: userId, contestId: targetContest._id });
      if(alreadyInThisInstance) {
        console.log(`User already in contest ${targetContest._id}. Skipping.`);
        if(!availableContest) break; // Prevents infinite loop if only one full contest exists
        continue;
      }

      targetContest.participants.push(userId);
      targetContest.filledSpots += 1;
      await targetContest.save();

      await ContestParticipation.create({
        user: userId,
        matchId,
        contestId: targetContest._id,
        teamId
      });

      joinedCount++;
    }

    if (joinedCount < count) {
      return res.status(200).json({ message: `Successfully joined ${joinedCount} contest(s). Some could not be joined as they filled up.` });
    }
    return res.status(200).json({ message: `Successfully joined ${joinedCount} contest(s)` });

  } catch (err) {
    console.error('Error in joinMultipleContests:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};


exports.switchTeam = async (req, res) => {
  const userId = req.user._id;
  const { participationId, newTeamId } = req.body;

  if (!participationId || !newTeamId) {
    return res.status(400).json({ message: 'Required fields: participationId, newTeamId' });
  }

  try {
    const participation = await ContestParticipation.findOne({ _id: participationId, user: userId });
    if (!participation) return res.status(404).json({ message: 'Participation not found' });

    // --- REPLACED EXTERNAL CALL WITH LOCAL DB QUERY ---
    // We check if the match still exists in our 'upcoming' matches collection.
    const contestMatch = await Match.findById(participation.matchId, '_id').lean();
    
    // If it's not found in our upcoming collection, it means the match is live or completed.
    if (!contestMatch) {
      return res.status(400).json({ message: 'Cannot switch team after match starts' });
    }
    // --- END OF REPLACEMENT ---

    const newTeam = await Team.findOne({ _id: newTeamId, user: userId, matchId: participation.matchId });
    if (!newTeam) return res.status(400).json({ message: 'Invalid new team' });

    participation.teamId = newTeamId;
    await participation.save();

    return res.json({ message: 'Team switched successfully' });
  } catch (err) {
    console.error('Error in switchTeam:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getContestsByMatchId = async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!matchId) {
      return res.status(400).json({ message: 'A matchId is required.' });
    }

    const contests = await Contest.find({ matchId })
      .select('title entryFee totalSpots filledSpots prize prizeBreakupType contestTemplateId')
      .lean();

    return res.status(200).json(contests);

  } catch (error) {
    console.error('Error fetching contests by match ID:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};