import { Link, useLocation } from 'react-router';

const QUICK_NAV_ITEMS = [
  { label: 'Modules', to: '/' },
  { label: 'Load Planner', to: '/route-planner' },
  { label: 'Load Board', to: '/load-board' },
  { label: 'Dispatching', to: '/dispatching' },
  { label: 'Vehicles', to: '/fleet-monitor' },
  { label: 'Broker Desk', to: '/broker-desk' },
  { label: 'Payments', to: '/payments' },
  { label: 'Finance', to: '/finance' },
];

export function ThinModuleMenu() {
  const location = useLocation();

  return (
    <div className="flex h-10 items-center gap-1.5 overflow-x-auto border-b border-slate-700 bg-slate-900 px-3 whitespace-nowrap">
      {QUICK_NAV_ITEMS.map((item) => {
        const isActive = location.pathname === item.to;

        return (
          <Link
            key={item.to}
            to={item.to}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-white text-slate-900'
                : 'text-slate-200 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
