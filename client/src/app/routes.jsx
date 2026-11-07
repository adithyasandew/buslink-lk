import { Route, Routes } from 'react-router-dom'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import Home from '../pages/Home'
import Login from '../pages/Login'
import {
  AdminDashboard, Forbidden, NotFoundPage, PassengerDashboard, StaffDashboard,
} from '../pages/Placeholders'
import OwnerLayout from '../features/owner/OwnerLayout'
import OwnerDashboard from '../features/owner/Dashboard'
import BusesPage from '../features/owner/BusesPage'
import StaffPage from '../features/owner/StaffPage'
import RoutesPage from '../features/owner/RoutesPage'
import RouteDetailPage from '../features/owner/RouteDetailPage'
import SchedulesPage from '../features/owner/SchedulesPage'

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="forbidden" element={<Forbidden />} />
        <Route element={<ProtectedRoute roles={['passenger']} />}>
          <Route path="passenger" element={<PassengerDashboard />} />
        </Route>
        <Route element={<ProtectedRoute roles={['owner']} />}>
          <Route path="owner" element={<OwnerLayout />}>
            <Route index element={<OwnerDashboard />} />
            <Route path="buses" element={<BusesPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="routes/:id" element={<RouteDetailPage />} />
            <Route path="schedules" element={<SchedulesPage />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute roles={['staff']} />}>
          <Route path="staff" element={<StaffDashboard />} />
        </Route>
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="admin" element={<AdminDashboard />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
