import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const amount = Number(body.amount);
    const observation = String(body.observation || '').slice(0, 180);
    if (!Number.isFinite(amount) || amount < 5) return json({ error: 'O valor mínimo do Pix é R$ 5,00.' }, 400);
    const token = Deno.env.get('DOMINIPAY_TOKEN');
    if (!token) return json({ error: 'DOMINIPAY_TOKEN não configurado.' }, 500);
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/dominipay-webhook`;
    const response = await fetch('https://public-api-prod.dominipay.com.br/api-public/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, observation, webhookUrl })
    });
    const data = await response.json();
    return json(data, response.status);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Não foi possível criar o Pix.' }, 500);
  }
});
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
