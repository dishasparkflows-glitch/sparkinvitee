import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
// import { DateRangePicker } from 'react-date-range'; // Not installed, using native for mock
// import 'react-date-range/dist/styles.css';
// import 'react-date-range/dist/theme/default.css';

const CreditsHistory = () => {
  const [history, setHistory] = useState([]);
  
  useEffect(() => {
    import('axios').then(axios => {
      axios.default.get(`${import.meta.env.VITE_API_URL}/api/transactions/history`)
        .then(res => setHistory(res.data))
        .catch(err => console.error('Error fetching transactions:', err));
    });
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Credits History</h1>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-gray-50 cursor-pointer text-gray-500">
            <Calendar size={18} className="mr-2" />
            <span className="text-sm">All Time History</span>
          </div>
          <button className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-md hover:bg-opacity-90">
            Export History
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider bg-gray-50">
              <th className="py-3 px-4 font-medium rounded-tl-lg">Date</th>
              <th className="py-3 px-4 font-medium">Description</th>
              <th className="py-3 px-4 font-medium text-right text-green-600">Debited (+)</th>
              <th className="py-3 px-4 font-medium text-right text-red-600">Credited (-)</th>
              <th className="py-3 px-4 font-medium text-right rounded-tr-lg">Balance</th>
            </tr>
          </thead>
          <tbody>
            {history.map((record) => (
              <tr key={record._id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-4 px-4 text-sm text-gray-500">{new Date(record.date).toLocaleString()}</td>
                <td className="py-4 px-4 font-medium text-gray-900">{record.description}</td>
                <td className="py-4 px-4 text-right font-medium text-green-600">
                  {record.creditsAdded > 0 ? `+${record.creditsAdded}` : '--'}
                </td>
                <td className="py-4 px-4 text-right font-medium text-red-600">
                  {record.creditsDeducted > 0 ? `-${record.creditsDeducted}` : '--'}
                </td>
                <td className="py-4 px-4 text-right font-medium text-gray-900">{record.balanceAfter}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center py-8 text-gray-500">No transactions found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CreditsHistory;
