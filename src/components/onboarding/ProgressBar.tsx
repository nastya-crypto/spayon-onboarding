export function ProgressBar({ current, labels }: { current: number; labels: readonly string[] }) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center">
        {labels.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                    ${done ? "bg-blue-600 text-white" : active ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-gray-200 text-gray-500"}`}
                >
                  {done ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`mt-1.5 text-xs font-medium hidden sm:block text-center max-w-[80px] leading-tight
                  ${active ? "text-blue-600" : done ? "text-gray-600" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {i < labels.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${done ? "bg-blue-600" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
