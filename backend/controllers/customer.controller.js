import Customer from '../models/Customer.js';
import Campaign from '../models/Campaign.js';
import ApiResponse from '../utils/ApiResponse.js';

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
    
    return ApiResponse.success(res, populated, 'Customers fetched successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message);
  }
};

export const getCustomerLookup = async (req, res) => {
  try {
    const customers = await Customer.find()
      .select('_id profile.name')
      .sort({ 'profile.name': 1 })
      .lean();
    return ApiResponse.success(res, customers, 'Customer lookup fetched successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message);
  }
};

export const createCustomer = async (req, res) => {
  try {
    const { profile, userId, whatsapp } = req.body;
    
    const customer = new Customer({
      userId: userId || req.userId,
      profile,
      whatsapp: {
        status: 'Disconnected',
        mobileNo: whatsapp?.mobileNo || profile?.mobile || '',
        provider: whatsapp?.provider || 'wwebjs'
      }
    });
    
    await customer.save();
    return ApiResponse.created(res, null, 'Customer created successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message);
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return ApiResponse.error(res, 'Customer not found', 404);
    return ApiResponse.success(res, customer, 'Customer fetched successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message);
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.whatsapp && typeof updateData.whatsapp === 'object') {
      if ('mobileNo' in updateData.whatsapp) {
        updateData['whatsapp.mobileNo'] = updateData.whatsapp.mobileNo;
      }
      delete updateData.whatsapp;
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { returnDocument: 'after', runValidators: true }
    );
    if (!customer) return ApiResponse.error(res, 'Customer not found', 404);
    return ApiResponse.success(res, null, 'Customer updated successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message);
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return ApiResponse.error(res, 'Customer not found', 404);
    return ApiResponse.success(res, null, 'Customer deleted successfully');
  } catch (error) {
    return ApiResponse.error(res, error.message);
  }
};
