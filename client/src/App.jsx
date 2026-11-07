import { useEffect, useState } from 'react'
import { getHealth } from './api/client'

export default function App() {
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    getHealth()
      .then((res) => setState({ ok: true, data: res.data }))
      .catch(() => setState({ ok: false }))
  }, [])

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-bold">BusLink LK</h1>
      <p className="mt-2" role="status">
        {state.loading && 'Checking API…'}
        {state.ok && `API status: ${state.data.status} (database ${state.data.db})`}
        {state.ok === false && 'API is unreachable. Is the server running?'}
      </p>
    </main>
  )
}
