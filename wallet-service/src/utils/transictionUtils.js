const formatTransactionReason = (baseReason, contestId, matchId, contestDetails, matchDetails) => {
    let reason = baseReason;
    
    if (contestId) {
        const contestName = contestDetails?.[contestId]?.name || `Contest ${contestId}`;
        reason = reason.replace(contestId, contestName);
    }
    
    if (matchId) {
        const matchName = matchDetails?.[matchId]?.name || `Match ${matchId}`;
        reason = reason.replace(matchId, matchName);
    }
    
    return reason;
};
module.exports= formatTransactionReason;