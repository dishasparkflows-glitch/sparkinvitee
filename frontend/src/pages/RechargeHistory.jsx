import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { toast } from '../utils/toast';
import api from '../services/api';
import Pagination from '../components/Pagination';

const RequestCreditModal = ({ isOpen, onClose }) => {
  const [credit, setCredit] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/transactions/request-credit', {
        creditsRequested: credit,
        description
      });
      toast.success('Credit request submitted successfully');
      setTimeout(() => window.location.reload(), 800);
      onClose();
    } catch (err) {
      console.error('Request failed:', err);
      toast.error(err.response?.data?.message || 'Error requesting credit');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-[500px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold mb-2">Request Credits</h2>
          <p className="text-sm text-gray-500">You will need to request a Spark Invitee to proceed with a new credit purchase.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credit</label>
            <input
              type="number"
              placeholder="Enter Credit Amount"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[var(--color-primary)]"
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              placeholder="Enter Your Description"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[var(--color-primary)] h-32"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-md hover:bg-opacity-90"
            >
              Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const RechargeHistory = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const tabs = ['All', 'Requested', 'Completed', 'Rejected'];

  useEffect(() => {
    api.get('/transactions/history')
      .then(res => setHistory(res.data.filter(t => t.type === 'Request' || t.type === 'Recharge')))
      .catch(err => console.error('Error fetching transactions:', err));
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter(h => {
      const matchesTab = activeTab === 'All' || h.status === activeTab;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (h.description && h.description.toLowerCase().includes(q)) ||
        (h.status && h.status.toLowerCase().includes(q)) ||
        (h.credits?.added && h.credits.added.toString().includes(q)) ||
        (h.totalPrice && h.totalPrice.toString().includes(q));
      return matchesTab && matchesSearch;
    });
  }, [history, activeTab, searchQuery]);

  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredHistory, currentPage, itemsPerPage]);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Recharge History</h1>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-md hover:bg-opacity-90"
          >
            + Request Credits
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setCurrentPage(1);
            }}
            className={`px-4 py-3 whitespace-nowrap font-medium transition-colors border-b-2 ${activeTab === tab
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider bg-gray-50">
              <th className="py-3 px-4 font-medium rounded-tl-lg whitespace-nowrap">Sr. No.</th>
              <th className="py-3 px-4 font-medium">Purchase Date</th>
              <th className="py-3 px-4 font-medium">Description</th>
              <th className="py-3 px-4 font-medium">Credit Rate</th>
              <th className="py-3 px-4 font-medium">Credits</th>
              <th className="py-3 px-4 font-medium">Total Price</th>
              <th className="py-3 px-4 font-medium rounded-tr-lg">Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedHistory.map((record, index) => (
              <tr key={record._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-4 px-4 text-sm text-gray-400 font-medium whitespace-nowrap">
                  {(currentPage - 1) * itemsPerPage + index + 1}
                </td>
                <td className="py-4 px-4 text-sm text-gray-500 whitespace-nowrap">
                  {new Date(record.date).toLocaleDateString()}
                </td>
                <td className="py-4 px-4 font-medium text-gray-900">{record.description}</td>
                <td className="py-4 px-4 text-sm text-gray-500">₹{record.credits?.rate ?? 1}</td>
                <td className="py-4 px-4 font-medium text-[var(--color-primary)]">{record.credits?.added || 0}</td>
                <td className="py-4 px-4 font-medium text-gray-900">₹{record.totalPrice}</td>
                <td className="py-4 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${record.status === 'Completed' ? 'bg-[var(--color-status-completed)] text-[var(--color-status-completed-text)]' :
                      record.status === 'Rejected' || record.status === 'Failed' ? 'bg-[var(--color-status-failed)] text-[var(--color-status-failed-text)]' :
                        'bg-[var(--color-status-requested)] text-[var(--color-status-requested-text)]'
                    }`}>
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
            {filteredHistory.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center py-8 text-gray-500">
                  {history.length === 0 ? 'No transactions found.' : 'No transactions match the selected filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalItems={filteredHistory.length}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => setCurrentPage(page)}
          onItemsPerPageChange={(val) => {
            setItemsPerPage(val);
            setCurrentPage(1);
          }}
          label="transactions"
        />
      </div>

      <RequestCreditModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default RechargeHistory;
