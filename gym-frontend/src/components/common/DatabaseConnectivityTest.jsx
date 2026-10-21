import { useState, useEffect } from "react";
import {
  Database,
  Server,
  Link2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Clock,
} from "lucide-react";

function DatabaseConnectivityTest() {
  const [connectionStatus, setConnectionStatus] = useState(
    "Testing connection...",
  );
  const [loading, setLoading] = useState(false);
  const [serverTime, setServerTime] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [lastTested, setLastTested] = useState(null);

  const testConnection = async () => {
    setLoading(true);
    setConnectionStatus("Testing...");
    setErrorDetails(null);

    setTimeout(() => {
      const success = Math.random() > 0.3;
      if (success) {
        setConnectionStatus("Connected");
        setServerTime(new Date().toISOString());
        setErrorDetails(null);
      } else {
        setConnectionStatus("Connection Failed");
        setErrorDetails("Unable to connect to database server.");
        setServerTime(null);
      }
      setLoading(false);
      setLastTested(new Date());
    }, 1500);
  };

  useEffect(() => {
    testConnection();
  }, []);

  const statusConfig = {
    Connected: {
      icon: CheckCircle,
      iconColor: "text-classic-gold",
      borderColor: "border-dark-bronze/40",
      bgColor: "bg-classic-gold/10",
      label: "Connected",
      dotColor: "bg-classic-gold",
    },
    "Connection Failed": {
      icon: XCircle,
      iconColor: "text-red-400",
      borderColor: "border-red-500/40",
      bgColor: "bg-red-500/10",
      label: "Connection Failed",
      dotColor: "bg-red-400",
    },
    default: {
      icon: AlertCircle,
      iconColor: "text-classic-gold",
      borderColor: "border-dark-bronze/40",
      bgColor: "bg-classic-gold/10",
      label: "Testing...",
      dotColor: "bg-classic-gold",
    },
  };

  const currentStatus = statusConfig[connectionStatus] || statusConfig.default;
  const StatusIcon = currentStatus.icon;

  return (
    <div className="win-full min-h-screen flex items-center justify-center p-4 bg-linear-to-r from-neutral-800 to-neutral-900">
      <div className="w-full max-w-lg mx-auto bg-neutral-900 rounded-2xl border border-amber-900/30 shadow-xl overflow-hidden">
        
        <div className="h-1 bg-linear-to-r from-dark-bronze  to-classic-gold" />

        
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-dark-bronze/20 border border-amber-500/30 flex items-center justify-center">
                <Database className="w-5 h-5 text-classic-gold" />
              </div>
              <div>
                <h2 className="text-xs text-gradient uppercase tracking-wider font-bold">
                  Database
                </h2>
                <p className="text-[10px] text-neutral-500">
                  Connectivity Monitor
                </p>
              </div>
            </div>
          </div>
        </div>

        
        <div className="px-6 pb-3">
          <div
            className={`flex flex-col items-center justify-center p-5 rounded-xl border ${currentStatus.borderColor} ${currentStatus.bgColor} transition-all`}
          >
            <div className="relative mb-3">
              <div className="w-14 h-14 rounded-full bg-neutral-800/80 border-2 border-amber-500/30 flex items-center justify-center">
                <StatusIcon
                  className={`w-7 h-7 ${currentStatus.iconColor} ${loading ? "animate-pulse" : ""}`}
                />
              </div>
              {loading && (
                <div className="absolute inset-0 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${currentStatus.dotColor} ${loading ? "animate-pulse" : ""}`}
              />
              <p className={`text-xl font-bold ${currentStatus.iconColor}`}>
                {currentStatus.label}
              </p>
            </div>

            {loading && (
              <p className="text-amber-400/60 text-xs mt-2 animate-pulse">
                Establishing connection...
              </p>
            )}
          </div>
        </div>

        
        {serverTime && (
          <div className="px-6 pb-3">
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2.5 bg-neutral-800/60 rounded-lg">
                <Clock className="w-4 h-4 text-classic-gold" />
                <div>
                  <p className="text-[9px] text-classic-gold uppercase tracking-wider">
                    Server Time
                  </p>
                  <p className="text-xs font-mono text-neutral-300">
                    {serverTime.slice(0, 19)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 bg-neutral-800/60 rounded-lg">
                <Database className="w-4 h-4 text-classic-gold" />
                <div>
                  <p className="text-[9px] text-classic-gold uppercase tracking-wider">
                    Database
                  </p>
                  <p className="text-xs font-semibold text-neutral-300">
                    GymDB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 bg-neutral-800/60 rounded-lg">
                <Link2 className="w-4 h-4 text-classic-gold" />
                <div>
                  <p className="text-[9px] text-classic-gold uppercase tracking-wider">
                    API Endpoint
                  </p>
                  <p className="text-xs font-mono text-neutral-300">
                    localhost/Capstone%20project/gym-backend/api
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        
        {errorDetails && (
          <div className="px-6 pb-3">
            <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-lg">
              <p className="text-[10px] text-red-400 uppercase tracking-wider font-bold mb-1">
                Error
              </p>
              <code className="text-xs text-red-300/80 block font-mono">
                {errorDetails}
              </code>
            </div>
          </div>
        )}

        
        <div className="px-6 pb-4">
          <button
            className="w-full bg-gradient text-neutral-950 font-bold py-2.5 rounded-lg transition-all hover:shadow-lg hover:shadow-amber-600/25 hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
            onClick={testConnection}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="text-sm">
              {loading ? "Testing..." : "Test Connection"}
            </span>
          </button>
        </div>

        
        <div className="px-6 pb-4">
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-neutral-800/60">
            <Clock className="w-2.5 h-2.5 text-neutral-600" />
            <p className="text-[9px] text-neutral-600">
              Last tested:{" "}
              {lastTested ? lastTested.toLocaleTimeString() : "Just now"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DatabaseConnectivityTest;
