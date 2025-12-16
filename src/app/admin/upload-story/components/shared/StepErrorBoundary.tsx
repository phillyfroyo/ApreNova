"use client";

import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  stepNumber: number;
  stepLabel: string;
  onRetry?: () => void;
  onGoBack?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error boundary for story upload wizard steps.
 * Catches React errors in step components and provides recovery options.
 */
export class StepErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error(`Step ${this.props.stepNumber} (${this.props.stepLabel}) crashed:`, error);
    console.error("Component stack:", errorInfo.componentStack);

    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onRetry?.();
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onGoBack?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-red-50 border border-red-200 rounded-xl p-6 space-y-4">
            {/* Error Icon */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-800">
                  Step {this.props.stepNumber} Error
                </h3>
                <p className="text-sm text-red-600">
                  Something went wrong in &quot;{this.props.stepLabel}&quot;
                </p>
              </div>
            </div>

            {/* Error Message */}
            <div className="bg-white border border-red-100 rounded-lg p-3">
              <p className="text-sm text-gray-700 font-mono">
                {this.state.error?.message || "An unexpected error occurred"}
              </p>
            </div>

            {/* Recovery Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
              {this.props.onGoBack && (
                <button
                  onClick={this.handleGoBack}
                  className="flex-1 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Go Back
                </button>
              )}
            </div>

            {/* Debug Details (collapsed by default) */}
            <details className="text-xs">
              <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
                Technical details
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded text-gray-600 overflow-auto max-h-32">
                {this.state.error?.stack || "No stack trace available"}
              </pre>
            </details>

            {/* Help Text */}
            <p className="text-xs text-gray-500">
              Your progress has been auto-saved. If this keeps happening, try refreshing the page.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default StepErrorBoundary;
