// Supabase Edge Function para deletar usuários do Auth
// Deploy: npx supabase functions deploy delete-user --project-ref cwhiujeragsethxjekkb

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
            throw new Error('Only admins can delete users')
        }

        // Get request body
        const { userId, authId, email } = await req.json()

        if (!authId && !email) {
            throw new Error('Missing required fields: authId or email')
        }

        let targetAuthId = authId

        // Se não tem authId mas tem email, buscar o authId
        if (!targetAuthId && email) {
            const { data: targetUser } = await supabaseAdmin
                .from('users')
                .select('auth_id')
                .eq('email', email)
                .single()

            targetAuthId = targetUser?.auth_id
        }

        // 1. Deletar customer associado (se existir)
        if (email) {
            const { error: customerError } = await supabaseAdmin
                .from('customers')
                .delete()
                .eq('email', email)

            if (customerError) {
                console.log('No customer to delete or error:', customerError)
            }
        }

        // 2. Deletar da tabela users
        if (userId) {
            const { error: userError } = await supabaseAdmin
                .from('users')
                .delete()
                .eq('id', userId)

            if (userError) {
                console.log('Error deleting from users:', userError)
            }
        } else if (email) {
            const { error: userError } = await supabaseAdmin
                .from('users')
                .delete()
                .eq('email', email)

            if (userError) {
                console.log('Error deleting from users:', userError)
            }
        }

        // 3. Deletar do Auth
        if (targetAuthId) {
            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetAuthId)

            if (authError) {
                console.error('Error deleting from Auth:', authError)
                // Mesmo se falhar no auth, consideramos sucesso parcial
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'User deleted successfully'
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
