import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import axios from 'axios';

const CustomerFormModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState({ name: '', email: '', mobile: '', address: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        email: initialData.email || '',
        mobile: initialData.mobile || '',
        address: initialData.address || ''
      });
    } else {
      setFormData({ name: '', email: '', mobile: '', address: '' });
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      if (initialData && initialData._id) {
        // Edit mode
        const res = await axios.put(`${import.meta.env.VITE_API_URL}/api/customers/${initialData._id}`, formData);
        onSave(res.data, 'edit');
      } else {
        // Add mode
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/customers`, formData);
        onSave(res.data, 'add');
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error saving customer. Please check the inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-[#4c3963]">
            {initialData ? 'Edit Customer' : 'Add Customer'}
          </h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-1.5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input 
              required 
              type="text" 
              placeholder="e.g. Disha Radadiya"
              className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#4c3963] focus:ring-1 focus:ring-[#4c3963]" 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input 
              required 
              type="email" 
              placeholder="e.g. disha@example.com"
              className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#4c3963] focus:ring-1 focus:ring-[#4c3963]" 
              value={formData.email} 
              onChange={e => setFormData({ ...formData, email: e.target.value })} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input 
              required 
              type="text" 
              placeholder="e.g. 9825032534"
              className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#4c3963] focus:ring-1 focus:ring-[#4c3963]" 
              value={formData.mobile} 
              onChange={e => setFormData({ ...formData, mobile: e.target.value })} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input 
              required 
              type="text" 
              placeholder="e.g. Punagam, Surat"
              className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#4c3963] focus:ring-1 focus:ring-[#4c3963]" 
              value={formData.address} 
              onChange={e => setFormData({ ...formData, address: e.target.value })} 
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#4c3963] text-white rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              <span>{isSubmitting ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerFormModal;
