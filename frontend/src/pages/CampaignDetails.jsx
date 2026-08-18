import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Download, RefreshCw, LayoutGrid, Beaker,
  MessageSquare, Clock, Send, CheckCircle2, Eye, XCircle, AlertCircle, CalendarDays, X, Users
} from 'lucide-react';
import axios from 'axios';

const CampaignDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('All Recipient');
  const [campaign, setCampaign] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}`)
      .then(res => setCampaign(res.data))
      .catch(err => console.error('Error fetching campaign details:', err));
  }, [id]);

  if (!campaign) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  const filteredContacts = campaign.contacts.filter(c => {
    const matchesTab = activeTab === 'Test Massage' ? c.isTest : true;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (c.name || '').toLowerCase().includes(searchLower) ||
                          (c.number || '').toLowerCase().includes(searchLower);
    return matchesTab && matchesSearch;
  });

  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const paginatedContacts = filteredContacts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatDate = (dateString) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${day}/${month}/${year}, ${hours.toString().padStart(2, '0')}:${minutes}${ampm.toLowerCase()}`;
  };

  const getContactStatus = (delivery) => {
    if (!delivery) return 'Pending';
    if (delivery.failed || delivery.invalid) return 'Failed';
    if (delivery.seen) return 'Seen';
    if (delivery.delivered) return 'Delivered';
    if (delivery.sent) return 'Sent';
    return 'Pending';
  };

  const getInitials = (name) => {
    if (!name) return 'NA';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const customer = campaign.customerId || {};

  return (
    <div className="bg-[#f0f2f5] min-h-full -m-6 p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[calc(100vh-6rem)] relative">
        
        <div className="flex items-center gap-2 mb-6 text-gray-600">
          <button onClick={() => navigate('/campaigns')} className="hover:text-gray-900 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <span className="font-medium text-[#483d8b]">Campaigns Details</span>
        </div>

        <div className="flex flex-col xl:flex-row gap-6">
          {/* Left Column */}
          <div className="w-full xl:w-1/3 flex flex-col gap-4">
            
            {/* Personal Details */}
            <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-5">
              <h3 className="text-[#483d8b] font-semibold mb-5 text-sm">Personal Details</h3>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-[#e6e6fa] text-[#483d8b] flex items-center justify-center font-bold text-sm">
                  {getInitials(customer.name)}
                </div>
                <div className="text-sm font-medium text-gray-700">{customer.name || 'Unknown'}</div>
              </div>
              <div className="text-xs text-[#483d8b] mb-1.5 font-medium">Contact Info</div>
              <div className="text-[11px] text-gray-500 mb-1">Email: {customer.email || '-'}</div>
              <div className="text-[11px] text-gray-500">Mobile: {customer.mobile || '-'}</div>
            </div>

            {/* Campaign Details */}
            <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-5">
              <h3 className="text-[#483d8b] font-semibold mb-5 text-sm">Campaigns Details</h3>
              <div className="text-xs font-semibold text-[#483d8b] mb-1">Campaigns Name</div>
              <div className="text-xs text-gray-500 mb-5">{campaign.name}</div>
              
              <div className="flex gap-4 mb-5">
                <div className="flex-1 flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-xl bg-[#f3efff] text-[#8b5cf6] flex items-center justify-center">
                    <Send size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#483d8b] mb-0.5">Status</div>
                    <div className="text-[10px] text-gray-500">{campaign.status}</div>
                  </div>
                </div>
                <div className="flex-1 flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-xl bg-[#f3efff] text-[#8b5cf6] flex items-center justify-center">
                    <Users size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#483d8b] mb-0.5">Recipient</div>
                    <div className="text-[10px] text-gray-500">{campaign.stats?.totalRecipients || campaign.contacts?.length || 0}</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mb-5">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#483d8b] mb-1">Delay From</div>
                  <div className="text-[10px] text-gray-500">{campaign.delayFrom || '-'}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#483d8b] mb-1">Delay To</div>
                  <div className="text-[10px] text-gray-500">{campaign.delayTo || '-'}</div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#483d8b] mb-1">Created On</div>
                  <div className="text-[10px] text-gray-500">{formatDate(campaign.createdAt)}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#483d8b] mb-1">Updated On</div>
                  <div className="text-[10px] text-gray-500">{formatDate(campaign.updatedAt)}</div>
                </div>
              </div>
            </div>

            {/* Schedule Details */}
            <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-5">
              <h3 className="text-[#483d8b] font-semibold mb-5 text-sm">Schedule Details</h3>
              <div className="mb-4">
                <div className="text-xs font-semibold text-[#483d8b] mb-1.5">Schedule Date & Time</div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <CalendarDays size={12} className="text-[#8b5cf6]"/>
                  {formatDate(campaign.scheduleDateTime)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#483d8b] mb-1.5">Sent Date & Time</div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <CalendarDays size={12} className="text-[#8b5cf6]"/>
                  {campaign.status === 'Completed' ? formatDate(campaign.updatedAt) : '--'}
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-5">
              <h3 className="text-[#483d8b] font-semibold mb-2 text-sm">Message</h3>
              <div className="text-xs font-semibold text-[#483d8b] text-center py-8">
                {campaign.messageTemplate || 'No massage available'}
              </div>
            </div>

            {/* PDF */}
            <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-5">
              <h3 className="text-[#483d8b] font-semibold mb-4 text-sm">PDF</h3>
              <div className="flex justify-center">
                {campaign.fileUrl ? (
                  campaign.fileUrl.toLowerCase().endsWith('.pdf') ? (
                    <div className="h-48 w-36 bg-gray-50 flex flex-col items-center justify-center rounded-lg border border-gray-200">
                      <div className="text-xs text-gray-400 font-medium text-center px-2">PDF Document</div>
                    </div>
                  ) : (
                    <img src={`${import.meta.env.VITE_API_URL}/${campaign.fileUrl}`} alt="Preview" className="h-48 object-contain rounded-lg shadow-sm" />
                  )
                ) : (
                  <div className="text-xs text-gray-400 py-10">No file attached</div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="w-full xl:w-2/3 flex flex-col gap-5">
            
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Total Recipients', value: campaign.stats?.totalRecipients || 0, icon: <MessageSquare size={16} /> },
                { label: 'In Queue', value: campaign.stats?.inQueue || 0, icon: <MessageSquare size={16} />, subIcon: <Clock size={10} className="absolute -bottom-1 -right-1 bg-[#e1e7f0] rounded-full" /> },
                { label: 'Sent', value: campaign.stats?.sent || 0, icon: <Send size={16} /> },
                { label: 'Delivered', value: campaign.stats?.delivered || 0, icon: <MessageSquare size={16} />, subIcon: <CheckCircle2 size={10} className="absolute -bottom-1 -right-1 bg-[#e1e7f0] rounded-full" /> },
                { label: 'Seen', value: campaign.stats?.seen || 0, icon: <MessageSquare size={16} />, subIcon: <Eye size={10} className="absolute -bottom-1 -right-1 bg-[#e1e7f0] rounded-full" /> },
                { label: 'Failed', value: campaign.stats?.failed || 0, icon: <MessageSquare size={16} />, subIcon: <XCircle size={10} className="absolute -bottom-1 -right-1 bg-[#e1e7f0] rounded-full" /> },
                { label: 'Invalid', value: campaign.stats?.invalid || 0, icon: <MessageSquare size={16} />, subIcon: <AlertCircle size={10} className="absolute -bottom-1 -right-1 bg-[#e1e7f0] rounded-full" /> }
              ].map((stat, idx) => (
                <div key={idx} className="bg-[#f2f6fa] rounded-xl p-5 flex justify-between items-start shadow-sm border border-gray-50">
                  <div>
                    <div className="text-lg font-bold text-gray-900 mb-1">{stat.value}</div>
                    <div className="text-[11px] text-gray-500">{stat.label}</div>
                  </div>
                  <div className="bg-[#e1e7f0] p-2 rounded-lg text-gray-600 relative">
                    {stat.icon}
                    {stat.subIcon}
                  </div>
                </div>
              ))}
            </div>

            {/* Table Area */}
            <div className="mt-2 flex-1 flex flex-col">
              
              {/* Tabs */}
              <div className="flex gap-3 mb-5">
                <button 
                  onClick={() => { setActiveTab('All Recipient'); setCurrentPage(1); }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'All Recipient' ? 'bg-[#5b528b] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100'
                  }`}
                >
                  <LayoutGrid size={16} /> All Recipient
                </button>
                <button 
                  onClick={() => { setActiveTab('Test Massage'); setCurrentPage(1); }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'Test Massage' ? 'bg-[#5b528b] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100'
                  }`}
                >
                  <Beaker size={16} /> Test Massage
                </button>
              </div>

              {/* Controls */}
              <div className="flex justify-between items-center mb-4">
                <div className="relative w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#5b528b] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
                  />
                </div>
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 px-5 py-2 bg-[#5b528b] text-white rounded-lg text-sm font-medium hover:bg-[#4a4272] transition-colors shadow-md">
                    <Download size={16} /> Export
                  </button>
                  <button className="flex items-center gap-2 px-5 py-2 bg-[#5b528b] text-white rounded-lg text-sm font-medium hover:bg-[#4a4272] transition-colors shadow-md">
                    <RefreshCw size={16} /> Refresh
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-gray-50 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="py-4 px-6 font-semibold text-gray-800">I'd</th>
                        <th className="py-4 px-6 font-semibold text-gray-800">Name</th>
                        <th className="py-4 px-6 font-semibold text-gray-800">Number</th>
                        <th className="py-4 px-6 font-semibold text-gray-800 text-center">Status</th>
                        <th className="py-4 px-6 font-semibold text-gray-800 text-center">Sent Status</th>
                        <th className="py-4 px-6 font-semibold text-gray-800 text-center">Delivery Status</th>
                        <th className="py-4 px-6 font-semibold text-gray-800 text-center">Seen Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedContacts.map((c, idx) => {
                        const statusStr = getContactStatus(c.delivery);
                        const failed = statusStr === 'Failed';
                        const absoluteIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                        return (
                          <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-2 text-gray-500">
                                {failed ? <X size={10} className="text-red-500 font-bold" /> : <Send size={10} className="text-gray-400" />}
                                #{absoluteIdx}
                              </div>
                            </td>
                            <td className="py-3.5 px-6 text-gray-600">{c.name || '-'}</td>
                            <td className="py-3.5 px-6 text-gray-500">{c.number}</td>
                            <td className="py-3.5 px-6 text-center">
                              <span className={`px-2.5 py-1 rounded text-[10px] font-semibold ${
                                failed ? 'bg-red-100 text-red-600' : 
                                statusStr === 'Seen' ? 'bg-blue-100 text-blue-700' :
                                statusStr === 'Delivered' ? 'bg-purple-100 text-purple-700' :
                                'bg-green-100/60 text-green-700'
                              }`}>
                                {statusStr}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-center text-[11px] text-gray-500">{c.delivery?.sent ? formatDate(c.delivery.sent) : '-'}</td>
                            <td className="py-3.5 px-6 text-center text-[11px] text-gray-500">{c.delivery?.delivered ? formatDate(c.delivery.delivered) : '-'}</td>
                            <td className="py-3.5 px-6 text-center text-[11px] text-gray-500">{c.delivery?.seen ? formatDate(c.delivery.seen) : '-'}</td>
                          </tr>
                        );
                      })}
                      {filteredContacts.length === 0 && (
                        <tr>
                          <td colSpan="7" className="text-center py-12 text-gray-400">No data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
                  <div className="text-[11px] text-gray-400 font-medium">
                    Displaying {filteredContacts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredContacts.length)} of {filteredContacts.length} Customers
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >&lt;</button>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        // Simple sliding window for pagination
                        let pageNum = i + 1;
                        if (totalPages > 5 && currentPage > 3) {
                          pageNum = currentPage - 2 + i;
                          if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                        }
                        return (
                          <button 
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-6 h-6 flex items-center justify-center rounded shadow-sm ${currentPage === pageNum ? 'bg-[#5b528b] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <span className="text-gray-400 mx-0.5">..</span>
                          <button 
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}

                      <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >&gt;</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetails;
