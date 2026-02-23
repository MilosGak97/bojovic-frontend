
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import App from './app/App.tsx';
import FleetMonitorPage from './app/FleetMonitorPage.tsx';
import FinancePage from './app/FinancePage.tsx';
import HomePage from './app/HomePage.tsx';
import LoadDetailPage from './app/LoadDetailPage.tsx';
import LoadBoardPage from './app/LoadBoardPage.tsx';
import ModulePlaceholderPage from './app/ModulePlaceholderPage.tsx';
import { dashboardModules } from './app/modules';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/route-planner" element={<App />} />
      <Route path="/load-board" element={<LoadBoardPage />} />
      <Route path="/loads/:loadId" element={<LoadDetailPage />} />
      <Route path="/fleet-monitor" element={<FleetMonitorPage />} />
      <Route path="/finance" element={<FinancePage />} />
      {dashboardModules
        .filter((module) => !module.ready)
        .map((module) => (
          <Route
            key={module.path}
            path={module.path}
            element={<ModulePlaceholderPage module={module} />}
          />
        ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>,
);
  
