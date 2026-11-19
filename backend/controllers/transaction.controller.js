import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import ApiResponse from '../utils/ApiResponse.js';

export const getHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 });
    return ApiResponse.success(res, transactions, 'Transactions fetched successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message);
  }
};

export const requestCredit = async (req, res) => {
  try {
    const { description, creditsRequested, userId: bodyUserId } = req.body;
    
    // User from body, auth middleware, or fallback to first user
    let userId = bodyUserId || req.userId;
    if (!userId) {
      const defaultUser = await User.findOne();
      userId = defaultUser ? defaultUser._id : null;
    }
    
    // Credit rate from settings (e.g. 1 INR per credit)
    const creditRate = 1;
    const totalPrice = creditsRequested * creditRate;

    // Get current balance
    const user = userId ? await User.findById(userId) : null;
    const balanceAfter = user ? user.credits.available : 0;

    const transaction = new Transaction({
      userId,
      type: 'Request',
      description,
      credits: {
        added: creditsRequested,
        deducted: 0,
        rate: creditRate
      },
      totalPrice,
      status: 'Requested',
      balanceAfter
    });

    await transaction.save();
    return ApiResponse.created(res, null, 'Credit requested successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message);
  }
};

// Hidden mock endpoint to simulate an admin approving a credit request
export const mockApproveCredit = async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await Transaction.findById(id);
    if (!transaction || transaction.type !== 'Request' || transaction.status !== 'Requested') {
      return ApiResponse.error(res, 'Invalid transaction to approve', 400);
    }

    transaction.status = 'Completed';
    
    // Update the User's balance
    const user = await User.findById(transaction.userId);
    if (user) {
      user.credits.available += transaction.credits.added;
      await user.save();
    }
    
    // The transaction's balanceAfter should reflect the newly updated balance
    transaction.balanceAfter = user ? user.credits.available : transaction.balanceAfter;
    
    // Also create a 'Purchase' transaction record since the request was approved
    if (user) {
      await Transaction.create({
        userId: user._id,
        type: 'Purchase',
        description: `Credits Purchased: ${transaction.credits.added}`,
        credits: {
          added: transaction.credits.added,
          deducted: 0,
          rate: transaction.credits.rate
        },
        balanceAfter: user.credits.available
      });
    }
    
    await transaction.save();
    return ApiResponse.success(res, null, 'Credit request approved');
  } catch (error) {
    return ApiResponse.error(res, error.message);
  }
};
