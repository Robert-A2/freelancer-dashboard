import { Sk, SkCard } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 md:space-y-10">

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card-sm flex flex-col gap-3">
            <Sk h="h-3" w="w-16" />
            <Sk h="h-8" w="w-28" rounded="rounded-xl" />
            <Sk h="h-3" w="w-20" />
          </div>
        ))}
      </div>

      {/* Trends chart */}
      <SkCard>
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <Sk h="h-3" w="w-20" />
            <Sk h="h-5" w="w-48" />
          </div>
          <div className="flex gap-1.5">
            {[1,2,3,4].map(i => <Sk key={i} h="h-8" w="w-10" rounded="rounded-lg" />)}
          </div>
        </div>
        <Sk h="h-[260px]" rounded="rounded-xl" />
      </SkCard>

      {/* 3-col row: monthly comparison, forecast, historical insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SkCard>
          <Sk h="h-3" w="w-24" className="mb-3" />
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex justify-between items-center">
                <Sk h="h-4" w="w-24" />
                <Sk h="h-4" w="w-16" />
              </div>
            ))}
          </div>
        </SkCard>
        <SkCard>
          <Sk h="h-3" w="w-28" className="mb-3" />
          <Sk h="h-6" w="w-36" className="mb-4" rounded="rounded-xl" />
          <div className="space-y-2">
            {[1,2,3].map(i => <Sk key={i} h="h-4" w={i % 2 ? "w-full" : "w-4/5"} />)}
          </div>
        </SkCard>
        <SkCard>
          <Sk h="h-3" w="w-32" className="mb-3" />
          <div className="space-y-2">
            {[1,2,3].map(i => <Sk key={i} h="h-10" rounded="rounded-xl" />)}
          </div>
        </SkCard>
      </div>

      {/* Recent transactions */}
      <SkCard>
        <Sk h="h-3" w="w-36" className="mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sk h="h-8" w="w-8" rounded="rounded-full" />
                <div className="space-y-1.5">
                  <Sk h="h-3.5" w="w-36" />
                  <Sk h="h-3" w="w-20" />
                </div>
              </div>
              <Sk h="h-4" w="w-16" />
            </div>
          ))}
        </div>
      </SkCard>

    </div>
  );
}
