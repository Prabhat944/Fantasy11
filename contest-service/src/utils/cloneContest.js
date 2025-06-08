// const Contest = require('../models/Contest');

// /**
//  * Clones a given base contest.
//  * @param {Object} baseContest - The original contest to be cloned.
//  * @returns {Promise<Object>} - The newly created contest document.
//  */
// const cloneContest = async (baseContest) => {
//   if (!baseContest || !baseContest._id) {
//     throw new Error('Invalid base contest passed for cloning');
//   }

//   const newContest = new Contest({
//     matchId: baseContest.matchId,
//     entryFee: baseContest.entryFee,
//     totalSpots: baseContest.totalSpots,
//     filledSpots: 0,
//     prize: baseContest.prize,
//     participants: [],
//     baseContestId: baseContest._id,
//   });

//   try {
//     const saved = await newContest.save();
//     console.log(`✅ Cloned new contest from base: ${baseContest._id} → ${saved._id}`);
//     return saved;
//   } catch (error) {
//     console.error('❌ Error cloning contest:', error.message);
//     throw error;
//   }
// };

// module.exports = { cloneContest };


const Contest = require('../models/Contest');

/**
 * Clones a given base contest.
 * @param {Object} baseContest - The original contest to be cloned.
 * @returns {Promise<Object>} - The newly created contest document.
 */
const cloneContest = async (baseContest) => {
  if (!baseContest || !baseContest._id) {
    throw new Error('Invalid base contest passed for cloning');
  }

  // Convert the original Mongoose document to a plain JavaScript object.
  // This copies ALL fields, including title, prizeBreakupType, etc.
  const contestData = baseContest.toObject();

  // We must remove the original '_id' so MongoDB can generate a new one.
  delete contestData._id;

  const newContest = new Contest({
    ...contestData, // Use the spread operator to copy all fields from the original

    // Now, override the fields that need to be reset for a new contest
    filledSpots: 0,
    participants: [],
    
    // Explicitly set the baseContestId to link back to the original
    baseContestId: baseContest._id, 
  });

  try {
    const saved = await newContest.save();
    console.log(`✅ Cloned new contest from base: ${baseContest._id} → ${saved._id}`);
    return saved;
  } catch (error) {
    console.error('❌ Error cloning contest:', error.message);
    // It's good practice to throw the original error to preserve its type (e.g., ValidationError)
    throw error;
  }
};

module.exports = { cloneContest };