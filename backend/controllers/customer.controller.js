import Customer from '../models/Customer.js';
import Campaign from '../models/Campaign.js';

export const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 }).lean();
    const campaignsCounts = await Campaign.aggregate([
      { $group: { _id: '$customerId', count: { $sum: 1 } } }
    ]);
    
    const countsMap = {};
    campaignsCounts.forEach(c => countsMap[c._id] = c.count);
    
    const populated = customers.map(c => ({
      ...c,
      campaignsCount: countsMap[c._id.toString()] || 0
    }));
    
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers', error: error.message });
  }
};

export const createCustomer = async (req, res) => {
  try {
    const { name, email, mobile, address, userId } = req.body;
    
    const customer = new Customer({
      userId: userId || '60d5ecb8b392d700153ee123', // hardcoded mock for now
      name,
      email,
      mobile,
      address,
      whatsapp: { status: 'Disconnected' }
    });
    
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error creating customer', error: error.message });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer', error: error.message });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error updating customer', error: error.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting customer', error: error.message });
  }
};
