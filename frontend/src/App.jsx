import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import AuthLayout from './components/AuthLayout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Customers from './pages/Customers';
import Campaigns from './pages/Campaigns';
import CreditsHistory from './pages/CreditsHistory';
import RechargeHistory from './pages/RechargeHistory';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Auth Layout Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
        
        {/* Dashboard Layout Routes */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers/*" element={<Customers />} />
          <Route path="/campaigns/*" element={<Campaigns />} />
          <Route path="/credits-history" element={<CreditsHistory />} />
          <Route path="/recharge-history" element={<RechargeHistory />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
