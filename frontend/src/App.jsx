import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Bell, ClipboardList, Home, IndianRupee, MapPinned, Settings, Star, UserRound, Wrench,
  LayoutDashboard, Users, Briefcase, Tags, BadgePercent, Wallet, BarChart3, Map, MessageSquare,
} from 'lucide-react';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { useAuth } from './context/AuthContext';
import { FullScreenLoader } from './components/Loading';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import BookingPage from './pages/BookingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TechnicianRegisterPage from './pages/TechnicianRegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import CustomerHome from './dashboards/customer/CustomerHome';
import CustomerOrders from './dashboards/customer/CustomerOrders';
import CustomerOrderDetail from './dashboards/customer/CustomerOrderDetail';
import CustomerTrack from './dashboards/customer/CustomerTrack';
import { CustomerAddresses, CustomerNotifications, CustomerPayments, CustomerProfile, CustomerReviews, CustomerSettings } from './dashboards/customer/CustomerExtras';
import TechHome from './dashboards/technician/TechHome';
import TechOrders from './dashboards/technician/TechOrders';
import TechOrderDetail from './dashboards/technician/TechOrderDetail';
import TechReports from './dashboards/technician/TechReports';
import { TechAvailability, TechCustomers, TechEarnings, TechIncentives, TechNotifications, TechPayments, TechProfile, TechSettings } from './dashboards/technician/TechExtras';
import AdminHome from './dashboards/admin/AdminHome';
import AdminOrders from './dashboards/admin/AdminOrders';
import AdminOrderDetail from './dashboards/admin/AdminOrderDetail';
import {
  AdminCategories, AdminCustomerDetail, AdminCustomers, AdminIncentives, AdminLocations, AdminMap,
  AdminNotifications, AdminPayments, AdminPricing, AdminProfile, AdminReports, AdminReviews, AdminSales,
  AdminServices, AdminSettings, AdminTechnicianDetail, AdminTechnicians,
} from './dashboards/admin/AdminManage';

function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader label="Checking your session..." />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

const customerNav = [
  { to: '/customer', label: 'Dashboard', short: 'Home', icon: Home, end: true },
  { to: '/customer/profile', label: 'My Profile', short: 'Profile', icon: UserRound },
  { to: '/customer/orders', label: 'My Orders', short: 'Orders', icon: ClipboardList },
  { to: '/customer/payments', label: 'Payments', short: 'Payments', icon: IndianRupee },
  { to: '/customer/addresses', label: 'Addresses', icon: MapPinned },
  { to: '/customer/track', label: 'Track Technician', short: 'Track', icon: MapPinned },
  { to: '/customer/notifications', label: 'Notifications', icon: Bell },
  { to: '/customer/reviews', label: 'Reviews', icon: Star },
  { to: '/customer/settings', label: 'Settings', icon: Settings },
];

const customerMobile = [
  customerNav[0], customerNav[2], customerNav[5], customerNav[3], customerNav[1],
];

const techNav = [
  { to: '/technician', label: 'Dashboard', short: 'Home', icon: Home, end: true },
  { to: '/technician/orders', label: 'My Orders', short: 'Jobs', icon: Wrench },
  { to: '/technician/orders?bucket=active', label: 'Active Jobs', icon: Wrench },
  { to: '/technician/orders?bucket=completed', label: 'Completed Jobs', icon: Wrench },
  { to: '/technician/payments', label: 'Payments', icon: Wallet },
  { to: '/technician/earnings', label: 'Earnings', short: 'Earnings', icon: IndianRupee },
  { to: '/technician/incentives', label: 'Incentives', icon: BadgePercent },
  { to: '/technician/reports', label: 'Sales Reports', short: 'Reports', icon: BarChart3 },
  { to: '/technician/customers', label: 'Customers', icon: Users },
  { to: '/technician/profile', label: 'Profile', short: 'Profile', icon: UserRound },
  { to: '/technician/availability', label: 'Availability', icon: Briefcase },
  { to: '/technician/notifications', label: 'Notifications', icon: Bell },
  { to: '/technician/settings', label: 'Settings', icon: Settings },
];

