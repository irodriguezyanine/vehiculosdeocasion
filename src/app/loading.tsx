export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[#f6efe8] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-[#e7d9cc]" />
        <div className="mt-6 h-40 animate-pulse rounded-3xl bg-[#e7d9cc]" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="h-44 animate-pulse bg-[#e7d9cc]" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-[#efe4d8]" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-[#efe4d8]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
