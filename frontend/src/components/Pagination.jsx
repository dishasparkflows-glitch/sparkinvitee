import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const Pagination = ({ 
  currentPage, 
  totalItems, 
  itemsPerPage, 
  onPageChange, 
  onItemsPerPageChange,
  label = 'records',
  pageSizeOptions = [10, 25, 50, 100]
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          <span className="text-xs text-gray-300">|</span>
          <span className="text-sm text-gray-500 font-medium">Rows:</span>
          
          {/* Custom Styled Rows Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`flex items-center justify-between gap-1.5 min-w-[62px] bg-white border rounded-md px-2.5 py-1 text-xs font-semibold text-gray-700 transition-all focus:outline-none ${
                isDropdownOpen
                  ? 'border-[#4c3963] ring-1 ring-[#4c3963]/30 shadow-xs'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <span>{itemsPerPage}</span>
              <ChevronDown
                size={13}
                className={`text-gray-400 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180 text-[#4c3963]' : ''
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute bottom-full mb-1.5 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[66px] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                {pageSizeOptions.map((size) => {
                  const isSelected = size === itemsPerPage;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        onItemsPerPageChange(size);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-[calc(100%-8px)] mx-1 my-0.5 px-2 py-1 text-xs text-center rounded-md font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#4c3963] text-white font-semibold shadow-xs'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
          title="Previous page"
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
          title="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
