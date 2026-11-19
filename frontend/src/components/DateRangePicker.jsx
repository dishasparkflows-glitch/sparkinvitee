import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react';

/**
 * Format Date to 'YYYY-MM-DD'
 */
const toDateString = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
    // If already in YYYY-MM-DD, return it
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    date = d;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse 'YYYY-MM-DD' or Date to Date object at local midnight
 */
const parseDate = (dateOrStr) => {
  if (!dateOrStr) return null;
  if (dateOrStr instanceof Date) {
    return new Date(dateOrStr.getFullYear(), dateOrStr.getMonth(), dateOrStr.getDate());
  }
  if (typeof dateOrStr === 'string') {
    const parts = dateOrStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
    const d = new Date(dateOrStr);
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
};

/**
 * Format for human-readable display e.g. "19 Nov 2026"
 */
const formatDisplay = (dateOrStr) => {
  const d = parseDate(dateOrStr);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * Common DateRangePicker Component
 *
 * Props:
 * - startDate: 'YYYY-MM-DD' or Date
 * - endDate: 'YYYY-MM-DD' or Date
 * - onChange: ({ startDate, endDate }) => void
 * - onStartDateChange?: (dateStr) => void
 * - onEndDateChange?: (dateStr) => void
 * - placeholder?: string (default: "Select Date Range")
 * - className?: string
 * - align?: 'left' | 'right' (popover alignment, default: 'left')
 */
const DateRangePicker = ({
  startDate,
  endDate,
  onChange,
  onStartDateChange,
  onEndDateChange,
  placeholder = 'Select Date Range',
  className = '',
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parsed initial dates
  const parsedStart = useMemo(() => parseDate(startDate), [startDate]);
  const parsedEnd = useMemo(() => parseDate(endDate), [endDate]);

  // Current view month in the calendar
  const [viewDate, setViewDate] = useState(() => parsedStart || parsedEnd || new Date());

  // Transient selection during picking
  const [tempStart, setTempStart] = useState(null);
  const [tempEnd, setTempEnd] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);

  // Sync temp selection when popover opens or prop changes
  useEffect(() => {
    if (isOpen) {
      setTempStart(parsedStart);
      setTempEnd(parsedEnd);
      if (parsedStart) {
        setViewDate(new Date(parsedStart.getFullYear(), parsedStart.getMonth(), 1));
      } else if (parsedEnd) {
        setViewDate(new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), 1));
      }
    }
  }, [isOpen, parsedStart, parsedEnd]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const emitChange = (start, end) => {
    const sStr = toDateString(start);
    const eStr = toDateString(end);
    if (onChange) {
      onChange({ startDate: sStr, endDate: eStr });
    }
    if (onStartDateChange) onStartDateChange(sStr);
    if (onEndDateChange) onEndDateChange(eStr);
  };

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    setTempStart(null);
    setTempEnd(null);
    emitChange(null, null);
    setIsOpen(false);
  };

  // Preset handlers
  const applyPreset = (type) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start = null;
    let end = null;

    if (type === 'today') {
      start = today;
      end = today;
    } else if (type === 'yesterday') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    } else if (type === 'last7') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      end = today;
    } else if (type === 'last30') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
      end = today;
    } else if (type === 'thisMonth') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    setTempStart(start);
    setTempEnd(end);
    emitChange(start, end);
    setIsOpen(false);
  };

  // Day click logic
  const handleDayClick = (dayDate) => {
    // If no start date selected yet, or both start and end are already selected:
    // start fresh with clicked day as start
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dayDate);
      setTempEnd(null);
    } else if (tempStart && !tempEnd) {
      // If clicked day is before start, make it the new start
      if (dayDate < tempStart) {
        setTempStart(dayDate);
        setTempEnd(null);
      } else {
        // Complete the range and auto-apply
        setTempEnd(dayDate);
        emitChange(tempStart, dayDate);
        setIsOpen(false);
      }
    }
  };

  const handleApply = () => {
    emitChange(tempStart, tempEnd);
    setIsOpen(false);
  };

  // Navigation handlers
  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  // Generate calendar grid for the viewDate month
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Trailing previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Leading next month days to complete 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, [viewDate]);

  // Determine active display text
  const displayText = useMemo(() => {
    if (parsedStart && parsedEnd) {
      return `${formatDisplay(parsedStart)} - ${formatDisplay(parsedEnd)}`;
    }
    if (parsedStart) {
      return `From ${formatDisplay(parsedStart)}`;
    }
    if (parsedEnd) {
      return `To ${formatDisplay(parsedEnd)}`;
    }
    return placeholder;
  }, [parsedStart, parsedEnd, placeholder]);

  const hasValue = Boolean(parsedStart || parsedEnd);

  // Check if a date is today
  const isToday = (d) => {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  // Check if date is start, end, or in range
  const getDateStatus = (d) => {
    const time = d.getTime();
    const startTime = tempStart ? tempStart.getTime() : null;
    const endTime = tempEnd ? tempEnd.getTime() : null;
    const hoverTime = hoverDate ? hoverDate.getTime() : null;

    const isStart = startTime === time;
    const isEnd = endTime === time;

    let inRange = false;
    if (startTime && endTime) {
      inRange = time > startTime && time < endTime;
    } else if (startTime && !endTime && hoverTime) {
      const min = Math.min(startTime, hoverTime);
      const max = Math.max(startTime, hoverTime);
      inRange = time > min && time < max;
    }

    return { isStart, isEnd, inRange };
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 bg-white border rounded-md px-3 py-2 text-sm transition-all focus:outline-none ${
          isOpen
            ? 'border-[#4c3963] ring-1 ring-[#4c3963]/30'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon size={16} className="text-gray-400 shrink-0" />
          <span className={`truncate ${hasValue ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
            {displayText}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {hasValue && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-0.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 transition-colors"
              title="Clear date filter"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-72 sm:w-80 select-none ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Presets Row */}
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-gray-100">
            {[
              { label: 'Today', type: 'today' },
              { label: 'Yesterday', type: 'yesterday' },
              { label: 'Last 7 Days', type: 'last7' },
              { label: 'Last 30 Days', type: 'last30' },
              { label: 'This Month', type: 'thisMonth' },
            ].map((preset) => (
              <button
                key={preset.type}
                type="button"
                onClick={() => applyPreset(preset.type)}
                className="text-[11px] font-medium px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-[#4c3963]/10 hover:text-[#4c3963] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              title="Previous Month"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              title="Next Month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="text-[11px] font-semibold text-gray-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center text-xs">
            {calendarDays.map(({ date, isCurrentMonth }, idx) => {
              const { isStart, isEnd, inRange } = getDateStatus(date);
              const currentToday = isToday(date);

              let cellClasses = 'relative h-8 w-8 mx-auto flex items-center justify-center text-xs font-medium transition-colors cursor-pointer ';

              if (isStart || isEnd) {
                cellClasses += 'bg-[#4c3963] text-white rounded-full font-semibold shadow-sm ';
              } else if (inRange) {
                cellClasses += 'bg-[#4c3963]/10 text-[#4c3963] rounded-none ';
              } else if (!isCurrentMonth) {
                cellClasses += 'text-gray-300 hover:bg-gray-50 rounded-full ';
              } else {
                cellClasses += 'text-gray-700 hover:bg-gray-100 rounded-full ';
              }

              if (currentToday && !isStart && !isEnd) {
                cellClasses += ' border border-[#4c3963] font-bold ';
              }

              return (
                <div
                  key={idx}
                  className={`${inRange ? 'bg-[#4c3963]/10' : ''} ${
                    isStart ? 'rounded-l-full' : ''
                  } ${isEnd ? 'rounded-r-full' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => handleDayClick(date)}
                    onMouseEnter={() => tempStart && !tempEnd && setHoverDate(date)}
                    className={cellClasses}
                  >
                    {date.getDate()}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Range Summary & Action Footer */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <div className="text-gray-500 truncate mr-2">
              {tempStart && tempEnd ? (
                <span>
                  <strong className="text-gray-700">{formatDisplay(tempStart)}</strong> -{' '}
                  <strong className="text-gray-700">{formatDisplay(tempEnd)}</strong>
                </span>
              ) : tempStart ? (
                <span>Start: <strong className="text-gray-700">{formatDisplay(tempStart)}</strong></span>
              ) : (
                <span className="text-gray-400">No range selected</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 text-gray-500 hover:text-red-600 rounded hover:bg-gray-100 font-medium transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!tempStart}
                className="px-3 py-1 bg-[#4c3963] text-white rounded font-medium hover:bg-opacity-90 disabled:opacity-50 transition-colors shadow-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
