import { useEffect } from 'react';
import { CheckCircle, Ban } from 'lucide-react';

const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const styles = {
        success: 'bg-green-50 border-green-400 text-green-800',
        error:   'bg-red-50 border-red-400 text-red-800',
    };

    return (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-lg text-sm font-medium animate-slide-in-up ${styles[type]}`}>
            {type === 'success'
                ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                : <Ban className="w-5 h-5 text-red-500 flex-shrink-0" />
            }
            <span>{message}</span>
            <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600 font-bold text-lg leading-none">×</button>
        </div>
    );
};

export default Toast;