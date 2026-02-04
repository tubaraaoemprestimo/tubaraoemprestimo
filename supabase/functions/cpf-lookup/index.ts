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
        const { cpf, api_key, provider } = await req.json()

        if (!cpf || !api_key) {
            return new Response(
                JSON.stringify({ error: 'CPF e api_key são obrigatórios' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Limpar CPF
        const cleanCpf = cpf.replace(/\D/g, '')

        let response
        let data

        // Selecionar provedor de API
        if (provider === 'hubdev') {
            // Hub do Desenvolvedor - https://hubdodesenvolvedor.com.br
            console.log('[cpf-lookup] Using Hub do Desenvolvedor')
            response = await fetch(
                `https://ws.hubdodesenvolvedor.com.br/v2/cpf/?cpf=${cleanCpf}&token=${api_key}`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                }
            )
            data = await response.json()

            // Normalizar resposta do Hub Dev
            if (data.status === true && data.result) {
                data = {
                    code: 200,
                    data: {
                        cpf: data.result.numero_de_cpf || cleanCpf,
                        nome: data.result.nome_da_pf,
                        data_nascimento: data.result.data_nascimento,
                        situacao: data.result.situacao_cadastral,
                        data_inscricao: data.result.data_inscricao,
                        digito_verificador: data.result.digito_verificador
                    }
                }
            }
        } else {
            // API CPF (padrão) - https://apicpf.com
            console.log('[cpf-lookup] Using API CPF (default)')
            response = await fetch(
                `https://apicpf.com/api/consulta?cpf=${cleanCpf}&api_key=${api_key}`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                }
            )
            data = await response.json()
        }

        console.log('[cpf-lookup] Response:', JSON.stringify(data))

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
