import { CardGridSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-6">
      <div className="skeleton mx-auto mb-8 h-16 max-w-4xl rounded-full" />
      <CardGridSkeleton />
    </div>
  );
}
