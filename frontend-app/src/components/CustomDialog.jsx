import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function CustomDialog({ isOpen, onClose, onConfirm, title, message, type = 'info', confirmText = 'Confirmer', cancelText = 'Annuler', confirmVariant = 'primary' }) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const getIconAndColor = () => {
        switch (type) {
            case 'success':
                return { icon: <CheckCircle2 size={32} className="text-emerald-500" />, color: 'emerald' };
            case 'error':
                return { icon: <AlertCircle size={32} className="text-red-500" />, color: 'red' };
            case 'warning':
            case 'confirm':
                return { icon: <AlertTriangle size={32} className="text-amber-500" />, color: 'amber' };
            default:
                return { icon: <Info size={32} className="text-indigo-500" />, color: 'indigo' };
        }
    };

    const { icon, color } = getIconAndColor();
    const isConfirm = type === 'confirm';
    const confirmClass = confirmVariant === 'danger'
        ? 'bg-red-600 hover:bg-red-700'
        : 'bg-indigo-600 hover:bg-indigo-700';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Overlay */}
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    />

                    {/* Dialog Box */}
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        exit={{ scale: 0.95, opacity: 0 }} 
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative z-10"
                    >
                        <div className="p-6">
                            <div className="flex justify-center mb-4">
                                <div className={`p-3 bg-${color}-50 rounded-full`}>
                                    {icon}
                                </div>
                            </div>
                            
                            <h3 className="text-xl font-bold text-slate-800 text-center mb-2">{title}</h3>
                            <p className="text-slate-600 text-center leading-relaxed mb-6">{message}</p>
                            
                            <div className={`flex gap-3 ${isConfirm ? 'justify-between' : 'justify-center'}`}>
                                {isConfirm && (
                                    <button 
                                        onClick={onClose} 
                                        className="flex-1 py-2.5 px-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                    >
                                        {cancelText}
                                    </button>
                                )}
                                <button 
                                    onClick={isConfirm ? onConfirm : onClose} 
                                    className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-white transition-colors ${confirmClass}`}
                                >
                                    {isConfirm ? confirmText : (type === 'success' ? 'Continuer' : 'Compris')}
                                </button>
                            </div>
                        </div>
                        
                        {/* Decorative Top Border */}
                        <div className={`h-1.5 w-full absolute top-0 left-0 bg-${color}-500`} />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
