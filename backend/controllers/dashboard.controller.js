import Customer from '../models/Customer.js';
import Campaign from '../models/Campaign.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

export const getOverviewStats = async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const activeCampaigns = await Campaign.countDocuments({ status: { $in: ['In-Process', 'Drafted', 'Scheduled'] } });
    
    // Default admin user for now (or get from req.user if auth middleware was applied)
    const user = await User.findOne();
    const creditsAvailable = user ? user.credits.available : 0;
    
    const allCampaigns = await Campaign.find();
    let totalSent = 0;
    let totalSeen = 0;
    
    allCampaigns.forEach(c => {
      totalSent += c.stats?.sent || 0;
      totalSeen += c.stats?.seen || 0;
    });
    
    let conversionRate = '0%';
    if (totalSent > 0) {
      conversionRate = ((totalSeen / totalSent) * 100).toFixed(1) + '%';
    }

    const latestCampaigns = await Campaign.find().sort({ createdAt: -1 }).limit(5);
    const recentActivity = latestCampaigns.map(c => ({
        id: c._id,
        title: `Campaign '${c.name}' ${c.status.toLowerCase()}`,
        description: c.type,
        date: c.createdAt
    }));

    res.json({
      stats: {
        totalCustomers,
        activeCampaigns,
        creditsAvailable,
        conversionRate
      },
      recentActivity: recentActivity.map(t => ({
        id: t.id,
        title: t.title,
        time: new Date(t.date).toLocaleDateString()
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};
