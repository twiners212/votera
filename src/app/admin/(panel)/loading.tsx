export default function AdminPanelLoading() {
  return (
    <div
      role="status"
      aria-label="Memuat panel admin..."
      className="space-y-6"
    >
      <span className="sr-only">Memuat data panel admin...</span>
      {/* Page Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-7 w-52 rounded-[8px] bg-slate-200 animate-pulse" />
          <div className="mt-2 h-4 w-72 rounded-[6px] bg-slate-100 animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 rounded-[12px] bg-slate-100 animate-pulse" />
          <div className="h-10 w-32 rounded-[12px] bg-slate-200 animate-pulse" />
        </div>
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded-[6px] bg-slate-100 animate-pulse" />
              <div className="h-8 w-8 rounded-[8px] bg-slate-100 animate-pulse" />
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <div className="h-7 w-16 rounded-[6px] bg-slate-200 animate-pulse" />
              <div className="h-4 w-12 rounded-full bg-slate-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Table / Content Card Skeleton */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
        {/* Filter bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-10 w-full rounded-[10px] bg-slate-100 sm:w-72 animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-28 rounded-[10px] bg-slate-100 animate-pulse" />
            <div className="h-10 w-28 rounded-[10px] bg-slate-100 animate-pulse" />
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-3">
          <div className="h-10 w-full rounded-[8px] bg-slate-100 animate-pulse" />
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="h-14 w-full rounded-[8px] border border-[#E2E8F0]/60 bg-slate-50/40 p-3 flex items-center justify-between animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-slate-200" />
                <div className="h-4 w-36 rounded bg-slate-200" />
              </div>
              <div className="hidden h-4 w-24 rounded bg-slate-100 sm:block" />
              <div className="h-4 w-16 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
