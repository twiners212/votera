export default function PublicLoading() {
  return (
    <div
      role="status"
      aria-label="Memuat konten halaman..."
      className="flex min-h-screen flex-col bg-[#F8FAFC]"
    >
      <span className="sr-only">Memuat data pemilihan...</span>
      {/* Top Navbar Skeleton */}
      <div className="h-16 border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-100 animate-pulse" />
            <div className="h-5 w-32 rounded-[6px] bg-slate-100 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden h-9 w-20 rounded-[10px] bg-slate-100 sm:block animate-pulse" />
            <div className="h-9 w-24 rounded-[10px] bg-slate-100 animate-pulse" />
          </div>
        </div>
      </div>

      <main className="flex-1">
        {/* Hero Section Skeleton */}
        <section className="border-b border-[#E2E8F0] bg-[#FFF5F3] py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="h-5 w-36 rounded-full bg-red-100 animate-pulse" />
            <div className="mt-3 h-9 w-64 rounded-[8px] bg-slate-200 sm:h-12 sm:w-96 animate-pulse" />
            <div className="mt-3 h-4 w-72 rounded-[6px] bg-slate-200/80 sm:w-[480px] animate-pulse" />
            <div className="mt-6 flex gap-3">
              <div className="h-10 w-36 rounded-[12px] bg-red-200/60 animate-pulse" />
              <div className="h-10 w-28 rounded-[12px] bg-white border border-[#E2E8F0] animate-pulse" />
            </div>
          </div>
        </section>

        {/* Candidate Showcase Grid Skeleton */}
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="h-3.5 w-28 rounded-full bg-red-100 animate-pulse" />
              <div className="mt-1.5 h-6 w-44 rounded-[8px] bg-slate-200 animate-pulse" />
            </div>
            <div className="h-4 w-28 rounded-[6px] bg-slate-100 animate-pulse" />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm"
              >
                <div className="h-48 w-full rounded-[12px] bg-slate-100 animate-pulse sm:h-52" />
                <div className="mt-4 flex items-center justify-between">
                  <div className="h-5 w-16 rounded-full bg-red-50 animate-pulse" />
                  <div className="h-4 w-20 rounded-[6px] bg-slate-100 animate-pulse" />
                </div>
                <div className="mt-2.5 h-5 w-3/4 rounded-[6px] bg-slate-200 animate-pulse" />
                <div className="mt-2 h-4 w-5/6 rounded-[6px] bg-slate-100 animate-pulse" />
                <div className="mt-4 border-t border-[#E2E8F0]/60 pt-4">
                  <div className="h-9 w-full rounded-[10px] bg-slate-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer Skeleton */}
      <div className="h-24 border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="h-4 w-40 rounded-[6px] bg-slate-100 animate-pulse" />
          <div className="h-4 w-24 rounded-[6px] bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
