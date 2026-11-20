import DateRangePicker from './DateRangePicker';

export { DateRangePicker };
export const DatePicker = (props) => <DateRangePicker mode="single" {...props} />;
export const DateTimePicker = (props) => <DateRangePicker mode="single" showTime {...props} />;
export default DateRangePicker;
