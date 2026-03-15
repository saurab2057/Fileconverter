import { Trash2 } from 'lucide-react';

const UserActions = ({ user, isUpdating, isDeleting, onMutate, onDeleteClick }) => {

    const btn = (label, onClick, style) => (
        <button
            key={label}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            disabled={isUpdating || isDeleting}
            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-50 transition-colors ${style}`}
        >
            {label}
        </button>
    );

    const deleteBtn = (
        <button
            onClick={(e) => { e.stopPropagation(); onDeleteClick(user); }}
            disabled={isUpdating || isDeleting}
            className="w-full text-left px-3 py-1.5 text-xs rounded-lg font-medium mt-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1"
        >
            <Trash2 className="w-3 h-3" /> Delete
        </button>
    );

    if (user.status === 'banned') {
        return (
            <div className="flex flex-col gap-1 w-28">
                {btn('Unban', () => onMutate({ userId: user._id, status: 'active' }),
                    'bg-green-100 text-green-700 hover:bg-green-200')}
                {deleteBtn}
            </div>
        );
    }

    // active
    return (
        <div className="flex flex-col gap-1 w-28">
            {btn('Ban', () => onMutate({ userId: user._id, status: 'banned' }),
                'bg-red-100 text-red-700 hover:bg-red-200')}
            {user.role === 'user'
                ? btn('Make Admin', () => onMutate({ userId: user._id, role: 'admin' }),
                    'bg-amber-100 text-amber-700 hover:bg-amber-200')
                : btn('Remove Admin', () => onMutate({ userId: user._id, role: 'user' }),
                    'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }
            {deleteBtn}
        </div>
    );
};

export default UserActions;