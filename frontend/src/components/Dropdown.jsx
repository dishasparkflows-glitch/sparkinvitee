import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const Dropdown = ({ 
  value, 
  onChange, 
  options = [], 
  placeholder = 'Select an option', 
  className = '',
  icon = null,
  direction = 'down', // 'down' | 'up'
  size = 'default',   // 'default' | 'sm'
  align = 'left',     // 'left' | 'center' | 'right'
  menuClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedItemRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll selected item into view when dropdown opens
  useEffect(() => {
    if (isOpen && selectedItemRef.current) {
      setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({ block: 'nearest' });
      }, 30);
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  const isSmall = size === 'sm';

  const textAlignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-white border focus:outline-none transition-all cursor-pointer ${
          isSmall ? 'rounded-lg px-2.5 py-1.5' : 'rounded-md px-4 py-2'
        } ${
          isOpen 
            ? 'border-[#4c3963] ring-2 ring-purple-100 shadow-2xs' 
            : 'border-gray-300 hover:border-gray-400'
        } ${icon ? 'pl-9 pr-3' : ''}`}
      >
        <div className={`flex items-center truncate ${align === 'center' ? 'justify-center w-full' : ''}`}>
          {icon && (
            <span className="absolute left-3 text-gray-400 flex items-center justify-center">
              {icon}
            </span>
          )}
          <span className={`truncate ${isSmall ? 'text-xs font-bold' : 'text-sm font-medium'} ${
            !selectedOption && placeholder ? 'text-gray-400 font-normal' : 'text-gray-800'
          }`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown 
          size={isSmall ? 13 : 16} 
          className={`text-gray-400 transition-transform duration-200 shrink-0 ml-1.5 ${isOpen ? 'rotate-180 text-[#4c3963]' : ''}`} 
        />
      </button>

      {isOpen && (
        <div 
          className={`absolute z-60 w-full bg-white border border-gray-200 shadow-xl max-h-52 overflow-y-auto py-1 custom-scrollbar animate-fade-in-up ${
            isSmall ? 'rounded-lg' : 'rounded-md'
          } ${
            direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } ${menuClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                ref={isSelected ? selectedItemRef : null}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full ${textAlignClass} transition-colors cursor-pointer ${
                  isSmall ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
                } ${
                  isSelected 
                    ? 'bg-[#4c3963]/10 text-[#4c3963] font-bold' 
                    : 'text-gray-700 hover:bg-purple-50/70 hover:text-[#4c3963]'
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
