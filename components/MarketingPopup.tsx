import React, { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Button } from './Button';
import { Campaign } from '../types';
import { supabaseService } from '../services/supabaseService';

export const MarketingPopup: React.FC = () => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    checkCampaigns();
  }, []);

  const checkCampaigns = async () => {
    const activeCampaigns = await supabaseService.getActiveCampaigns();
    
    for (const camp of activeCampaigns) {
       if (shouldShowCampaign(camp)) {
          setCampaign(camp);
          // Small delay for UX so it doesn't pop immediately over content loading
          setTimeout(() => setIsOpen(true), 1500);
          return; // Show only one at a time per session/load
       }
    }
  };

  const shouldShowCampaign = (camp: Campaign): boolean => {
      const storageKey = `marketing_view_${camp.id}`;
      const lastView = localStorage.getItem(storageKey);
      
      if (camp.frequency === 'ALWAYS') return true;
      
      if (!lastView) return true; // Never seen

      if (camp.frequency === 'ONCE') return false; // Seen once, never show again in popup

      if (camp.frequency === 'DAILY') {
          const lastDate = new Date(lastView).toDateString();
          const today = new Date().toDateString();
          return lastDate !== today;
      }

      return false;
  };

  const handleClose = () => {
      if (campaign) {
        const storageKey = `marketing_view_${campaign.id}`;
        localStorage.setItem(storageKey, new Date().toISOString());
      }
      setIsOpen(false);
  };

  const handleAction = () => {
      if (campaign?.link) {
          window.open(campaign.link, '_blank');
      }
      handleClose();
  };

  if (!isOpen || !campaign) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-zinc-900 border border-[#D4AF37] rounded-3xl w-full max-w-sm overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.2)] relative animate-in zoom-in-95 duration-300">
            {/* Close Button */}
            <button 
                onClick={handleClose}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black text-white p-2 rounded-full z-10 backdrop-blur-md transition-colors"
            >
                <X size={20} />
            </button>

            {/* Image */}
            <div className="relative aspect-video bg-black">
                {campaign.imageUrl ? (
                    <img src={campaign.imageUrl} alt={campaign.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#D4AF37] to-black">
                        <span className="text-4xl">🎁</span>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent"></div>
            </div>

            {/* Content */}
            <div className="p-6 pt-2 text-center">
                <h3 className="text-2xl font-bold text-white mb-2 leading-tight">{campaign.title}</h3>
                <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                    {campaign.description}
                </p>

                <div className="space-y-3">
                    {campaign.link && (
                        <Button onClick={handleAction} className="w-full shadow-lg shadow-[#D4AF37]/20">
                            Aprovar Oferta <ExternalLink size={16} className="ml-2" />
                        </Button>
                    )}
                    <button 
                        onClick={handleClose}
                        className="text-zinc-500 text-xs hover:text-white transition-colors uppercase tracking-widest"
                    >
                        Dispensar
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};