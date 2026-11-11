import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode; level?: 'halaman' | 'tata letak' }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(`[ErrorBoundary:${this.props.level ?? 'halaman'}]`, error, info.componentStack)
  }
  reload = () => this.setState({ error: null })
  render() {
    if (!this.state.error) return this.props.children
    return <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-danger/30 bg-danger/5 p-6 text-sm text-danger">
      <h2 className="font-bold">Halaman tidak dapat ditampilkan</h2>
      <p className="mt-2">Terjadi kesalahan saat memuat {this.props.level ?? 'halaman'}. Coba muat ulang.</p>
      <button onClick={this.reload} className="mt-4 rounded-xl bg-brand px-4 py-2 font-semibold text-white">Muat ulang</button>
    </div>
  }
}
