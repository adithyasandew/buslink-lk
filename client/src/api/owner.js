import api from './client'

const data = (p) => p.then((res) => res.data.data)

export const listBuses = () => data(api.get('/buses'))
export const createBus = (body) => data(api.post('/buses', body))
export const updateBus = (id, body) => data(api.patch(`/buses/${id}`, body))
export const deactivateBus = (id) => data(api.delete(`/buses/${id}`))

export const listStaff = () => data(api.get('/staff'))
export const createStaff = (body) => data(api.post('/staff', body))
export const assignStaff = (busId, body) => data(api.post(`/buses/${busId}/staff`, body))
export const unassignStaff = (busId, staffUserId) => data(api.delete(`/buses/${busId}/staff/${staffUserId}`))

export const listRoutes = () => data(api.get('/routes'))
export const createRoute = (body) => data(api.post('/routes', body))
export const getRoute = (id) => data(api.get(`/routes/${id}`))
export const deleteRoute = (id) => data(api.delete(`/routes/${id}`))
export const saveStops = (id, stops) => data(api.put(`/routes/${id}/stops`, { stops }))
export const assignBusToRoute = (id, busId) => data(api.post(`/routes/${id}/buses`, { busId }))

export const listSchedules = () => data(api.get('/schedules'))
export const createSchedule = (body) => data(api.post('/schedules', body))
export const deactivateSchedule = (id) => data(api.delete(`/schedules/${id}`))
export const generateTrips = (id, body) => data(api.post(`/schedules/${id}/trips`, body))
