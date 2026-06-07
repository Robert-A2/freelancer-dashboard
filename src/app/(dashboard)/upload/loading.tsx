import { Sk, SkCard } from "@/components/ui/Skeleton";

export default function UploadLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 md:space-y-8">

      {/* Page title */}
      <div className="space-y-2">
        <Sk h="h-7" w="w-28" rounded="rounded-xl" />
        <Sk h="h-4" w="w-80" />
      </div>

      {/* Drop zone */}
      <div className="border-2 border-dashed border-[#1E3550] rounded-2xl p-8 md:p-12 flex flex-col items-center gap-3">
        <Sk h="h-10" w="w-10" rounded="rounded-xl" />
        <Sk h="h-4" w="w-36" />
        <Sk h="h-3" w="w-24" />
        <Sk h="h-3" w="w-52" className="mt-1" />
      </div>

      {/* Format guide */}
      <SkCard>
        <Sk h="h-3" w="w-28" className="mb-3" />
        <Sk h="h-20" rounded="rounded-xl" className="mb-3" />
        <Sk h="h-3" w="w-full" />
        <Sk h="h-3" w="w-4/5" className="mt-1.5" />
      </SkCard>

    </div>
  );
}
