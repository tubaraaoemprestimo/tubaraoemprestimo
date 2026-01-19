// Supabase Edge Function para criar usuários como admin
// Deploy: npx supabase functions deploy create-user

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get the authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing authorization header')
        }

        // Create Supabase client with service role key
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // Verify the requesting user is an admin
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: { headers: { Authorization: authHeader } },
                auth: { persistSession: false }
            }
        )

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) {
            throw new Error('User not authenticated')
        }

        // Check if user is admin
        const { data: userData } = await supabaseClient
            .from('users')
            .select('role')
            .eq('auth_id', user.id)
            .single()

        if (userData?.role !== 'ADMIN') {
            throw new Error('Only admins can create users')
        }

        // Get request body
        const { email, password, name, role = 'CLIENT', cpf, phone } = await req.json()

        if (!email || !password || !name) {
            throw new Error('Missing required fields: email, password, name')
        }

        // Create user with admin API (bypasses email confirmation)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Automatically confirm email
            user_metadata: { name, role }
        })

        if (authError) {
            throw authError
        }

        // Create user profile in users table
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                auth_id: authData.user.id,
                name,
                email,
                role
            })
            .select('id')
            .single()

        if (profileError) {
            console.error('Profile error:', profileError)
            // User was created in Auth, but profile failed - still return success
        }

        // Se for CLIENT, criar registro na tabela customers também
        if (role === 'CLIENT' && userProfile) {
            // Gerar CPF único se não fornecido
            const customerCpf = cpf || `TEMP-${Date.now()}`

            const { error: customerError } = await supabaseAdmin
                .from('customers')
                .insert({
                    user_id: userProfile.id,
                    name,
                    cpf: customerCpf,
                    email,
                    phone: phone || '',
                    status: 'ACTIVE',
                    internal_score: 500,
                    total_debt: 0,
                    active_loans_count: 0
                })

            if (customerError) {
                console.error('Customer creation error:', customerError)
            } else {
                console.log('Customer created successfully for:', email)
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: authData.user.id,
                    email,
                    name,
                    role
                }
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        )
    }
})
