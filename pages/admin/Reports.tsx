
// 📄 Reports Page - Página de Relatórios do Admin
import React from 'react';
import { ReportsPanel } from '../../components/ReportsPanel';

export const Reports: React.FC = () => {
    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white">
            <ReportsPanel />
        </div>
    );
};
