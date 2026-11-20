import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, ChevronDown, Clock } from 'lucide-react';
import Dropdown from './Dropdown';

/**
 * Format Date to 'YYYY-MM-DD'
 */
const toDateString = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
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
 * Format Date to 'YYYY-MM-DDTHH:mm'
 */
const toDateTimeString = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Parse Date object or string at local midnight for calendar logic
 */
const parseDate = (dateOrStr) => {
  if (!dateOrStr) return null;
  if (dateOrStr instanceof Date) {
    return isNaN(dateOrStr.getTime()) ? null : new Date(dateOrStr.getFullYear(), dateOrStr.getMonth(), dateOrStr.getDate());
  }
  if (typeof dateOrStr === 'string') {
    const parts = dateOrStr.split('T')[0].split('-');
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
 * Parse full datetime
 */
const parseDateTime = (dateOrStr) => {
  if (!dateOrStr) return null;
  const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
  return isNaN(d.getTime()) ? null : d;
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

/**
 * Format for human-readable display e.g. "19 Nov 2026, 02:30 PM"
 */
const formatDateTimeDisplay = (dateOrStr) => {
  const d = parseDateTime(dateOrStr);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hourStr = String(hours).padStart(2, '0');
  return `${day} ${month} ${year}, ${hourStr}:${minutes} ${ampm}`;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * Common DateRangePicker & DateTimePicker Component
 *
 * Range Mode Props:
 * - startDate: 'YYYY-MM-DD' or Date
 * - endDate: 'YYYY-MM-DD' or Date
 * - onChange: ({ startDate, endDate }) => void
 * - onStartDateChange?: (dateStr) => void
 * - onEndDateChange?: (dateStr) => void
 *
 * Single / DateTime Mode Props:
 * - mode: 'single' | 'range' (defaults to 'single' if value or showTime is provided, else 'range')
 * - value: string | Date
 * - onChange: (val) => void
 * - showTime?: boolean
 * - minDate?: Date | string
 * - maxDate?: Date | string
 *
 * Common Props:
 * - placeholder?: string
 * - className?: string
 * - align?: 'left' | 'right'
 */
const DateRangePicker = ({
  // Common
  mode,
  placeholder,
  className = '',
  align = 'left',
  // Range mode
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  // Single mode
  value,
  showTime = false,
  minDate,
  maxDate,
  // Polymorphic onChange
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Determine mode
  const isSingleMode = mode === 'single' || Boolean(showTime) || (value !== undefined && startDate === undefined);

  // ==========================================
  // Range Mode State
  // ==========================================
  const parsedStart = useMemo(() => parseDate(startDate), [startDate]);
  const parsedEnd = useMemo(() => parseDate(endDate), [endDate]);
  const [tempStart, setTempStart] = useState(null);
  const [tempEnd, setTempEnd] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);

  // ==========================================
  // Single Mode State
  // ==========================================
  const parsedSingleValue = useMemo(() => parseDateTime(value), [value]);
  const minDateObj = useMemo(() => parseDate(minDate), [minDate]);
  const maxDateObj = useMemo(() => parseDate(maxDate), [maxDate]);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedHour, setSelectedHour] = useState(10);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedAmPm, setSelectedAmPm] = useState('AM');

  const hourOptions = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const val = i + 1;
      return { value: val, label: String(val).padStart(2, '0') };
    })
  , []);

  const minuteOptions = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => {
      return { value: i, label: String(i).padStart(2, '0') };
    })
  , []);

  // Current view month in the calendar
  const [viewDate, setViewDate] = useState(() => {
    if (isSingleMode) {
      return parsedSingleValue || (minDateObj && minDateObj > new Date() ? minDateObj : new Date());
    }
    return parsedStart || parsedEnd || new Date();
  });

  // Sync state on open or prop changes
  useEffect(() => {
    if (isSingleMode) {
      if (parsedSingleValue) {
        setSelectedDate(new Date(parsedSingleValue.getFullYear(), parsedSingleValue.getMonth(), parsedSingleValue.getDate()));
        const h = parsedSingleValue.getHours() % 12 || 12;
        setSelectedHour(h);
        setSelectedMinute(parsedSingleValue.getMinutes());
        setSelectedAmPm(parsedSingleValue.getHours() >= 12 ? 'PM' : 'AM');
        setViewDate(new Date(parsedSingleValue.getFullYear(), parsedSingleValue.getMonth(), 1));
      } else {
        setSelectedDate(null);
        const now = new Date();
        const h = now.getHours() % 12 || 12;
        setSelectedHour(h);
        setSelectedMinute(Math.floor(now.getMinutes() / 5) * 5);
        setSelectedAmPm(now.getHours() >= 12 ? 'PM' : 'AM');
      }
    } else {
      if (isOpen) {
        setTempStart(parsedStart);
        setTempEnd(parsedEnd);
        if (parsedStart) {
          setViewDate(new Date(parsedStart.getFullYear(), parsedStart.getMonth(), 1));
        } else if (parsedEnd) {
          setViewDate(new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), 1));
        }
      }
    }
  }, [isOpen, isSingleMode, parsedSingleValue, parsedStart, parsedEnd]);

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

  // Check if a date is today
  const isToday = (d) => {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  // Check if date is disabled by min/max
  const isDateDisabled = (d) => {
    if (minDateObj && d < minDateObj) return true;
    if (maxDateObj && d > maxDateObj) return true;
    return false;
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

    // Leading next month days to complete grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, [viewDate]);

  // ==========================================
  // Range Mode Handlers
  // ==========================================
  const emitRangeChange = (start, end) => {
    const sStr = toDateString(start);
    const eStr = toDateString(end);
    if (onChange) {
      onChange({ startDate: sStr, endDate: eStr });
    }
    if (onStartDateChange) onStartDateChange(sStr);
    if (onEndDateChange) onEndDateChange(eStr);
  };

  const handleRangeClear = (e) => {
    if (e) e.stopPropagation();
    setTempStart(null);
    setTempEnd(null);
    emitRangeChange(null, null);
    setIsOpen(false);
  };

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
    emitRangeChange(start, end);
    setIsOpen(false);
  };

  const handleRangeDayClick = (dayDate) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dayDate);
      setTempEnd(null);
    } else if (tempStart && !tempEnd) {
      if (dayDate < tempStart) {
        setTempStart(dayDate);
        setTempEnd(null);
      } else {
        setTempEnd(dayDate);
        emitRangeChange(tempStart, dayDate);
        setIsOpen(false);
      }
    }
  };

  const handleRangeApply = () => {
    emitRangeChange(tempStart, tempEnd);
    setIsOpen(false);
  };

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

  const rangeDisplayText = useMemo(() => {
    if (parsedStart && parsedEnd) {
      return `${formatDisplay(parsedStart)} - ${formatDisplay(parsedEnd)}`;
    }
    if (parsedStart) {
      return `From ${formatDisplay(parsedStart)}`;
    }
    if (parsedEnd) {
      return `To ${formatDisplay(parsedEnd)}`;
    }
    return placeholder || 'Select Date Range';
  }, [parsedStart, parsedEnd, placeholder]);

  const hasRangeValue = Boolean(parsedStart || parsedEnd);

  // ==========================================
  // Single / DateTime Mode Handlers
  // ==========================================
  const emitSingleChange = (dateObj, hour, minute, ampm) => {
    if (!dateObj) {
      if (onChange) onChange(null);
      return;
    }
    if (showTime) {
      let h = hour % 12;
      if (ampm === 'PM') h += 12;
      const combined = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), h, minute, 0, 0);
      const str = toDateTimeString(combined);
      if (onChange) onChange(str);
    } else {
      const str = toDateString(dateObj);
      if (onChange) onChange(str);
    }
  };

  const handleSingleDayClick = (dayDate) => {
    if (isDateDisabled(dayDate)) return;

    setSelectedDate(dayDate);
    if (!showTime) {
      emitSingleChange(dayDate, selectedHour, selectedMinute, selectedAmPm);
      setIsOpen(false);
    }
  };

  const handleSingleApply = () => {
    const targetDate = selectedDate || new Date();
    emitSingleChange(targetDate, selectedHour, selectedMinute, selectedAmPm);
    setIsOpen(false);
  };

  const handleSelectNow = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setSelectedDate(today);
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const h = now.getHours() % 12 || 12;
    setSelectedHour(h);
    setSelectedMinute(now.getMinutes());
    setSelectedAmPm(now.getHours() >= 12 ? 'PM' : 'AM');
    emitSingleChange(today, h, now.getMinutes(), now.getHours() >= 12 ? 'PM' : 'AM');
    setIsOpen(false);
  };

  const handleSingleClear = (e) => {
    if (e) e.stopPropagation();
    setSelectedDate(null);
    if (onChange) onChange(null);
    setIsOpen(false);
  };

  const singleDisplayText = useMemo(() => {
    if (value) {
      return showTime ? formatDateTimeDisplay(value) : formatDisplay(value);
    }
    return placeholder || (showTime ? 'Select Date & Time' : 'Select Date');
  }, [value, showTime, placeholder]);

  const hasSingleValue = Boolean(value);

  // Live formatted label for current single selection in footer
  const currentSinglePreview = useMemo(() => {
    if (!selectedDate) return null;
    if (!showTime) return formatDisplay(selectedDate);
    let h = selectedHour % 12;
    if (selectedAmPm === 'PM') h += 12;
    const combined = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), h, selectedMinute, 0, 0);
    return formatDateTimeDisplay(combined);
  }, [selectedDate, showTime, selectedHour, selectedMinute, selectedAmPm]);

  // ==========================================
  // Render: Single Mode
  // ==========================================
  if (isSingleMode) {
    return (
      <div className={`relative inline-block ${className}`} ref={containerRef}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between gap-2 bg-white border rounded-lg px-3.5 py-2.5 text-sm transition-all focus:outline-none shadow-2xs hover:border-gray-400 ${
            isOpen
              ? 'border-[#4c3963] ring-2 ring-purple-100'
              : 'border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2.5 truncate">
            <CalendarIcon size={16} className="text-[#4c3963] shrink-0" />
            <span className={`truncate ${hasSingleValue ? 'text-gray-800 font-semibold' : 'text-gray-400 font-normal'}`}>
              {singleDisplayText}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {hasSingleValue && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleSingleClear}
                className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                title="Clear date"
              >
                <X size={14} />
              </span>
            )}
            <ChevronDown
              size={15}
              className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#4c3963]' : ''}`}
            />
          </div>
        </button>

        {/* Popover */}
        {isOpen && (
          <div
            className={`absolute z-50 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 select-none animate-fade-in-up w-72 sm:w-80 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {/* Calendar Grid */}
            <div className="w-full">
              {/* Month/Year Navigation */}
              <div className="flex items-center justify-between mb-3 px-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-purple-50 hover:text-[#4c3963] rounded-lg transition-colors cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-bold text-gray-800">
                  {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-purple-50 hover:text-[#4c3963] rounded-lg transition-colors cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {WEEK_DAYS.map((day) => (
                  <div key={day} className="text-[11px] font-bold text-gray-400 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center text-xs">
                {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                  const isSelected = selectedDate &&
                    date.getFullYear() === selectedDate.getFullYear() &&
                    date.getMonth() === selectedDate.getMonth() &&
                    date.getDate() === selectedDate.getDate();

                  const currentToday = isToday(date);
                  const disabled = isDateDisabled(date);

                  let cellClasses = 'relative h-8 w-8 mx-auto flex items-center justify-center text-xs font-medium transition-all rounded-full ';

                  if (disabled) {
                    cellClasses += 'opacity-25 cursor-not-allowed text-gray-400 ';
                  } else if (isSelected) {
                    cellClasses += 'bg-[#4c3963] text-white font-bold shadow-sm scale-105 ';
                  } else if (!isCurrentMonth) {
                    cellClasses += 'text-gray-300 hover:bg-gray-100 cursor-pointer ';
                  } else {
                    cellClasses += 'text-gray-700 hover:bg-purple-50 hover:text-[#4c3963] font-semibold cursor-pointer ';
                  }

                  if (currentToday && !isSelected && !disabled) {
                    cellClasses += 'border border-[#4c3963] text-[#4c3963] font-bold ';
                  }

                  return (
                    <div key={idx} className="flex items-center justify-center">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleSingleDayClick(date)}
                        className={cellClasses}
                      >
                        {date.getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time Selection Bar (if showTime) */}
            {showTime && (
              <div className="mt-3.5 pt-3 border-t border-gray-100 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                    <Clock size={13} className="text-[#4c3963]" />
                    <span>Select Time</span>
                  </div>

                  {/* Quick Preset Chips */}
                  <div className="flex items-center gap-1">
                    {[
                      { label: 'Now', action: handleSelectNow },
                      { label: '10 AM', h: 10, m: 0, ap: 'AM' },
                      { label: '2 PM', h: 2, m: 0, ap: 'PM' },
                      { label: '6 PM', h: 6, m: 0, ap: 'PM' },
                    ].map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => {
                          if (preset.action) {
                            preset.action();
                          } else {
                            setSelectedHour(preset.h);
                            setSelectedMinute(preset.m);
                            setSelectedAmPm(preset.ap);
                          }
                        }}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-[#4c3963] transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Styled Selector Row using our Common Dropdown */}
                <div className="flex items-center justify-center gap-2 bg-[#f8f9fc] border border-gray-200/80 rounded-xl py-2 px-3">
                  {/* Hour Dropdown */}
                  <div className="flex flex-col items-center w-[74px]">
                    <Dropdown
                      value={selectedHour}
                      onChange={(val) => setSelectedHour(val)}
                      options={hourOptions}
                      size="sm"
                      align="center"
                      direction="up"
                      className="w-full"
                    />
                    <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Hr</span>
                  </div>

                  <span className="text-gray-400 font-bold text-lg select-none -mt-3.5">:</span>

                  {/* Minute Dropdown */}
                  <div className="flex flex-col items-center w-[74px]">
                    <Dropdown
                      value={selectedMinute}
                      onChange={(val) => setSelectedMinute(val)}
                      options={minuteOptions}
                      size="sm"
                      align="center"
                      direction="up"
                      className="w-full"
                    />
                    <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Min</span>
                  </div>

                  {/* AM / PM Segmented Toggle */}
                  <div className="flex flex-col items-center">
                    <div className="flex bg-gray-200/80 p-0.5 rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setSelectedAmPm('AM')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          selectedAmPm === 'AM'
                            ? 'bg-[#4c3963] text-white shadow-2xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedAmPm('PM')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          selectedAmPm === 'PM'
                            ? 'bg-[#4c3963] text-white shadow-2xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        PM
                      </button>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Period</span>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Summary & Action Buttons */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <div className="truncate mr-2">
                {currentSinglePreview ? (
                  <span className="text-gray-500">
                    Selected: <strong className="text-[#4c3963] font-bold">{currentSinglePreview}</strong>
                  </span>
                ) : (
                  <span className="text-gray-400">Pick date & time</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleSelectNow}
                  className="px-2.5 py-1 text-gray-600 hover:text-[#4c3963] hover:bg-purple-50 rounded-md font-semibold transition-colors cursor-pointer"
                >
                  Now
                </button>
                <button
                  type="button"
                  onClick={handleSingleClear}
                  className="px-2.5 py-1 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-md font-medium transition-colors cursor-pointer"
                >
                  Clear
                </button>
                {showTime && (
                  <button
                    type="button"
                    onClick={handleSingleApply}
                    disabled={!selectedDate}
                    className="px-3.5 py-1 bg-[#4c3963] text-white rounded-md font-bold hover:bg-opacity-95 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // Render: Range Mode (Preserves existing UI & API)
  // ==========================================
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
          <span className={`truncate ${hasRangeValue ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
            {rangeDisplayText}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {hasRangeValue && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleRangeClear}
              className="p-0.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
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
          className={`absolute z-50 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-72 sm:w-80 select-none animate-fade-in-up ${
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
                className="text-[11px] font-medium px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-[#4c3963]/10 hover:text-[#4c3963] transition-colors cursor-pointer"
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
              className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
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
              className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
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
                    onClick={() => handleRangeDayClick(date)}
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
                onClick={handleRangeClear}
                className="px-2.5 py-1 text-gray-500 hover:text-red-600 rounded hover:bg-gray-100 font-medium transition-colors cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleRangeApply}
                disabled={!tempStart}
                className="px-3 py-1 bg-[#4c3963] text-white rounded font-medium hover:bg-opacity-90 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
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
