import { AlertCircle } from "lucide-react";

function MemberExistsModal({ isOpen, onClose, email }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center overflow-y-auto p-3 sm:p-4">
      
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-backdrop-in"
        onClick={onClose}
        aria-hidden="true"
      />

      
      <div className="relative animate-modal-in">
        
        <div className="absolute -inset-3 bg-red-500/15 rounded-3xl blur-2xl animate-glow-pulse" />

        
        <div className="relative my-auto max-h-[calc(100dvh-1.5rem)] w-[min(100%,24rem)] overflow-y-auto rounded-2xl border border-red-500/20 bg-[#111111] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:w-[400px]">
          
          <div className="h-1 bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0 animate-shimmer" />

          <div className="px-5 py-5 text-center sm:px-8 sm:py-8">
            
            <div className="relative mx-auto mb-4 h-16 w-16 sm:mb-6 sm:h-24 sm:w-24">
              <div className="absolute inset-0 rounded-full bg-red-500/10 animate-ring-expand" />
              <div className="absolute inset-3 rounded-full bg-red-500/15 animate-ring-expand-delayed" />
              <div className="relative w-full h-full rounded-full bg-red-500/15 flex items-center justify-center border border-red-500/30 animate-icon-pop">
                <AlertCircle
                  className="h-9 w-9 text-red-400 sm:h-12 sm:w-12"
                  strokeWidth={2}
                />
              </div>
            </div>

            
            <h2 className="mb-2 text-xl font-bold text-white animate-text-slide-up sm:mb-3 sm:text-2xl">
              Member Already Exists
            </h2>

            
            <p className="mb-5 text-sm leading-relaxed text-zinc-400 animate-text-fade-in sm:mb-8 sm:text-base">
              A member with email{" "}
              <span className="text-red-400 font-semibold">{email}</span>{" "}
              already exists in the system.
              <br />
              <br />
              <span className="text-red-400/80">
                ⚠️ This member may have been deleted by an admin.
              </span>
              <br />
              <br />
              Please use a different email address or contact the admin to
              restore the account.
            </p>

            
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition-all duration-300 hover:bg-red-500 hover:shadow-red-500/30 hover:-translate-y-0.5 active:translate-y-0 animate-button-in sm:py-3 sm:text-base"
            >
              OK
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-in {
          0% { opacity: 0; transform: scale(0.92) translateY(16px); }
          60% { transform: scale(1.01) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.98); }
          50% { opacity: 0.6; transform: scale(1.02); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes ring-expand {
          0% { transform: scale(0.85); opacity: 0.5; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes ring-expand-delayed {
          0% { transform: scale(0.85); opacity: 0.5; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes icon-pop {
          0% { transform: scale(0); opacity: 0; }
          55% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes text-slide-up {
          0% { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes text-fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes button-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .animate-backdrop-in {
          animation: backdrop-in 0.3s ease-out forwards;
        }
        .animate-modal-in {
          animation: modal-in 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        .animate-glow-pulse {
          animation: glow-pulse 3s ease-in-out infinite;
        }
        .animate-shimmer {
          background-size: 200% 100%;
          animation: shimmer 2.5s linear infinite;
        }
        .animate-ring-expand {
          animation: ring-expand 1.8s ease-out infinite;
        }
        .animate-ring-expand-delayed {
          animation: ring-expand-delayed 1.8s ease-out 0.4s infinite;
        }
        .animate-icon-pop {
          animation: icon-pop 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) 0.15s both;
        }
        .animate-text-slide-up {
          animation: text-slide-up 0.4s ease-out 0.3s both;
        }
        .animate-text-fade-in {
          animation: text-fade-in 0.4s ease-out 0.45s both;
        }
        .animate-button-in {
          animation: button-in 0.4s ease-out 0.55s both;
        }
      `}</style>
    </div>
  );
}

export default MemberExistsModal;
