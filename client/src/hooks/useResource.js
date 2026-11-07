import { useCallback, useEffect, useState } from 'react'

/** Load data with loading / error / reload handling and race protection. */
export default function useResource(loader) {
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState({ key: -1, data: null, error: null })

  useEffect(() => {
    let active = true
    loader()
      .then((data) => active && setResult({ key: tick, data, error: null }))
      .catch((error) => active && setResult({ key: tick, data: null, error }))
    return () => { active = false }
  }, [loader, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data: result.data, error: result.error, loading: result.key !== tick, reload }
}
