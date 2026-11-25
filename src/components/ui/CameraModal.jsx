'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function CameraModal({ isOpen, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isOpenRef = useRef(isOpen);
  const startRequestIdRef = useRef(0);
  const facingModeRef = useRef('user');
  const previewUrlRef = useRef(null);
  const noticeTimerRef = useRef(null);

  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [facingMode, setFacingMode] = useState('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [switchNotice, setSwitchNotice] = useState(null);

  const showTemporaryNotice = useCallback((message, duration = 2000) => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    setSwitchNotice(message);
    noticeTimerRef.current = setTimeout(() => {
      setSwitchNotice(null);
      noticeTimerRef.current = null;
    }, duration);
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * Deteksi apakah perangkat memiliki 2 kamera (kamera depan & kamera belakang).
   */
  const checkCameraConfiguration = useCallback((stream, devicesList) => {
    const isMobileDevice =
      typeof navigator !== 'undefined' &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) ||
        (typeof navigator.maxTouchPoints === 'number' &&
          navigator.maxTouchPoints > 1 &&
          !/Windows NT/i.test(navigator.userAgent)));

    const validVideoInputs = (devicesList || []).filter((d) => {
      if (d.kind !== 'videoinput') return false;
      const lbl = (d.label || '').toLowerCase();
      if (lbl.includes('ir ') || lbl.includes('infrared')) return false;
      return true;
    });

    let supportsDualFacing = false;
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities();
        if (
          Array.isArray(capabilities?.facingMode) &&
          capabilities.facingMode.includes('user') &&
          capabilities.facingMode.includes('environment')
        ) {
          supportsDualFacing = true;
        }
      }
    }

    const hasFrontAndBackLabels =
      validVideoInputs.some((d) => /front|user|depan|selfie/i.test(d.label)) &&
      validVideoInputs.some((d) => /back|rear|environment|belakang/i.test(d.label));

    const isDualCamera =
      supportsDualFacing ||
      (isMobileDevice && validVideoInputs.length >= 2) ||
      hasFrontAndBackLabels;

    setHasMultipleCameras(isDualCamera);
    return isDualCamera;
  }, []);

  const startCamera = useCallback(
    async (mode) => {
      const reqId = ++startRequestIdRef.current;
      stopStream();
      setStreamReady(false);
      setCameraError(null);

      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setLoading(false);
        setCameraError(
          'Kamera web langsung hanya aktif di koneksi HTTPS atau localhost. Kamu tetap bisa memilih foto lewat tombol "Buka Galeri Perangkat" di bawah atau "Pilih dari Galeri".'
        );
        return;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setLoading(false);
        setCameraError(
          'Browser ini belum mendukung kamera web langsung. Silakan gunakan tombol "Buka Galeri Perangkat" di bawah atau "Pilih dari Galeri".'
        );
        return;
      }

      setLoading(true);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        // Cegah kebocoran stream kamera jika modal ditutup atau mode diubah saat menunggu izin
        if (!isOpenRef.current || reqId !== startRequestIdRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setLoading(false);

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (isOpenRef.current && reqId === startRequestIdRef.current) {
            checkCameraConfiguration(stream, devices);
          }
        } catch (enumErr) {
          console.warn('Gagal membaca enumerateDevices:', enumErr);
        }
      } catch (err) {
        if (!isOpenRef.current || reqId !== startRequestIdRef.current) {
          return;
        }
        console.warn('Camera access unavailable:', err?.name || err?.message);
        const errName = err?.name || '';
        let message =
          'Tidak dapat mengakses kamera perangkat. Silakan gunakan opsi "Buka Galeri Perangkat" atau "Pilih dari Galeri".';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          message = 'Izin akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.';
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          message =
            'Kamera tidak ditemukan pada perangkat ini. Silakan gunakan tombol "Buka Galeri Perangkat" atau "Pilih dari Galeri".';
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          message =
            'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi tersebut atau gunakan "Pilih dari Galeri".';
        }
        setCameraError(message);
        setLoading(false);
      }
    },
    [stopStream, checkCameraConfiguration]
  );

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const handleClose = useCallback(() => {
    startRequestIdRef.current += 1;
    isOpenRef.current = false;
    stopStream();
    revokePreviewUrl();
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    setCapturedBlob(null);
    setCameraError(null);
    setStreamReady(false);
    setSwitchNotice(null);
    facingModeRef.current = 'user';
    setFacingMode('user');
    onClose();
  }, [stopStream, revokePreviewUrl, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (!isOpen) {
      startRequestIdRef.current += 1;
      stopStream();
      return;
    }

    const timer = setTimeout(() => {
      startCamera(facingModeRef.current);
    }, 0);

    return () => {
      clearTimeout(timer);
      startRequestIdRef.current += 1;
      stopStream();
    };
  }, [isOpen, startCamera, stopStream]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
  }, []);

  const handleToggleCamera = () => {
    if (!hasMultipleCameras) {
      showTemporaryNotice('Perangkat Anda hanya memiliki 1 kamera aktif.', 2500);
      return;
    }

    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    facingModeRef.current = nextMode;
    setFacingMode(nextMode);
    startCamera(nextMode);
    showTemporaryNotice(
      nextMode === 'user' ? 'Beralih ke Kamera Depan' : 'Beralih ke Kamera Belakang',
      2000
    );
  };

  const isMirrored = !hasMultipleCameras || facingMode === 'user';

  const handleTakePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    const maxW = 1280;
    const rawW = video.videoWidth;
    const rawH = video.videoHeight;
    const scale = rawW > maxW ? maxW / rawW : 1;
    canvas.width = Math.round(rawW * scale);
    canvas.height = Math.round(rawH * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        revokePreviewUrl();
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setCapturedBlob(blob);
        setPreviewUrl(url);
        setStreamReady(false);
        stopStream();
      },
      'image/jpeg',
      0.88
    );
  };

  const handleRetake = () => {
    revokePreviewUrl();
    setCapturedBlob(null);
    startCamera(facingModeRef.current);
  };

  const handleConfirmPhoto = () => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], 'kamera-capture.jpg', {
      type: 'image/jpeg',
    });
    onCapture(file);
    handleClose();
  };

  const handleNativeFallback = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      onCapture(file);
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ambil Foto dengan Kamera"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-ink/80 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg bg-ink sm:rounded-2xl shadow-lg overflow-hidden flex flex-col h-dvh sm:h-auto sm:max-h-[90dvh] border border-white/15">
        {/* Header Modal */}
        <div className="flex items-center justify-between p-4 bg-navy-900 text-white z-10 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Camera className="w-5 h-5 text-campus-gold shrink-0" aria-hidden="true" />
            <span className="font-bold text-sm truncate">Ambil Foto Barang</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!cameraError && !previewUrl && (
              <span className="hidden sm:inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-white/15 text-white">
                {!hasMultipleCameras
                  ? 'Kamera Laptop'
                  : facingMode === 'user'
                  ? 'Kamera Depan'
                  : 'Kamera Belakang'}
              </span>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="w-11 h-11 md:w-10 md:h-10 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              aria-label="Tutup kamera"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Viewport Kamera / Pratinjau Foto */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[240px] sm:min-h-[380px] overflow-hidden">
          {switchNotice && (
            <div className="absolute top-4 z-20 px-4 py-2 rounded-lg bg-navy-900/95 border border-white/20 text-white text-xs font-semibold shadow-lg flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-campus-gold" aria-hidden="true" />
              <span>{switchNotice}</span>
            </div>
          )}

          {cameraError ? (
            <div className="p-6 text-center flex flex-col items-center gap-3 max-w-xs text-white">
              <AlertCircle className="w-12 h-12 text-campus-gold" aria-hidden="true" />
              <p className="text-xs md:text-sm text-white/90 leading-relaxed">
                {cameraError}
              </p>
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition-colors mt-2">
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span>Buka Galeri Perangkat</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture={facingMode}
                  className="hidden"
                  onChange={handleNativeFallback}
                />
              </label>
            </div>
          ) : previewUrl ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Pratinjau Hasil Jepretan"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setStreamReady(true)}
                className={`w-full h-full object-cover ${
                  isMirrored ? 'scale-x-[-1]' : ''
                }`}
              />
              {loading && (
                <div className="absolute inset-0 bg-ink/70 flex items-center justify-center text-white text-xs font-medium">
                  Memulai kamera...
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Tombol Aksi */}
        <div className="px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-navy-900 border-t border-white/10 flex items-center justify-around text-white shrink-0">
          {previewUrl ? (
            <div className="w-full flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                onClick={handleRetake}
                className="bg-white/15 text-white border-white/25 hover:bg-white/25 hover:text-white"
                icon={RefreshCw}
              >
                Ambil Ulang
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmPhoto}
                icon={Check}
              >
                Gunakan Foto Ini
              </Button>
            </div>
          ) : !cameraError ? (
            <div className="w-full flex items-center justify-between px-4">
              <button
                type="button"
                onClick={handleToggleCamera}
                className="w-11 h-11 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors flex items-center justify-center"
                aria-label={
                  !hasMultipleCameras
                    ? 'Informasi kamera perangkat'
                    : facingMode === 'user'
                    ? 'Ganti ke Kamera Belakang'
                    : 'Ganti ke Kamera Depan'
                }
                title={
                  !hasMultipleCameras
                    ? 'Perangkat hanya memiliki 1 kamera'
                    : facingMode === 'user'
                    ? 'Ganti ke Kamera Belakang'
                    : 'Ganti ke Kamera Depan'
                }
              >
                <RefreshCw className="w-5 h-5" aria-hidden="true" />
              </button>

              {/* Tombol Shutter Lingkaran Besar per design2.md 5.7 */}
              <button
                type="button"
                onClick={handleTakePhoto}
                disabled={loading || !streamReady}
                aria-label="Jepret Foto"
                className="w-14 h-14 rounded-full bg-white ring-4 ring-brand-blue flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-transform"
              >
                <span className="w-5 h-5 rounded-full bg-brand-blue" />
              </button>

              <div className="w-11" aria-hidden="true" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
