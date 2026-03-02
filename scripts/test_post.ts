
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Ler .env manualmente
const envPath = path.join(process.cwd(), '.env');
let env: any = {};
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) env[key.trim()] = value.trim();
    });
}

const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
// Tentar Service Role se tiver
const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

console.log(`URL: ${supabaseUrl ? 'OK' : 'MISSING'}`);
console.log(`Key: ${supabaseKey ? 'OK' : 'MISSING'}`);

if (!supabaseUrl || !supabaseKey) {
    console.error("Faltam variaveis. Verifique .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
    console.log("1. Buscando config WhatsApp...");
    const { data: config, error: confError } = await supabase.from('whatsapp_config').select('*').single();

    if (confError || !config) {
        console.error("Erro config:", confError);
        return;
    }
    console.log("Config OK:", config.instance_name);

    console.log("2. Buscando pendentes...");
    const { data: posts, error: postError } = await supabase
        .from('scheduled_status')
        .select('*')
        .eq('status', 'PENDING')
        .limit(1);

    if (postError) {
        console.error("Erro posts:", postError);
        return;
    }

    if (!posts || posts.length === 0) {
        console.log("--> Nenhum post pendente encontrado.");
        return;
    }

    const post = posts[0];
    console.log(`--> Tentando postar ID ${post.id}`);

    let apiUrl = config.api_url.replace(/\/$/, '').replace(/\/message$/, '');
    const endpoint = `${apiUrl}/message/sendStatus/${config.instance_name}`;

    console.log("Endpoint:", endpoint);

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': config.api_key
            },
            body: JSON.stringify({
                type: 'image',
                content: post.image_url,
                caption: post.caption || ''
            })
        });

        const txt = await res.text();
        console.log(`Response ${res.status}:`, txt);

        if (res.ok) {
            console.log("SUCESSO! Atualizando status...");
            await supabase.from('scheduled_status').update({ status: 'POSTED', posted_at: new Date().toISOString() }).eq('id', post.id);
        } else {
            console.log("FALHA API. Atualizando status...");
            await supabase.from('scheduled_status').update({ status: 'FAILED', error_message: txt }).eq('id', post.id);
        }

    } catch (err) {
        console.error("Erro fetch:", err);
    }
}

run();
