import { createClient } from '@supabase/supabase-js';

// Fallback values for production (Vercel)
const FALLBACK_SUPABASE_URL = 'https://cwhiujeragsethxjekkb.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3aGl1amVyYWdzZXRoeGpla2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTAyODUsImV4cCI6MjA4MzQ4NjI4NX0.7e7P2PVY8DnvBYxsdpVWnNYK2Z3E6WgbiaS_XcChKvI';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});


export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: 'ADMIN' | 'CLIENT';
          avatar_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          cpf: string;
          email: string;
          phone: string;
          status: 'ACTIVE' | 'BLOCKED';
          internal_score: number;
          total_debt: number;
          active_loans_count: number;
          address: string | null;
          neighborhood: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          latitude: number | null;
          longitude: number | null;
          monthly_income: number | null;
          pre_approved_amount: number | null;
          pre_approved_at: string | null;
          joined_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'joined_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      loan_requests: {
        Row: {
          id: string;
          customer_id: string;
          client_name: string;
          cpf: string;
          email: string;
          phone: string;
          amount: number;
          installments: number;
          status: 'PENDING' | 'WAITING_DOCS' | 'APPROVED' | 'REJECTED';
          father_phone: string | null;
          mother_phone: string | null;
          spouse_phone: string | null;
          selfie_url: string | null;
          id_card_url: string | null;
          id_card_back_url: string | null;
          proof_of_address_url: string | null;
          proof_income_url: string | null;
          vehicle_url: string | null;
          video_selfie_url: string | null;
          video_house_url: string | null;
          video_vehicle_url: string | null;
          signature_url: string | null;
          supplemental_description: string | null;
          supplemental_doc_url: string | null;
          supplemental_requested_at: string | null;
          supplemental_uploaded_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['loan_requests']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['loan_requests']['Insert']>;
      };
      loans: {
        Row: {
          id: string;
          customer_id: string;
          request_id: string;
          amount: number;
          installments_count: number;
          remaining_amount: number;
          status: 'APPROVED' | 'PAID' | 'DEFAULTED';
          start_date: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['loans']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['loans']['Insert']>;
      };
      installments: {
        Row: {
          id: string;
          loan_id: string;
          due_date: string;
          amount: number;
          status: 'OPEN' | 'PAID' | 'LATE';
          pix_code: string | null;
          proof_url: string | null;
          paid_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['installments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['installments']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          type: 'IN' | 'OUT';
          description: string;
          amount: number;
          category: 'LOAN' | 'PAYMENT' | 'FEE';
          date: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      collection_rules: {
        Row: {
          id: string;
          days_offset: number;
          type: 'WHATSAPP' | 'EMAIL' | 'SMS';
          message_template: string;
          active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['collection_rules']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['collection_rules']['Insert']>;
      };
      message_templates: {
        Row: {
          id: string;
          name: string;
          category: 'REMINDER' | 'COLLECTION' | 'WELCOME' | 'APPROVAL' | 'REJECTION' | 'PAYMENT' | 'CUSTOM';
          content: string;
          variables: string[];
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['message_templates']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['message_templates']['Insert']>;
      };
      campaigns: {
        Row: {
          id: string;
          title: string;
          description: string;
          image_url: string | null;
          link: string | null;
          start_date: string;
          end_date: string;
          frequency: 'ONCE' | 'DAILY' | 'ALWAYS';
          active: boolean;
          priority: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['campaigns']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['campaigns']['Insert']>;
      };
      blacklist: {
        Row: {
          id: string;
          cpf: string;
          name: string;
          reason: string;
          added_by: string;
          active: boolean;
          added_at: string;
        };
        Insert: Omit<Database['public']['Tables']['blacklist']['Row'], 'id' | 'added_at'>;
        Update: Partial<Database['public']['Tables']['blacklist']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          user_name: string;
          action: string;
          entity: string;
          entity_id: string | null;
          details: string;
          ip_address: string | null;
          timestamp: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'timestamp'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
      system_settings: {
        Row: {
          id: string;
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['system_settings']['Row'], 'id' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['system_settings']['Insert']>;
      };
      brand_settings: {
        Row: {
          id: string;
          system_name: string;
          logo_url: string | null;
          primary_color: string;
          secondary_color: string;
          background_color: string;
          company_name: string;
          cnpj: string;
          address: string;
          phone: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['brand_settings']['Row'], 'id' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['brand_settings']['Insert']>;
      };
      whatsapp_config: {
        Row: {
          id: string;
          api_url: string;
          api_key: string;
          instance_name: string;
          is_connected: boolean;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['whatsapp_config']['Row'], 'id' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['whatsapp_config']['Insert']>;
      };
      goals_settings: {
        Row: {
          id: string;
          monthly_loan_goal: number;
          monthly_client_goal: number;
          monthly_approval_rate_goal: number;
          projections: any;
          expected_growth_rate: number;
          goal_period: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['goals_settings']['Row'], 'id' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['goals_settings']['Insert']>;
      };
      loan_packages: {
        Row: {
          id: string;
          name: string;
          min_value: number;
          max_value: number;
          min_installments: number;
          max_installments: number;
          interest_rate: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['loan_packages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['loan_packages']['Insert']>;
      };
    };
  };
};
