import { ResponsiveModal } from '@/components/ui/ResponsiveModal';
import { ReactNode } from 'react';

interface ModalWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export function ModalWrapper({ open, onOpenChange, title, children }: ModalWrapperProps) {
  return (
    <ResponsiveModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={title}
      className="max-h-[85vh] overflow-y-auto"
      maxWidth="4xl"
    >
      {children}
    </ResponsiveModal>
  );
}