const adminNav = [
  { to: '/admin', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', short: 'Orders', icon: ClipboardList },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/technicians', label: 'Technicians', short: 'Techs', icon: Wrench },
  { to: '/admin/services', label: 'Services', icon: Briefcase },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
  { to: '/admin/pricing', label: 'Technician Pricing', short: 'Pricing', icon: BadgePercent },
  { to: '/admin/incentives', label: 'Incentives', icon: BadgePercent },
  { to: '/admin/payments', label: 'Payments', icon: Wallet },
  { to: '/admin/sales', label: 'Sales', icon: BarChart3 },
  { to: '/admin/reports', label: 'Reports', short: 'Reports', icon: BarChart3 },
  { to: '/admin/map', label: 'Live Map', short: 'Map', icon: Map },
  { to: '/admin/locations', label: 'Locations', icon: MapPinned },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/reviews', label: 'Reviews', icon: MessageSquare },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/profile', label: 'Admin Profile', icon: UserRound },
];

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:slug" element={<ServiceDetailPage />} />
        <Route path="/book/:slug" element={<BookingPage />} />
        <Route path="/technician/register" element={<TechnicianRegisterPage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/customer" element={<RequireAuth role="CUSTOMER"><DashboardLayout items={customerNav} mobileItems={customerMobile} accent="customer" /></RequireAuth>}>
        <Route index element={<CustomerHome />} />
        <Route path="profile" element={<CustomerProfile />} />
        <Route path="orders" element={<CustomerOrders />} />
        <Route path="orders/:id" element={<CustomerOrderDetail />} />
        <Route path="track" element={<CustomerTrack />} />
        <Route path="track/:id" element={<CustomerTrack />} />
        <Route path="payments" element={<CustomerPayments />} />
        <Route path="addresses" element={<CustomerAddresses />} />
        <Route path="notifications" element={<CustomerNotifications />} />
        <Route path="reviews" element={<CustomerReviews />} />
        <Route path="settings" element={<CustomerSettings />} />
      </Route>

      <Route path="/technician" element={<RequireAuth role="TECHNICIAN"><DashboardLayout items={techNav} mobileItems={[techNav[0], techNav[1], techNav[5], techNav[7], techNav[9]]} accent="technician" /></RequireAuth>}>
        <Route index element={<TechHome />} />
        <Route path="orders" element={<TechOrders />} />
        <Route path="orders/:id" element={<TechOrderDetail />} />
        <Route path="payments" element={<TechPayments />} />
        <Route path="earnings" element={<TechEarnings />} />
        <Route path="incentives" element={<TechIncentives />} />
        <Route path="reports" element={<TechReports />} />
        <Route path="customers" element={<TechCustomers />} />
        <Route path="profile" element={<TechProfile />} />
        <Route path="availability" element={<TechAvailability />} />
        <Route path="notifications" element={<TechNotifications />} />
        <Route path="settings" element={<TechSettings />} />
      </Route>

      <Route path="/admin" element={<RequireAuth role="ADMIN"><DashboardLayout items={adminNav} mobileItems={[adminNav[0], adminNav[1], adminNav[3], adminNav[11], adminNav[10]]} accent="admin" /></RequireAuth>}>
        <Route index element={<AdminHome />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="customers/:id" element={<AdminCustomerDetail />} />
        <Route path="technicians" element={<AdminTechnicians />} />
        <Route path="technicians/:id" element={<AdminTechnicianDetail />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="pricing" element={<AdminPricing />} />
        <Route path="incentives" element={<AdminIncentives />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="sales" element={<AdminSales />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="map" element={<AdminMap />} />
        <Route path="locations" element={<AdminLocations />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
