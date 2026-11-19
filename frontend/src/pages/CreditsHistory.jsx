import { useState, useEffect } from 'react';
import Pagination from '../components/Pagination';
import DateSelection from '../components/DateSelection';

const CreditsHistory = () => {
  const [history, setHistory] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  useEffect(() => {
    import('axios').then(axios => {
      axios.default.get(`${import.meta.env.VITE_API_URL}/api/transactions/history`)
        .then(res => setHistory(res.data))
        .catch(err => console.error('Error fetching transactions:', err));
    });
  }, []);

  const filteredHistory = history.filter(record => {
    if (!startDate && !endDate) return true;
    const recordDate = new Date(record.date);
    
    let isValid = true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (recordDate < start) isValid = false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (recordDate > end) isValid = false;
    }
    return isValid;
  });

  const handleExport = () => {
    if (!filteredHistory || filteredHistory.length === 0) return;

    const headers = ['Date', 'Description', 'Debited (+)', 'Credited (-)', 'Balance'];
    const csvRows = [headers.join(',')];

    filteredHistory.forEach((record) => {
      const row = [
        `"${new Date(record.date).toLocaleString()}"`,
        `"${(record.description || '').replace(/"/g, '""')}"`,
        `"${record.credits?.added > 0 ? '+' + record.credits.added : '--'}"`,
        `"${record.credits?.deducted > 0 ? '-' + record.credits.deducted : '--'}"`,
        `"${record.balanceAfter}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Credits_History.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Credits History</h1>
        
        <div className="flex items-center gap-4">
          <DateSelection
            startDate={startDate}
            endDate={endDate}
            onChange={({ startDate: s, endDate: e }) => {
              setStartDate(s);
              setEndDate(e);
              setCurrentPage(1);
            }}
            placeholder="Filter by Date"
            align="right"
          />
          <button 
            onClick={handleExport}
            className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-md hover:bg-opacity-90"
          >
            Export History
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider bg-gray-50">
              <th className="py-3 px-4 font-medium rounded-tl-lg whitespace-nowrap">Sr. No.</th>
              <th className="py-3 px-4 font-medium">Date</th>
              <th className="py-3 px-4 font-medium">Description</th>
              <th className="py-3 px-4 font-medium text-right text-green-600">Debited (+)</th>
              <th className="py-3 px-4 font-medium text-right text-red-600">Credited (-)</th>
              <th className="py-3 px-4 font-medium text-right rounded-tr-lg">Balance</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((record, index) => (
              <tr key={record._id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-4 px-4 text-sm text-gray-400 font-medium">
                  {(currentPage - 1) * itemsPerPage + index + 1}
                </td>
                <td className="py-4 px-4 text-sm text-gray-500">{new Date(record.date).toLocaleString()}</td>
                <td className="py-4 px-4 font-medium text-gray-900">{record.description}</td>
                <td className="py-4 px-4 text-right font-medium text-green-600">
                  {record.credits?.added > 0 ? `+${record.credits.added}` : '--'}
                </td>
                <td className="py-4 px-4 text-right font-medium text-red-600">
                  {record.credits?.deducted > 0 ? `-${record.credits.deducted}` : '--'}
                </td>
                <td className="py-4 px-4 text-right font-medium text-gray-900">{record.balanceAfter}</td>
              </tr>
            ))}
            {filteredHistory.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-500">
                  {history.length === 0 ? "No transactions found." : "No transactions match the selected date range."}
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
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          label="transactions"
        />
      </div>
    </div>
  );
};

export default CreditsHistory;
