import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MoreVertical, Eye, Trash2, Edit, X } from 'lucide-react';
import axios from 'axios';

const AllCampaigns = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('All');
  const [campaigns, setCampaigns] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  
  const tabs = ['All', 'Completed', 'Drafted', 'Scheduled', 'In-Process', 'Partially Failed', 'Failed', 'Cancelled'];

  useEffect(() => {
    fetchCampaigns();
    
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchCampaigns = () => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/campaigns`)
      .then(res => setCampaigns(res.data))
      .catch(err => console.error('Error fetching campaigns:', err));
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      try {
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}`);
        setCampaigns(campaigns.filter(c => c._id !== id));
      } catch (err) {
        console.error(err);
        alert('Error deleting campaign');
      }
    }
    setOpenMenuId(null);
  };

  const handleCancel = async (id) => {
    if (window.confirm('Are you sure you want to cancel this campaign?')) {
      try {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}/cancel`);
        fetchCampaigns();
      } catch (err) {
        console.error(err);
        alert('Error cancelling campaign');
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
    hours = hours ? hours : 12; 
    const strHours = hours.toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`;
  };

  const filteredCampaigns = campaigns.filter(c => {
    const matchesTab = activeTab === 'All' || c.status === activeTab;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.customerId?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">All Campaigns</h1>
        
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
          <button onClick={() => navigate('/campaigns/new')} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-md hover:bg-opacity-90">
            + New Campaign
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 whitespace-nowrap font-medium transition-colors border-b-2 ${
              activeTab === tab 
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {filteredCampaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-gray-400 text-3xl">📭</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No {activeTab !== 'All' ? activeTab : ''} Campaigns Found</h3>
          <p className="text-gray-500 text-sm mt-1">There are no campaigns matching this filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-32">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4 font-medium">Campaign & Customer Name</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Total Recipients</th>
                <th className="py-3 px-4 font-medium">Credits Used</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Date & Time</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((c) => (
                <tr key={c._id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/campaigns/${c._id}`)}>
                  <td className="py-4 px-4">
                    <div className="font-medium text-[var(--color-primary)]">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.customerId?.name || '-'}</div>
                  </td>
                  <td className="py-4 px-4 text-sm">{c.type}</td>
                  <td className="py-4 px-4 font-medium">{c.stats?.totalRecipients || c.contacts?.length || 0}</td>
                  <td className="py-4 px-4 text-sm">{c.stats?.creditsUsed || c.contacts?.length || 0}</td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      c.status === 'Completed' ? 'bg-[var(--color-status-completed)] text-[var(--color-status-completed-text)]' : 
                      c.status === 'Failed' || c.status === 'Cancelled' ? 'bg-[var(--color-status-failed)] text-[var(--color-status-failed-text)]' :
                      c.status === 'Drafted' ? 'bg-[var(--color-status-drafted)] text-[var(--color-status-drafted-text)]' :
                      'bg-[var(--color-status-inprocess)] text-[var(--color-status-inprocess-text)]'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-500">{formatDate(c.createdAt)}</td>
                  <td className="py-4 px-4 text-right relative">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => navigate(`/campaigns/${c._id}`)} 
                        className="p-1.5 text-gray-400 hover:text-[#5b528b] hover:bg-purple-50 rounded-md transition-colors" 
                        title="View"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => navigate(`/campaigns/edit/${c._id}`)} 
                        className="p-1.5 text-gray-400 hover:text-[#5b528b] hover:bg-purple-50 rounded-md transition-colors" 
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(c._id)} 
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" 
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                      {['Drafted', 'Scheduled', 'In-Process'].includes(c.status) && (
                        <button 
                          onClick={() => handleCancel(c._id)} 
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors" 
                          title="Cancel"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AllCampaigns;
