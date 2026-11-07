import api from './client'

const data = (p) => p.then((res) => res.data.data)

export const listAssignedTrips = () => data(api.get('/staff/trips'))
export const verifyTicket = (qrToken) => data(api.post('/tickets/verify', { qrToken }))
