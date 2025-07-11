const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const axios = require('axios');
const { invalidateWalletCache, getWalletCache, setWalletCache } = require('../utils/cache');

// Define service URLs from environment variables with fallbacks
const CONTEST_SERVICE_URL = process.env.CONTEST_SERVICE_URL || 'http://localhost:5001';
// const MATCH_SERVICE_URL = process.env.MATCH_SERVICE_URL || CONTEST_SERVICE_URL;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:5001'; // Added for referral logic

const OFFER_SERVICE_URL = process.env.OFFER_SERVICE_URL || 'http://localhost:3003';
// Helper to round numbers to two decimal places consistently
const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Helper to calculate the total balance from different wallet components
const calculateTotalBalance = (wallet) => {
    const total = (wallet.deposit_balance || 0) + (wallet.cashback_balance || 0) + 
                  (wallet.withdrawal_balance || 0) + (wallet.signup_bonus_balance || 0);
    return roundToTwo(total);
};

// Helper to format wallet details for API responses
const formatWallet = (wallet) => {
    const raw = typeof wallet.toObject === 'function' ? wallet.toObject() : wallet;

    return {
        ...raw,
        deposit_balance: roundToTwo(raw.deposit_balance),
        withdrawal_balance: roundToTwo(raw.withdrawal_balance),
        cashback_balance: roundToTwo(raw.cashback_balance),
        signup_bonus_balance: roundToTwo(raw.signup_bonus_balance),
        total_balance: calculateTotalBalance(raw)
    };
};

// Helper function for consistent transaction reason formatting
// const formatTransactionReason = async (baseReason, contestId = null, matchId = null) => {
//     let reason = baseReason;
//     const idsToFetch = [];
    
//     if (contestId) idsToFetch.push({ type: 'contest', id: contestId });
//     if (matchId) idsToFetch.push({ type: 'match', id: matchId });

//     if (idsToFetch.length > 0) {
//         try {
//             const contestIds = idsToFetch.filter(i => i.type === 'contest').map(i => i.id);
//             const matchIds = idsToFetch.filter(i => i.type === 'match').map(i => i.id);
            
//             const { contests, matches } = await getContestAndMatchDetails(contestIds, matchIds);

//             if (contestId && contests[contestId]) {
//                 const contest = contests[contestId];
//                 reason = reason.replace(new RegExp(contestId.toString(), 'g'), `${contest.name || 'Contest'} (₹${contest.prizePool || contest.entryFee})`);
//             }

//             if (matchId && matches[matchId]) {
//                 const match = matches[matchId];
//                 reason = reason.replace(new RegExp(matchId.toString(), 'g'), matches[matchId].name || `Match ${matchId}`);
//             }
//         } catch (error) {
//             console.error('Error formatting transaction reason:', error);
//         }
//     }

//     return reason;
// };

