/**
 * Geolocation Service
 * Provides geolocation, clustering and route optimization features
 */

import { Customer, GeoCluster, CollectionRoute, RouteStop } from '../types';

// Haversine formula to calculate distance between two coordinates
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Mock coordinates for Brazilian neighborhoods (Recife area as example)
const neighborhoodCoordinates: Record<string, { lat: number; lng: number }> = {
    'Boa Viagem': { lat: -8.1189, lng: -34.9013 },
    'Casa Amarela': { lat: -8.0256, lng: -34.9182 },
    'Aflitos': { lat: -8.0472, lng: -34.8972 },
    'Várzea': { lat: -8.0439, lng: -34.9579 },
    'Ibura': { lat: -8.1139, lng: -34.9405 },
    'Jardim São Paulo': { lat: -8.0653, lng: -34.9172 },
    'Pina': { lat: -8.0986, lng: -34.8820 },
    'Imbiribeira': { lat: -8.1083, lng: -34.9156 },
    'Cordeiro': { lat: -8.0494, lng: -34.9233 },
    'Madalena': { lat: -8.0478, lng: -34.9081 },
    'Torre': { lat: -8.0517, lng: -34.8994 },
    'Espinheiro': { lat: -8.0381, lng: -34.8939 },
    'Derby': { lat: -8.0556, lng: -34.8989 },
    'Graças': { lat: -8.0414, lng: -34.8919 },
    'Parnamirim': { lat: -8.0350, lng: -34.9092 },
    'Tamarineira': { lat: -8.0292, lng: -34.9111 },
    'Encruzilhada': { lat: -8.0281, lng: -34.8853 },
    'Rosarinho': { lat: -8.0208, lng: -34.8883 },
    'Hipódromo': { lat: -8.0236, lng: -34.8981 },
    'Santana': { lat: -8.0189, lng: -34.8894 },
};

// Generate mock coordinates based on address or default
const getCustomerCoordinates = (customer: Customer): { lat: number; lng: number } | null => {
    if (customer.latitude && customer.longitude) {
        return { lat: customer.latitude, lng: customer.longitude };
    }

    // Try to get from neighborhood
    if (customer.neighborhood) {
        const coords = neighborhoodCoordinates[customer.neighborhood];
        if (coords) {
            // Add small random offset for visualization
            return {
                lat: coords.lat + (Math.random() - 0.5) * 0.01,
                lng: coords.lng + (Math.random() - 0.5) * 0.01
            };
        }
    }

    // Default coordinates (Recife center) with random offset
    return {
        lat: -8.0476 + (Math.random() - 0.5) * 0.1,
        lng: -34.8770 + (Math.random() - 0.5) * 0.1
    };
};

// Generate clusters based on neighborhood
const generateClusters = (customers: Customer[]): GeoCluster[] => {
    const clusterMap = new Map<string, Customer[]>();

    customers.forEach(customer => {
        const key = customer.neighborhood || customer.city || 'Sem Bairro';
        if (!clusterMap.has(key)) {
            clusterMap.set(key, []);
        }
        clusterMap.get(key)!.push(customer);
    });

    const clusters: GeoCluster[] = [];

    clusterMap.forEach((clusterCustomers, neighborhood) => {
        // Calculate center
        const coords = clusterCustomers
            .map(c => getCustomerCoordinates(c))
            .filter(c => c !== null) as { lat: number; lng: number }[];

        const centerLat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length || -8.0476;
        const centerLng = coords.reduce((sum, c) => sum + c.lng, 0) / coords.length || -34.8770;

        // Calculate default rate
        const defaultedCustomers = clusterCustomers.filter(c => c.status === 'BLOCKED' || c.totalDebt > 0);
        const defaultRate = (defaultedCustomers.length / clusterCustomers.length) * 100;

        // Calculate total debt
        const totalDebt = clusterCustomers.reduce((sum, c) => sum + c.totalDebt, 0);

        clusters.push({
            id: `cluster-${neighborhood.toLowerCase().replace(/\s/g, '-')}`,
            neighborhood,
            city: clusterCustomers[0]?.city || 'Recife',
            center: { lat: centerLat, lng: centerLng },
            customerCount: clusterCustomers.length,
            defaultRate: Math.round(defaultRate * 10) / 10,
            totalDebt,
            customers: clusterCustomers
        });
    });

    return clusters.sort((a, b) => b.defaultRate - a.defaultRate);
};

