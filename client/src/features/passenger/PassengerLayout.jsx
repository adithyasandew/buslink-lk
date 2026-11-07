import SectionLayout from '../../components/SectionLayout'

const LINKS = [
  { to: '/passenger', label: 'Search', icon: 'search', end: true },
  { to: '/passenger/bookings', label: 'My trips', icon: 'ticket' },
  { to: '/passenger/notifications', label: 'Alerts', icon: 'bell' },
]

export default function PassengerLayout() {
  return <SectionLayout label="Passenger" links={LINKS} />
}
