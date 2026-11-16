// Deploy: npx supabase functions deploy delete-account
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are Supabase-managed secrets.
import { createClient } from 'npm:@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return respond(405, 'Method not allowed');
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, 'Unauthorized');
  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user) return respond(401, 'Unauthorized');
  const { data: files, error: pathsError } = await caller.rpc('account_storage_paths');
  if (pathsError) return respond(500, 'Cannot enumerate account media');
  for (const bucket of ['portfolio', 'chat-images']) {
    const paths = (files || []).filter((f: { bucket_id: string }) => f.bucket_id === bucket).map((f: { name: string }) => f.name);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) return respond(500, 'Cannot delete account media. Please retry.');
    }
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return respond(500, 'Cannot delete account. Please retry.');
  return respond(200, 'Account deleted');
});
