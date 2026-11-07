import axios from 'axios'

// Single Axios instance; base URL and auth handling are centralized here.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api/v1' })

export const getHealth = () => api.get('/health').then((res) => res.data)

export default api
