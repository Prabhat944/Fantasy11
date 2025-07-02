// src/services/wallet.service.js

// ... (existing deductContestFee and logTransaction functions) ...

const Wallet = require('../models/wallet.model');
const Transaction = require('../models/transaction.model');
const { calculateNetWinnings, calculateTds, calculateGstOnDeposit } = require('../utils/financialUtils');


/**
 * Creates a new wallet for a user, typically upon signup.
 * Gives an initial signup bonus.
 * @param {string} userId - The ID of the user.
 * @param {number} signupBonus - The amount of bonus to give.
 * @returns {Promise<object>} The created wallet document.
 */
exports.createWalletForUser = async (userId, signupBonus = 25) => {
    // Check if a wallet already exists to prevent duplicates
    const existingWallet = await Wallet.findOne({ user: userId });
    if (existingWallet) {
        console.warn(`Wallet already exists for user ${userId}.`);
        return existingWallet;
    }

    const wallet = new Wallet({
        user: userId,
        signup_bonus_balance: signupBonus
    });
    await wallet.save();

    // Log the initial bonus transaction
    await logTransaction(wallet._id, signupBonus, 'SIGNUP_BONUS', 'Initial signup bonus credit', wallet);
    
    return wallet;
};

/**
 * Processes a deposit after it's confirmed by a payment gateway.
 * Calculates GST and credits the appropriate balances.
 * @param {string} userId - The ID of the user.
 * @param {number} depositAmount - The gross amount deposited by the user.
 * @returns {Promise<object>} The updated wallet document.
 */
exports.processUserDeposit = async (userId, depositAmount) => {
    const { gstAmount, realDepositValue } = calculateGstOnDeposit(depositAmount);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const wallet = await Wallet.findOneAndUpdate(
            { user: userId },
            {
                $inc: {
                    deposit_balance: realDepositValue,
                    cashback_balance: gstAmount
                }
            },
            { new: true, session } // 'new: true' returns the updated doc, 'session' ensures it's part of the transaction
        );

        if (!wallet) throw new Error("Wallet not found to process deposit.");

        // Log both parts of the transaction atomically
        await logTransaction(wallet._id, realDepositValue, 'DEPOSIT', `Gross deposit: ${depositAmount}`, wallet, session);
        await logTransaction(wallet._id, gstAmount, 'CASHBACK_CREDIT', 'Promotional GST cashback', wallet, session);

        await session.commitTransaction();
        return wallet;
    } catch (error) {
        await session.abortTransaction();
        console.error("Error processing deposit:", error);
        throw error; // Re-throw the error to be handled by the controller
    } finally {
        session.endSession();
    }
};

/**
 * Fetches a paginated transaction history for a user's wallet.
 * @param {string} userId - The ID of the user.
 * @param {number} page - The page number for pagination.
 * @param {number} limit - The number of transactions per page.
 * @returns {Promise<object>} An object containing transactions and pagination info.
 */
exports.getTransactionHistory = async (userId, page = 1, limit = 20) => {
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) throw new Error("Wallet not found.");

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort: { createdAt: -1 }, // Show most recent transactions first
        lean: true
    };

    const transactions = await Transaction.paginate({ wallet: wallet._id }, options);
    return transactions;
};

// Note: You will need to install 'mongoose-paginate-v2' for the paginate function
// npm install mongoose-paginate-v2
// And add it as a plugin to your transaction.model.js:
/*
  const mongoosePaginate = require('mongoose-paginate-v2');
  transactionSchema.plugin(mongoosePaginate);
*/


exports.withdrawFromWallet = async (userId, withdrawalAmount) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const wallet = await Wallet.findOne({ user: userId }).session(session);
        if (!wallet) throw new Error('Wallet not found.');

        const currentWalletBalance = wallet.withdrawal_balance;

        if (withdrawalAmount > currentWalletBalance) {
            throw new Error('Insufficient withdrawal balance.');
        }

        // Get total deposits and withdrawals
        const allTransactions = await Transaction.find({ wallet: wallet._id }).session(session);

        const totalDeposits = allTransactions
            .filter(txn => txn.type === 'DEPOSIT')
            .reduce((sum, txn) => sum + txn.amount, 0);

        const totalWithdrawals = allTransactions
            .filter(txn => txn.type === 'WITHDRAWAL')
            .reduce((sum, txn) => sum + txn.amount, 0);

        const totalTdsPaid = allTransactions
            .filter(txn => txn.type === 'TDS')
            .reduce((sum, txn) => sum + txn.amount, 0);

        const walletTotal = wallet.withdrawal_balance + wallet.deposit_balance + wallet.cashback_balance;

        const netWinnings = calculateNetWinnings(totalWithdrawals, walletTotal, totalDeposits);

        const { tds, taxableAmount } = calculateTds(netWinnings, totalTdsPaid);
        console.log(`Taxable Winnings: ₹${taxableAmount}, TDS applied: ₹${tds}`);

        const finalWithdraw = withdrawalAmount - tds;

        if (finalWithdraw < 0) {
            throw new Error('TDS exceeds withdrawal amount.');
        }

        // Deduct from withdrawal balance
        wallet.withdrawal_balance -= withdrawalAmount;
        await wallet.save({ session });

        // Log withdrawal
        await logTransaction(wallet._id, withdrawalAmount, 'WITHDRAWAL', 'User initiated withdrawal', wallet, session);

        // Log TDS if applicable
        if (tds > 0) {
            await logTransaction(wallet._id, tds, 'TDS', 'TDS deducted on winnings', wallet, session);
        }

        await session.commitTransaction();
        return { amountCredited: finalWithdraw, tdsDeducted: tds };
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};