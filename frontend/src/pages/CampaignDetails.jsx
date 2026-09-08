import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Download,
  RefreshCw,
  LayoutGrid,
  Beaker,
  MessageSquare,
  Clock,
  Send,
  CheckCircle2,
  Eye,
  XCircle,
  AlertCircle,
  CalendarDays,
  X,
  Users,
  Filter,
  Pause,
  Play,
  Ban,
  RotateCcw,
  Edit2,
  AlertTriangle
} from 'lucide-react';
import axios from 'axios';
import Dropdown from '../components/Dropdown';
import ConfirmationModal from '../components/ConfirmationModal';

const CampaignDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('All Recipient');
  const [campaign, setCampaign] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modal, setModal] = useState({ open: false, title: '', message: '', onConfirm: null, isDestructive: true, confirmText: 'Confirm' });

  // Retry and edit state
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [retryingContactIds, setRetryingContactIds] = useState(new Set());
  const [editingContact, setEditingContact] = useState(null);
  const [editNumberValue, setEditNumberValue] = useState('');
  const [editNumberError, setEditNumberError] = useState('');
  const [isSavingNumber, setIsSavingNumber] = useState(false);

  const handlePause = () => {
    setModal({
      open: true,
      title: 'Pause Campaign',
      message: 'This will pause the campaign. No more messages will be sent until you resume it.',
      isDestructive: false,
      onConfirm: async () => {
        try {
          await axios.put(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}/pause`);
          fetchCampaign();
        } catch (err) {
          console.error(err);
          alert('Error pausing campaign');
        }
      }
    });
  };

  const handleResume = () => {
    setModal({
      open: true,
      title: 'Resume Campaign',
      message: 'This will resume sending remaining messages. Already-sent contacts will be skipped.',
      isDestructive: false,
      onConfirm: async () => {
        try {
          await axios.put(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}/resume`);
          fetchCampaign();
        } catch (err) {
          console.error(err);
          alert('Error resuming campaign');
        }
      }
    });
  };

  const handleCancel = () => {
    setModal({
      open: true,
      title: 'Cancel Campaign',
      message: 'This will stop all remaining messages from being sent. Already-sent messages will NOT be recalled or deleted from recipients\' devices.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await axios.put(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}/cancel`);
          fetchCampaign();
        } catch (err) {
          console.error(err);
          alert('Error cancelling campaign');
        }
      }
    });
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchCampaign = () => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}`)
      .then((res) => {
        if (res.data?.status === 'Drafted') {
          navigate(`/campaigns/edit/${id}`, { replace: true });
          return;
        }
        setCampaign(res.data);
      })
      .catch((err) => console.error('Error fetching campaign details:', err));
  };

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  // Polling during active retries
  useEffect(() => {
    const hasActiveRetries = campaign?.contacts?.some(
      (c) => c.delivery?.retryStatus === 'Queued' || c.delivery?.retryStatus === 'Sending'
    );
    if (!hasActiveRetries) {
      if (isRetryingAll) setIsRetryingAll(false);
      return;
    }

    const interval = setInterval(() => {
      fetchCampaign();
    }, 2500);

    return () => clearInterval(interval);
  }, [campaign, isRetryingAll]);

  const checkWhatsAppConnected = () => {
    const customer = campaign?.customerId;
    if (!customer || customer.whatsapp?.status !== 'Connected') {
      setModal({
        open: true,
        title: 'WhatsApp Disconnected',
        message: 'Your WhatsApp is currently disconnected. Please reconnect your WhatsApp account before retrying invitations.',
        isDestructive: false,
        confirmText: 'Go to Customer',
        onConfirm: () => navigate(`/customers/${customer?._id || customer}`)
      });
      return false;
    }
    return true;
  };

  const handleRetryFailedAll = async () => {
    if (!checkWhatsAppConnected()) return;

    try {
      setIsRetryingAll(true);
      await axios.post(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}/retry`);
      fetchCampaign();
    } catch (err) {
      console.error('Error retrying all failed recipients:', err);
      setIsRetryingAll(false);
      const msg = err.response?.data?.message || 'Error retrying failed invitations';
      alert(msg);
    }
  };

  const handleRetrySingle = async (contact) => {
    if (!checkWhatsAppConnected()) return;

    // If number is invalid, require correction first
    const cleanNum = (contact.number || '').toString().replace(/\D/g, '');
    if (contact.delivery?.invalid || cleanNum.length < 10) {
      setEditingContact(contact);
      setEditNumberValue(contact.number || '');
      setEditNumberError('Phone number is invalid. Please correct it before retrying.');
      return;
    }

    try {
      setRetryingContactIds((prev) => new Set([...prev, contact._id]));
      await axios.post(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}/retry/${contact._id}`);
      fetchCampaign();
    } catch (err) {
      console.error('Error retrying recipient:', err);
      const msg = err.response?.data?.message || 'Error retrying invitation';
      alert(msg);
    } finally {
      setRetryingContactIds((prev) => {
        const next = new Set(prev);
        next.delete(contact._id);
        return next;
      });
    }
  };

  const handleSaveNumberAndRetry = async () => {
    if (!editingContact) return;
    const cleanNum = editNumberValue.replace(/\D/g, '');
    if (cleanNum.length < 10) {
      setEditNumberError('Phone number must have at least 10 digits');
      return;
    }

    try {
      setIsSavingNumber(true);
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/campaigns/${id}/contacts/${editingContact._id}/number`,
        { number: cleanNum }
      );
      const updatedContact = { ...editingContact, number: cleanNum, delivery: { ...editingContact.delivery, invalid: false, failureReason: null } };
      setEditingContact(null);
      setEditNumberValue('');
      setEditNumberError('');
      // Immediately trigger retry on corrected contact
      handleRetrySingle(updatedContact);
    } catch (err) {
      console.error('Error updating recipient number:', err);
      setEditNumberError(err.response?.data?.message || 'Error updating number');
    } finally {
      setIsSavingNumber(false);
    }
  };

  if (!campaign)
    return <div className="p-8 text-center text-gray-500">Loading...</div>;

  const getContactStatus = (delivery) => {
    if (!delivery) return 'Pending';
    if (delivery.retryStatus === 'Queued') return 'Queued';
    if (delivery.retryStatus === 'Sending') return 'Sending';
    if (delivery.retryStatus === 'Status unknown') return 'Status unknown';
    if (delivery.failed || delivery.invalid) return 'Failed';
    if (delivery.seen) return 'Seen';
    if (delivery.delivered) return 'Delivered';
    if (delivery.sent) return 'Sent';
    return 'Pending';
  };

  const failedContactsCount = (campaign.contacts || []).filter((c) => {
    const status = getContactStatus(c.delivery);
    return status === 'Failed' || status === 'Status unknown' || c.delivery?.failed || c.delivery?.invalid;
  }).length;

  const filteredContacts = campaign.contacts.filter((c) => {
    const matchesTab = activeTab === 'Test Message' ? c.isTest : true;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      (c.name || '').toLowerCase().includes(searchLower) ||
      (c.number || '').toLowerCase().includes(searchLower);
    const contactStatus = getContactStatus(c.delivery);
    const matchesStatus =
      statusFilter === 'All' || contactStatus === statusFilter;
    return matchesTab && matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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

  const getInitials = (name) => {
    if (!name) return 'NA';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const handleExport = () => {
    if (!filteredContacts || filteredContacts.length === 0) return;

    const headers = [
      'Id',
      'Name',
      'Number',
      'Status',
      'Sent Status',
      'Delivery Status',
      'Seen Status'
    ];
    const csvRows = [headers.join(',')];

    filteredContacts.forEach((c, idx) => {
      const statusStr = getContactStatus(c.delivery);
      const row = [
        idx + 1,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${c.number || ''}"`,
        `"${statusStr}"`,
        `"${c.delivery?.sent ? formatDate(c.delivery.sent) : '-'}"`,
        `"${c.delivery?.delivered ? formatDate(c.delivery.delivered) : '-'}"`,
        `"${c.delivery?.seen ? formatDate(c.delivery.seen) : '-'}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Campaign_${(campaign.name || 'Export').replace(/\s+/g, '_')}_Contacts.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const customer = campaign.customerId || {};

  return (
    <div className="bg-[#f0f2f5] min-h-full -m-6 p-6">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={modal.open}
        onClose={() => setModal({ ...modal, open: false })}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        isDestructive={modal.isDestructive}
        confirmText={modal.confirmText || (modal.isDestructive ? 'Yes, Proceed' : 'Confirm')}
      />

      {/* Edit Phone Number Modal */}
      {editingContact && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setEditingContact(null)}
          ></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-100 text-amber-700">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Correct Recipient Number
                  </h2>
                  <p className="text-xs text-gray-500">
                    Recipient: {editingContact.name || 'Unknown'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingContact(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                WhatsApp Phone Number (e.g. 919876543210)
              </label>
              <input
                type="text"
                value={editNumberValue}
                onChange={(e) => {
                  setEditNumberValue(e.target.value);
                  setEditNumberError('');
                }}
                placeholder="e.g. 919876543210"
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#5b528b] shadow-sm"
                autoFocus
              />
              {editNumberError && (
                <p className="text-xs text-red-500 mt-1 font-medium">
                  {editNumberError}
                </p>
              )}
            </div>

            <p className="text-[11px] text-gray-500 mb-6 bg-gray-50 p-2.5 rounded border border-gray-200">
              Saving the corrected phone number will immediately validate and retry sending the invitation.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setEditingContact(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNumberAndRetry}
                disabled={isSavingNumber}
                className="px-4 py-2 rounded-md font-medium text-white bg-[#5b528b] hover:bg-[#4a4272] transition-colors text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingNumber && (
                  <RotateCcw size={12} className="animate-spin" />
                )}
                Save & Retry
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[calc(100vh-6rem)] relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-gray-600">
            <button
              onClick={() => navigate('/campaigns')}
              className="hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="font-medium text-[#483d8b]">Campaigns Details</span>
          </div>
          {campaign?.status === 'Drafted' && (
            <button
              onClick={() => navigate(`/campaigns/edit/${id}`)}
              className="bg-[#4c3963] text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-opacity-90 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Edit2 size={16} />
              Continue Editing Draft
            </button>
          )}
        </div>

        <div className="flex flex-col xl:flex-row gap-6">
          {/* Left Column */}
          <div className="w-full xl:w-1/3 flex flex-col gap-4">
            {/* Personal Details */}
            <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-5">
              <h3 className="text-[#483d8b] font-semibold mb-5 text-sm">
                Personal Details
              </h3>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-[#e6e6fa] text-[#483d8b] flex items-center justify-center font-bold text-sm">
                  {getInitials(customer.name)}
                </div>
                <div className="text-sm font-medium text-gray-700">
                  {customer.name || 'Unknown'}
                </div>
              </div>
              <div className="text-xs text-[#483d8b] mb-1.5 font-medium">
                Contact Info
              </div>
              <div className="text-[11px] text-gray-500 mb-1">
                Email: {customer.email || '-'}
              </div>
              <div className="text-[11px] text-gray-500">
                Mobile: {customer.mobile || '-'}
              </div>
            </div>

            {/* Campaign Details */}
            <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-5">
              <h3 className="text-[#483d8b] font-semibold mb-5 text-sm">
                Campaigns Details
              </h3>
              <div className="text-xs font-semibold text-[#483d8b] mb-1">
                Campaigns Name
              </div>
              <div className="text-xs text-gray-500 mb-5">{campaign.name}</div>

              <div className="flex gap-4 mb-5">
                <div className="flex-1 flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-xl bg-[#f3efff] text-[#8b5cf6] flex items-center justify-center">
                    <Send size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#483d8b] mb-0.5">
                      Status
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {campaign.status}
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-xl bg-[#f3efff] text-[#8b5cf6] flex items-center justify-center">
                    <Users size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#483d8b] mb-0.5">
                      Recipient
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {campaign.stats?.totalRecipients ||
                        campaign.contacts?.length ||
                        0}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mb-5">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#483d8b] mb-1">
                    Delay From
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {campaign.delayFrom || '-'}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#483d8b] mb-1">
                    Delay To
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {campaign.delayTo || '-'}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#483d8b] mb-1">
                    Created On
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {formatDate(campaign.createdAt)}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#483d8b] mb-1">
                    Updated On
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {formatDate(campaign.updatedAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule Details */}
            <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-5">
              <h3 className="text-[#483d8b] font-semibold mb-5 text-sm">
                Schedule Details
              </h3>
              <div className="mb-4">
                <div className="text-xs font-semibold text-[#483d8b] mb-1.5">
                  Schedule Date & Time
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <CalendarDays size={12} className="text-[#8b5cf6]" />
                  {formatDate(campaign.scheduleDateTime)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#483d8b] mb-1.5">
                  Sent Date & Time
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <CalendarDays size={12} className="text-[#8b5cf6]" />
                  {campaign.status === 'Completed'
                    ? formatDate(campaign.updatedAt)
                    : '--'}
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-5">
              <h3 className="text-[#483d8b] font-semibold mb-2 text-sm">
                Message
              </h3>
              <div className="text-xs font-semibold text-[#483d8b] text-center py-8">
                {campaign.messageTemplate || 'No massage available'}
              </div>
            </div>

            {/* File Attachment */}
            <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-5">
              <h3 className="text-[#483d8b] font-semibold mb-4 text-sm">
                {campaign.fileUrl
                  ? campaign.fileUrl.toLowerCase().endsWith('.pdf')
                    ? 'PDF Document'
                    : 'Image'
                  : 'Attachment'}
              </h3>
              <div className="flex justify-center">
                {campaign.fileUrl ? (
                  campaign.fileUrl.toLowerCase().endsWith('.pdf') ? (
                    <a
                      href={campaign.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-48 w-36 bg-gray-50 flex flex-col items-center justify-center rounded-lg border border-gray-200 hover:border-[var(--color-primary)] hover:bg-purple-50 transition-colors cursor-pointer group"
                    >
                      <svg
                        className="w-12 h-12 text-red-500 mb-2"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z" />
                        <path d="M8 15h3v2H8zm0-3h8v2H8zm0 6h8v2H8z" />
                      </svg>
                      <div className="text-xs text-gray-500 font-medium text-center px-2 group-hover:text-[var(--color-primary)]">
                        View PDF
                      </div>
                    </a>
                  ) : (
                    <a
                      href={campaign.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={campaign.fileUrl}
                        alt="Attachment"
                        className="h-48 object-contain rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      />
                    </a>
                  )
                ) : (
                  <div className="text-xs text-gray-400 py-10">
                    No file attached
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="w-full xl:w-2/3 flex flex-col gap-5">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                {
                  label: 'Total Recipients',
                  value: campaign.stats?.totalRecipients || 0,
                  icon: <MessageSquare size={16} />
                },
                {
                  label: 'In Queue',
                  value: campaign.stats?.inQueue || 0,
                  icon: <MessageSquare size={16} />,
                  subIcon: (
                    <Clock
                      size={10}
                      className="absolute -bottom-1 -right-1 bg-[#e1e7f0] rounded-full"
                    />
                  )
                },
                {
                  label: 'Sent',
                  value: campaign.stats?.sent || 0,
                  icon: <Send size={16} />
                },
                {
                  label: 'Delivered',
                  value: campaign.stats?.delivered || 0,
                  icon: <MessageSquare size={16} />,
                  subIcon: (
                    <CheckCircle2
                      size={10}
                      className="absolute -bottom-1 -right-1 bg-[#e1e7f0] rounded-full"
                    />
                  )
                },
                {
                  label: 'Seen',
                  value: campaign.stats?.seen || 0,
                  icon: <MessageSquare size={16} />,
                  subIcon: (
                    <Eye
                      size={10}
                      className="absolute -bottom-1 -right-1 bg-[#e1e7f0] rounded-full"
                    />
                  )
                },
                {
                  label: 'Failed',
                  value: campaign.stats?.failed || 0,
                  icon: <MessageSquare size={16} />,
                  subIcon: (
                    <XCircle
                      size={10}
                      className="absolute -bottom-1 -right-1 bg-[#e1e7f0] rounded-full"
                    />
                  )
                },
                {
                  label: 'Invalid',
                  value: campaign.stats?.invalid || 0,
                  icon: <MessageSquare size={16} />,
                  subIcon: (
                    <AlertCircle
                      size={10}
                      className="absolute -bottom-1 -right-1 bg-[#e1e7f0] rounded-full"
                    />
                  )
                }
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="bg-[#f2f6fa] rounded-xl p-5 flex justify-between items-start shadow-sm border border-gray-50"
                >
                  <div>
                    <div className="text-lg font-bold text-gray-900 mb-1">
                      {stat.value}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {stat.label}
                    </div>
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
                  onClick={() => {
                    setActiveTab('All Recipient');
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'All Recipient'
                      ? 'bg-[#5b528b] text-white shadow-md'
                      : 'text-gray-500 hover:bg-gray-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100'
                  }`}
                >
                  <LayoutGrid size={16} /> All Recipient
                </button>
                <button
                  onClick={() => {
                    setActiveTab('Test Message');
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'Test Message'
                      ? 'bg-[#5b528b] text-white shadow-md'
                      : 'text-gray-500 hover:bg-gray-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100'
                  }`}
                >
                  <Beaker size={16} /> Test Message
                </button>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-72">
                    <Search
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="Search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#5b528b] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
                    />
                  </div>
                  <div className="relative">
                    <Dropdown
                      value={statusFilter}
                      onChange={(val) => {
                        setStatusFilter(val);
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: 'All', label: 'All Status' },
                        { value: 'Pending', label: 'Pending' },
                        { value: 'Queued', label: 'Queued' },
                        { value: 'Sending', label: 'Sending' },
                        { value: 'Sent', label: 'Sent' },
                        { value: 'Delivered', label: 'Delivered' },
                        { value: 'Seen', label: 'Seen' },
                        { value: 'Failed', label: 'Failed' },
                        { value: 'Status unknown', label: 'Status unknown' }
                      ]}
                      icon={<Filter size={15} />}
                      className="w-40"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Retry Failed Button */}
                  {failedContactsCount > 0 && (
                    <button
                      onClick={handleRetryFailedAll}
                      disabled={isRetryingAll}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Resend invitations to all failed recipients"
                    >
                      <RotateCcw size={15} className={isRetryingAll ? 'animate-spin' : ''} />
                      {isRetryingAll ? 'Retrying...' : `Retry Failed (${failedContactsCount})`}
                    </button>
                  )}

                  {/* Campaign Control Actions */}
                  {campaign.status === 'In-Process' && (
                    <button
                      onClick={handlePause}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors shadow-md"
                      title="Pause Campaign"
                    >
                      <Pause size={16} /> Pause
                    </button>
                  )}
                  {campaign.status === 'Paused' && (
                    <button
                      onClick={handleResume}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-md"
                      title="Resume Campaign"
                    >
                      <Play size={16} /> Resume
                    </button>
                  )}
                  {['Drafted', 'Scheduled', 'In-Process', 'Paused'].includes(campaign.status) && (
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors shadow-md"
                      title="Cancel Campaign"
                    >
                      <Ban size={16} /> Cancel
                    </button>
                  )}

                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-5 py-2 bg-[#5b528b] text-white rounded-lg text-sm font-medium hover:bg-[#4a4272] transition-colors shadow-md"
                  >
                    <Download size={16} /> Export
                  </button>
                  <button
                    onClick={fetchCampaign}
                    className="flex items-center gap-2 px-5 py-2 bg-[#5b528b] text-white rounded-lg text-sm font-medium hover:bg-[#4a4272] transition-colors shadow-md"
                  >
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
                        <th className="py-4 px-6 font-semibold text-gray-800">
                          I'd
                        </th>
                        <th className="py-4 px-6 font-semibold text-gray-800">
                          Name
                        </th>
                        <th className="py-4 px-6 font-semibold text-gray-800">
                          Number
                        </th>
                        <th className="py-4 px-6 font-semibold text-gray-800 text-center">
                          Status
                        </th>
                        <th className="py-4 px-6 font-semibold text-gray-800 text-center">
                          Sent Status
                        </th>
                        <th className="py-4 px-6 font-semibold text-gray-800 text-center">
                          Delivery Status
                        </th>
                        <th className="py-4 px-6 font-semibold text-gray-800 text-center">
                          Seen Status
                        </th>
                        <th className="py-4 px-6 font-semibold text-gray-800 text-center">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedContacts.map((c, idx) => {
                        const statusStr = getContactStatus(c.delivery);
                        const failed = statusStr === 'Failed';
                        const absoluteIdx =
                          (currentPage - 1) * itemsPerPage + idx + 1;
                        const isContactInvalid = c.delivery?.invalid || (c.number && c.number.replace(/\D/g, '').length < 10);
                        const isRetryingThis = retryingContactIds.has(c._id);
                        const isQueued = statusStr === 'Queued';
                        const isSending = statusStr === 'Sending';

                        return (
                          <tr
                            key={idx}
                            className="border-b border-gray-50 hover:bg-gray-50/50"
                          >
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-2 text-gray-500">
                                {failed ? (
                                  <X
                                    size={10}
                                    className="text-red-500 font-bold"
                                  />
                                ) : (
                                  <Send size={10} className="text-gray-400" />
                                )}
                                #{absoluteIdx}
                              </div>
                            </td>
                            <td className="py-3.5 px-6 text-gray-600">
                              {c.name || '-'}
                            </td>
                            <td className="py-3.5 px-6 text-gray-500">
                              <div className="flex items-center gap-1.5">
                                <span>{c.number}</span>
                                {isContactInvalid && (
                                  <button
                                    onClick={() => {
                                      setEditingContact(c);
                                      setEditNumberValue(c.number || '');
                                      setEditNumberError('');
                                    }}
                                    className="text-amber-500 hover:text-amber-700 transition-colors"
                                    title="Invalid phone number. Click to fix."
                                  >
                                    <AlertTriangle size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              {failed ? (
                                <div className="inline-flex items-center gap-1.5 justify-center flex-wrap">
                                  <span className="px-2.5 py-1 rounded text-[10px] font-semibold bg-red-100 text-red-600">
                                    Failed
                                  </span>
                                  {c.delivery?.failureReason && (
                                    <span
                                      className="text-[10px] text-red-700 bg-red-50 border border-red-200/70 px-2 py-0.5 rounded font-medium max-w-[150px] truncate"
                                      title={c.delivery.failureReason}
                                    >
                                      {c.delivery.failureReason}
                                    </span>
                                  )}
                                </div>
                              ) : isQueued ? (
                                <span className="px-2.5 py-1 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-800 inline-flex items-center gap-1">
                                  <Clock size={10} /> Queued
                                </span>
                              ) : isSending ? (
                                <span className="px-2.5 py-1 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 inline-flex items-center gap-1 animate-pulse">
                                  <RotateCcw size={10} className="animate-spin" /> Sending
                                </span>
                              ) : statusStr === 'Status unknown' ? (
                                <div className="inline-flex items-center gap-1.5 justify-center" title="Timeout - verify before resending to avoid duplicates">
                                  <span className="px-2.5 py-1 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                                    Status unknown
                                  </span>
                                </div>
                              ) : (
                                <span
                                  className={`px-2.5 py-1 rounded text-[10px] font-semibold ${
                                    statusStr === 'Seen'
                                      ? 'bg-blue-100 text-blue-700'
                                      : statusStr === 'Delivered'
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-green-100/60 text-green-700'
                                  }`}
                                >
                                  {statusStr}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-center text-[11px] text-gray-500">
                              {c.delivery?.sent
                                ? formatDate(c.delivery.sent)
                                : '-'}
                            </td>
                            <td className="py-3.5 px-6 text-center text-[11px] text-gray-500">
                              {c.delivery?.delivered
                                ? formatDate(c.delivery.delivered)
                                : '-'}
                            </td>
                            <td className="py-3.5 px-6 text-center text-[11px] text-gray-500">
                              {c.delivery?.seen
                                ? formatDate(c.delivery.seen)
                                : '-'}
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              {failed || statusStr === 'Status unknown' ? (
                                <div className="inline-flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleRetrySingle(c)}
                                    disabled={
                                      isRetryingAll ||
                                      isRetryingThis ||
                                      isQueued ||
                                      isSending
                                    }
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-[#5b528b] hover:bg-[#4a4272] text-white rounded text-[11px] font-medium transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Retry sending to this recipient"
                                  >
                                    <RotateCcw
                                      size={11}
                                      className={
                                        isRetryingThis || isSending
                                          ? 'animate-spin'
                                          : ''
                                      }
                                    />
                                    Retry
                                  </button>
                                  {isContactInvalid && (
                                    <button
                                      onClick={() => {
                                        setEditingContact(c);
                                        setEditNumberValue(c.number || '');
                                        setEditNumberError('');
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-[10px] font-medium transition-colors"
                                      title="Phone number is invalid. Click to correct."
                                    >
                                      <Edit2 size={10} /> Fix #
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300 text-[11px]">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredContacts.length === 0 && (
                        <tr>
                          <td
                            colSpan="8"
                            className="text-center py-12 text-gray-400"
                          >
                            No data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
                  <div className="text-[11px] text-gray-400 font-medium">
                    Displaying{' '}
                    {filteredContacts.length > 0
                      ? (currentPage - 1) * itemsPerPage + 1
                      : 0}{' '}
                    to{' '}
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredContacts.length
                    )}{' '}
                    of {filteredContacts.length} Customers
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        &lt;
                      </button>

                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          // Simple sliding window for pagination
                          let pageNum = i + 1;
                          if (totalPages > 5 && currentPage > 3) {
                            pageNum = currentPage - 2 + i;
                            if (pageNum > totalPages)
                              pageNum = totalPages - (4 - i);
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
                        }
                      )}

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
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={
                          currentPage === totalPages || totalPages === 0
                        }
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        &gt;
                      </button>
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
