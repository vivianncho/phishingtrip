import { Component, type ComponentType, type ReactNode } from 'react';
export interface ErrorFallbackProps { error: Error; resetError: () => void }
interface Props { children: ReactNode; resetKey?: unknown; FallbackComponent?: ComponentType<ErrorFallbackProps> }
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(): { error: Error } { return { error: new Error('This screen could not be displayed.') }; }
  componentDidUpdate(previous: Props) { if (this.state.error && previous.resetKey !== this.props.resetKey) this.resetError(); }
  resetError = () => this.setState({ error: null });
  render() {
    if (!this.state.error) return this.props.children;
    const Fallback = this.props.FallbackComponent;
    return Fallback ? <Fallback error={this.state.error} resetError={this.resetError} /> : <section className="empty" role="alert"><h2>A small ripple.</h2><p>This screen couldn’t be displayed. No conclusion was reached about a phone number. Try opening it again or choose another page.</p><button className="btn primary" data-testid="button-recover-screen" onClick={this.resetError}>Try again</button></section>;
  }
}
