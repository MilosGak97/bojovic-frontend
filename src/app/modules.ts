export interface ModuleDefinition {
  title: string;
  path: string;
  description: string;
  ready: boolean;
}

export const dashboardModules: ModuleDefinition[] = [
  {
    title: 'Route Planner',
    path: '/route-planner',
    description: 'Build, simulate, and finalize load routes on the interactive board.',
    ready: true,
  },
  {
    title: 'Dispatching',
    path: '/dispatching',
    description: 'Assign drivers and vans to active routes with shift visibility.',
    ready: false,
  },
  {
    title: 'Load Board',
    path: '/load-board',
    description: 'Review available, negotiating, and taken loads in one place.',
    ready: true,
  },
  {
    title: 'Broker Desk',
    path: '/broker-desk',
    description: 'Track broker profiles, trust score, and contact quality.',
    ready: false,
  },
  {
    title: 'Vehicles',
    path: '/fleet-monitor',
    description: 'Manage vehicles, type classes, and cargo dimensions used by planner.',
    ready: true,
  },
  {
    title: 'Drivers',
    path: '/drivers',
    description: 'Manage drivers, track trips, and view assignment history.',
    ready: true,
  },
  {
    title: 'Trips',
    path: '/trips',
    description: 'View active/past trips and start new trips with driver + vehicle assignment.',
    ready: true,
  },
  {
    title: 'Payments',
    path: '/payments',
    description: 'Follow invoice lifecycle, overdue records, and settlement stats.',
    ready: false,
  },
  {
    title: 'Finance',
    path: '/finance',
    description: 'Track expenses, driver payroll, and profitability reports.',
    ready: true,
  },
  {
    title: 'Settings',
    path: '/settings',
    description: 'Email accounts, templates, and system configuration.',
    ready: true,
  },
];
