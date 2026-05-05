import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40 mb-1.5" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center w-full mb-4">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="flex gap-2">
             <Skeleton className="h-8 w-32" />
             <Skeleton className="h-8 w-40" />
          </div>
        </div>

        <div className="flex justify-between items-center mb-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        <Card>
          <div className="border-b px-4 py-3">
             <div className="grid grid-cols-6 gap-4">
               {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-4 w-full" />)}
             </div>
          </div>
          <CardContent className="p-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border-b px-4 py-4 grid grid-cols-6 gap-4 items-center last:border-0">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
