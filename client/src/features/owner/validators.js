export function validateBus({ registrationNumber, capacity }) {
  const errors = {}
  const reg = registrationNumber.trim()
  if (reg.length < 3 || reg.length > 20) errors.registrationNumber = 'Enter 3 to 20 characters, e.g. NB-1234'
  const n = Number(capacity)
  if (!Number.isInteger(n) || n < 1 || n > 100) errors.capacity = 'Enter a whole number of seats from 1 to 100'
  return errors
}

export function validateStaff({ name, email, password }) {
  const errors = {}
  if (name.trim().length < 2) errors.name = 'Enter the staff member’s full name'
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email address'
  if (password.length < 8) errors.password = 'Use at least 8 characters'
  return errors
}

export function validateRoute({ name, startPoint, destination }) {
  const errors = {}
  if (name.trim().length < 2) errors.name = 'Enter a route name, e.g. Colombo – Kandy'
  if (startPoint.trim().length < 2) errors.startPoint = 'Enter the starting point'
  if (destination.trim().length < 2) errors.destination = 'Enter the destination'
  return errors
}

/** stops: [{ name, lat, lng, fareFromStart }] as strings from the form. Returns { rowIndex: { field: message } } plus _form. */
export function validateStops(stops) {
  const errors = {}
  const set = (i, f, m) => { errors[i] = { ...(errors[i] ?? {}), [f]: m } }
  if (stops.length < 2) errors._form = 'A route needs at least two stops'
  let lastFare = -Infinity
  stops.forEach((s, i) => {
    if (!s.name.trim()) set(i, 'name', 'Enter the stop name')
    const lat = Number(s.lat), lng = Number(s.lng), fare = Number(s.fareFromStart)
    if (s.lat === '' || Number.isNaN(lat) || lat < -90 || lat > 90) set(i, 'lat', 'Latitude from -90 to 90')
    if (s.lng === '' || Number.isNaN(lng) || lng < -180 || lng > 180) set(i, 'lng', 'Longitude from -180 to 180')
    if (s.fareFromStart === '' || Number.isNaN(fare) || fare < 0) set(i, 'fareFromStart', 'Enter a fare of 0 or more')
    else if (fare < lastFare) set(i, 'fareFromStart', 'Fare cannot be lower than the previous stop')
    else lastFare = fare
  })
  return errors
}

export function validateSchedule({ busId, routeId, departureTime, arrivalTime, operatingDays }) {
  const errors = {}
  if (!busId) errors.busId = 'Choose a bus'
  if (!routeId) errors.routeId = 'Choose a route'
  if (!departureTime) errors.departureTime = 'Set a departure time'
  if (!arrivalTime) errors.arrivalTime = 'Set an arrival time'
  if (operatingDays.length === 0) errors.operatingDays = 'Choose at least one operating day'
  return errors
}
