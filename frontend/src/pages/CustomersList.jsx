import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, MoreVertical, X, Eye, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';

const CustomerFormModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState({ name: '', email: '', mobile: '', address: '' });
  
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
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      alert('Error saving customer');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">{initialData ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input required type="text" className="w-full px-4 py-2 border rounded-md" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input required type="email" className="w-full px-4 py-2 border rounded-md" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
            <input required type="text" className="w-full px-4 py-2 border rounded-md" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input required type="text" className="w-full px-4 py-2 border rounded-md" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:bg-opacity-90">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CustomersList = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  
  const menuRef = useRef(null);

  useEffect(() => {
    fetchCustomers();
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchCustomers = () => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/customers`)
      .then(res => setCustomers(res.data))
      .catch(err => console.error(err));
  };

  const handleSaveCustomer = (customerData, mode) => {
    if (mode === 'add') {
      setCustomers([customerData, ...customers]);
    } else {
      setCustomers(customers.map(c => c._id === customerData._id ? { ...customerData, campaignsCount: c.campaignsCount } : c));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/customers/${id}`);
        setCustomers(customers.filter(c => c._id !== id));
      } catch (err) {
        console.error(err);
        alert('Error deleting customer');
      }
    }
    setOpenMenuId(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strHours = hours.toString().padStart(2, '0');
    
    return `${day}-${month}-${year} ${strHours}:${minutes} ${ampm}`;
  };

  const filteredCustomers = customers.filter(c => {
    const searchLower = searchQuery.toLowerCase();
    return (c.name || '').toLowerCase().includes(searchLower) ||
           (c.mobile || '').toLowerCase().includes(searchLower) ||
           (c.email || '').toLowerCase().includes(searchLower);
  });

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <button 
            onClick={() => {
              setEditingCustomer(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[#4c3963] text-white px-4 py-2 rounded-md hover:bg-opacity-90"
          >
            <Plus size={18} />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-32">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-sm text-[#4c3963] font-semibold tracking-wider">
              <th className="py-4 px-4 font-semibold">Name</th>
              <th className="py-4 px-4 font-semibold">Contact Number</th>
              <th className="py-4 px-4 font-semibold">Campaigns</th>
              <th className="py-4 px-4 font-semibold">Created At</th>
              <th className="py-4 px-4 font-semibold">WhatsApp Status</th>
              <th className="py-4 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c) => (
              <tr key={c._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-4 px-4 text-gray-500 font-medium text-sm">
                  {c.name}
                </td>
                <td className="py-4 px-4 text-sm text-gray-500 font-medium">
                  {c.mobile || '-'}
                </td>
                <td className="py-4 px-4 text-sm text-gray-500 font-medium">
                  {c.campaignsCount?.toString().padStart(2, '0') || '00'}
                </td>
                <td className="py-4 px-4 text-sm text-gray-500 font-medium">
                  {formatDate(c.createdAt)}
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-col gap-1 items-start">
                    {c.whatsapp?.status === 'Connected' ? (
                      <span className="bg-green-100/50 text-green-600 px-3 py-1 rounded text-xs font-medium">
                        Connected
                      </span>
                    ) : (
                      <span className="bg-red-100/50 text-red-500 px-3 py-1 rounded text-xs font-medium">
                        Disconnected
                      </span>
                    )}
                    <span className="text-xs text-gray-500 font-medium px-1">
                      {c.whatsapp?.mobileNo || c.mobile || '-'}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 text-right relative">
                  <button 
                    onClick={() => setOpenMenuId(openMenuId === c._id ? null : c._id)}
                    className="p-1 hover:bg-gray-200 rounded-md text-gray-400 hover:text-gray-700 focus:outline-none"
                  >
                    <MoreVertical size={20} />
                  </button>
                  
                  {openMenuId === c._id && (
                    <div ref={menuRef} className="absolute right-8 top-10 w-32 bg-white rounded-md shadow-lg border border-gray-100 z-10 overflow-hidden py-1">
                      <button 
                        onClick={() => {
                          setOpenMenuId(null);
                          setEditingCustomer(c);
                          setIsModalOpen(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => {
                          setOpenMenuId(null);
                          navigate(`/customers/${c._id}`);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => handleDelete(c._id)}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-12">
                  <div className="text-gray-400 mb-2 flex justify-center"><Search size={32} /></div>
                  <div className="text-gray-500 text-sm">No customers found. Click 'Add Customer' to create one.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {customers.length > 0 && (
          <div className="mt-6 text-sm text-[#4c3963] font-medium">
            Displaying 1 to {customers.length} of {customers.length} Customers
          </div>
        )}
      </div>
      
      <CustomerFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveCustomer}
        initialData={editingCustomer}
      />
    </div>
  );
};

export default CustomersList;
