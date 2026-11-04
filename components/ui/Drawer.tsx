'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Drawer = DialogPrimitive.Root;

const DrawerTrigger = DialogPrimitive.Trigger;

const DrawerClose = DialogPrimitive.Close;

const DrawerPortal = DialogPrimitive.Portal;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/50  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
    ref={ref}
  />
));
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName;

const drawerVariants = cva(
  'fixed z-[var(--z-modal)] gap-4 bg-[var(--color-bg-primary)] p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
  {
    variants: {
      side: {
        // Logical properties based directions
        // We use left/right for actual CSS positioning but we must handle RTL aware classes for animations
        // ideally, CSS logical properties: inset-inline-end, but radix animation keyframes usually use transform.
        // For simplicity and Radix compatibility, we map 'end' to 'right' (LTR) or 'left' (RTL) via CSS or just support explicit 'left'/'right' and let the user choose based on direction.
        // HOWEVER, requirements say: "Uses logical properties for side... In RTL, drawer appears on inline end"

        // Let's implement 'start' and 'end' using Tailwind logicals:
        // top/bottom are same.
        // start (left in LTR, right in RTL): start-0 border-e
        // end (right in LTR, left in RTL): end-0 border-s

        top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        start:
          'inset-y-0 start-0 h-full w-3/4 border-e sm:max-w-sm data-[state=closed]:slide-out-to-left data-[state=closed]:rtl:slide-out-to-right data-[state=open]:slide-in-from-left data-[state=open]:rtl:slide-in-from-right',
        end: 'inset-y-0 end-0 h-full w-3/4 border-s sm:max-w-sm data-[state=closed]:slide-out-to-right data-[state=closed]:rtl:slide-out-to-left data-[state=open]:slide-in-from-right data-[state=open]:rtl:slide-in-from-left',
      },
    },
    defaultVariants: {
      side: 'end',
    },
  }
);

interface DrawerContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerVariants> {}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ side = 'end', className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(drawerVariants({ side }), className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute end-4 top-4 h-10 w-10 flex items-center justify-center rounded-full bg-slate-100 opacity-80 ring-offset-background transition-all hover:opacity-100 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary touch-manipulation active:scale-90">
        <X className="h-5 w-5" />
        <span className="sr-only">סגירה</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = DialogPrimitive.Content.displayName;

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-start', className)} {...props} />
);
DrawerHeader.displayName = 'DrawerHeader';

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
DrawerFooter.displayName = 'DrawerFooter';

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-[var(--color-text-primary)]', className)}
    {...props}
  />
));
DrawerTitle.displayName = DialogPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[var(--color-text-secondary)]', className)}
    {...props}
  />
));
DrawerDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
