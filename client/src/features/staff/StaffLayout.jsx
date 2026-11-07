import SectionLayout from '../../components/SectionLayout'

const LINKS = [{ to: '/staff', label: 'Verify ticket', icon: 'scan', end: true }]

export default function StaffLayout() {
  return <SectionLayout label="Bus staff" links={LINKS} />
}
