import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function Broken() { throw new Error('unexpected null'); return null }

describe('ErrorBoundary', () => {
  it('menampilkan pesan Indonesia dan tombol muat ulang ketika render gagal', () => {
    render(<ErrorBoundary level="halaman"><Broken /></ErrorBoundary>)
    expect(screen.getByRole('alert').textContent).toContain('Halaman tidak dapat ditampilkan')
    expect(screen.getByRole('button', { name: 'Muat ulang' })).toBeTruthy()
  })
})
