import api from './client'

const data = (p) => p.then((res) => res.data.data)

export const listAssignedTrips = () => data(api.get('/staff/trips'))
export const startTrip = (id) => data(api.post(`/trips/${id}/start`))
export const endTrip = (id) => data(api.post(`/trips/${id}/end`))
export const sendLocation = (id, point) => data(api.post(`/trips/${id}/location`, point))
export const verifyTicket = (qrToken) => data(api.post('/tickets/verify', { qrToken }))
