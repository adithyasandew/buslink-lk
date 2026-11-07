export const ROLE_HOME = {
  passenger: '/passenger',
  owner: '/owner',
  staff: '/staff',
  admin: '/admin',
}

export const homeFor = (user) => (user ? ROLE_HOME[user.role] ?? '/' : '/login')
