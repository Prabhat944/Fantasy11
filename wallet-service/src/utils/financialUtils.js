/**
 * Calculate net winnings = (withdrawn amount + current wallet balance) - total deposits
 */
exports.calculateNetWinnings = (totalWithdrawals, currentWalletBalance, totalDeposits) => {
    return (totalWithdrawals + currentWalletBalance) - totalDeposits;
};

/**
 * Calculate TDS based on untaxed winnings
 */
exports.calculateTds = (netWinnings, alreadyTaxed) => {
    const taxableAmount = Math.max(0, netWinnings - alreadyTaxed);
    const tds = +(taxableAmount * 0.30).toFixed(2);
    return { tds, taxableAmount };
};


exports.calculateGstOnDeposit = (grossAmount) => {
    const gstRate = 0.28; // 28% GST as per latest gaming rules

    const baseAmount = +(grossAmount / (1 + gstRate)).toFixed(2); // e.g., ₹100
    const gstAmount = +(grossAmount - baseAmount).toFixed(2);     // e.g., ₹28

    return {
        realDepositValue: baseAmount,
        gstAmount
    };
};
