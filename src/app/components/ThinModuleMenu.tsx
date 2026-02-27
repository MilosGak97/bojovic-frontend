import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  HandCoins,
  LogOut,
  Menu,
  Route,
  Settings,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';

type UserRole =
  | 'ADMIN'
  | 'SALES'
  | 'DISPATCH'
  | 'COLD_CALLER'
  | 'FOREMAN'
  | 'DRIVER'
  | 'HELPER';

type MainNavId = 'ROUTE_PLANNER' | 'LOAD_BOARD' | 'TRIPS' | 'FINANCE';

type NavItem = {
  id: string;
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  matchPrefixes?: string[];
  roles?: UserRole[];
};

const ROLE_STORAGE_KEY = 'bojovic_user_role';
const MORE_TOOLS_OPEN_STORAGE_KEY = 'bojovic_nav_more_tools_open';

const MAIN_NAV_ITEMS: Array<NavItem & { id: MainNavId }> = [
  { id: 'ROUTE_PLANNER', label: 'Route Planner', to: '/route-planner', icon: Route },
  {
    id: 'LOAD_BOARD',
    label: 'Load Board',
    to: '/load-board',
    icon: BriefcaseBusiness,
    matchPrefixes: ['/loads/'],
  },
  { id: 'TRIPS', label: 'Trips', to: '/trips', icon: CalendarClock },
  { id: 'FINANCE', label: 'Finance', to: '/finance', icon: Wallet },
];

const MAIN_NAV_BY_ROLE: Record<UserRole, MainNavId[]> = {
  ADMIN: ['ROUTE_PLANNER', 'LOAD_BOARD', 'TRIPS', 'FINANCE'],
  SALES: ['ROUTE_PLANNER', 'LOAD_BOARD', 'TRIPS', 'FINANCE'],
  DISPATCH: ['ROUTE_PLANNER', 'LOAD_BOARD', 'TRIPS', 'FINANCE'],
  COLD_CALLER: ['ROUTE_PLANNER', 'LOAD_BOARD', 'TRIPS', 'FINANCE'],
  FOREMAN: ['ROUTE_PLANNER', 'LOAD_BOARD', 'TRIPS', 'FINANCE'],
  DRIVER: ['ROUTE_PLANNER', 'LOAD_BOARD', 'TRIPS', 'FINANCE'],
  HELPER: ['ROUTE_PLANNER', 'LOAD_BOARD', 'TRIPS', 'FINANCE'],
};

const MORE_TOOLS_ITEMS: NavItem[] = [
  { id: 'vehicles', label: 'Vehicles', to: '/fleet-monitor', icon: Truck },
  { id: 'drivers', label: 'Drivers', to: '/drivers', icon: Users },
  { id: 'customers', label: 'Customers', to: '/broker-desk', icon: Building2 },
  { id: 'payments', label: 'Payments', to: '/payments', icon: HandCoins, roles: ['ADMIN', 'SALES', 'DISPATCH'] },
  { id: 'settings', label: 'Settings', to: '/settings', icon: Settings, roles: ['ADMIN', 'SALES', 'DISPATCH'] },
];

const ALL_ROLES: UserRole[] = ['ADMIN', 'SALES', 'DISPATCH', 'COLD_CALLER', 'FOREMAN', 'DRIVER', 'HELPER'];

const isUserRole = (value: string | null): value is UserRole =>
  Boolean(value && ALL_ROLES.includes(value as UserRole));

const getInitialRole = (): UserRole => {
  if (typeof window === 'undefined') return 'ADMIN';
  const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
  if (isUserRole(stored)) return stored;
  return 'ADMIN';
};

const getInitialMoreToolsOpen = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(MORE_TOOLS_OPEN_STORAGE_KEY);
  return stored === '1';
};

const isItemActive = (pathname: string, item: NavItem): boolean => {
  if (pathname === item.to) return true;
  if (!item.matchPrefixes) return false;
  return item.matchPrefixes.some((prefix) => pathname.startsWith(prefix));
};

type NavigationBlockProps = {
  pathname: string;
  items: NavItem[];
  onNavigate?: () => void;
};

function NavigationBlock({ pathname, items, onNavigate }: NavigationBlockProps) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const isActive = isItemActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            to={item.to}
            onClick={onNavigate}
            className={`group flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white text-slate-900'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function ThinModuleMenu() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMoreToolsOpen, setIsMoreToolsOpen] = useState(getInitialMoreToolsOpen);
  const [activeRole, setActiveRole] = useState<UserRole>(getInitialRole);

  useEffect(() => {
    document.body.classList.add('app-shell-sidebar-layout');
    return () => {
      document.body.classList.remove('app-shell-sidebar-layout');
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleFromQuery = params.get('role');
    if (isUserRole(roleFromQuery)) {
      setActiveRole(roleFromQuery);
      window.localStorage.setItem(ROLE_STORAGE_KEY, roleFromQuery);
    }
  }, [location.search]);

  useEffect(() => {
    window.localStorage.setItem(
      MORE_TOOLS_OPEN_STORAGE_KEY,
      isMoreToolsOpen ? '1' : '0',
    );
  }, [isMoreToolsOpen]);

  const visibleMainItems = useMemo(() => {
    const allowed = new Set(MAIN_NAV_BY_ROLE[activeRole]);
    return MAIN_NAV_ITEMS.filter((item) => allowed.has(item.id));
  }, [activeRole]);

  const visibleMoreTools = useMemo(
    () =>
      MORE_TOOLS_ITEMS.filter(
        (item) => !item.roles || item.roles.includes(activeRole),
      ),
    [activeRole],
  );

  const currentMainLabel = useMemo(
    () =>
      visibleMainItems.find((item) => isItemActive(location.pathname, item))?.label ?? 'Navigation',
    [location.pathname, visibleMainItems],
  );

  const handleSignOut = () => {
    setMobileOpen(false);
    navigate('/');
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-800 bg-slate-950 text-slate-100 md:flex md:flex-col">
        <div className="border-b border-slate-800 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Bojovic
          </p>
          <p className="mt-1 text-sm font-semibold text-white">Operations Suite</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Main</p>
          <NavigationBlock pathname={location.pathname} items={visibleMainItems} />

          {visibleMoreTools.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setIsMoreToolsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>More tools</span>
                {isMoreToolsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>

              {isMoreToolsOpen && (
                <div className="mt-1">
                  <NavigationBlock pathname={location.pathname} items={visibleMoreTools} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex h-11 items-center justify-between border-b border-slate-200 bg-white px-3 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <Menu className="h-4 w-4" />
              Menu
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-xs border-r border-slate-800 bg-slate-950 p-0 text-slate-100">
            <SheetHeader className="border-b border-slate-800 p-4">
              <SheetTitle className="text-left text-sm font-semibold text-white">Navigation</SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Main</p>
              <NavigationBlock pathname={location.pathname} items={visibleMainItems} onNavigate={() => setMobileOpen(false)} />

              {visibleMoreTools.length > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setIsMoreToolsOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
                  >
                    <span>More tools</span>
                    {isMoreToolsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {isMoreToolsOpen && (
                    <div className="mt-1">
                      <NavigationBlock pathname={location.pathname} items={visibleMoreTools} onNavigate={() => setMobileOpen(false)} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <SheetFooter className="border-t border-slate-800 p-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <p className="truncate text-xs font-semibold text-slate-700">{currentMainLabel}</p>
      </div>
    </>
  );
}
