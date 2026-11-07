import SectionLayout from '../../components/SectionLayout'

const LINKS = [
  { to: '/staff', label: 'Trips', icon: 'bus', end: true },
  { to: '/staff/verify', label: 'Verify ticket', icon: 'scan' },
]

export default function StaffLayout() {
  return <SectionLayout label="Bus staff" links={LINKS} />
}
