import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, LogOut, CloudOff, Phone, Search, MoreVertical, Edit, Plus, X, Eye, Trash2 } from 'lucide-react';
import axios from 'axios';

const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [qrCode, setQrCode] = useState(null);
  const [status, setStatus] = useState('Disconnected'); // Disconnected, INITIALIZING, QR_READY, Connected
  const [polling, setPolling] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  const tabs = ['All', 'Drafted', 'Scheduled', 'In-Process', 'Completed', 'Partially Failed', 'Failed', 'Cancelled'];

  useEffect(() => {
    fetchCustomerData();
    fetchCustomerCampaigns();
    
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [id]);

  const fetchCustomerData = () => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/customers/${id}`)
      .then(res => {
        setCustomer(res.data);
        setStatus(res.data.whatsapp?.status || 'Disconnected');
      })
      .catch(err => console.error('Error fetching customer:', err));
  };

  const fetchCustomerCampaigns = () => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/campaigns/customer/${id}`)
      .then(res => setCampaigns(res.data))
      .catch(err => console.error('Error fetching campaigns:', err));
  };
  
  const handleDeleteCampaign = async (campaignId) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      try {
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}`);
        setCampaigns(campaigns.filter(c => c._id !== campaignId));
      } catch (err) {
        console.error(err);
        alert('Error deleting campaign');
      }
    }
    setOpenMenuId(null);
  };

  // ... (keeping existing polling and disconnect logic)
  useEffect(() => {
    let interval;
    if (polling) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/whatsapp/status/${id}`);
          setStatus(res.data.status);
          if (res.data.qr) setQrCode(res.data.qr);
          if (res.data.status === 'CONNECTED' || res.data.status === 'Connected') {
            setPolling(false);
            setStatus('Connected');
          } else if (res.data.status === 'DISCONNECTED' || res.data.status === 'Disconnected') {
            setPolling(false);
            setStatus('Disconnected');
          }
        } catch (err) {
          console.error('Polling error', err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [polling, id]);

  const handleConnectDevice = async () => {
    setStatus('INITIALIZING');
    setPolling(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/whatsapp/initiate/${id}`);
    } catch (err) {
      console.error(err);
      setStatus('Disconnected');
      setPolling(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/whatsapp/disconnect/${id}`);
      setStatus('Disconnected');
      setQrCode(null);
      setPolling(false);
    } catch (err) {
      console.error(err);
    }
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

  if (!customer) return <div className="p-8 text-center text-gray-500">Loading customer data...</div>;

  const filteredCampaigns = campaigns.filter(c => {
    const matchesTab = activeTab === 'All' || c.status === activeTab;
    const matchesSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });
  
  const initials = customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/customers')} className="text-gray-500 hover:text-gray-700 flex items-center gap-2 font-medium">
          <ArrowLeft size={18} />
          Customer details
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Details & WhatsApp (1/3 width) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          
          {/* Personal Details Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 relative">
            <h2 className="text-lg font-bold text-[#4c3963] mb-6">Personal Details</h2>
            <button className="absolute top-6 right-6 text-[var(--color-primary)] font-medium text-sm hover:underline">
              Edit
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-[#4c3963] flex items-center justify-center font-bold text-lg">
                {initials}
              </div>
              <div className="font-semibold text-gray-700">{customer.name}</div>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <div className="text-sm font-semibold text-[#4c3963] mb-1">Contact Info</div>
                <div className="text-xs text-gray-500 font-medium">Email: {customer.email || '-'}</div>
                <div className="text-xs text-gray-500 font-medium">Mobile: {customer.mobile || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#4c3963] mb-1">Address Info</div>
                <div className="text-xs text-gray-500 font-medium">{customer.address || '-'}</div>
              </div>
            </div>

            <div className="flex justify-between border-t border-gray-100 pt-4">
              <div>
                <div className="text-sm font-semibold text-[#4c3963] mb-1">Created On</div>
                <div className="text-xs text-gray-500 font-medium">{formatDate(customer.createdAt)}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#4c3963] mb-1">Updated On</div>
                <div className="text-xs text-gray-500 font-medium">{formatDate(customer.updatedAt)}</div>
              </div>
            </div>
          </div>

          {/* WhatsApp Details Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-[#4c3963] mb-2">WhatsApp Details</h2>
            <p className="text-xs text-gray-500 font-medium mb-6">
              {status === 'Connected' ? 'Connected At : ' + formatDate(customer.updatedAt) : 'Disconnected'}
            </p>
            
            <div className="flex gap-4 mb-6">
              {/* Status Box */}
              <div className="flex-1 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 text-red-500 flex items-center justify-center">
                  <CloudOff size={20} />
                </div>
                <div>
                  <div className="text-red-500 font-bold text-sm">Status</div>
                  <div className="text-xs text-gray-500 font-medium">{status === 'Connected' ? 'Connected' : 'Not Connected'}</div>
                </div>
              </div>
              
              {/* Mobile No Box */}
              <div className="flex-1 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-500 flex items-center justify-center">
                  <Phone size={20} />
                </div>
                <div>
                  <div className="text-[#4c3963] font-bold text-sm">Mobile No</div>
                  <div className="text-xs text-gray-500 font-medium">{customer.whatsapp?.mobileNo || '-'}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center mt-2">
              {status === 'Connected' ? (
                <button 
                  onClick={handleDisconnect}
                  className="w-full bg-[#4c3963] text-white font-medium py-3 rounded-md hover:bg-opacity-90 transition-colors"
                >
                  Disconnect
                </button>
              ) : status === 'INITIALIZING' || status === 'QR_READY' ? (
                <div className="flex flex-col items-center w-full">
                  {qrCode ? (
                    <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm mb-4">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                    </div>
                  ) : (
                    <div className="w-48 h-48 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center mb-4 text-sm text-gray-400">
                      Loading QR...
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mb-4 text-center">Scan this QR code with WhatsApp to connect your device.</p>
                  <button 
                    onClick={handleDisconnect}
                    className="w-full bg-red-50 text-red-600 font-medium py-2 rounded-md hover:bg-red-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleConnectDevice}
                  className="w-full bg-[#4c3963] text-white font-medium py-3 rounded-md hover:bg-opacity-90 transition-colors"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Campaigns Table (2/3 width) */}
        <div className="w-full lg:w-2/3 bg-white rounded-lg shadow-sm border border-gray-100 p-6 min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar pb-2">
            {tabs.map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 whitespace-nowrap font-medium text-sm transition-colors rounded-md ${
                  activeTab === tab 
                    ? 'bg-[#4c3963] text-white' 
                    : 'bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2 opacity-70">
                  {tab === 'All' ? '∷' : tab === 'Drafted' ? '📄' : tab === 'Scheduled' ? '⏱' : tab === 'In-Process' ? '⚙' : tab === 'Completed' ? '✓' : tab === 'Failed' ? '✕' : '🗑'}
                </span>
                {tab}
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search Campaigns..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <button 
              onClick={() => navigate(`/campaigns/new?customer=${id}`)}
              className="bg-[#4c3963] text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-opacity-90 flex items-center gap-2"
            >
              <Plus size={16} />
              New Campaign
            </button>
          </div>

          <div className="overflow-x-auto pb-32">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-[#4c3963] font-bold tracking-wider uppercase">
                  <th className="py-3 px-2">Name</th>
                  <th className="py-3 px-2">Send Type</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2">Recipients</th>
                  <th className="py-3 px-2">Credits Used</th>
                  <th className="py-3 px-2">Created At</th>
                  <th className="py-3 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((c) => (
                  <tr key={c._id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/campaigns/${c._id}`)}>
                    <td className="py-4 px-2 text-sm text-gray-500 font-medium">{c.name}</td>
                    <td className="py-4 px-2 text-sm text-gray-500 font-medium">{c.type}</td>
                    <td className="py-4 px-2">
                      <span className={`px-3 py-1 rounded text-xs font-medium ${
                        c.status === 'Completed' ? 'bg-green-100/50 text-green-600' : 
                        c.status === 'Failed' || c.status === 'Cancelled' ? 'bg-red-100/50 text-red-500' :
                        c.status === 'Drafted' ? 'bg-gray-100 text-gray-600' :
                        'bg-blue-100/50 text-blue-600'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-4 px-2 text-sm text-gray-500 font-medium">{c.stats?.totalRecipients || c.contacts?.length || 0}</td>
                    <td className="py-4 px-2 text-sm text-gray-500 font-medium">{c.stats?.creditsUsed || c.contacts?.length || 0}</td>
                    <td className="py-4 px-2 text-xs text-gray-500 font-medium">{formatDate(c.createdAt)}</td>
                    <td className="py-4 px-2 text-right relative">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setOpenMenuId(openMenuId === c._id ? null : c._id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded-md text-gray-400 hover:text-gray-700 focus:outline-none"
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {openMenuId === c._id && (
                        <div ref={menuRef} onClick={(e) => e.stopPropagation()} className="absolute right-8 top-10 w-32 bg-white rounded-md shadow-lg border border-gray-100 z-10 overflow-hidden py-1 text-left">
                          <button 
                            onClick={() => {
                              setOpenMenuId(null);
                              navigate(`/campaigns/${c._id}`);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Eye size={14} />
                            View
                          </button>
                          <button 
                            onClick={() => {
                              setOpenMenuId(null);
                              navigate(`/campaigns/edit/${c._id}`);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit size={14} />
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteCampaign(c._id)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredCampaigns.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-sm text-gray-500 font-medium">
                      No {activeTab !== 'All' ? activeTab.toLowerCase() : ''} campaigns found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-xs text-gray-400 font-medium">
            Displaying {filteredCampaigns.length > 0 ? 1 : 0} to {filteredCampaigns.length} of {filteredCampaigns.length} Campaigns
          </div>
        </div>
      </div>

      {/* WhatsApp QR Modal Pop-up */}
      {(status === 'INITIALIZING' || (status === 'QR_READY' && qrCode)) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center relative animate-fade-in-up">
            <button 
              onClick={() => { setStatus('Disconnected'); setPolling(false); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"
            >
              <X size={18} />
            </button>
            
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <Phone size={24} />
            </div>
            
            <h3 className="text-xl font-bold text-[#4c3963] mb-2">Connect WhatsApp</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Scan this QR code with your WhatsApp mobile app to link your device.</p>
            
            {status === 'INITIALIZING' ? (
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCw className="animate-spin text-[var(--color-primary)] mb-4" size={40} />
                <span className="text-gray-600 font-medium text-sm">Generating secure QR Code...</span>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl shadow-inner">
                <img src={qrCode} alt="WhatsApp QR Code" className="w-56 h-56 object-contain" />
              </div>
            )}
            
            <p className="text-xs text-gray-400 mt-6 text-center font-medium">
              Keep your phone connected to the internet during this process.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDetails;
