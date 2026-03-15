import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import './index.css';

import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import MachinesPage from './pages/MachinesPage';
import MaintenancePage from './pages/MaintenancePage';
import InventoryPage from './pages/InventoryPage';
import QualityPage from './pages/QualityPage';
import CameraPage from './pages/CameraPage';
import JobsPage from './pages/JobsPage';
import SuppliersPage from './pages/SuppliersPage';
import OrdersPage from './pages/OrdersPage';
import LedgerPage from './pages/LedgerPage';
import EnergyPage from './pages/EnergyPage';
import PaymentsPage from './pages/PaymentsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';

function PrivateRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="machines" element={<MachinesPage />} />
              <Route path="maintenance" element={<MaintenancePage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="quality" element={<QualityPage />} />
              <Route path="camera" element={<CameraPage />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="ledger" element={<LedgerPage />} />
              <Route path="energy" element={<EnergyPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="users" element={<PrivateRoute roles={['admin']}><UsersPage /></PrivateRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
