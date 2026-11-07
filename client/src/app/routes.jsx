import { Route, Routes } from 'react-router-dom'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import Home from '../pages/Home'
import Login from '../pages/Login'
import {
  AdminDashboard, Forbidden, NotFoundPage, OwnerDashboard, PassengerDashboard, StaffDashboard,
} from '../pages/Placeholders'

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
          <Route path="owner" element={<OwnerDashboard />} />
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
