import * as SeparatorPrimitive from '@radix-ui/react-separator';
import type { ComponentPropsWithoutRef, ComponentRef } from 'react';
import { cn } from '@/lib/utils';

const Separator = ({
  className,
  orientation = 'horizontal',
  decorative = true,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & {
  ref?: React.Ref<ComponentRef<typeof SeparatorPrimitive.Root>>;
}) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
