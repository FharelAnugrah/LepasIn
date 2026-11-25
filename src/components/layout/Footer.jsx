import { ShieldCheck } from 'lucide-react';

export default function Footer({ minimal = false }) {
  return (
    <footer
      className={`bg-navy-900 text-white border-t-4 border-navy-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] mt-auto ${
        minimal ? 'py-5' : 'py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-1">
          <span className="inline-flex items-baseline font-extrabold text-sm text-white tracking-tight">
            <span>LepasIn</span>
            <span
              className="w-1.5 h-1.5 rounded-[3px] bg-campus-gold inline-block ml-0.5 mb-0.5 shadow-[0_1.5px_0_#B87D04]"
              aria-hidden="true"
            />
          </span>
          <span className="text-slate-400" aria-hidden="true">
            &bull;
          </span>
          <p className="text-slate-300">
            2026 LepasIn. Marketplace Preloved Mahasiswa Indonesia.
          </p>
        </div>

        <p className="inline-flex items-center gap-1.5 text-slate-300 shrink-0">
          <ShieldCheck className="w-4 h-4 text-campus-gold shrink-0" aria-hidden="true" />
          <span>Verifikasi identitas KTM untuk penjual terpercaya</span>
        </p>
      </div>
    </footer>
  );
}
