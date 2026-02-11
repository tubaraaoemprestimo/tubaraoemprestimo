import { supabase } from './supabaseClient';
import {
    FleetVehicle,
    FleetRental,
    FleetWeeklyPayment,
    FleetVideoCheck,
    FleetLocationLog,
    FleetMaintenanceTicket,
    FleetAlert,
    FleetSettings,
    VehicleType,
    VehicleStatus,
    RentalStatus,
    RentalPaymentStatus,
    VideoCheckStatus,
    MaintenanceTicketStatus,
    FleetAlertType,
} from '../types';

// =====================================================
// HELPERS
// =====================================================
const toCamelCase = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(toCamelCase);
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((r: any, key) => {
            const ck = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
            r[ck] = toCamelCase(obj[key]);
            return r;
        }, {});
    }
    return obj;
};

const toSnakeCase = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(toSnakeCase);
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((r: any, key) => {
            const sk = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
            r[sk] = toSnakeCase(obj[key]);
            return r;
        }, {});
    }
    return obj;
};

// =====================================================
// FLEET SERVICE
// =====================================================
export const fleetService = {

    // ============================================
    // VEHICLES
    // ============================================

    getVehicles: async (filters?: { status?: VehicleStatus; type?: VehicleType; search?: string }): Promise<FleetVehicle[]> => {
        let query = supabase.from('fleet_vehicles').select('*').order('created_at', { ascending: false });
        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.type) query = query.eq('type', filters.type);
        if (filters?.search) {
            query = query.or(`brand.ilike.%${filters.search}%,model.ilike.%${filters.search}%,license_plate.ilike.%${filters.search}%`);
        }
        const { data, error } = await query;
        if (error) throw error;
        return toCamelCase(data || []);
    },

    getVehicleById: async (id: string): Promise<FleetVehicle | null> => {
        const { data, error } = await supabase.from('fleet_vehicles').select('*').eq('id', id).single();
        if (error) return null;
        return toCamelCase(data);
    },

    createVehicle: async (vehicle: Partial<FleetVehicle>): Promise<FleetVehicle> => {
        const { id, createdAt, updatedAt, ...rest } = vehicle as any;
        const { data, error } = await supabase.from('fleet_vehicles').insert(toSnakeCase(rest)).select().single();
        if (error) throw error;
        return toCamelCase(data);
    },

    updateVehicle: async (id: string, updates: Partial<FleetVehicle>): Promise<FleetVehicle> => {
        const { id: _, createdAt, updatedAt, ...rest } = updates as any;
        const { data, error } = await supabase.from('fleet_vehicles').update(toSnakeCase(rest)).eq('id', id).select().single();
        if (error) throw error;
        return toCamelCase(data);
    },

    updateVehicleStatus: async (id: string, status: VehicleStatus): Promise<void> => {
        const { error } = await supabase.from('fleet_vehicles').update({ status }).eq('id', id);
        if (error) throw error;
    },

    deleteVehicle: async (id: string): Promise<void> => {
        const { error } = await supabase.from('fleet_vehicles').delete().eq('id', id);
        if (error) throw error;
    },

    // ============================================
    // RENTALS
    // ============================================

    getRentals: async (filters?: { status?: RentalStatus; customerId?: string; vehicleId?: string }): Promise<FleetRental[]> => {
        let query = supabase
            .from('fleet_rentals')
            .select(`
                *,
                fleet_vehicles ( id, brand, model, license_plate, type, status, photo_urls, color ),
                customers ( id, name, cpf, phone, email )
            `)
            .order('created_at', { ascending: false });

        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
        if (filters?.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((row: any) => {
            const rental = toCamelCase(row) as any;
            if (row.fleet_vehicles) {
                rental.vehicle = toCamelCase(row.fleet_vehicles);
            }
            if (row.customers) {
                rental.customerName = row.customers.name;
                rental.customerCpf = row.customers.cpf;
                rental.customerPhone = row.customers.phone;
                rental.customerEmail = row.customers.email;
            }
            delete rental.fleetVehicles;
            delete rental.customers;
            return rental as FleetRental;
        });
    },

    getRentalById: async (id: string): Promise<FleetRental | null> => {
        const { data, error } = await supabase
            .from('fleet_rentals')
            .select(`
                *,
                fleet_vehicles ( * ),
                customers ( id, name, cpf, phone, email )
            `)
            .eq('id', id)
            .single();

        if (error) return null;
        const rental = toCamelCase(data) as any;
        if (data.fleet_vehicles) rental.vehicle = toCamelCase(data.fleet_vehicles);
        if (data.customers) {
            rental.customerName = data.customers.name;
            rental.customerCpf = data.customers.cpf;
            rental.customerPhone = data.customers.phone;
            rental.customerEmail = data.customers.email;
        }
        delete rental.fleetVehicles;
        delete rental.customers;
        return rental as FleetRental;
    },

    createRental: async (rental: Partial<FleetRental>): Promise<FleetRental> => {
        const { id, createdAt, updatedAt, vehicle, customerName, customerCpf, customerPhone, customerEmail, ...rest } = rental as any;

        // Generate contract number
        const now = new Date();
        const contractNumber = `LOC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        const insertData = toSnakeCase({ ...rest, contractNumber });
        const { data, error } = await supabase.from('fleet_rentals').insert(insertData).select().single();
        if (error) throw error;

        // Update vehicle status to RENTED
        if (rest.vehicleId) {
            await supabase.from('fleet_vehicles').update({ status: 'RENTED' }).eq('id', rest.vehicleId);
        }

        return toCamelCase(data);
    },

    updateRentalStatus: async (id: string, status: RentalStatus, reason?: string): Promise<void> => {
        const updates: any = { status };
        if (status === 'CANCELLED' && reason) updates.cancelled_reason = reason;
        if (status === 'COMPLETED') updates.end_date = new Date().toISOString().split('T')[0];

        const { error } = await supabase.from('fleet_rentals').update(updates).eq('id', id);
        if (error) throw error;

        // If completed or cancelled, free the vehicle
        if (status === 'COMPLETED' || status === 'CANCELLED') {
            const rental = await fleetService.getRentalById(id);
            if (rental?.vehicleId) {
                await supabase.from('fleet_vehicles').update({ status: 'AVAILABLE' }).eq('id', rental.vehicleId);
            }
        }
    },

    getActiveRentalByCustomer: async (customerId: string): Promise<FleetRental | null> => {
        const { data, error } = await supabase
            .from('fleet_rentals')
            .select(`*, fleet_vehicles ( * )`)
            .eq('customer_id', customerId)
            .in('status', ['ACTIVE', 'PENDING'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !data) return null;
        const rental = toCamelCase(data) as any;
        if (data.fleet_vehicles) rental.vehicle = toCamelCase(data.fleet_vehicles);
        delete rental.fleetVehicles;
        return rental;
    },

    getRentalsByCustomer: async (customerId: string): Promise<FleetRental[]> => {
        const { data, error } = await supabase
            .from('fleet_rentals')
            .select(`*, fleet_vehicles ( id, brand, model, license_plate, type )`)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map((row: any) => {
            const rental = toCamelCase(row) as any;
            if (row.fleet_vehicles) rental.vehicle = toCamelCase(row.fleet_vehicles);
            delete rental.fleetVehicles;
            return rental;
        });
    },

    // ============================================
    // WEEKLY PAYMENTS
    // ============================================

    getPaymentsByRental: async (rentalId: string): Promise<FleetWeeklyPayment[]> => {
        const { data, error } = await supabase
            .from('fleet_weekly_payments')
            .select('*')
            .eq('rental_id', rentalId)
            .order('week_number', { ascending: true });
        if (error) throw error;
        return toCamelCase(data || []);
    },

    generateWeeklyPayment: async (rentalId: string, weekNumber: number, periodStart: string, periodEnd: string, amount: number, dueDate: string, customerId: string): Promise<FleetWeeklyPayment> => {
        const { data, error } = await supabase
            .from('fleet_weekly_payments')
            .insert({
                rental_id: rentalId,
                customer_id: customerId,
                week_number: weekNumber,
                period_start: periodStart,
                period_end: periodEnd,
                amount,
                total_due: amount,
                due_date: dueDate,
                status: 'PENDING',
            })
            .select()
            .single();
        if (error) throw error;
        return toCamelCase(data);
    },

    confirmPayment: async (paymentId: string, confirmedBy: string, proofUrl?: string): Promise<void> => {
        const updates: any = {
            status: 'PAID',
            paid_at: new Date().toISOString(),
            confirmed_by: confirmedBy,
            confirmed_at: new Date().toISOString(),
        };
        if (proofUrl) updates.proof_url = proofUrl;
        const { error } = await supabase.from('fleet_weekly_payments').update(updates).eq('id', paymentId);
        if (error) throw error;
    },

    calculateLateFees: async (paymentId: string, lateFixedFee: number, lateDailyInterest: number): Promise<FleetWeeklyPayment> => {
        const { data: payment, error: fetchErr } = await supabase
            .from('fleet_weekly_payments')
            .select('*')
            .eq('id', paymentId)
            .single();
        if (fetchErr || !payment) throw fetchErr || new Error('Payment not found');

        const dueDate = new Date(payment.due_date);
        const today = new Date();
        const daysLate = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        if (daysLate <= 0) return toCamelCase(payment);

        const lateFee = lateFixedFee;
        const lateInterest = Number(((payment.amount * lateDailyInterest / 100) * daysLate).toFixed(2));
        const totalDue = Number((payment.amount + lateFee + lateInterest).toFixed(2));

        const { data, error } = await supabase
            .from('fleet_weekly_payments')
            .update({
                late_fee: lateFee,
                late_interest: lateInterest,
                total_due: totalDue,
                status: 'LATE',
            })
            .eq('id', paymentId)
            .select()
            .single();

        if (error) throw error;
        return toCamelCase(data);
    },

    getPendingPayments: async (): Promise<FleetWeeklyPayment[]> => {
        const { data, error } = await supabase
            .from('fleet_weekly_payments')
            .select('*')
            .eq('status', 'PENDING')
            .order('due_date', { ascending: true });
        if (error) throw error;
        return toCamelCase(data || []);
    },

    getOverduePayments: async (): Promise<FleetWeeklyPayment[]> => {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('fleet_weekly_payments')
            .select('*')
            .in('status', ['PENDING', 'LATE'])
            .lt('due_date', today)
            .order('due_date', { ascending: true });
        if (error) throw error;
        return toCamelCase(data || []);
    },

    getAllPayments: async (filters?: { status?: RentalPaymentStatus; rentalId?: string }): Promise<FleetWeeklyPayment[]> => {
        let query = supabase.from('fleet_weekly_payments').select('*').order('due_date', { ascending: false });
        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.rentalId) query = query.eq('rental_id', filters.rentalId);
        const { data, error } = await query;
        if (error) throw error;
        return toCamelCase(data || []);
    },

    // ============================================
    // VIDEO CHECKS
    // ============================================

    getVideoChecksByRental: async (rentalId: string): Promise<FleetVideoCheck[]> => {
        const { data, error } = await supabase
            .from('fleet_video_checks')
            .select('*')
            .eq('rental_id', rentalId)
            .order('week_number', { ascending: true });
        if (error) throw error;
        return toCamelCase(data || []);
    },

    submitVideoCheck: async (id: string, urls: { videoExteriorUrl?: string; videoDashboardUrl?: string; videoResidenceUrl?: string }, geo?: { latitude: number; longitude: number; accuracy?: number; address?: string }): Promise<void> => {
        const updates: any = {
            status: 'SUBMITTED',
            captured_at: new Date().toISOString(),
        };
        if (urls.videoExteriorUrl) updates.video_exterior_url = urls.videoExteriorUrl;
        if (urls.videoDashboardUrl) updates.video_dashboard_url = urls.videoDashboardUrl;
        if (urls.videoResidenceUrl) updates.video_residence_url = urls.videoResidenceUrl;
        if (geo) {
            updates.latitude = geo.latitude;
            updates.longitude = geo.longitude;
            if (geo.accuracy) updates.accuracy = geo.accuracy;
            if (geo.address) updates.address = geo.address;
        }

        const { error } = await supabase.from('fleet_video_checks').update(updates).eq('id', id);
        if (error) throw error;
    },

    reviewVideoCheck: async (id: string, status: 'APPROVED' | 'REJECTED', reviewedBy: string, adminNotes?: string): Promise<void> => {
        const updates: any = {
            status,
            reviewed_by: reviewedBy,
            reviewed_at: new Date().toISOString(),
        };
        if (adminNotes) updates.admin_notes = adminNotes;
        const { error } = await supabase.from('fleet_video_checks').update(updates).eq('id', id);
        if (error) throw error;
    },

    getPendingVideoChecks: async (): Promise<FleetVideoCheck[]> => {
        const { data, error } = await supabase
            .from('fleet_video_checks')
            .select('*')
            .in('status', ['PENDING', 'SUBMITTED'])
            .order('due_date', { ascending: true });
        if (error) throw error;
        return toCamelCase(data || []);
    },

    getOverdueVideoChecks: async (): Promise<FleetVideoCheck[]> => {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('fleet_video_checks')
            .select('*')
            .eq('status', 'PENDING')
            .lt('due_date', today)
            .order('due_date', { ascending: true });
        if (error) throw error;
        return toCamelCase(data || []);
    },

    createVideoCheck: async (rentalId: string, customerId: string, weekNumber: number, dueDate: string): Promise<FleetVideoCheck> => {
        const { data, error } = await supabase
            .from('fleet_video_checks')
            .insert({
                rental_id: rentalId,
                customer_id: customerId,
                week_number: weekNumber,
                due_date: dueDate,
                status: 'PENDING',
            })
            .select()
            .single();
        if (error) throw error;
        return toCamelCase(data);
    },

    // ============================================
    // LOCATION LOGS
    // ============================================

    logLocation: async (log: Partial<FleetLocationLog>): Promise<void> => {
        const { id, createdAt, ...rest } = log as any;
        const { error } = await supabase.from('fleet_location_logs').insert(toSnakeCase(rest));
        if (error) throw error;
    },

    getLocationHistory: async (rentalId: string, limit = 50): Promise<FleetLocationLog[]> => {
        const { data, error } = await supabase
            .from('fleet_location_logs')
            .select('*')
            .eq('rental_id', rentalId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return toCamelCase(data || []);
    },

    getLatestLocation: async (rentalId: string): Promise<FleetLocationLog | null> => {
        const { data, error } = await supabase
            .from('fleet_location_logs')
            .select('*')
            .eq('rental_id', rentalId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error || !data) return null;
        return toCamelCase(data);
    },

    // ============================================
    // MAINTENANCE TICKETS
    // ============================================

    createTicket: async (ticket: Partial<FleetMaintenanceTicket>): Promise<FleetMaintenanceTicket> => {
        const { id, createdAt, updatedAt, ...rest } = ticket as any;
        const { data, error } = await supabase.from('fleet_maintenance_tickets').insert(toSnakeCase(rest)).select().single();
        if (error) throw error;
        return toCamelCase(data);
    },

    getTicketsByVehicle: async (vehicleId: string): Promise<FleetMaintenanceTicket[]> => {
        const { data, error } = await supabase
            .from('fleet_maintenance_tickets')
            .select('*')
            .eq('vehicle_id', vehicleId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return toCamelCase(data || []);
    },

    updateTicketStatus: async (id: string, status: MaintenanceTicketStatus, resolvedBy?: string, resolution?: string): Promise<void> => {
        const updates: any = { status };
        if (status === 'RESOLVED') {
            updates.resolved_at = new Date().toISOString();
            if (resolvedBy) updates.resolved_by = resolvedBy;
            if (resolution) updates.resolution = resolution;
        }
        const { error } = await supabase.from('fleet_maintenance_tickets').update(updates).eq('id', id);
        if (error) throw error;
    },

    getAllOpenTickets: async (): Promise<FleetMaintenanceTicket[]> => {
        const { data, error } = await supabase
            .from('fleet_maintenance_tickets')
            .select('*')
            .in('status', ['OPEN', 'IN_PROGRESS'])
            .order('created_at', { ascending: false });
        if (error) throw error;
        return toCamelCase(data || []);
    },

    getAllTickets: async (filters?: { status?: MaintenanceTicketStatus; vehicleId?: string }): Promise<FleetMaintenanceTicket[]> => {
        let query = supabase.from('fleet_maintenance_tickets').select('*').order('created_at', { ascending: false });
        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
        const { data, error } = await query;
        if (error) throw error;
        return toCamelCase(data || []);
    },

    // ============================================
    // ALERTS
    // ============================================

    createAlert: async (alert: Partial<FleetAlert>): Promise<FleetAlert> => {
        const { id, createdAt, ...rest } = alert as any;
        const { data, error } = await supabase.from('fleet_alerts').insert(toSnakeCase(rest)).select().single();
        if (error) throw error;
        return toCamelCase(data);
    },

    getActiveAlerts: async (): Promise<FleetAlert[]> => {
        const { data, error } = await supabase
            .from('fleet_alerts')
            .select('*')
            .eq('resolved', false)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return toCamelCase(data || []);
    },

    getAllAlerts: async (filters?: { type?: FleetAlertType; resolved?: boolean }): Promise<FleetAlert[]> => {
        let query = supabase.from('fleet_alerts').select('*').order('created_at', { ascending: false });
        if (filters?.type) query = query.eq('type', filters.type);
        if (filters?.resolved !== undefined) query = query.eq('resolved', filters.resolved);
        const { data, error } = await query;
        if (error) throw error;
        return toCamelCase(data || []);
    },

    resolveAlert: async (id: string, resolvedBy: string): Promise<void> => {
        const { error } = await supabase.from('fleet_alerts').update({
            resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: resolvedBy,
        }).eq('id', id);
        if (error) throw error;
    },

    checkAndGenerateAlerts: async (): Promise<number> => {
        let alertsCreated = 0;

        // Check overdue payments
        const overduePayments = await fleetService.getOverduePayments();
        for (const payment of overduePayments) {
            const { data: existing } = await supabase
                .from('fleet_alerts')
                .select('id')
                .eq('rental_id', payment.rentalId)
                .eq('type', 'LATE_PAYMENT')
                .eq('resolved', false)
                .maybeSingle();

            if (!existing) {
                await fleetService.createAlert({
                    rentalId: payment.rentalId,
                    customerId: payment.customerId,
                    type: 'LATE_PAYMENT',
                    title: `Pagamento atrasado - Semana ${payment.weekNumber}`,
                    message: `Pagamento de R$ ${payment.totalDue.toFixed(2)} vencido em ${payment.dueDate}`,
                    severity: 'WARNING',
                });
                alertsCreated++;
            }
        }

        // Check overdue video checks
        const overdueVideos = await fleetService.getOverdueVideoChecks();
        for (const video of overdueVideos) {
            const { data: existing } = await supabase
                .from('fleet_alerts')
                .select('id')
                .eq('rental_id', video.rentalId)
                .eq('type', 'NO_VIDEO')
                .eq('resolved', false)
                .maybeSingle();

            if (!existing) {
                await fleetService.createAlert({
                    rentalId: video.rentalId,
                    customerId: video.customerId,
                    type: 'NO_VIDEO',
                    title: `Video nao enviado - Semana ${video.weekNumber}`,
                    message: `Video obrigatorio vencido em ${video.dueDate}`,
                    severity: 'WARNING',
                });
                alertsCreated++;
            }
        }

        return alertsCreated;
    },

    // ============================================
    // SETTINGS
    // ============================================

    getFleetSettings: async (): Promise<FleetSettings | null> => {
        const { data, error } = await supabase
            .from('fleet_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
        if (error || !data) return null;
        return toCamelCase(data);
    },

    updateFleetSettings: async (updates: Partial<FleetSettings>): Promise<FleetSettings> => {
        const { id, updatedAt, ...rest } = updates as any;
        // Get existing settings row
        const { data: existing } = await supabase.from('fleet_settings').select('id').limit(1).single();
        if (!existing) throw new Error('Fleet settings not found');

        const { data, error } = await supabase
            .from('fleet_settings')
            .update(toSnakeCase(rest))
            .eq('id', existing.id)
            .select()
            .single();
        if (error) throw error;
        return toCamelCase(data);
    },

    // ============================================
    // DASHBOARD KPIs
    // ============================================

    getFleetDashboardStats: async () => {
        // Total vehicles by status
        const { data: vehicles } = await supabase.from('fleet_vehicles').select('id, status');
        const totalVehicles = vehicles?.length || 0;
        const availableVehicles = vehicles?.filter(v => v.status === 'AVAILABLE').length || 0;
        const rentedVehicles = vehicles?.filter(v => v.status === 'RENTED').length || 0;
        const maintenanceVehicles = vehicles?.filter(v => v.status === 'MAINTENANCE').length || 0;
        const blockedVehicles = vehicles?.filter(v => v.status === 'BLOCKED').length || 0;

        // Active rentals
        const { count: activeRentals } = await supabase
            .from('fleet_rentals')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'ACTIVE');

        // Revenue this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { data: paidPayments } = await supabase
            .from('fleet_weekly_payments')
            .select('total_due')
            .eq('status', 'PAID')
            .gte('paid_at', startOfMonth.toISOString());
        const monthlyRevenue = paidPayments?.reduce((sum, p) => sum + Number(p.total_due), 0) || 0;

        // Overdue payments count
        const today = new Date().toISOString().split('T')[0];
        const { count: overdueCount } = await supabase
            .from('fleet_weekly_payments')
            .select('id', { count: 'exact', head: true })
            .in('status', ['PENDING', 'LATE'])
            .lt('due_date', today);

        // Pending video checks
        const { count: pendingVideos } = await supabase
            .from('fleet_video_checks')
            .select('id', { count: 'exact', head: true })
            .in('status', ['PENDING', 'SUBMITTED']);

        // Active alerts
        const { count: activeAlerts } = await supabase
            .from('fleet_alerts')
            .select('id', { count: 'exact', head: true })
            .eq('resolved', false);

        // Occupancy rate
        const occupancyRate = totalVehicles > 0 ? Math.round((rentedVehicles / totalVehicles) * 100) : 0;

        return {
            totalVehicles,
            availableVehicles,
            rentedVehicles,
            maintenanceVehicles,
            blockedVehicles,
            activeRentals: activeRentals || 0,
            monthlyRevenue,
            overdueCount: overdueCount || 0,
            pendingVideos: pendingVideos || 0,
            activeAlerts: activeAlerts || 0,
            occupancyRate,
        };
    },

    // ============================================
    // UTILITY: Generate weekly cycle for a rental
    // ============================================

    generateWeeklyCycle: async (rentalId: string, customerId: string, weeklyRate: number, startDate: string, weeksCount = 1): Promise<void> => {
        const start = new Date(startDate);
        const settings = await fleetService.getFleetSettings();
        const videoRequired = settings?.videoCheckRequired !== false;

        for (let w = 0; w < weeksCount; w++) {
            const periodStart = new Date(start);
            periodStart.setDate(periodStart.getDate() + (w * 7));
            const periodEnd = new Date(periodStart);
            periodEnd.setDate(periodEnd.getDate() + 6);
            const dueDate = new Date(periodStart);
            dueDate.setDate(dueDate.getDate() + 5); // Due on Friday of that week

            const weekNumber = w + 1;
            const pStart = periodStart.toISOString().split('T')[0];
            const pEnd = periodEnd.toISOString().split('T')[0];
            const due = dueDate.toISOString().split('T')[0];

            // Generate payment
            await fleetService.generateWeeklyPayment(rentalId, weekNumber, pStart, pEnd, weeklyRate, due, customerId);

            // Generate video check if required
            if (videoRequired) {
                const videoDayOffset = settings?.videoCheckDayOfWeek ?? 1; // Default Monday
                const videoDue = new Date(periodStart);
                videoDue.setDate(videoDue.getDate() + videoDayOffset);
                await fleetService.createVideoCheck(rentalId, customerId, weekNumber, videoDue.toISOString().split('T')[0]);
            }
        }
    },
};
