import api from './client'

const data = (p) => p.then((res) => res.data.data)
/** For list endpoints that also return pagination/summary meta. */
const withMeta = (p) => p.then((res) => ({ items: res.data.data, meta: res.data.meta }))

export const getOverview = () => data(api.get('/admin/overview'))
export const listUsers = (params) => withMeta(api.get('/users', { params }))
export const updateUser = (id, body) => data(api.patch(`/users/${id}`, body))
export const verifyOwner = (id, verified) => data(api.patch(`/owners/${id}/verify`, { verified }))
export const listAllBuses = (params) => withMeta(api.get('/admin/buses', { params }))
export const verifyBus = (id, verified) => data(api.patch(`/buses/${id}/verify`, { verified }))
export const listComplaints = (params) => data(api.get('/complaints', { params }))
export const updateComplaint = (id, status) => data(api.patch(`/complaints/${id}`, { status }))
export const listRatings = () => withMeta(api.get('/feedback'))
