// Crea el usuario de un empleado. Solo lo puede llamar la administradora.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: esAdmin } = await caller.rpc('is_admin')
  if (!esAdmin) return json({ error: 'Solo la administradora puede crear usuarios' }, 403)

  const { full_name, email, password } = await req.json()
  if (!full_name || !email || !password || String(password).length < 8)
    return json({ error: 'Faltan datos o la contraseña es muy corta' }, 400)

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const correo = String(email).trim().toLowerCase()
  const inv = await admin.from('staff_invites').upsert({ email: correo, full_name, role: 'empleado' })
  if (inv.error) return json({ error: inv.error.message }, 400)
  const { error } = await admin.auth.admin.createUser({ email: correo, password, email_confirm: true })
  if (error) return json({ error: error.message.includes('already') ? 'Ese correo ya tiene usuario' : error.message }, 400)
  return json({ ok: true })
})
