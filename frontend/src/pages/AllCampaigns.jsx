import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Trash2, Edit, X, Pause, Play, Ban, Calendar } from 'lucide-react';
import axios from 'axios';
import Pagination from '../components/Pagination';
import ConfirmationModal from '../components/ConfirmationModal';
import Dropdown from '../components/Dropdown';

const AllCampaigns = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('All');
  const [campaigns, setCampaigns] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filters
  const [customerFilter, setCustomerFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Confirmation modal state
  const [modal, setModal] = useState({ open: false, title: '', message: '', onConfirm: null, isDestructive: true });

  const tabs = ['All', 'Completed', 'Drafted', 'Scheduled', 'In-Process', 'Paused', 'Partially Failed', 'Failed', 'Cancelled'];

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = () => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/campaigns`)
      .then(res => setCampaigns(res.data))
      .catch(err => console.error('Error fetching campaigns:', err));
  };

  // Unique customers for filter dropdown
  const customerOptions = useMemo(() => {
    const map = new Map();
    campaigns.forEach(c => {
      if (c.customerId?._id && c.customerId?.name) {
        map.set(c.customerId._id, c.customerId.name);
      }
    });
    return [
      { value: 'All', label: 'All Customers' },
      ...Array.from(map, ([id, name]) => ({ value: id, label: name }))
    ];
  }, [campaigns]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = {};
    tabs.forEach(t => { counts[t] = t === 'All' ? campaigns.length : 0; });
    campaigns.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });
    return counts;
  }, [campaigns]);

  const handleDelete = async (id) => {
    setModal({
      open: true,
      title: 'Delete Campaign',
      message: 'Are you sure you want to permanently delete this campaign? This action cannot be undone.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await axios.delete(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}`);
          setCampaigns(campaigns.filter(c => c._id !== id));
        } catch (err) {
          console.error(err);
          alert('Error deleting campaign');
        }
      }
    });
  };

  const handleCancel = async (id) => {
    setModal({
      open: true,
      title: 'Cancel Campaign',
      message: 'This will stop all remaining messages from being sent. Already-sent messages will NOT be recalled or deleted from recipients\' devices.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await axios.put(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}/cancel`);
          fetchCampaigns();
        } catch (err) {
          console.error(err);
          alert('Error cancelling campaign');
        }
      }
    });
  };

  const handlePause = async (id) => {
    setModal({
      open: true,
      title: 'Pause Campaign',
      message: 'This will pause the campaign. No more messages will be sent until you resume it.',
      isDestructive: false,
      onConfirm: async () => {
        try {
          await axios.put(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}/pause`);
          fetchCampaigns();
        } catch (err) {
          console.error(err);
          alert('Error pausing campaign');
        }
      }
    });
  };

  const handleResume = async (id) => {
    setModal({
      open: true,
      title: 'Resume Campaign',
      message: 'This will resume sending remaining messages. Already-sent contacts will be skipped.',
      isDestructive: false,
      onConfirm: async () => {
        try {
          await axios.put(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}/resume`);
          fetchCampaigns();
        } catch (err) {
          console.error(err);
          alert('Error resuming campaign');
        }
      }
    });
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
    const matchesCustomer = customerFilter === 'All' || c.customerId?._id === customerFilter;

    // Date filter
    let matchesDate = true;
    if (dateFrom) {
      matchesDate = matchesDate && new Date(c.createdAt) >= new Date(dateFrom);
    }
    if (dateTo) {
      const toEnd = new Date(dateTo);
      toEnd.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(c.createdAt) <= toEnd;
    }

    return matchesTab && matchesSearch && matchesCustomer && matchesDate;
  });

  const getProgressPercent = (stats) => {
    if (!stats || !stats.totalRecipients) return 0;
    return Math.round(((stats.sent + stats.failed) / stats.totalRecipients) * 100);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 min-h-[500px]">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={modal.open}
        onClose={() => setModal({ ...modal, open: false })}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        isDestructive={modal.isDestructive}
        confirmText={modal.isDestructive ? 'Yes, Proceed' : 'Confirm'}
      />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">All Campaigns</h1>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search" 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <button onClick={() => navigate('/campaigns/new')} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-md hover:bg-opacity-90">
            + New Campaign
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="w-52">
          <Dropdown 
            value={customerFilter}
            onChange={(val) => { setCustomerFilter(val); setCurrentPage(1); }}
            options={customerOptions}
            placeholder="Filter by Customer"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <input 
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[var(--color-primary)]"
            placeholder="From"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input 
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[var(--color-primary)]"
            placeholder="To"
          />
          {(dateFrom || dateTo) && (
            <button 
              onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs with Counts */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button 
            key={tab}
            onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
            className={`px-4 py-3 whitespace-nowrap font-medium transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === tab 
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
              activeTab === tab
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {tabCounts[tab] || 0}
            </span>
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
                <th className="py-3 px-4 font-medium w-12">#</th>
                <th className="py-3 px-4 font-medium">Campaign & Customer Name</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium text-center">Progress</th>
                <th className="py-3 px-4 font-medium text-center">Sent</th>
                <th className="py-3 px-4 font-medium text-center">Failed</th>
                <th className="py-3 px-4 font-medium text-center">Pending</th>
                <th className="py-3 px-4 font-medium">Sender</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Date & Time</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((c, index) => {
                  const progress = getProgressPercent(c.stats);
                  const sentCount = c.stats?.sent || 0;
                  const failedCount = c.stats?.failed || 0;
                  const pendingCount = c.stats?.inQueue || 0;
                  const total = c.stats?.totalRecipients || 0;
                  const senderNum = c.senderNumber || c.customerId?.whatsapp?.mobileNo || '-';

                  return (
                <tr 
                  key={c._id} 
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" 
                  onClick={() => navigate(c.status === 'Drafted' ? `/campaigns/edit/${c._id}` : `/campaigns/${c._id}`)}
                >
                  <td className="py-4 px-4 text-sm text-gray-400 font-medium">
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-medium text-[var(--color-primary)]">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.customerId?.name || '-'}</div>
                  </td>
                  <td className="py-4 px-4 text-sm">{c.type}</td>

                  {/* Progress Bar */}
                  <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-center gap-1 min-w-[80px]">
                      <span className="text-xs font-semibold text-gray-600">{progress}%</span>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        {total > 0 && (
                          <div className="h-full flex">
                            <div
                              className="bg-green-500 h-full transition-all duration-500"
                              style={{ width: `${(sentCount / total) * 100}%` }}
                            />
                            <div
                              className="bg-red-400 h-full transition-all duration-500"
                              style={{ width: `${(failedCount / total) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Sent / Failed / Pending */}
                  <td className="py-4 px-4 text-center">
                    <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">{sentCount}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">{failedCount}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">{pendingCount}</span>
                  </td>

                  {/* Sender Number */}
                  <td className="py-4 px-4 text-sm text-gray-600 font-mono">{senderNum}</td>

                  {/* Status Badge */}
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      c.status === 'Completed' ? 'bg-[var(--color-status-completed)] text-[var(--color-status-completed-text)]' : 
                      c.status === 'Failed' || c.status === 'Cancelled' ? 'bg-[var(--color-status-failed)] text-[var(--color-status-failed-text)]' :
                      c.status === 'Drafted' ? 'bg-[var(--color-status-drafted)] text-[var(--color-status-drafted-text)]' :
                      c.status === 'Paused' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-[var(--color-status-inprocess)] text-[var(--color-status-inprocess-text)]'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-500">{formatDate(c.createdAt)}</td>
                  <td className="py-4 px-4 text-right relative" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {/* View */}
                      <div className="group relative">
                        <button 
                          onClick={() => navigate(c.status === 'Drafted' ? `/campaigns/edit/${c._id}` : `/campaigns/${c._id}`)} 
                          className="p-1.5 text-gray-400 hover:text-[#5b528b] hover:bg-purple-50 rounded-md transition-colors"
                        >
                          <Eye size={18} />
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-800 text-white text-[10px] font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none shadow-lg">
                          View Details
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                        </div>
                      </div>

                      {/* Edit */}
                      <div className="group relative">
                        <button 
                          onClick={() => navigate(`/campaigns/edit/${c._id}`)} 
                          className="p-1.5 text-gray-400 hover:text-[#5b528b] hover:bg-purple-50 rounded-md transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-800 text-white text-[10px] font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none shadow-lg">
                          Edit Campaign
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                        </div>
                      </div>

                      {/* Delete */}
                      <div className="group relative">
                        <button 
                          onClick={() => handleDelete(c._id)} 
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-800 text-white text-[10px] font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none shadow-lg">
                          Delete Campaign
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                        </div>
                      </div>

                      {/* Pause — visible when In-Process */}
                      {c.status === 'In-Process' && (
                        <div className="group relative">
                          <button 
                            onClick={() => handlePause(c._id)} 
                            className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                          >
                            <Pause size={18} />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-800 text-white text-[10px] font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none shadow-lg">
                            Pause Campaign
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                          </div>
                        </div>
                      )}

                      {/* Resume — visible when Paused */}
                      {c.status === 'Paused' && (
                        <div className="group relative">
                          <button 
                            onClick={() => handleResume(c._id)} 
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          >
                            <Play size={18} />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-800 text-white text-[10px] font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none shadow-lg">
                            Resume Campaign
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                          </div>
                        </div>
                      )}

                      {/* Cancel — visible for active states */}
                      {['Drafted', 'Scheduled', 'In-Process', 'Paused'].includes(c.status) && (
                        <div className="group relative">
                          <button 
                            onClick={() => handleCancel(c._id)} 
                            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                          >
                            <Ban size={18} />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-800 text-white text-[10px] font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none shadow-lg">
                            Cancel Campaign
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                  );
                })}
            </tbody>
          </table>
          
          <Pagination
            currentPage={currentPage}
            totalItems={filteredCampaigns.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => setCurrentPage(page)}
            onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
            label="Campaigns"
          />
        </div>
      )}
    </div>
  );
};

export default AllCampaigns;
