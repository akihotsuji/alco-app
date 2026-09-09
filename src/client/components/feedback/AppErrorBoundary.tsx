import { Component, type ErrorInfo, type ReactNode } from "react";
import { AuthBoot } from "@/client/auth/AuthBoot.tsx";
import {
  isChunkLoadError,
  recoverFromAssetFailure,
  subscribeAssetRecovery,
} from "@/client/lib/asset-recovery.ts";

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * ルートの未捕捉エラー用。Error Boundary は class コンポーネントが必要。
 */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };
  private unsubscribe: (() => void) | undefined;

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidMount(): void {
    this.unsubscribe = subscribeAssetRecovery(() => {
      this.setState({ failed: true });
    });
  }

  override componentWillUnmount(): void {
    this.unsubscribe?.();
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    if (isChunkLoadError(error)) {
      const decision = recoverFromAssetFailure();
      if (decision === "reload") {
        return;
      }
    }
    this.setState({ failed: true });
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <AuthBoot
          variant="failed"
          onRetry={() => {
            this.setState({ failed: false });
          }}
        />
      );
    }
    return this.props.children;
  }
}
