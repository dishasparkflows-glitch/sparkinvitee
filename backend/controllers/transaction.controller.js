import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

export const getHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
};

export const requestCredit = async (req, res) => {
  try {
    const { description, creditsRequested } = req.body;
    
    // Mock user for now
    const userId = '60d5ecb8b392d700153ee123';
    
    // Mock fetching credit rate from settings (e.g. 1 INR per credit)
    const creditRate = 1;
    const totalPrice = creditsRequested * creditRate;

    // Get current balance
    const user = await User.findById(userId);
    const balanceAfter = user ? user.credits.available : 0;

    const transaction = new Transaction({
      userId,
      type: 'Request',
      description,
      creditsAdded: creditsRequested,
      creditRate,
      totalPrice,
      status: 'Requested',
      balanceAfter
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Error creating credit request', error: error.message });
  }
};

// Hidden mock endpoint to simulate an admin approving a credit request
export const mockApproveCredit = async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await Transaction.findById(id);
    if (!transaction || transaction.type !== 'Request' || transaction.status !== 'Requested') {
      return res.status(400).json({ message: 'Invalid transaction to approve' });
    }

    transaction.status = 'Completed';
    
    // Update the User's balance
    const user = await User.findById(transaction.userId);
    if (user) {
      user.credits.available += transaction.creditsAdded;
      await user.save();
    }
    
    // The transaction's balanceAfter should reflect the newly updated balance
    transaction.balanceAfter = user ? user.credits.available : transaction.balanceAfter;
    
    // Let's also create a 'Purchase' transaction record since the request was approved
    if (user) {
      await Transaction.create({
        userId: user._id,
        type: 'Purchase',
        description: `Credits Purchased: ${transaction.creditsAdded}`,
        creditsAdded: transaction.creditsAdded,
        creditsDeducted: 0,
        balanceAfter: user.credits.available
      });
    }
    
    await transaction.save();
    res.json({ message: 'Credit request approved', transaction });
  } catch (error) {
    res.status(500).json({ message: 'Error approving credit', error: error.message });
  }
};
