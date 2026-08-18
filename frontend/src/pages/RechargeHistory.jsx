import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

const RequestCreditModal = ({ isOpen, onClose }) => {
  const [credit, setCredit] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const axios = (await import('axios')).default;
      await axios.post(`${import.meta.env.VITE_API_URL}/api/transactions/request-credit`, {
        creditsRequested: credit,
        description
      });
      window.location.reload(); // simple reload to see new record
      onClose();
    } catch (err) {
      console.error('Request failed:', err);
      alert('Error requesting credit');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] overflow-hidden">
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

  const tabs = ['All', 'Requested', 'Completed', 'Rejected'];

  useEffect(() => {
    import('axios').then(axios => {
      axios.default.get(`${import.meta.env.VITE_API_URL}/api/transactions/history`)
        .then(res => setHistory(res.data.filter(t => t.type === 'Request' || t.type === 'Recharge')))
        .catch(err => console.error('Error fetching transactions:', err));
    });
  }, []);

  const filteredHistory = history.filter(h => activeTab === 'All' || h.status === activeTab);

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
            onClick={() => setActiveTab(tab)}
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
              <th className="py-3 px-4 font-medium rounded-tl-lg">Purchase Date</th>
              <th className="py-3 px-4 font-medium">Description</th>
              <th className="py-3 px-4 font-medium">Credit Rate</th>
              <th className="py-3 px-4 font-medium">Credits</th>
              <th className="py-3 px-4 font-medium">Total Price</th>
              <th className="py-3 px-4 font-medium rounded-tr-lg">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((record) => (
              <tr key={record._id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-4 px-4 text-sm text-gray-500">{new Date(record.date).toLocaleDateString()}</td>
                <td className="py-4 px-4 font-medium text-gray-900">{record.description}</td>
                <td className="py-4 px-4 text-sm text-gray-500">₹{record.creditRate}</td>
                <td className="py-4 px-4 font-medium text-[var(--color-primary)]">{record.creditsAdded}</td>
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
                <td colSpan="6" className="text-center py-8 text-gray-500">No transactions found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RequestCreditModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default RechargeHistory;
