import SectionLayout from '../../components/SectionLayout'

const LINKS = [
  { to: '/admin', label: 'Overview', icon: 'home', end: true },
  { to: '/admin/buses', label: 'Buses', icon: 'shield' },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/complaints', label: 'Complaints', icon: 'flag' },
  { to: '/admin/ratings', label: 'Ratings', icon: 'star' },
]

export default function AdminLayout() {
  return <SectionLayout label="Administrator" links={LINKS} />
}
