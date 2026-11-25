import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  href?: string;
}

/** CRM record/list header: breadcrumb trail with the page title last, actions on the right. */
export function PageHeader({
  title,
  description,
  crumbs = [],
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-1.5 text-xl font-normal text-slate-900 dark:text-slate-100">
          {crumbs.map((c) => (
            <React.Fragment key={c.label}>
              {c.href ? (
                <Link href={c.href} className="text-brand-600 hover:underline dark:text-brand-400">
                  {c.label}
                </Link>
              ) : (
                <span className="text-slate-500">{c.label}</span>
              )}
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </React.Fragment>
          ))}
          <span className="truncate">{title}</span>
        </h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
