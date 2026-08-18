import { Routes, Route } from 'react-router-dom';
import CustomersList from './CustomersList';
import CustomerDetails from './CustomerDetails';

const Customers = () => {
  return (
    <Routes>
      <Route path="/" element={<CustomersList />} />
      <Route path=":id" element={<CustomerDetails />} />
    </Routes>
  );
};

export default Customers;
