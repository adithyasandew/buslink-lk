import SectionLayout from '../../components/SectionLayout'

const LINKS = [
  { to: '/owner', label: 'Overview', icon: 'home', end: true },
  { to: '/owner/buses', label: 'Buses', icon: 'bus' },
  { to: '/owner/staff', label: 'Staff', icon: 'users' },
  { to: '/owner/routes', label: 'Routes', icon: 'route' },
  { to: '/owner/schedules', label: 'Schedules', icon: 'calendar' },
]

export default function OwnerLayout() {
  return <SectionLayout label="Bus owner" links={LINKS} />
}
