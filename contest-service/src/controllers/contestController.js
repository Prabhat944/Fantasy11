// controllers/contestController.js

const ContestParticipation = require('../models/ContestParticipation');
const Contest = require('../models/Contest');
const { cloneContest } = require('../utils/cloneContest');
const entityDataService = require('../utils/thirdPartyApiCall');
const { getMatchById, getTeamDetails, getUserMatch, createUserMatch } = entityDataService;

exports.joinContest = async (req, res) => {
  const userId = req.user._id;
  console.log('check the userid', userId);
  const { matchId, contestId, teamId } = req.body;

  if (!matchId || !contestId || !teamId) {
    return res.status(400).json({ message: 'Required fields: matchId, contestId, teamId' });
  }

  try {
    const [contest, team] = await Promise.all([
      Contest.findById(contestId),
      getTeamDetails({ teamId, userId, matchId }) // Use destructured function
    ]);
    console.log('DEBUG: Fetched data ->', { contest, team });

    if (!contest) return res.status(404).json({ message: 'Contest not found' });
    if (!team || team.user.toString() !== userId.toString() || team.matchId !== matchId){ // Ensure team object structure matches
      return res.status(400).json({ message: 'Invalid team for the match or team not found' });
    }

    if (contest.filledSpots >= contest.totalSpots) {
      console.log('----->>>>>');
      return res.status(400).json({ message: 'Contest is full' });
    }

    const alreadyJoined = await ContestParticipation.exists({ user: userId, matchId, contestId });
    if (alreadyJoined) {
      console.log('++++++++')
      return res.status(400).json({ message: 'Already joined this contest' });
    }

    let userMatchExists = await getUserMatch({ userId, matchId }); // Use destructured function
    console.log('check userMatchExists111111', userMatchExists);

    if (!userMatchExists) {
      const matchInfo = await getMatchById(matchId); // ✅ Now uses getMatchById from entityDataService
      if (matchInfo) {
        await createUserMatch({ // Use destructured function
          user: userId,
          matchId,
          matchInfo,
          status: matchInfo?.matchStarted ? (matchInfo?.matchEnded ? 'completed' : 'live') : 'upcoming'
        });
      }
    }

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
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// ... (similar changes for joinMultipleContests and switchTeam if they use getMatchById)
// In your provided code, joinMultipleContests and switchTeam also use getMatchById

exports.joinMultipleContests = async (req, res) => {
  const { matchId, contestId, teamId, count } = req.body;
  const userId = req.user._id;

  // ... (input validation) ...
  if (!matchId || !contestId || !teamId || !count || count < 1) {
    return res.status(400).json({ message: 'Required: matchId, contestId, teamId, and valid count' });
  }

  try {
    const [baseContest, team] = await Promise.all([
      Contest.findById(contestId),
      getTeamDetails({ teamId, userId, matchId })
    ]);

    // ... (validation for baseContest and team) ...
    if (!baseContest) return res.status(404).json({ message: 'Base contest not found' });
    if (!team || team.user.toString() !== userId.toString() || team.matchId !== matchId) {
      return res.status(400).json({ message: 'Invalid team or team not found' });
    }


    let userMatchExists = await getUserMatch({ userId, matchId });
    console.log('check userMatchExists', userMatchExists);
    if (!userMatchExists) {
      const matchInfo = await getMatchById(matchId); // ✅ Now uses getMatchById from entityDataService
      if (matchInfo) {
        await createUserMatch({
          user: userId,
          matchId,
          matchInfo,
          status: matchInfo?.matchStarted ? (matchInfo?.matchEnded ? 'completed' : 'live') : 'upcoming'
        });
      }
    }
    // ... rest of the function
    let joinedCount = 0;
    const participations = [];
    // ... (while loop logic as before) ...
     while (joinedCount < count) {
      let targetContestIdToJoin;
      if (joinedCount === 0) {
        const existingParticipation = await ContestParticipation.exists({
          user: userId, matchId, teamId, contestId: baseContest._id
        });
        if (existingParticipation && count === 1) { // only if they try to join the same thing once.
             return res.status(400).json({ message: 'Already joined base contest with this team' });
        } else if (existingParticipation) {
            console.warn(`User ${userId} already joined base contest ${baseContest._id} with team ${teamId}. Will attempt to join clones/other contests.`);
        }
        targetContestIdToJoin = baseContest._id;
      }

      let targetContest;
      if (targetContestIdToJoin && joinedCount === 0) {
          const tempBaseContest = await Contest.findOne({
              _id: baseContest._id,
              filledSpots: { $lt: baseContest.totalSpots },
          });
          const alreadyInThisInstance = tempBaseContest && tempBaseContest.participants.includes(userId);
          if (tempBaseContest && !alreadyInThisInstance) {
            targetContest = tempBaseContest;
          } else if (alreadyInThisInstance && joinedCount === 0) {
             console.log(`User already in base contest ${baseContest._id}, will find/clone another.`);
          }
      }

      if (!targetContest) {
        const availableContest = await Contest.findOne({
          matchId: baseContest.matchId,
          entryFee: baseContest.entryFee,
          totalSpots: baseContest.totalSpots,
          filledSpots: { $lt: baseContest.totalSpots },
          participants: { $ne: userId }
        }).sort({ filledSpots: -1 });

        if (availableContest) {
          targetContest = availableContest;
        } else {
          targetContest = await cloneContest(baseContest);
        }
      }

      if (targetContest.filledSpots >= targetContest.totalSpots) {
        console.warn(`Contest ${targetContest._id} became full before user ${userId} could join.`);
        const remainingAttempts = count - joinedCount;
        if (remainingAttempts === (count - joinedCount)) { // if no successful joins yet and first attempt fails.
             // Check if this was the original target and it's full
            if (targetContest._id.equals(baseContest._id) && joinedCount === 0) {
                console.log("Base contest is full, attempting to clone for multiple join.");
                targetContest = await cloneContest(baseContest); // try cloning immediately
                if (targetContest.filledSpots >= targetContest.totalSpots) { // if clone is also somehow full
                    break; 
                }
            } else { // Some other contest became full
                 break;
            }
        } else { // if some joins were successful but now hitting full ones
            break;
        }
      }
      if (targetContest.participants.includes(userId)) {
          console.warn(`User ${userId} already in target contest ${targetContest._id}. Trying to clone a new one.`);
          targetContest = await cloneContest(baseContest);
          if (targetContest.participants.includes(userId) || targetContest.filledSpots >= targetContest.totalSpots) {
              console.error("Failed to get a fresh contest for multiple join (already participant or full). Aborting this join attempt.");
              continue;
          }
      }

      targetContest.participants.push(userId);
      targetContest.filledSpots += 1;
      await targetContest.save();

      const participation = await ContestParticipation.create({
        user: userId, matchId, contestId: targetContest._id, teamId
      });
      participations.push(participation);
      joinedCount++;
    }

    if (joinedCount === 0) {
        return res.status(400).json({ message: 'Could not join any new contests. Base contest may be full or already joined with this team.' });
    }
    return res.status(200).json({ message: `Successfully joined ${joinedCount} contest(s)`, participations });

  } catch (err) {
    console.error('Error in joinMultipleContests:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

exports.switchTeam = async (req, res) => {
  const userId = req.user._id;
  const { participationId, newTeamId } = req.body;

  // ... (input validation) ...
  if (!participationId || !newTeamId) {
    return res.status(400).json({ message: 'Required fields: participationId, newTeamId' });
  }

  try {
    const participation = await ContestParticipation.findOne({ _id: participationId, user: userId });
    // ... (validation for participation and contest) ...
    if (!participation) return res.status(404).json({ message: 'Participation not found' });
    const contest = await Contest.findById(participation.contestId);
    if (!contest) return res.status(404).json({ message: 'Contest not found' });


    const matchData = await getMatchById(participation.matchId); // ✅ Now uses getMatchById from entityDataService
    if (matchData?.matchStarted) {
      return res.status(400).json({ message: 'Cannot switch team after match starts' });
    }

    const newTeam = await getTeamDetails({ teamId: newTeamId, userId, matchId: participation.matchId });
     // ... (validation for newTeam) ...
    if (!newTeam || newTeam.user !== userId || newTeam.matchId !== participation.matchId) {
        return res.status(400).json({ message: 'Invalid new team or team not found for this user and match' });
    }

    participation.teamId = newTeamId;
    await participation.save();

    return res.json({ message: 'Team switched successfully', participation });
  } catch (err) {
    console.error('Error in switchTeam:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};