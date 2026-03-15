import { Trash2 } from 'lucide-react';

const DeleteModal = ({ user, confirmInput, setConfirmInput, onConfirm, onCancel, isDeleting }) => {
    if (!user) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Delete User</h2>
                        <p className="text-sm text-gray-500">This action is permanent and cannot be undone.</p>
                    </div>
                </div>

                {/* Warning */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-5 text-sm text-red-700">
                    You are about to permanently delete{' '}
                    <span className="font-bold">{user.name}</span>{' '}
                    and all their data including file history.
                </div>

                {/* Type to confirm */}
                <p className="text-sm text-gray-700 mb-2">
                    Type <span className="font-bold text-gray-900">{user.name}</span> to confirm:
                </p>
                <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={user.name}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-5 text-sm"
                />

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={confirmInput !== user.name || isDeleting}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteModal;