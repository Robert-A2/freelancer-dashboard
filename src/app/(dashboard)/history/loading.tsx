import { Sk, SkCard } from "@/components/ui/Skeleton";

export default function HistoryLoading() {
  return (
    <div className="space-y-8 md:space-y-10">

      {/* Page title */}
      <div className="space-y-2">
        <Sk h="h-7" w="w-20" rounded="rounded-xl" />
        <Sk h="h-4" w="w-56" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Sk key={i} h="h-9" w="w-20" rounded="rounded-lg" />
        ))}
        <Sk h="h-9" w="w-36" rounded="rounded-xl" className="ml-auto" />
      </div>

      {/* Transaction list */}
      <SkCard>
        <div className="divide-y divide-[#1E3550]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <Sk h="h-8" w="w-8" rounded="rounded-full" />
                <div className="space-y-1.5 min-w-0">
                  <Sk h="h-3.5" w="w-44" />
                  <Sk h="h-3" w="w-24" />
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Sk h="h-6" w="w-16" rounded="rounded-full" />
                <Sk h="h-4" w="w-16" />
              </div>
            </div>
          ))}
        </div>
        {/* Pagination */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#1E3550]">
          <Sk h="h-4" w="w-32" />
          <div className="flex gap-2">
            <Sk h="h-8" w="w-16" rounded="rounded-lg" />
            <Sk h="h-8" w="w-16" rounded="rounded-lg" />
          </div>
        </div>
      </SkCard>

    </div>
  );
}
