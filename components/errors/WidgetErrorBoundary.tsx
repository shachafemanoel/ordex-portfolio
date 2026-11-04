'use client';

import { RefreshCw, AlertCircle } from 'lucide-react';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  title?: string;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WidgetErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={`p-4 rounded-lg border border-red-200 bg-red-50 flex flex-col items-center justify-center text-center h-full min-h-[200px] ${this.props.className || ''}`}>
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <h3 className="text-sm font-semibold text-red-800 mb-1">
            {this.props.title || 'שגיאה בטעינת הווידג׳ט'}
          </h3>
          <p className="text-xs text-red-600 mb-4 max-w-[250px]">
            {this.state.error?.message || 'אירעה שגיאה לא צפויה'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
            className="bg-white border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            <RefreshCw className="w-3 h-3 ml-1" />
            נסה שוב
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
