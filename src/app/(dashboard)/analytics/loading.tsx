import { Sk, SkCard } from "@/components/ui/Skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8 md:space-y-10">

      {/* Page title */}
      <div className="space-y-2">
        <Sk h="h-7" w="w-28" rounded="rounded-xl" />
        <Sk h="h-4" w="w-64" />
      </div>

      {/* YTD overview — 4 stat cards */}
      <SkCard>
        <div className="flex items-start justify-between mb-5">
          <div className="space-y-1.5">
            <Sk h="h-3" w="w-24" />
            <Sk h="h-5" w="w-40" />
          </div>
          <Sk h="h-8" w="w-24" rounded="rounded-lg" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#F7F8F5] rounded-xl p-4 space-y-2">
              <Sk h="h-3" w="w-20" />
              <Sk h="h-6" w="w-24" rounded="rounded-lg" />
              <Sk h="h-3" w="w-16" />
            </div>
          ))}
        </div>
      </SkCard>

      {/* Cashflow chart */}
      <SkCard>
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1.5">
            <Sk h="h-3" w="w-28" />
            <Sk h="h-5" w="w-52" />
          </div>
          <div className="flex gap-1.5">
            {[1,2,3].map(i => <Sk key={i} h="h-8" w="w-10" rounded="rounded-lg" />)}
          </div>
        </div>
        <Sk h="h-[220px]" rounded="rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#F7F8F5] rounded-xl p-4 space-y-2">
              <Sk h="h-3" w="w-16" />
              <Sk h="h-5" w="w-20" rounded="rounded-lg" />
            </div>
          ))}
        </div>
      </SkCard>

      {/* Category breakdown + client insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkCard>
          <Sk h="h-3" w="w-32" className="mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Sk h="h-3.5" w="w-28" />
                  <Sk h="h-3.5" w="w-14" />
                </div>
                <Sk h="h-2" rounded="rounded-full" />
              </div>
            ))}
          </div>
        </SkCard>
        <SkCard>
          <Sk h="h-3" w="w-28" className="mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <Sk h="h-3.5" w="w-32" />
                  <Sk h="h-3" w="w-20" />
                </div>
                <Sk h="h-5" w="w-14" rounded="rounded-full" />
              </div>
            ))}
          </div>
        </SkCard>
      </div>

    </div>
  );
}
