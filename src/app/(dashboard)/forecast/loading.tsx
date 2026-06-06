import { Sk, SkCard } from "@/components/ui/Skeleton";

export default function ForecastLoading() {
  return (
    <div className="space-y-8 md:space-y-10">

      {/* Page title */}
      <div className="space-y-2">
        <Sk h="h-7" w="w-24" rounded="rounded-xl" />
        <Sk h="h-4" w="w-72" />
      </div>

      {/* 4 health/status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkCard key={i} sm>
            <Sk h="h-3" w="w-20" className="mb-3" />
            <Sk h="h-7" w="w-28" rounded="rounded-lg" className="mb-2" />
            <Sk h="h-3" w="w-full" />
            <Sk h="h-3" w="w-3/4" className="mt-1" />
          </SkCard>
        ))}
      </div>

      {/* Year-end projection */}
      <SkCard>
        <div className="flex items-start justify-between flex-wrap gap-2 mb-4">
          <div className="space-y-1.5">
            <Sk h="h-3" w="w-32" />
            <Sk h="h-4" w="w-64" />
          </div>
          <Sk h="h-7" w="w-24" rounded="rounded-full" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#F7F8F5] rounded-xl p-3 space-y-2">
              <Sk h="h-3" w="w-24" />
              <Sk h="h-7" w="w-28" rounded="rounded-lg" />
              <Sk h="h-3" w="w-20" />
            </div>
          ))}
        </div>
      </SkCard>

      {/* Key drivers */}
      <SkCard>
        <Sk h="h-3" w="w-24" className="mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#F7F8F5] rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <Sk h="h-4" w="w-36" />
                <Sk h="h-5" w="w-16" rounded="rounded-full" />
              </div>
              <Sk h="h-3" w="w-full" />
              <Sk h="h-3" w="w-4/5" />
            </div>
          ))}
        </div>
      </SkCard>

      {/* Scenario + risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkCard>
          <Sk h="h-3" w="w-28" className="mb-4" />
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-[#F7F8F5] rounded-xl p-3 space-y-1.5">
                <Sk h="h-4" w="w-24" />
                <Sk h="h-5" w="w-32" rounded="rounded-lg" />
              </div>
            ))}
          </div>
        </SkCard>
        <SkCard>
          <Sk h="h-3" w="w-28" className="mb-4" />
          <div className="space-y-3">
            {[1,2].map(i => <Sk key={i} h="h-16" rounded="rounded-xl" />)}
          </div>
        </SkCard>
      </div>

    </div>
  );
}