const getWalletDetails = async (req, res) => {
    const userId = req.user._id.toString();

    try {
        const cachedWallet = await getWalletCache(userId);
        if (cachedWallet) {
            console.log(`Serving wallet for ${userId} from Redis cache.`);
            return res.status(200).json(formatWallet(cachedWallet));
        }

        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            wallet = new Wallet({ user: userId });
            await wallet.save();
            console.log(`New wallet created for user: ${userId}`);
        }

        await setWalletCache(userId, wallet.toObject());

        res.status(200).json(formatWallet(wallet));

    } catch (error) {
        console.error(`Error fetching wallet for ${userId}:`, error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
const calculateDepositBonus = async (depositAmount) => {
    try {
        // Call the endpoint we designed for the Offer Service
        const response = await axios.get(`${OFFER_SERVICE_URL}/api/offerRoutes/deposit-offer/active`);
        const offer = response.data;
        
        if (!offer || !offer.tiers || offer.tiers.length === 0) {
            return 0; // No active offer found
        }

        // Sort tiers from highest deposit to lowest to find the best matching offer
        offer.tiers.sort((a, b) => b.minDeposit - a.minDeposit);
        
        let bonusPercentage = 0;
        // Find the correct tier for the deposited amount
        for (const tier of offer.tiers) {
            if (depositAmount >= tier.minDeposit) {
                bonusPercentage = tier.bonusPercentage;
                break; // Stop at the first (highest) tier that matches
            }
        }

        if (bonusPercentage > 0) {
            let bonusAmount = (depositAmount * bonusPercentage) / 100;
            // Apply the max bonus cap if the offer has one
            if (offer.maxBonusAmount && bonusAmount > offer.maxBonusAmount) {
                bonusAmount = offer.maxBonusAmount;
            }
            return roundToTwo(bonusAmount);
        }

        return 0; // The deposit amount didn't meet any of the offer tiers

    } catch (error) {
        // If the Offer Service is down or returns a 404 (No offer), we don't want to crash.
        // We just log it and proceed without an offer bonus.
        if (error.response?.status !== 404) {
            console.error('Error fetching deposit offer:', error.message);
        } else {
            console.log('Info: No active deposit offer available.');
        }
        return 0;
    }
};
const updateWalletAmount = async (userId, type, amount, res, deductionReason = '', signupBonusPercentage = 0, contestId = null, matchId = null) => {
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount. Amount must be a positive number.' });
    }
    if (typeof signupBonusPercentage !== 'number' || signupBonusPercentage < 0 || signupBonusPercentage > 100) {
        signupBonusPercentage = 0;
    }

    try {
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            if (type === 'withdraw' || type === 'deduct') {
                return res.status(404).json({ message: `Wallet not found for user: ${userId}. Cannot ${type}.` });
            }
            wallet = new Wallet({ user: userId });
            await wallet.save();
        }

        let deductionBreakdown = {
            deposit_balance: 0,
            cashback_balance: 0,
            withdrawal_balance: 0,
            signup_bonus_balance: 0
        };

        let finalReason = deductionReason; 

        switch (type) {
            case 'deposit': {
                const gst = roundToTwo(amount * 0.28);
                const netDeposit = roundToTwo(amount - gst);

                wallet.deposit_balance += netDeposit;
                wallet.cashback_balance += gst;

                let bonus = 0;
                if (!wallet.isFirstDepositBonusGiven) {
                    bonus = amount;
                    wallet.signup_bonus_balance += bonus;
                    wallet.isFirstDepositBonusGiven = true;
                }
                finalReason = `Deposit ₹${amount}, GST ₹${gst}, Bonus ₹${bonus}`;
                break;
            }
            case 'winning': {
                wallet.withdrawal_balance += amount;
                finalReason = deductionReason || `Winnings credited for match ${matchId || 'N/A'} and contest ${contestId || 'N/A'}`;
                break;
            }
            case 'cashback': {
                wallet.cashback_balance += amount;
                finalReason = deductionReason || 'Cashback credited';
                break;
            }
            case 'bonus': {
                wallet.signup_bonus_balance += amount;
                finalReason = deductionReason || 'Bonus credited';
                break;
            }
            case 'withdraw': {
                if (wallet.withdrawal_balance < amount) {
                    return res.status(400).json({ message: 'Insufficient withdrawable balance.' });
                }
                wallet.withdrawal_balance -= amount;
                deductionBreakdown.withdrawal_balance = amount;
                finalReason = deductionReason || 'Withdrawal by user';
                break;
            }
            case 'deduct': {
                let remainingToCover = amount;
                let snapshot = { ...wallet.toObject() };

                const totalAvailable = snapshot.deposit_balance + snapshot.cashback_balance + 
                                      snapshot.withdrawal_balance + snapshot.signup_bonus_balance;
                if (totalAvailable < amount - 0.01) {
                    return res.status(400).json({ message: 'Insufficient overall balance to join contest.' });
                }

                let bonusUsed = 0;
                if (signupBonusPercentage > 0 && snapshot.signup_bonus_balance > 0) {
                    const maxBonusFromEntry = roundToTwo(amount * (signupBonusPercentage / 100));
                    bonusUsed = Math.min(snapshot.signup_bonus_balance, maxBonusFromEntry, remainingToCover);

                    if (bonusUsed > 0) {
                        wallet.signup_bonus_balance -= bonusUsed;
                        deductionBreakdown.signup_bonus_balance = bonusUsed;
                        remainingToCover -= bonusUsed;
                    }
                }

                let cashUsedFromCashback = 0;
                let cashUsedFromDeposit = 0;
                let cashUsedFromWithdrawal = 0;

                const targetCashbackShare = roundToTwo(remainingToCover * 0.3);
                cashUsedFromCashback = Math.min(wallet.cashback_balance, targetCashbackShare);

                if (cashUsedFromCashback > 0) {
                    wallet.cashback_balance -= cashUsedFromCashback;
                    deductionBreakdown.cashback_balance = roundToTwo(deductionBreakdown.cashback_balance + cashUsedFromCashback);
                    remainingToCover -= cashUsedFromCashback;
                }

                if (remainingToCover > 0.01) {
                    cashUsedFromDeposit = Math.min(wallet.deposit_balance, remainingToCover);
                    if (cashUsedFromDeposit > 0) {
                        wallet.deposit_balance -= cashUsedFromDeposit;
                        deductionBreakdown.deposit_balance = roundToTwo(deductionBreakdown.deposit_balance + cashUsedFromDeposit);
                        remainingToCover -= cashUsedFromDeposit;
                    }

                    if (remainingToCover > 0.01) {
                        cashUsedFromWithdrawal = Math.min(wallet.withdrawal_balance, remainingToCover);
                        if (cashUsedFromWithdrawal > 0) {
                            wallet.withdrawal_balance -= cashUsedFromWithdrawal;
                            deductionBreakdown.withdrawal_balance = roundToTwo(deductionBreakdown.withdrawal_balance + cashUsedFromWithdrawal);
                            remainingToCover -= cashUsedFromWithdrawal;
                        }
                    }
                }

                if (remainingToCover > 0.01) {
                    wallet.signup_bonus_balance += bonusUsed;
                    wallet.cashback_balance += cashUsedFromCashback;
                    wallet.deposit_balance += cashUsedFromDeposit;
                    wallet.withdrawal_balance += cashUsedFromWithdrawal;

                    return res.status(400).json({ message: 'Insufficient balance to deduct full amount for contest entry.' });
                }
                
                finalReason = deductionReason || `Deducted for contest join: Contest(${contestId || 'N/A'}) Match(${matchId || 'N/A'})`;
                break;
            }
            default:
                return res.status(400).json({ message: 'Invalid transaction type' });
        }

        wallet.deposit_balance = roundToTwo(wallet.deposit_balance);
        wallet.withdrawal_balance = roundToTwo(wallet.withdrawal_balance);
        wallet.cashback_balance = roundToTwo(wallet.cashback_balance);
        wallet.signup_bonus_balance = roundToTwo(wallet.signup_bonus_balance);

        await wallet.save();
        await invalidateWalletCache(userId);

        await WalletTransaction.create({
            user: userId,
            type: type,
            amount,
            reason: finalReason,
            breakdown: deductionBreakdown,
            withdrawalStatus: (type === 'withdraw') ? 'Pending' : null,
        });

        res.status(200).json({
            message: `Wallet ${type} successful.${finalReason ? ` Reason: ${finalReason}` : ''}`,
            wallet: formatWallet(wallet),
            deductionBreakdown: (type === 'deduct' || type === 'withdraw') ? deductionBreakdown : undefined
        });
    } catch (err) {
        console.error(`Error during ${type} for user ${userId}:`, err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

const creditWinningAmountsForMatch = async (matchId) => {
    try {
        const { data: winners } = await axios.get(`${CONTEST_SERVICE_URL}/api/contest/winners/${matchId}`);

        if (!Array.isArray(winners) || winners.length === 0) {
            console.log(`[creditWinningAmountsForMatch] No winners for match: ${matchId}`);
            return;
        }

        for (const winner of winners) {
            const { user, prizeWon, contestId, matchId: winnerMatchId } = winner;

            if (!prizeWon || prizeWon <= 0) continue;

            const wallet = await Wallet.findOne({ user });

            if (!wallet) {
                console.warn(`[creditWinningAmountsForMatch] Wallet not found for user ${user}`);
                continue;
            }

            wallet.withdrawal_balance = roundToTwo(wallet.withdrawal_balance + prizeWon);

            await wallet.save();
            await invalidateWalletCache(user);

            const reason = `Winning credited for match ${winnerMatchId || 'N/A'} and contest ${contestId || 'N/A'}`;

            await WalletTransaction.create({
                user,
                type: 'winning',
                amount: prizeWon,
                reason,
                breakdown: { withdrawal_balance: prizeWon },
            });

            await axios.post(`${CONTEST_SERVICE_URL}/api/contest/mark-winning-credited`, {
                userId: user,
                matchId: winnerMatchId || matchId
            });

            console.log(`[creditWinningAmountsForMatch] Credited ₹${prizeWon} to user ${user}`);
        }

    } catch (err) {
        console.error('[creditWinningAmountsForMatch] Error:', err.message);
    }
};

const getContestAndMatchDetails = async (contestIds, matchIds) => {
    let details = {
        contests: {},
        matches: {}
    };

    try {
        if (contestIds && contestIds.length > 0) {
            const contestResponse = await axios.get(`${CONTEST_SERVICE_URL}/api/contest/details-by-ids?ids=${contestIds.join(',')}`);
            contestResponse.data.forEach(c => {
                details.contests[c._id] = c;
            });
        }
        
        if (matchIds && matchIds.length > 0) {
            const matchResponse = await axios.get(`${CONTEST_SERVICE_URL}/api/contest/match/details-by-ids?ids=${matchIds.join(',')}`);
            
            matchResponse.data.forEach(m => {
                if (m.matchId) details.matches[m.matchId] = m;
                details.matches[m._id] = m;
            });
        }
    } catch (error) {
        console.error("Error fetching contest/match details:", error.message);
    }
    return details;
};

const getTransactionsHistory = async (req, res) => {
    const userId = req.user._id.toString();
    const { page = 1, limit = 10, type, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = { user: userId };
    if (type) {
        query.type = type;
    }

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
        lean: true
    };
        try {
            const result = await WalletTransaction.paginate(query, options);
            const transactions = result.docs;
    
            const contestIds = new Set();
            const matchIds = new Set();
    
            transactions.forEach(t => {
                const idPattern = /[0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
                const idsInReason = t.reason.match(idPattern) || [];
                
                idsInReason.forEach(id => {
                    if (id.length === 24) contestIds.add(id);
                    else if (id.length === 36) matchIds.add(id);
                });
            });
    
            const { contests, matches } = await getContestAndMatchDetails(
                Array.from(contestIds),
                Array.from(matchIds)
            );
    
            const formattedTransactions = transactions.map(t => {
                let reason = t.reason;
                const idReplacementPattern = /([0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
                
                reason = reason.replace(idReplacementPattern, (match) => {
                    if (match.length === 24) {
                        if (contests[match]) {
                            const contest = contests[match];
                            return `${contest.name || 'Contest'} (₹${contest.prizePool || contest.entryFee})`;
                        } else if (matches[match]) {
                            const matchDetails = matches[match];
                            return matchDetails.name || `Match ${match.substring(0,6)}...`;
                        }
                    } else if (match.length === 36) {
                        if (matches[match]) {
                            const matchDetails = matches[match];
                            return matchDetails.name || `Match ${match.substring(0,6)}...`;
                        }
                    }
                    return match;
                });
    
                return {
                    ...t,
                    reason: reason
                };
            });    

        res.status(200).json({
            transactions: formattedTransactions,
            totalTransactions: result.totalDocs,
            totalPages: result.totalPages,
            currentPage: result.page,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage
        });

    } catch (error) {
        console.error(`Error fetching transaction history for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to fetch transaction history.' });
    }
};

const depositFunds = async (req, res) => {
    const userId = req.user._id.toString();
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'A valid positive amount is required.' });
    }

    try {
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId });
        }

        const gst = roundToTwo(amount * 0.28);
        const netDeposit = roundToTwo(amount - gst);

        // Update main balances
        wallet.deposit_balance += netDeposit;
        wallet.cashback_balance += gst;

        // --- New Bonus Calculation Logic ---
        let bonus = 0;
        let bonusReason = "";

        // 1. First, try to get a bonus from a special offer
        const offerBonus = await calculateDepositBonus(amount);
        
        if (offerBonus > 0) {
            bonus = offerBonus;
            bonusReason = "Promotional offer bonus";
        } 
        // 2. If no offer bonus, fallback to the original first deposit bonus logic
        else if (!wallet.isFirstDepositBonusGiven) {
            bonus = amount; // Your original 100% first deposit bonus
            wallet.isFirstDepositBonusGiven = true;
            bonusReason = "First deposit bonus";
        }
        
        if (bonus > 0) {
            wallet.signup_bonus_balance += bonus;
        }
        // --- End of New Bonus Logic ---

        await wallet.save();
        await invalidateWalletCache(userId);

        const finalReason = `Deposit ₹${amount}, GST ₹${gst}, Bonus ₹${bonus} (${bonusReason || 'No bonus'})`;
        
        // Create a detailed transaction record
        await WalletTransaction.create({
            user: userId,
            type: 'deposit',
            amount: amount,
            reason: finalReason,
            breakdown: {
                deposit_balance: netDeposit,
                cashback_balance: gst,
                signup_bonus_balance: bonus
            },
        });
        
        res.status(200).json({ 
            message: 'Deposit successful.', 
            wallet: formatWallet(wallet) 
        });

    } catch (err) {
        console.error(`Error during deposit for user ${userId}:`, err);
        res.status(500).json({ message: 'Internal server error during deposit.' });
    }
};

const addWinningAmount = async (req, res) => {
    const amount = req.body.amount;
    const userId = req.body.userId || req.user._id;
    const contestId = req.body.contestId || null;
    const matchId = req.body.matchId || null;
    if (!userId || !amount) {
        return res.status(400).json({ message: 'Missing userId or amount' });
    }
    await updateWalletAmount(userId, 'winning', amount, res, `Winning credited for match ${matchId || 'N/A'} and contest ${contestId || 'N/A'}`, 0, contestId, matchId);
};

const addGstTdsCashback = async (req, res) => {
    const amount = req.body.amount;
    await updateWalletAmount(req.user._id.toString(), 'cashback', amount, res);
};

const addBonus = async (req, res) => {
    const amount = req.body.amount;
    await updateWalletAmount(req.user._id.toString(), 'bonus', amount, res);
};

const withdrawFunds = async (req, res) => {
    const userId = req.user._id.toString();
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'A valid positive amount is required.' });
    }

    const isTdsPromoActive = true;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const [wallet, userFinancials] = await Promise.all([
            Wallet.findOne({ user: userId }).session(session),
            getUserFinancialSummary(userId)
        ]);
        
        console.log('--- Financial Summary For TDS ---', userFinancials);

        if (!wallet) {
            throw new Error('Wallet not found.');
        }
        if (wallet.withdrawal_balance < amount) {
            return res.status(400).json({ message: 'Insufficient withdrawable balance.' });
        }

        const tdsDetails = calculateTDS(amount, userFinancials);
        console.log('--- TDS Calculation Details ---', tdsDetails);

        wallet.withdrawal_balance = roundToTwo(wallet.withdrawal_balance - amount);
        
        if (isTdsPromoActive && tdsDetails.tdsToDeduct > 0) {
            wallet.cashback_balance = roundToTwo(wallet.cashback_balance + tdsDetails.tdsToDeduct);
        }
        
        await wallet.save({ session });

        await WalletTransaction.create([{
            user: userId, type: 'withdraw', amount: amount,
            reason: 'Withdrawal by user', withdrawalStatus: 'Completed',
            breakdown: { withdrawal_balance: amount }
        }], { session });

        if (tdsDetails.tdsToDeduct > 0) {
            await WalletTransaction.create([{
                user: userId, type: 'tds', amount: tdsDetails.tdsToDeduct,
                reason: `TDS (30%) on net winnings of ₹${tdsDetails.netWinnings}`
            }], { session });

            if (isTdsPromoActive) {
                await WalletTransaction.create([{
                    user: userId, 
                    type: 'cashback', 
                    // 👇 --- THIS LINE IS NOW CORRECTED ---
                    amount: tdsDetails.tdsToDeduct, 
                    reason: 'Promotional cashback against TDS deduction',
                    breakdown: { cashback_balance: tdsDetails.tdsToDeduct }
                }], { session });
            }
        }
        
        await session.commitTransaction();
        await invalidateWalletCache(userId);

        res.status(200).json({
            message: 'Withdrawal successful.',
            withdrawalAmount: amount,
            tdsDeducted: tdsDetails.tdsToDeduct,
            amountCreditedToBank: tdsDetails.finalAmountToUser,
            promotionalCashback: isTdsPromoActive ? tdsDetails.tdsToDeduct : 0
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error during withdrawal with TDS:', error);
        res.status(500).json({ message: 'Internal server error during withdrawal.', error: error.message });
    } finally {
        session.endSession();
    }
};
const deductFunds = async (req, res) => {
    const { amount, reason, signupBonusPercentage, contestId, matchId } = req.body;
    let effectiveReason = reason || `Deducted for contest join: Contest(${contestId || 'N/A'}) Match(${matchId || 'N/A'})`;
    await updateWalletAmount(req.user._id.toString(), 'deduct', amount, res, effectiveReason, signupBonusPercentage, contestId, matchId);
};

// const refundFunds = async (req, res) => {
//     const targetUserId = req.body.userId || req.user._id.toString();
//     const { breakdown, reason = 'Generic Refund', refundedTransactionId = null, contestId = null, matchId = null } = req.body;

//     if (!targetUserId) {
//         return res.status(400).json({ message: 'User ID is required for refund.' });
//     }
//     if (!breakdown || typeof breakdown !== 'object') {
//         return res.status(400).json({ message: 'Invalid or missing refund breakdown.' });
//     }
//     // A quick check for the presence of keys, can be more robust if needed
//     if (!('deposit_balance' in breakdown && 'cashback_balance' in breakdown && 'withdrawal_balance' in breakdown && 'signup_bonus_balance' in breakdown)) {
//         return res.status(400).json({ message: 'Refund breakdown is incomplete. Missing balance types.' });
//     }

//     try {
//         if (refundedTransactionId) {
//             const existingRefund = await WalletTransaction.findOne({ refundedTransactionId });
//             if (existingRefund) {
//                 return res.status(400).json({ message: 'Refund already processed for this transaction.' });
//             }
//         }

//         let wallet = await Wallet.findOne({ user: targetUserId });
//         if (!wallet) {
//             wallet = new Wallet({ user: targetUserId });
//             await wallet.save();
//             console.warn(`Wallet not found for user: ${targetUserId} during refund. A new wallet was created.`);
//         }

//         // Update wallet balances
//         wallet.deposit_balance = roundToTwo(wallet.deposit_balance + (breakdown.deposit_balance || 0));
//         wallet.cashback_balance = roundToTwo(wallet.cashback_balance + (breakdown.cashback_balance || 0));
//         wallet.withdrawal_balance = roundToTwo(wallet.withdrawal_balance + (breakdown.withdrawal_balance || 0));
//         wallet.signup_bonus_balance = roundToTwo(wallet.signup_bonus_balance + (breakdown.signup_bonus_balance || 0));

//         await wallet.save();
//         await invalidateWalletCache(targetUserId);

//         // Format the reason for the transaction log
//         let refundReason = reason;
//         if (contestId || matchId) {
//             refundReason += ` (Contest:${contestId || 'N/A'} Match:${matchId || 'N/A'})`;
//         }
//         if (refundedTransactionId) {
//             refundReason += ` [Ref ID: ${refundedTransactionId}]`;
//         }

//         // --- MODIFICATION START ---
//         // Build the transaction data object first
//         const transactionData = {
//             user: targetUserId,
//             type: 'refund',
//             amount: roundToTwo(
//                 (breakdown.deposit_balance || 0) +
//                 (breakdown.cashback_balance || 0) +
//                 (breakdown.withdrawal_balance || 0) +
//                 (breakdown.signup_bonus_balance || 0)
//             ),
//             reason: refundReason,
//             breakdown: breakdown,
//             isRefunded: true,
//         };

//         // Conditionally add the refundedTransactionId only if it exists
//         if (refundedTransactionId) {
//             transactionData.refundedTransactionId = refundedTransactionId;
//         }

//         // Create the transaction using the prepared object
//         await WalletTransaction.create(transactionData);
//         // --- MODIFICATION END ---


//         res.status(200).json({
//             message: `Refund successful. Reason: ${refundReason}.`,
//             wallet: formatWallet(wallet)
//         });

//     } catch (err) {
//         console.error(`Error during refund for user ${targetUserId}:`, err);
//         res.status(500).json({ message: 'Internal server error', error: err.message });
//     }
// };

const refundFunds = async (req, res) => {
    const targetUserId = req.body.userId || (req.user ? req.user._id.toString() : null);
    const { breakdown, reason = 'Generic Refund', refundedTransactionId = null } = req.body;

    // --- Step 0: Initial validation ---
    if (!targetUserId) {
        return res.status(400).json({ message: 'User ID is required for refund.' });
    }
    if (!breakdown || typeof breakdown !== 'object' || !('deposit_balance' in breakdown && 'cashback_balance' in breakdown && 'withdrawal_balance' in breakdown && 'signup_bonus_balance' in breakdown)) {
        return res.status(400).json({ message: 'Invalid or missing refund breakdown.' });
    }
    
    console.log(`--- REFUND PROCESS STARTED for user ${targetUserId} ---`);
    console.log('1. Received breakdown:', JSON.stringify(breakdown, null, 2));

    try {
        if (refundedTransactionId) {
            const existingRefund = await WalletTransaction.findOne({ refundedTransactionId });
            if (existingRefund) {
                console.log(`Skipping refund: Already processed for transaction ID ${refundedTransactionId}`);
                return res.status(200).json({ message: 'Refund already processed for this transaction.' });
            }
        }

        let wallet = await Wallet.findOne({ user: targetUserId });
        if (!wallet) {
            wallet = new Wallet({ user: targetUserId });
            console.warn(`Wallet not found for user ${targetUserId}. A new wallet was created.`);
        }

        console.log('2. Wallet state BEFORE update:', JSON.stringify(wallet.toObject(), null, 2));

        // Update wallet balances in memory
        wallet.deposit_balance = roundToTwo(wallet.deposit_balance + (breakdown.deposit_balance || 0));
        wallet.cashback_balance = roundToTwo(wallet.cashback_balance + (breakdown.cashback_balance || 0));
        wallet.withdrawal_balance = roundToTwo(wallet.withdrawal_balance + (breakdown.withdrawal_balance || 0));
        wallet.signup_bonus_balance = roundToTwo(wallet.signup_bonus_balance + (breakdown.signup_bonus_balance || 0));

        console.log('3. Wallet state AFTER update (in memory):', JSON.stringify(wallet.toObject(), null, 2));
        
        // --- The critical save operation ---
        const savedWallet = await wallet.save();
        console.log('4. Wallet state AFTER save (returned from DB):', JSON.stringify(savedWallet.toObject(), null, 2));

        await invalidateWalletCache(targetUserId);

        const totalRefundAmount = roundToTwo(
            (breakdown.deposit_balance || 0) + (breakdown.cashback_balance || 0) +
            (breakdown.withdrawal_balance || 0) + (breakdown.signup_bonus_balance || 0)
        );

        const transactionData = {
            user: targetUserId,
            type: 'refund',
            amount: totalRefundAmount,
            reason: reason,
            breakdown: breakdown,
        };
        if (refundedTransactionId) {
            transactionData.refundedTransactionId = refundedTransactionId;
        }

        await WalletTransaction.create(transactionData);
        console.log('5. Transaction record created successfully.');
        console.log(`--- REFUND PROCESS ENDED for user ${targetUserId} ---`);

        res.status(200).json({
            message: `Refund successful.`,
            wallet: formatWallet(savedWallet)
        });
    } catch (err) {
        console.error(`❌ Error during refund for user ${targetUserId}:`, err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

const updateWithdrawalStatus = async (transactionId, newStatus, remarks = '') => {
    try {
        const transaction = await WalletTransaction.findById(transactionId);

        if (!transaction) {
            return null;
        }

        if (transaction.type !== 'withdraw') {
            throw new Error('Transaction is not a withdrawal type.');
        }

        transaction.withdrawalStatus = newStatus;
        
        await transaction.save();

        if (newStatus === 'Rejected' || newStatus === 'Failed') {
            const wallet = await Wallet.findOne({ user: transaction.user });
            if (wallet) {
                wallet.withdrawal_balance = roundToTwo(wallet.withdrawal_balance + transaction.amount);
                await wallet.save();
                await invalidateWalletCache(transaction.user.toString());
                await WalletTransaction.create({
                    user: transaction.user,
                    type: 'refund',
                    amount: transaction.amount,
                    reason: `Refund for failed/rejected withdrawal ID: ${transactionId}`,
                    breakdown: { withdrawal_balance: transaction.amount },
                    isRefunded: true,
                    refundedTransactionId: transactionId.toString()
                });
            }
        }

        return transaction;

    } catch (error) {
        console.error(`Error in updateWithdrawalStatus for ${transactionId}:`, error);
        throw error;
    }
};

// --- START: ADDED FOR REFERRAL BONUS LOGIC ---
const getUser = async (userId) => {
    try {
      console.log(`Fetching user from: ${USER_SERVICE_URL}/api/v1/user/by-id/${userId}`);
      const res = await axios.get(`${USER_SERVICE_URL}/api/v1/user/by-id/${userId}`, {
        timeout: 5000 // 5 second timeout
      });
      
      if (!res.data) {
        console.warn(`User ${userId} not found - empty response`);
        return null;
      }
      
      return res.data;
    } catch (err) {
      console.error(`Failed to fetch user ${userId}:`, {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
        stack: err.stack
      });
      return null;
    }
};
  
const creditUserForReferral = async (userId, amount, reason) => {
    try {
      let wallet = await Wallet.findOne({ user: userId });
      
      if (!wallet) {
        wallet = new Wallet({ 
          user: userId,
          signup_bonus_balance: amount, // Initialize with bonus
          signup_bonus_expiry: new Date(Date.now() + 30*24*60*60*1000) // 30 days expiry
        });
      } else {
        // Explicitly increment the bonus balance
        wallet.signup_bonus_balance = (wallet.signup_bonus_balance || 0) + amount;
        wallet.signup_bonus_expiry = new Date(Date.now() + 30*24*60*60*1000);
      }
  
      // Explicitly mark the field as modified if using Mongoose
      wallet.markModified('signup_bonus_balance');
      
      await wallet.save();
      await invalidateWalletCache(userId);
  
      // Create transaction with proper breakdown
      await WalletTransaction.create({
        user: userId,
        type: 'bonus',
        amount,
        reason,
        breakdown: {
          deposit_balance: 0,
          cashback_balance: 0,
          withdrawal_balance: 0,
          signup_bonus_balance: amount
        }
      });
  
      console.log(`✅ Successfully credited ₹${amount} as signup bonus to ${userId}`);
    } catch (err) {
      console.error('❌ Failed to credit referral bonus:', err);
      throw err; // Re-throw to handle in calling function
    }
  };
  
  const addReferralBonus = async (req, res) => {
    const { referrerId, refereeId } = req.body;
    const referralAmount = 50;
  
    console.log('[Referral Bonus] Incoming:', req.body);
  
    if (!referrerId || !refereeId) {
      return res.status(400).json({ message: 'referrerId and refereeId are required.' });
    }
  
    try {
      const referrer = await getUser(referrerId);
      const referee = await getUser(refereeId);
  
      if (!referrer || !referee) {
        return res.status(404).json({ message: 'One of the users not found.' });
      }
  
      await creditUserForReferral(referrerId, referralAmount, `Referral bonus for inviting ${referee.name}`);
      await creditUserForReferral(refereeId, referralAmount, `Welcome bonus for joining via ${referrer.name}`);
  
      res.status(200).json({
        message: `Credited ₹${referralAmount} to both ${referrerId} and ${refereeId}`
      });
  
    } catch (err) {
      console.error('❌ Referral Bonus Error:', err.message);
      res.status(500).json({ message: 'Failed to process referral bonus' });
    }
  };

  const convertBonusToDeposit = async (req, res) => {
    const { userId, amountToConvert, reason } = req.body;

    if (!userId || !amountToConvert || amountToConvert <= 0) {
        return res.status(400).json({ message: 'User ID and a positive amount to convert are required.' });
    }

    try {
        const wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found.' });
        }
        if (wallet.signup_bonus_balance < amountToConvert) {
            return res.status(400).json({ message: 'Insufficient signup bonus balance to convert.' });
        }

        // The core conversion logic
        wallet.signup_bonus_balance = roundToTwo(wallet.signup_bonus_balance - amountToConvert);
        wallet.deposit_balance = roundToTwo(wallet.deposit_balance + amountToConvert);

        await wallet.save();
        await invalidateWalletCache(userId);

        // Create a transaction record for this conversion
        await WalletTransaction.create({
            user: userId,
            type: 'conversion', // A new type for clarity
            amount: amountToConvert,
            reason: reason || `Converted ₹${amountToConvert} from bonus to deposit.`,
            breakdown: {
                deposit_balance: amountToConvert, // Positive
                signup_bonus_balance: -amountToConvert // Negative
            }
        });

        res.status(200).json({
            message: 'Bonus successfully converted to deposit balance.',
            wallet: formatWallet(wallet)
        });

    } catch (err) {
        console.error(`Error during bonus conversion for user ${userId}:`, err);
        res.status(500).json({ message: 'Internal server error during conversion.' });
    }
};
// --- END: ADDED FOR REFERRAL BONUS LOGIC ---
const getWalletDetailsById = async (req, res) => {
    const { userId } = req.params; // Get userId from the URL parameter

    try {
        let wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            // It's better to return a 404 than create a wallet on a GET request
            return res.status(404).json({ message: 'Wallet not found.' });
        }

        // Use your existing formatter to return the wallet details
        res.status(200).json(formatWallet(wallet));

    } catch (error) {
        console.error(`Error fetching wallet for ${userId}:`, error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

const getUserFinancialSummary = async (userId) => {
    console.log(`\n--- Starting Financial Summary for User: ${userId} ---`);

    // Determine the start of the current financial year (April 1st)
    const now = new Date();
    const currentYear = now.getFullYear();
    const financialYearStart = new Date(now.getMonth() < 3 ? currentYear - 1 : currentYear, 3, 1);

    console.log(`1. Financial Year Start Date being used: ${financialYearStart.toISOString()}`);

    const matchQuery = {
        user: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: financialYearStart }
    };

    console.log('2. The exact query being sent to the database:', JSON.stringify(matchQuery, null, 2));
    
    const summary = await WalletTransaction.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: "$user",
                totalDepositsInFY: {
                    $sum: { $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0] }
                },
                totalWithdrawalsInFY: {
                    $sum: { $cond: [{ $and: [{ $eq: ["$type", "withdraw"] }, { $eq: ["$withdrawalStatus", "Completed"] }] }, "$amount", 0] }
                },
                tdsAlreadyPaidInFY: {
                    $sum: { $cond: [{ $eq: ["$type", "tds"] }, "$amount", 0] }
                }
            }
        }
    ]);

    console.log('3. Result returned from the database aggregation:', summary);

    const openingBalanceOnApril1st = 0;

    if (summary.length > 0) {
        console.log('4. Final summary being returned:', { ...summary[0], openingBalanceOnApril1st });
        console.log('--- Financial Summary Ended ---');
        return { ...summary[0], openingBalanceOnApril1st };
    }

    const defaultSummary = {
        totalDepositsInFY: 0,
        totalWithdrawalsInFY: 0,
        tdsAlreadyPaidInFY: 0,
        openingBalanceOnApril1st: openingBalanceOnApril1st
    };
    
    console.log('4. No transactions found. Returning default summary:', defaultSummary);
    console.log('--- Financial Summary Ended ---');
    return defaultSummary;
};

const calculateTDS = (currentWithdrawalAmount, userFinancials) => {
    const {
      totalDepositsInFY,
      totalWithdrawalsInFY,
      openingBalanceOnApril1st,
      tdsAlreadyPaidInFY
    } = userFinancials;
  
    const newTotalWithdrawals = totalWithdrawalsInFY + currentWithdrawalAmount;
    const netWinnings = newTotalWithdrawals - totalDepositsInFY - openingBalanceOnApril1st;
  
    if (netWinnings <= 0) {
      return { tdsToDeduct: 0, netWinnings, finalAmountToUser: currentWithdrawalAmount };
    }
  
    const totalTdsDue = netWinnings * 0.30;
    let tdsToDeductNow = totalTdsDue - tdsAlreadyPaidInFY;
    
    tdsToDeductNow = Math.max(0, tdsToDeductNow);
    tdsToDeductNow = Math.min(currentWithdrawalAmount, tdsToDeductNow);
  
    const finalAmountToUser = currentWithdrawalAmount - tdsToDeductNow;
  
    return {
      tdsToDeduct: roundToTwo(tdsToDeductNow),
      netWinnings: roundToTwo(netWinnings),
      finalAmountToUser: roundToTwo(finalAmountToUser),
    };
  };

module.exports = {
    getWalletDetails,
    depositFunds,
    addWinningAmount,
    addGstTdsCashback,
    addBonus,
    withdrawFunds,
    deductFunds,
    refundFunds,
    creditWinningAmountsForMatch,
    getTransactionsHistory,
    updateWithdrawalStatus,
    addReferralBonus,
    convertBonusToDeposit,
    getWalletDetailsById
};