// Simple Nearest Neighbor algorithm for route optimization
const optimizeRoute = (customers: Customer[], startLat: number, startLng: number): RouteStop[] => {
    const stops: RouteStop[] = [];
    const remaining = [...customers];
    let currentLat = startLat;
    let currentLng = startLng;

    while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;

        remaining.forEach((customer, index) => {
            const coords = getCustomerCoordinates(customer);
            if (coords) {
                const distance = haversineDistance(currentLat, currentLng, coords.lat, coords.lng);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = index;
                }
            }
        });

        const nextCustomer = remaining.splice(nearestIndex, 1)[0];
        const coords = getCustomerCoordinates(nextCustomer);

        if (coords) {
            stops.push({
                order: stops.length + 1,
                customer: nextCustomer,
                distance: Math.round(nearestDistance * 10) / 10,
                estimatedTime: Math.round((nearestDistance / 30) * 60) // Assuming 30 km/h average speed in city
            });

            currentLat = coords.lat;
            currentLng = coords.lng;
        }
    }

    return stops;
};

// Storage keys
const ROUTES_KEY = 'tubarao_collection_routes';

// Get saved routes
const getRoutes = (): CollectionRoute[] => {
    const data = localStorage.getItem(ROUTES_KEY);
    return data ? JSON.parse(data) : [];
};

// Save route
const saveRoute = (route: CollectionRoute): void => {
    const routes = getRoutes();
    const existingIndex = routes.findIndex(r => r.id === route.id);
    if (existingIndex >= 0) {
        routes[existingIndex] = route;
    } else {
        routes.push(route);
    }
    localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
};

// Delete route
const deleteRoute = (routeId: string): void => {
    const routes = getRoutes().filter(r => r.id !== routeId);
    localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
};

// Create optimized collection route
const createCollectionRoute = (
    name: string,
    customers: Customer[],
    startLat: number = -8.0476,
    startLng: number = -34.8770
): CollectionRoute => {
    const stops = optimizeRoute(customers, startLat, startLng);

    const route: CollectionRoute = {
        id: `route-${Date.now()}`,
        name,
        date: new Date().toISOString(),
        stops,
        totalDistance: stops.reduce((sum, s) => sum + s.distance, 0),
        totalTime: stops.reduce((sum, s) => sum + s.estimatedTime, 0),
        status: 'PLANNED'
    };

    saveRoute(route);
    return route;
};

// Update route status
const updateRouteStatus = (routeId: string, status: CollectionRoute['status']): void => {
    const routes = getRoutes();
    const route = routes.find(r => r.id === routeId);
    if (route) {
        route.status = status;
        saveRoute(route);
    }
};

// Get customers with coordinates
const getCustomersWithCoordinates = (customers: Customer[]): (Customer & { coords: { lat: number; lng: number } })[] => {
    return customers.map(customer => ({
        ...customer,
        coords: getCustomerCoordinates(customer) || { lat: 0, lng: 0 }
    })).filter(c => c.coords.lat !== 0);
};

// Get default risk by neighborhood
const getDefaultRiskByNeighborhood = (customers: Customer[]): { neighborhood: string; risk: number; count: number }[] => {
    const clusters = generateClusters(customers);
    return clusters.map(c => ({
        neighborhood: c.neighborhood,
        risk: c.defaultRate,
        count: c.customerCount
    }));
};

export const geolocationService = {
    getCustomerCoordinates,
    generateClusters,
    optimizeRoute,
    createCollectionRoute,
    getRoutes,
    saveRoute,
    deleteRoute,
    updateRouteStatus,
    getCustomersWithCoordinates,
    getDefaultRiskByNeighborhood,
    haversineDistance,
    neighborhoodCoordinates
};
