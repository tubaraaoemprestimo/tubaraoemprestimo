// Supabase Edge Function: infoseek-proxy
// Proxy para API InfoSeek evitar CORS

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const INFOSEEK_API_KEY = 'sk_prod_2de8b4cfd0dd8d3c6f575750759b9160bf13dc4806bc85d8a697421dd0e2d4ec'
const INFOSEEK_BASE_URL = 'https://api.infoseekdata.com.br/api'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, value } = await req.json()

    if (!type || !value) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetros inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar tipo
    if (type !== 'cpf' && type !== 'cnpj') {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo deve ser "cpf" ou "cnpj"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[InfoSeek Proxy] Validando ${type.toUpperCase()}:`, value)

    // Chamar API InfoSeek
    const endpoint = `${INFOSEEK_BASE_URL}/validate/${type}`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INFOSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    })

    const data = await response.json()

    console.log(`[InfoSeek Proxy] Resposta ${type.toUpperCase()}:`, data)

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: data.message || `Erro ${response.status}: ${response.statusText}`
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Retornar resposta da InfoSeek
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[InfoSeek Proxy] Erro:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao conectar com a API InfoSeek'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
