import { Sk, SkCard } from "@/components/ui/Skeleton";

export default function ClientsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Sk h="h-3" w="w-20" />
        <Sk h="h-7" w="w-64" rounded="rounded-xl" />
        <Sk h="h-4" w="w-80" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#1A3048] rounded-xl p-4 space-y-2">
            <Sk h="h-3" w="w-20" />
            <Sk h="h-7" w="w-12" rounded="rounded-lg" />
          </div>
        ))}
      </div>

      {/* Client list */}
      <SkCard>
        <Sk h="h-3" w="w-24" className="mb-5" />
        <div className="space-y-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-4 border-b border-[#1E3550] last:border-0">
              <Sk h="h-3" w="w-4" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sk h="h-4" w="w-32" />
                  <Sk h="h-5" w="w-14" rounded="rounded-full" />
                </div>
                <Sk h="h-3" w="w-24" />
                <Sk h="h-0.5" rounded="rounded-full" />
              </div>
              <div className="space-y-1.5 text-right">
                <Sk h="h-4" w="w-20" />
                <Sk h="h-3" w="w-14" />
              </div>
            </div>
          ))}
        </div>
      </SkCard>
    </div>
  );
}
