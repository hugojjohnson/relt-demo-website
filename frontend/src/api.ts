const endpoint = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:8000/graphql/'
let csrf = ''
// Django rotates the CSRF token when a user logs in. Clear the cached token so
// the first authenticated request obtains and sends the new one.
export function refreshCsrf() { csrf = '' }
async function getCsrf() { if (!csrf) csrf = (await fetch(endpoint.replace('/graphql/', '/csrf/'), {credentials:'include'}).then(r=>r.json())).csrfToken; return csrf }
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = await getCsrf()
  const response = await fetch(endpoint, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json','X-CSRFToken':token}, body:JSON.stringify({query, variables}) })
  const json = await response.json()
  if (json.errors) throw new Error(json.errors.map((x:{message:string})=>x.message).join('\n'))
  return json.data

}
