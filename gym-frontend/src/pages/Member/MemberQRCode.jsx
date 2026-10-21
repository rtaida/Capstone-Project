import { useRef, useState, useEffect } from "react";
import { QrCode, Download, CheckCircle, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import Logo from "../../assets/logo.png";

function MemberQRCode({ memberData, memberId, user }) {
  const cardRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [qrImageBase64, setQrImageBase64] = useState(null);
  const [isLoadingQr, setIsLoadingQr] = useState(true);


  useEffect(() => {
    let cancelled = false;

    const generateQRCode = async () => {
      setIsLoadingQr(true);
      setQrImageBase64(null);

      try {
        const resolvedMemberId = Number(
          memberData?.memberID ||
          memberData?.memberId ||
          memberId ||
          user?.memberID ||
          user?.id ||
          0,
        );

        if (!resolvedMemberId) {
          throw new Error(
            "Member ID is not available. Please log in again.",
          );
        }

        const qrData = JSON.stringify({
          member_id: resolvedMemberId,
          full_name:
            memberData?.full_name ||
            user?.fullName ||
            "Member",
          email:
            memberData?.email ||
            user?.email ||
            "",
        });

        const dataUrl = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: "M",
        });

        if (!cancelled) {
          setQrImageBase64(dataUrl);
        }
      } catch (error) {
        console.error("Error generating QR code:", error);

        if (!cancelled) {
          setQrImageBase64(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQr(false);
        }
      }
    };

    generateQRCode();

    return () => {
      cancelled = true;
    };
  }, [
    memberId,
    memberData?.memberID,
    memberData?.memberId,
    memberData?.full_name,
    memberData?.email,
    user?.id,
    user?.memberID,
    user?.fullName,
    user?.email,
  ]);

  const downloadCard = async () => {
    if (!cardRef.current) return;

    setIsDownloading(true);

    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#0a0a0a",
        skipAutoScale: true,
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `capra_qrcode_${(memberData?.full_name || "member").replace(/\s/g, "_")}.png`;
      link.href = dataUrl;
      link.click();

    } catch (error) {
      console.error("Error downloading card:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My QR Code</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Scan this QR code to check in at the gym
        </p>
      </div>

      <div className="flex flex-col items-center justify-center">

        <div
          ref={cardRef}
          className="bg-gradient-to-br from-zinc-900 to-black rounded-2xl border-2 border-classic-gold border-4 p-8 text-center max-w-md w-full shadow-2xl"
          style={{ backgroundColor: "#0a0a0a" }}
        >

          <div className="mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <img src={Logo} alt="Capra Fitness Logo" className="w-8 h-8" />
              <span className="text-gradient font-bold text-lg tracking-tight">
                CAPRA FITNESS
              </span>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-classic-gold/30 to-transparent" />
          </div>


          <div className="bg-white p-4 rounded-2xl inline-block mb-4 shadow-lg">
            {isLoadingQr ? (
              <div className="w-40 h-40 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-classic-gold animate-spin" />
              </div>
            ) : qrImageBase64 ? (
              <img
                src={qrImageBase64}
                alt="QR Code"
                className="w-40 h-40 object-contain"
              />
            ) : (
              <div className="w-40 h-40 bg-zinc-100 flex items-center justify-center rounded-xl">
                <QrCode className="w-20 h-20 text-zinc-400" />
              </div>
            )}
          </div>


          <div className="mb-4">
            <h3 className="text-white font-bold text-lg">
              {memberData?.full_name || user?.fullName || "Member"}
            </h3>
            <p className="text-zinc-400 text-sm font-mono mt-1">
              ID: {memberId || user?.id}
            </p>
          </div>


          <div className="h-px bg-gradient-to-r from-transparent via-classic-gold/30 to-transparent my-4" />


          <div className="text-left">
            <p className="text-classic-gold text-xs font-semibold mb-2">HOW TO USE:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-classic-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-classic-gold text-[10px] font-bold">1</span>
                </div>
                <p className="text-zinc-400 text-xs">Present this QR code at the gym entrance</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-classic-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-classic-gold text-[10px] font-bold">2</span>
                </div>
                <p className="text-zinc-400 text-xs">Scan your QR code in the gym's QR scanner to check in!</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                </div>
                <p className="text-zinc-400 text-xs">You're checked in! Enjoy your workout</p>
              </div>
            </div>
          </div>


          <div className="mt-4 pt-3 border-t border-classic-gold/10">
            <p className="text-zinc-600 text-[10px] text-center">
              Valid for CAPRA FITNESS members only
            </p>
          </div>
        </div>


        <button
          onClick={downloadCard}
          disabled={isDownloading || isLoadingQr}
          className="mt-6 w-full max-w-md py-3 bg-gradient text-black rounded-xl font-semibold hover:bg-light-gold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download QR Card
            </>
          )}
        </button>


        <p className="text-zinc-500 text-xs text-center mt-4">
          Click download to save this card as an image. Print it and bring to the gym!
        </p>
      </div>
    </div>
  );
}

export default MemberQRCode;