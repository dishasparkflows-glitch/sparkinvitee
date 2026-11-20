import { useState, useEffect, useCallback } from 'react';
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
  Check,
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
  AlertTriangle,
  Megaphone
} from 'lucide-react';
import api from '../services/api';
import Dropdown from '../components/Dropdown';
import ConfirmationModal from '../components/ConfirmationModal';
import Pagination from '../components/Pagination';
import { toast } from '../utils/toast';

const CampaignDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('All Recipient');
  const [campaign, setCampaign] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modal, setModal] = useState({ open: false, title: '', message: '', onConfirm: null, isDestructive: true, confirmText: 'Confirm' });
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

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
          await api.put(`/campaigns/${id}/pause`);
          fetchCampaign();
          toast.success('Campaign paused successfully');
        } catch (err) {
          console.error(err);
          toast.error(err.response?.data?.message || 'Error pausing campaign');
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
          await api.put(`/campaigns/${id}/resume`);
          fetchCampaign();
          toast.success('Campaign resumed successfully');
        } catch (err) {
          console.error(err);
          toast.error(err.response?.data?.message || 'Error resuming campaign');
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
          await api.put(`/campaigns/${id}/cancel`);
          fetchCampaign();
          toast.success('Campaign cancelled successfully');
        } catch (err) {
          console.error(err);
          toast.error(err.response?.data?.message || 'Error cancelling campaign');
        }
      }
    });
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchCampaign = useCallback(() => {
    api
      .get(`/campaigns/${id}`)
      .then((res) => {
        if (res.data?.status === 'Drafted') {
          navigate(`/campaigns/edit/${id}`, { replace: true });
          return;
        }
        setCampaign(res.data);
      })
      .catch((err) => console.error('Error fetching campaign details:', err));
  }, [id, navigate]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

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
  }, [campaign, isRetryingAll, fetchCampaign]);

  // Escape key closes preview modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && previewModalOpen) {
        setPreviewModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewModalOpen]);

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
      await api.post(`/campaigns/${id}/retry`);
      fetchCampaign();
      toast.success('Retrying failed invitations');
    } catch (err) {
      console.error('Error retrying all failed recipients:', err);
      setIsRetryingAll(false);
      const msg = err.response?.data?.message || 'Error retrying failed invitations';
      toast.error(msg);
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
      await api.post(`/campaigns/${id}/retry/${contact._id}`);
      fetchCampaign();
      toast.success('Retrying invitation');
    } catch (err) {
      console.error('Error retrying recipient:', err);
      const msg = err.response?.data?.message || 'Error retrying invitation';
      toast.error(msg);
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
      await api.put(
        `/campaigns/${id}/contacts/${editingContact._id}/number`,
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

  const formatHeaderDate = (dateString) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day} ${month} ${year}, ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return {
          bg: 'bg-[#eafaf1]',
          text: 'text-[#16a34a]',
          dot: 'bg-[#16a34a]',
          label: 'Completed'
        };
      case 'Failed':
      case 'Partially Failed':
        return {
          bg: 'bg-[#fddddd]',
          text: 'text-[#d93c42]',
          dot: 'bg-[#f35055]',
          label: status
        };
      case 'In-Process':
      case 'Sending':
        return {
          bg: 'bg-[#dbeafe]',
          text: 'text-[#2563eb]',
          dot: 'bg-[#2563eb]',
          label: 'In-Process'
        };
      case 'Scheduled':
        return {
          bg: 'bg-[#f3efff]',
          text: 'text-[#7c3aed]',
          dot: 'bg-[#7c3aed]',
          label: 'Scheduled'
        };
      case 'Paused':
        return {
          bg: 'bg-[#fef3c7]',
          text: 'text-[#b45309]',
          dot: 'bg-[#d97706]',
          label: 'Paused'
        };
      case 'Drafted':
        return {
          bg: 'bg-[#f1f5f9]',
          text: 'text-[#475569]',
          dot: 'bg-[#64748b]',
          label: 'Drafted'
        };
      default:
        return {
          bg: 'bg-[#f1f5f9]',
          text: 'text-[#475569]',
          dot: 'bg-[#64748b]',
          label: status || 'Unknown'
        };
    }
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
      'Sr. No.',
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

      {/* File Attachment In-App Preview Modal (No new tab) */}
      {previewModalOpen && campaign?.fileUrl && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-[#fbfbfe]">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <span>
                  {campaign.fileUrl.toLowerCase().endsWith('.pdf') ? 'PDF Preview' : 'Image Preview'}
                </span>
                <span className="text-gray-400 font-normal text-xs">({campaign.name})</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={campaign.fileUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Download / Open Full Size"
                >
                  <Download size={16} />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-4 min-h-[300px] max-h-[calc(90vh-60px)]">
              {campaign.fileUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={campaign.fileUrl}
                  title="PDF Preview"
                  className="w-full h-[70vh] rounded-lg border border-gray-200 bg-white"
                />
              ) : (
                <img
                  src={campaign.fileUrl}
                  alt="Attachment Preview"
                  className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[calc(100vh-6rem)] relative">
        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button
              onClick={() => navigate('/campaigns')}
              className="hover:text-gray-900 transition-colors flex items-center gap-1.5 font-medium text-gray-600"
            >
              <ArrowLeft size={16} />
              <span>Campaigns</span>
            </button>
            <span className="text-gray-300">/</span>
            <span className="font-bold text-gray-900">Campaign Details</span>
          </div>
          {campaign?.status === 'Drafted' && (
            <button
              onClick={() => navigate(`/campaigns/edit/${id}`)}
              className="bg-[#4c3963] text-white px-3.5 py-1.5 rounded-md font-medium text-xs hover:bg-opacity-90 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Edit2 size={14} />
              Continue Editing Draft
            </button>
          )}
        </div>

        {/* Campaign Info Banner Card */}
        {(() => {
          const statusBadge = getStatusBadge(campaign?.status);
          return (
            <div className="bg-[#f5f1fb] rounded-2xl p-4 sm:p-5 flex items-center justify-between border border-[#ede8f5] mb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#e6dcf7] text-[#7c3aed] flex items-center justify-center shrink-0">
                  <Megaphone size={22} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-gray-900">
                    Campaign: {campaign.name}
                  </h2>
                  <div className="text-[11px] sm:text-xs text-gray-500 font-normal mt-0.5 flex items-center flex-wrap gap-y-1">
                    <span>Created on {formatHeaderDate(campaign.createdAt)}</span>
                    <span className="mx-2 text-gray-300">|</span>
                    <span>Updated on {formatHeaderDate(campaign.updatedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.bg} ${statusBadge.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                  <span>{statusBadge.label}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Top 5 Info Boxes (Moved from sidebar to top row) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          {/* 1. Personal Details */}
          <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-[#483d8b] font-semibold mb-3 text-xs uppercase tracking-wider">
                Personal Details
              </h3>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-full bg-[#e6e6fa] text-[#483d8b] flex items-center justify-center font-bold text-xs shrink-0">
                  {getInitials(customer.profile?.name)}
                </div>
                <div className="text-xs font-semibold text-gray-800 truncate" title={customer.profile?.name}>
                  {customer.profile?.name || '-'}
                </div>
              </div>
            </div>
            <div className="border-t border-gray-50 pt-2 space-y-1">
              <div className="text-[11px] text-gray-500 truncate" title={customer.profile?.email}>
                <span className="text-gray-400 font-medium">Email:</span> {customer.profile?.email || '-'}
              </div>
              <div className="text-[11px] text-gray-500 truncate" title={customer.profile?.mobile}>
                <span className="text-gray-400 font-medium">Mobile:</span> {customer.profile?.mobile || '-'}
              </div>
            </div>
          </div>

          {/* 2. Campaign Details */}
          <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-[#483d8b] font-semibold mb-2.5 text-xs uppercase tracking-wider">
                Campaigns Details
              </h3>
              <div className="mb-2">
                <div className="text-[10px] text-gray-400 font-medium">Campaign Name</div>
                <div className="text-xs font-semibold text-gray-800 truncate" title={campaign.name}>
                  {campaign.name}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <div className="text-[10px] text-gray-400 font-medium">Delay From</div>
                  <div className="text-[11px] font-semibold text-gray-700">{campaign.delayFrom || '-'}s</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-medium">Delay To</div>
                  <div className="text-[11px] font-semibold text-gray-700">{campaign.delayTo || '-'}s</div>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-50 pt-1.5 grid grid-cols-2 gap-1.5 text-[10px] text-gray-500">
              <div className="truncate" title={formatDate(campaign.createdAt)}>
                <span className="text-gray-400">Created:</span> {formatDate(campaign.createdAt)}
              </div>
              <div className="truncate" title={formatDate(campaign.updatedAt)}>
                <span className="text-gray-400">Updated:</span> {formatDate(campaign.updatedAt)}
              </div>
            </div>
          </div>

          {/* 3. Schedule Details */}
          <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-[#483d8b] font-semibold mb-3 text-xs uppercase tracking-wider">
                Schedule Details
              </h3>
              <div className="mb-2.5">
                <div className="text-[10px] text-gray-400 font-medium mb-1">Schedule Date & Time</div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700">
                  <CalendarDays size={13} className="text-[#8b5cf6] shrink-0" />
                  <span className="truncate">{formatDate(campaign.scheduleDateTime)}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-medium mb-1">Sent Date & Time</div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700">
                  <CalendarDays size={13} className="text-[#8b5cf6] shrink-0" />
                  <span className="truncate">
                    {campaign.status === 'Completed' ? formatDate(campaign.updatedAt) : '--'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Message */}
          <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-[#483d8b] font-semibold mb-2.5 text-xs uppercase tracking-wider">
                Message
              </h3>
              <div className="text-[11px] text-gray-600 bg-gray-50/80 border border-gray-100 p-2.5 rounded-lg max-h-24 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {campaign.messageTemplate || 'No message available'}
              </div>
            </div>
          </div>

          {/* 5. File Attachment */}
          <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 p-4 flex flex-col justify-between">
            <div>
              <h3 className="text-[#483d8b] font-semibold mb-2.5 text-xs uppercase tracking-wider">
                {campaign.fileUrl
                  ? campaign.fileUrl.toLowerCase().endsWith('.pdf')
                    ? 'PDF Document'
                    : 'Image'
                  : 'Attachment'}
              </h3>
              <div className="flex items-center justify-center">
                {campaign.fileUrl ? (
                  campaign.fileUrl.toLowerCase().endsWith('.pdf') ? (
                    <button
                      type="button"
                      onClick={() => setPreviewModalOpen(true)}
                      className="w-full h-20 bg-gray-50 flex flex-col items-center justify-center rounded-lg border border-gray-200 hover:border-[#8b5cf6] hover:bg-purple-50 transition-colors cursor-pointer group"
                      title="Click to preview PDF"
                    >
                      <svg
                        className="w-7 h-7 text-red-500 mb-1"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z" />
                        <path d="M8 15h3v2H8zm0-3h8v2H8zm0 6h8v2H8z" />
                      </svg>
                      <div className="text-[10px] text-gray-500 font-medium group-hover:text-[#8b5cf6]">
                        Preview PDF
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPreviewModalOpen(true)}
                      className="block cursor-pointer group focus:outline-hidden"
                      title="Click to preview image"
                    >
                      <img
                        src={campaign.fileUrl}
                        alt="Attachment"
                        className="h-20 max-w-full object-contain rounded-lg shadow-2xs group-hover:shadow-md group-hover:scale-105 transition-all"
                      />
                    </button>
                  )
                ) : (
                  <div className="text-[11px] text-gray-400 py-6 text-center">
                    No file attached
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Campaign Metrics & Contacts Section */}
        <div className="flex flex-col gap-5">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                {
                  label: 'Total Recipients',
                  value: campaign.stats?.totalRecipients || 0,
                  icon: <Users size={16} strokeWidth={2.2} />,
                  cardBg: 'bg-[#f4f2f9]',
                  iconBg: 'bg-[#d9c9f2]',
                  iconColor: 'text-[#6b3ba6]'
                },
                {
                  label: 'In Queue',
                  value: campaign.stats?.inQueue || 0,
                  icon: <Clock size={16} strokeWidth={2.2} />,
                  cardBg: 'bg-[#fcf8f2]',
                  iconBg: 'bg-[#dfd8bf]',
                  iconColor: 'text-[#855e16]'
                },
                {
                  label: 'Sent',
                  value: campaign.stats?.sent || 0,
                  icon: <Send size={15} strokeWidth={2.2} />,
                  cardBg: 'bg-[#f1f4fd]',
                  iconBg: 'bg-[#bbbfc7]',
                  iconColor: 'text-[#2b59c3]'
                },
                {
                  label: 'Delivered',
                  value: campaign.stats?.delivered || 0,
                  icon: <Check size={16} strokeWidth={2.6} />,
                  cardBg: 'bg-[#f4f8f5]',
                  iconBg: 'bg-[#91be9b]',
                  iconColor: 'text-[#1d7039]'
                },
                {
                  label: 'Seen',
                  value: campaign.stats?.seen || 0,
                  icon: <Eye size={16} strokeWidth={2.2} />,
                  cardBg: 'bg-[#f6f1fd]',
                  iconBg: 'bg-[#c1a8ed]',
                  iconColor: 'text-[#5d309e]'
                },
                {
                  label: 'Failed',
                  value: campaign.stats?.failed || 0,
                  icon: <X size={16} strokeWidth={2.6} />,
                  cardBg: 'bg-[#fdf4f5]',
                  iconBg: 'bg-[#f7d2d0]',
                  iconColor: 'text-[#c52828]'
                },
                {
                  label: 'Invalid',
                  value: campaign.stats?.invalid || 0,
                  icon: <Ban size={16} strokeWidth={2.2} />,
                  cardBg: 'bg-[#f5f5f8]',
                  iconBg: 'bg-[#91919d]',
                  iconColor: 'text-[#475569]'
                }
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className={`${stat.cardBg} rounded-xl px-3.5 py-2.5 min-h-[48px] flex items-center gap-3 border border-transparent hover:border-black/5 transition-all`}
                >
                  <div className={`w-8 h-8 rounded-full ${stat.iconBg} ${stat.iconColor} flex items-center justify-center shrink-0`}>
                    {stat.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 leading-none">
                      {stat.value}
                    </div>
                    <div className="text-[11px] font-medium text-gray-500 leading-none mt-1 whitespace-nowrap">
                      {stat.label}
                    </div>
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
                        <th className="py-4 px-6 font-semibold text-gray-800 whitespace-nowrap">
                          Sr. No.
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
                            <td className="py-3.5 px-6 text-gray-500 font-medium whitespace-nowrap">
                              {absoluteIdx}
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
                <div className="px-6 pb-6">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredContacts.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={(page) => setCurrentPage(page)}
                    onItemsPerPageChange={(val) => {
                      setItemsPerPage(val);
                      setCurrentPage(1);
                    }}
                    label="Customers"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default CampaignDetails;
