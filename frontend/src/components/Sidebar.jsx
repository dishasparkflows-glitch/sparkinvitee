import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Clock, History, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';

const Sidebar = () => {
  const [availableCredits, setAvailableCredits] = useState(0);

  useEffect(() => {
    const fetchCredits = () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user && user.credits) {
          setAvailableCredits(user.credits.available || 0);
        }
      } catch (e) {
        console.error('Error parsing user data', e);
      }
    };
    
    fetchCredits();
    
    window.addEventListener('storage', fetchCredits);
    window.addEventListener('user-updated', fetchCredits);
    
    return () => {
      window.removeEventListener('storage', fetchCredits);
      window.removeEventListener('user-updated', fetchCredits);
    };
  }, []);
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Campaigns', path: '/campaigns', icon: Clock },
    { name: 'Credits History', path: '/credits-history', icon: History },
    { name: 'Recharge History', path: '/recharge-history', icon: Wallet },
  ];

  return (
    <div className="w-64 h-full bg-[var(--color-primary)] text-white flex flex-col">
      <div className="p-6 flex items-center gap-3">
        {/* Placeholder for SparkInvitee Logo */}
        <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
          <span className="text-[var(--color-primary)] font-bold text-xl">S</span>
        </div>
        <span className="font-bold text-xl tracking-wider">SPARKINVITEE</span>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-white/10 text-white font-medium border-l-4 border-white' 
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
      
      <div className="p-6">
        <div className="text-sm text-gray-300 mb-1">Available Credits:</div>
        <div className="text-xl font-bold">{availableCredits.toLocaleString()}</div>
      </div>
    </div>
  );
};

export default Sidebar;
