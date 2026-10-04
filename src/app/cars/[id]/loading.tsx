export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-6">
      <div className="skeleton mb-5 h-10 w-80 rounded-xl" />
      <div className="skeleton h-[460px] rounded-[1.75rem]" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
        <div className="skeleton h-[520px] rounded-[1.75rem]" />
      </div>
    </div>
  );
}
