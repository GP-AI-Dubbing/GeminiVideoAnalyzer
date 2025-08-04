import { cn } from '@/lib/utils';
import * as React from 'react';

// Các kiểu typography hỗ trợ
export type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'p'
  | 'blockquote'
  | 'ul'
  | 'table'
  | 'lead'
  | 'large'
  | 'small'
  | 'muted';

// Map kiểu sang class tailwind
const variantMap: Record<TypographyVariant, string> = {
  h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
  h2: 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0',
  h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
  h4: 'scroll-m-20 text-xl font-semibold tracking-tight',
  p: 'leading-7 [&:not(:first-child)]:mt-6',
  blockquote: 'mt-6 border-l-2 pl-6 italic',
  ul: 'my-6 ml-6 list-disc [&>li]:mt-2',
  table: 'w-full',
  lead: 'text-xl text-muted-foreground',
  large: 'text-lg font-semibold',
  small: 'text-sm font-medium leading-none',
  muted: 'text-sm text-muted-foreground',
};

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  as?: TypographyVariant;
  className?: string;
}

export function Typography({ as = 'p', className, ...props }: TypographyProps) {
  const Tag = as as keyof React.JSX.IntrinsicElements;
  return React.createElement(Tag, { className: cn(variantMap[as], className), ...props });
}
