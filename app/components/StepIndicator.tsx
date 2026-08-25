const LANGKAH = ['Pilih Tanggal', 'Review Berita', 'Download'];

export default function StepIndicator({ aktif }: { aktif: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center justify-center gap-3 text-sm">
      {LANGKAH.map((nama, i) => {
        const n = i + 1;
        const ini = n === aktif;
        const lewat = n < aktif;
        return (
          <li key={nama} className="flex items-center gap-3">
            <span className={`flex items-center gap-2 ${ini ? 'font-semibold text-green-900' : 'text-gray-400'}`}>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  ini ? 'bg-green-800 text-white' : lewat ? 'bg-green-200 text-green-900' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {n}
              </span>
              {nama}
            </span>
            {n < LANGKAH.length && <span className="text-gray-300">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
