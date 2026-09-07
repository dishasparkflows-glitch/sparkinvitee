import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const Dropdown = ({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Select an option', 
  className = '',
  icon = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-white border rounded-md focus:outline-none transition-colors ${
          isOpen 
            ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)] ring-opacity-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${icon ? 'pl-9 pr-3 py-2' : 'px-4 py-2'}`}
      >
        <div className="flex items-center truncate">
          {icon && (
            <span className="absolute left-3 text-gray-400 flex items-center justify-center">
              {icon}
            </span>
          )}
          <span className={`truncate text-sm ${!selectedOption && placeholder ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto py-1">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  isSelected 
                    ? 'bg-[#2E2248]/10 text-[var(--color-primary)] font-semibold' 
                    : 'text-gray-700 hover:bg-[#2E2248]/5'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
