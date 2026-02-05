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
        const { cpf, rapidapi_key } = await req.json()

        if (!cpf || !rapidapi_key) {
            return new Response(
                JSON.stringify({ error: 'CPF e rapidapi_key são obrigatórios' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Limpar CPF
        const cleanCpf = cpf.replace(/\D/g, '')

        console.log('[cpf-lookup] Consultando CPF via RapidAPI CPF DataPro:', cleanCpf)

        // Chamar RapidAPI CPF DataPro
        const response = await fetch(
            `https://cpf-datapro1.p.rapidapi.com/api-cpf.php?cpf=${cleanCpf}`,
            {
                method: 'GET',
                headers: {
                    'x-rapidapi-host': 'cpf-datapro1.p.rapidapi.com',
                    'x-rapidapi-key': rapidapi_key
                }
            }
        )

        console.log('[cpf-lookup] RapidAPI response status:', response.status)

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[cpf-lookup] RapidAPI error:', errorText)

            if (response.status === 401 || response.status === 403) {
                return new Response(
                    JSON.stringify({ error: 'Chave da RapidAPI inválida ou sem acesso.' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            return new Response(
                JSON.stringify({ error: `Erro na RapidAPI: ${response.status}`, details: errorText }),
                { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const data = await response.json()
        console.log('[cpf-lookup] RapidAPI result:', JSON.stringify(data))

        // Verificar se retornou dados
        if (!data || data.error || data.status === false) {
            return new Response(
                JSON.stringify({ error: data.message || data.error || 'CPF não encontrado.' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ success: true, data }),
            {
                status: 200,
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
