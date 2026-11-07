import { useEffect, useState } from 'react'
import { getHealth } from '../api/client'

export default function Home() {
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    getHealth()
      .then((res) => setState({ ok: true, data: res.data }))
      .catch(() => setState({ ok: false }))
  }, [])

  return (
    <section>
      <h1 className="text-2xl font-bold">BusLink LK</h1>
      <p className="mt-2 text-muted">Private bus booking, tickets and live tracking for Sri Lanka.</p>
      <p className="mt-4" role="status">
        {state.loading && 'Checking API…'}
        {state.ok && `API status: ${state.data.status} (database ${state.data.db})`}
        {state.ok === false && 'API is unreachable. Is the server running?'}
      </p>
    </section>
  )
}
