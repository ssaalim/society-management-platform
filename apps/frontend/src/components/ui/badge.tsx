import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** CRM-style labels: small, squarish, pastel by status tone. */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm border border-transparent px-2 py-0.5 text-xs font-medium [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
        warning: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
        danger: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
        info: 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300',
        muted: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
