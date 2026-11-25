import * as React from 'react';
import { cn } from '@/lib/utils';

export const nativeSelectClass = cn(
  'h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2377777e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:14px_14px] bg-[position:right_0.6rem_center] bg-no-repeat",
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
);

const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(({ className, ...props }, ref) => (
  <select ref={ref} data-slot="native-select" className={cn(nativeSelectClass, className)} {...props} />
));
NativeSelect.displayName = 'NativeSelect';

export { NativeSelect };
