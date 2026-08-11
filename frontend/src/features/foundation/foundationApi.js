export async function fetchLocations() {
  const res = await fetch('/api/foundation/locations')
  const data = await res.json()
  if (!data.ok) {
    throw new Error(data.error || 'Unknown error')
  }
  return data.data
}
