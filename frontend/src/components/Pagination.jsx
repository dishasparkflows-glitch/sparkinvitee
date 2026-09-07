import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ 
  currentPage, 
  totalItems, 
  itemsPerPage, 
  onPageChange, 
  onItemsPerPageChange,
  label = 'records'
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 3) {
        start = 2;
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
        end = totalPages - 1;
      }
      
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  if (totalItems === 0) return null;

  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
      {/* Left: info + per page */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          Showing <span className="font-medium text-gray-700">{startItem}-{endItem}</span> of <span className="font-medium text-gray-700">{totalItems}</span> {label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">|</span>
          <span className="text-sm text-gray-500">Rows:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="bg-white border border-gray-200 rounded-md px-2 py-1 text-sm text-gray-700 font-medium focus:outline-none focus:border-[var(--color-primary)] cursor-pointer appearance-none pr-6"
            style={{ 
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', 
              backgroundPosition: 'right 6px center' 
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Right: page navigation */}
      <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`p-1.5 rounded-md transition-colors ${
              currentPage === 1 
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-gray-600 hover:bg-[#2E2248]/5 hover:text-[var(--color-primary)]'
            }`}
          >
            <ChevronLeft size={18} />
          </button>
          
          {getPageNumbers().map((page, index) => (
            page === '...' ? (
              <span key={`dots-${index}`} className="px-2 text-gray-400 text-sm">...</span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`min-w-[32px] h-8 rounded-md text-sm font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-[#2E2248]/5 hover:text-[var(--color-primary)]'
                }`}
              >
                {page}
              </button>
            )
          ))}
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`p-1.5 rounded-md transition-colors ${
              currentPage === totalPages 
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-gray-600 hover:bg-[#2E2248]/5 hover:text-[var(--color-primary)]'
            }`}
          >
            <ChevronRight size={18} />
          </button>
        </div>
    </div>
  );
};

export default Pagination;
