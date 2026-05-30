function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-variant/40 ${className || ''}`}
    />
  )
}

export function EditorSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 lg:p-8">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Header breadcrumbs */}
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3 w-3" />
          <SkeletonBlock className="h-3 w-24" />
        </div>

        {/* Page icon + title */}
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-9 w-9 rounded-lg" />
          <SkeletonBlock className="h-10 w-64" />
          <SkeletonBlock className="h-8 w-20 rounded-lg" />
        </div>

        {/* Editor lines */}
        <div className="space-y-3 pt-4">
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-3/4" />
          <SkeletonBlock className="h-4 w-5/6" />
          <SkeletonBlock className="h-4 w-2/3" />
          <div className="pt-4">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-4/5 mt-3" />
            <SkeletonBlock className="h-4 w-3/4 mt-3" />
          </div>
          <div className="pt-4">
            <SkeletonBlock className="h-4 w-11/12" />
            <SkeletonBlock className="h-4 w-full mt-3" />
            <SkeletonBlock className="h-4 w-5/6 mt-3" />
            <SkeletonBlock className="h-4 w-3/5 mt-3" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SidebarSkeleton() {
  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Search bar */}
      <SkeletonBlock className="h-9 w-full rounded-lg" />

      {/* Project items */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-4 w-4 rounded" />
            <SkeletonBlock className="h-4 w-32" />
          </div>
          {i === 1 && (
            <div className="ml-6 space-y-2">
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
