import { Users, LayoutTemplate, Wallet, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';

const Dashboard = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/stats`)
      .then(res => setData(res.data))
      .catch(err => console.error(err));
  }, []);

  if (!data) return <div>Loading...</div>;

  const stats = [
    { title: 'Total Customers', value: data.stats.totalCustomers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Active Campaigns', value: data.stats.activeCampaigns, icon: LayoutTemplate, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Credits Available', value: data.stats.creditsAvailable, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Conversion Rate', value: data.stats.conversionRate, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back! Here is your system overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <Icon size={24} />
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium">{stat.title}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mock Chart Area */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 min-h-[300px]">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Campaign Performance</h2>
          <div className="flex items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-md">
            <span className="text-gray-400">Chart Visualization Area</span>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 min-h-[300px]">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {data.recentActivity.map(activity => (
              <div key={activity.id} className="flex items-center gap-4 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]"></div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{activity.title}</div>
                  <div className="text-xs text-gray-500">{activity.time}</div>
                </div>
              </div>
            ))}
            {data.recentActivity.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
