import axios from 'axios'

const TOKEN_KEY = 'buslink.token'
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

// Single Axios instance; base URL, auth header and error normalization live here.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api/v1' })

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Turn any failure into { code, message, details, status } per docs/api/ERROR_FORMAT.md */
export function normalizeError(err) {
  const apiError = err?.response?.data?.error
  return {
    status: err?.response?.status ?? 0,
    code: apiError?.code ?? (err?.response ? 'INTERNAL_ERROR' : 'NETWORK_ERROR'),
    message: apiError?.message ?? 'Something went wrong. Please try again.',
    details: apiError?.details ?? [],
  }
}

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(normalizeError(err)),
)

export const getHealth = () => api.get('/health').then((res) => res.data)
export const login = (body) => api.post('/auth/login', body).then((res) => res.data.data)
export const register = (body) => api.post('/auth/register', body).then((res) => res.data.data)
export const getMe = () => api.get('/auth/me').then((res) => res.data.data)

export default api
