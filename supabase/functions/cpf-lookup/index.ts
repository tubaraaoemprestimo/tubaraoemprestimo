import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
        const { cpf, api_key } = await req.json()

        if (!cpf || !api_key) {
            return new Response(
                JSON.stringify({ error: 'CPF e api_key são obrigatórios' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Limpar CPF
        const cleanCpf = cpf.replace(/\D/g, '')

        // Chamar API CPF (apicpf.com)
        const response = await fetch(
            `https://apicpf.com/api/consulta?cpf=${cleanCpf}&api_key=${api_key}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }
        )

        const data = await response.json()

        console.log('[cpf-lookup] Response:', data)

        return new Response(
            JSON.stringify(data),
            {
                status: response.ok ? 200 : response.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('[cpf-lookup] Error:', error)
        return new Response(
            JSON.stringify({ error: 'Erro ao consultar CPF', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
