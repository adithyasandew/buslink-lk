import api from './client'

const data = (p) => p.then((res) => res.data.data)

export const searchTrips = (params) => data(api.get('/trips/search', { params }))
export const getTrip = (id) => data(api.get(`/trips/${id}`))

export const createBooking = (body) => data(api.post('/bookings', body))
export const listBookings = () => data(api.get('/bookings'))
export const getBooking = (id) => data(api.get(`/bookings/${id}`))
export const cancelBooking = (id) => data(api.post(`/bookings/${id}/cancel`))
export const setPickupPoint = (id, body) => data(api.post(`/bookings/${id}/pickup-point`, body))

export const payBooking = (body) => data(api.post('/payments', body))
export const getTicket = (id) => data(api.get(`/tickets/${id}`))
export const getTripLocation = (tripId) => data(api.get(`/trips/${tripId}/location`))

export const listNotifications = () => data(api.get('/notifications'))
export const markNotificationRead = (id) => data(api.patch(`/notifications/${id}/read`))
