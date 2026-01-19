// 📍 Location Tracking Service - Rastreamento de Localização em Tempo Real
// Tubarão Empréstimos

import { supabase } from './supabaseClient';

export interface CustomerLocation {
    customerEmail: string;
    customerName?: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
    city?: string;
    state?: string;
    updatedAt?: string;
}

// Obter usuário atual
const getCurrentUser = (): { email: string; name: string } | null => {
    try {
        const user = JSON.parse(localStorage.getItem('tubarao_user') || '{}');
        return user.email ? user : null;
    } catch {
        return null;
    }
};

// Reverse Geocoding usando API gratuita do OpenStreetMap Nominatim
const reverseGeocode = async (lat: number, lng: number): Promise<{ address: string; city: string; state: string } | null> => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
            {
                headers: {
                    'Accept-Language': 'pt-BR',
                    'User-Agent': 'TubaraoEmprestimos/1.0'
                }
            }
        );

        if (!response.ok) return null;

        const data = await response.json();

        const address = data.address || {};
        const addressParts = [];

        if (address.road) addressParts.push(address.road);
        if (address.house_number) addressParts.push(address.house_number);
        if (address.suburb || address.neighbourhood) addressParts.push(address.suburb || address.neighbourhood);

        return {
            address: addressParts.join(', ') || data.display_name?.split(',').slice(0, 3).join(',') || 'Endereço não encontrado',
            city: address.city || address.town || address.municipality || address.county || '',
            state: address.state || ''
        };
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return null;
    }
};

export const locationTrackingService = {
    // Capturar e salvar localização atual do cliente
    captureAndSave: async (): Promise<boolean> => {
        const user = getCurrentUser();
        if (!user) return false;

        // Verificar se tem permissão de geolocalização
        if (!navigator.geolocation) {
            console.log('Geolocation not supported');
            return false;
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude, accuracy } = position.coords;

                    console.log(`[Location] Captured: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);

                    // Fazer reverse geocoding
                    const geoData = await reverseGeocode(latitude, longitude);

                    // Salvar no banco (upsert)
                    const { error } = await supabase
                        .from('customer_locations')
                        .upsert({
                            customer_email: user.email,
                            customer_name: user.name,
                            latitude,
                            longitude,
                            accuracy,
                            address: geoData?.address || null,
                            city: geoData?.city || null,
                            state: geoData?.state || null,
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'customer_email'
                        });

                    if (error) {
                        console.error('Error saving location:', error);
                        resolve(false);
                    } else {
                        console.log('[Location] Saved successfully');
                        resolve(true);
                    }
                },
                (error) => {
                    console.log('[Location] Permission denied or error:', error.message);
                    resolve(false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000 // 1 minuto de cache
                }
            );
        });
    },

    // Obter todas as localizações (para admin)
    getAllLocations: async (): Promise<CustomerLocation[]> => {
        const { data, error } = await supabase
            .from('customer_locations')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error || !data) return [];

        return data.map((loc: any) => ({
            customerEmail: loc.customer_email,
            customerName: loc.customer_name,
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            address: loc.address,
            city: loc.city,
            state: loc.state,
            updatedAt: loc.updated_at
        }));
    },

    // Obter localização de um cliente específico
    getCustomerLocation: async (email: string): Promise<CustomerLocation | null> => {
        const { data, error } = await supabase
            .from('customer_locations')
            .select('*')
            .eq('customer_email', email)
            .single();

        if (error || !data) return null;

        return {
            customerEmail: data.customer_email,
            customerName: data.customer_name,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            address: data.address,
            city: data.city,
            state: data.state,
            updatedAt: data.updated_at
        };
    },

    // Formatar tempo relativo
    formatTimeAgo: (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Agora';
        if (diffMins < 60) return `${diffMins} min atrás`;
        if (diffHours < 24) return `${diffHours}h atrás`;
        if (diffDays < 7) return `${diffDays} dias atrás`;
        return date.toLocaleDateString('pt-BR');
    }
};
