import { X, LogOut } from "lucide-react";

function LogoutModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center overflow-y-auto px-3 py-4 sm:px-4">
      <style>{`
        @keyframes logout-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes logout-modal-in {
          0% { opacity: 0; transform: scale(0.92) translateY(16px); }
          60% { transform: scale(1.01) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .logout-backdrop-in { animation: logout-backdrop-in 0.3s ease-out forwards; }
        .logout-modal-in { animation: logout-modal-in 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) forwards; }
      `}</style>
      
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm logout-backdrop-in"
        onClick={onClose}
      />

      
      <div className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900/95 p-4 shadow-xl logout-modal-in sm:p-5">
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-zinc-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Logout</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        
        <p className="text-zinc-400 text-sm mb-6">
          Are you sure you want to logout?
        </p>

        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogoutModal;
