import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useState, useEffect } from 'react';

const Topbar = () => {
  const [initials, setInitials] = useState('..');

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.name) {
      setInitials(user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase());
    } else {
      setInitials('SI');
    }
  }, []);

  return (
    <header className="h-20 bg-white shadow-sm flex items-center justify-between px-8">
      <div>
        {/* Page title logic can be injected here later via context or generic based on route */}
      </div>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold relative">
          {initials}
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
        </div>
      </div>
    </header>
  );
};

const DashboardLayout = () => {
  return (
    <div className="flex h-screen bg-[var(--color-background)] overflow-hidden">
      {/* Sidebar (Fixed width) */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        
        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
