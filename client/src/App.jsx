import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './HomePage.jsx';
import RegistrationWizard from './RegistrationWizard.jsx';
import AdminLogin from './admin/AdminLogin.jsx';
import AdminLayout, { ScreenGuard } from './admin/AdminLayout.jsx';
import Overview from './admin/Overview.jsx';
import ApplicationDetail from './admin/ApplicationDetail.jsx';
import { MembersPage, ApprovalsPage, PaymentsPage, EventsPage } from './admin/ListPages.jsx';
import ReceiptsPage from './admin/ReceiptsPage.jsx';
import UsersPage from './admin/UsersPage.jsx';
import SettingsPage from './admin/SettingsPage.jsx';
import FormBuilder from './admin/FormBuilder.jsx';

function PublicHeader() {
  const { pathname } = useLocation();
  if (!pathname.startsWith('/register')) return null;
  return (
    <header className="site-header no-print">
      <div className="wrap">
        <Link to="/" className="logo-chip" title="Back to home">
          <img src="/api/logo" alt="REACH Pravasi Welfare Society" />
        </Link>
        <div className="spacer" />
        <Link className="admin-link" to="/">Home</Link>
        <Link className="admin-link" to="/admin">Admin</Link>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PublicHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegistrationWizard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route element={<ScreenGuard screen="overview" />}>
            <Route index element={<Overview />} />
          </Route>
          <Route element={<ScreenGuard screen="members" />}>
            <Route path="members" element={<MembersPage />} />
            <Route path="applications/:id" element={<ApplicationDetail />} />
          </Route>
          <Route element={<ScreenGuard screen="approvals" />}>
            <Route path="approvals" element={<ApprovalsPage />} />
          </Route>
          <Route element={<ScreenGuard screen="payments" />}>
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="receipts" element={<ReceiptsPage />} />
          </Route>
          <Route element={<ScreenGuard screen="events" />}>
            <Route path="events" element={<EventsPage />} />
          </Route>
          <Route element={<ScreenGuard screen="form" />}>
            <Route path="form-builder" element={<FormBuilder />} />
          </Route>
          <Route element={<ScreenGuard screen="users" />}>
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route element={<ScreenGuard screen="settings" />}>
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
