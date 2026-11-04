'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const variantConfig = {
  danger: {
    icon: '⚠️',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-700',
    confirmButton: 'destructive' as const,
  },
  warning: {
    icon: '⚠️',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-700',
    confirmButton: 'secondary' as const,
  },
  info: {
    icon: 'ℹ️',
    iconBg: 'bg-primary-light',
    iconColor: 'text-primary',
    confirmButton: 'primary' as const,
  },
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'אשר',
  cancelText = 'ביטול',
  variant = 'info',
  loading = false,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const config = variantConfig[variant];

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClose = () => {
    if (!isConfirming && !loading) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} className="max-w-md">
      <div className="p-4 sm:p-6">
        {/* Icon */}
        <div className="mx-auto flex h-14 w-14 sm:h-12 sm:w-12 items-center justify-center rounded-full mb-4">
          <div
            className={cn(
              'flex h-full w-full items-center justify-center rounded-full',
              config.iconBg
            )}
          >
            <span className={cn('text-3xl sm:text-2xl', config.iconColor)} role="img" aria-hidden="true">
              {config.icon}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <h3 className="text-xl font-bold text-text-primary mb-2">{title}</h3>
          <p className="text-text-secondary mb-6 text-sm sm:text-base leading-relaxed">{message}</p>
        </div>

        {/* Actions – full-width stacked on mobile, inline on desktop */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isConfirming || loading}
            size="lg"
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>
          <Button
            variant={config.confirmButton}
            onClick={handleConfirm}
            loading={isConfirming || loading}
            disabled={isConfirming || loading}
            size="lg"
            className="w-full sm:w-auto"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Hook for using confirm dialogs
export function useConfirmDialog() {
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    variant?: ConfirmDialogProps['variant'];
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const confirm = (options: {
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    variant?: ConfirmDialogProps['variant'];
    confirmText?: string;
    cancelText?: string;
  }) => {
    setDialog({
      isOpen: true,
      ...options,
    });
  };

  const close = () => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      isOpen={dialog.isOpen}
      onClose={close}
      onConfirm={dialog.onConfirm}
      title={dialog.title}
      message={dialog.message}
      variant={dialog.variant}
      confirmText={dialog.confirmText}
      cancelText={dialog.cancelText}
    />
  );

  return {
    confirm,
    ConfirmDialogComponent,
  };
}
