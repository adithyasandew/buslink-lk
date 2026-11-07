import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Loading } from '../components/ui/States'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import Home from '../pages/Home'
import Login from '../pages/Login'
import { AdminDashboard, Forbidden, NotFoundPage } from '../pages/Placeholders'
import PassengerLayout from '../features/passenger/PassengerLayout'
import SearchPage from '../features/passenger/SearchPage'
import TripPage from '../features/passenger/TripPage'
import BookingsPage from '../features/passenger/BookingsPage'
import BookingDetailPage from '../features/passenger/BookingDetailPage'
import NotificationsPage from '../features/passenger/NotificationsPage'
import StaffLayout from '../features/staff/StaffLayout'

// Heavy screens (QR library, Leaflet map, socket client, camera scanner) load on demand.
const TicketPage = lazy(() => import('../features/passenger/TicketPage'))
const TrackPage = lazy(() => import('../features/passenger/TrackPage'))
const VerifyTicketPage = lazy(() => import('../features/staff/VerifyTicketPage'))
const page = (el) => <Suspense fallback={<Loading />}>{el}</Suspense>
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
          <Route path="passenger" element={<PassengerLayout />}>
            <Route index element={<SearchPage />} />
            <Route path="trips/:id" element={<TripPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="bookings/:id" element={<BookingDetailPage />} />
            <Route path="bookings/:id/track" element={page(<TrackPage />)} />
            <Route path="tickets/:id" element={page(<TicketPage />)} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
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
          <Route path="staff" element={<StaffLayout />}>
            <Route index element={page(<VerifyTicketPage />)} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="admin" element={<AdminDashboard />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
