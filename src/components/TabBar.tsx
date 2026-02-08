import type { ReactNode } from 'react'
import './TabBar.css'

export type TabId = 'ukeplan' | 'retter' | 'fellesskap' | 'historikk'

const svgProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const CalendarIcon = () => (
  <svg {...svgProps}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const UtensilsIcon = () => (
  <svg {...svgProps}>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
  </svg>
)

const UsersIcon = () => (
  <svg {...svgProps}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const BarChartIcon = () => (
  <svg {...svgProps}>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
)

const TABS: { id: TabId; label: string; icon: () => ReactNode }[] = [
  { id: 'ukeplan', label: 'Ukeplan', icon: CalendarIcon },
  { id: 'retter', label: 'Retter', icon: UtensilsIcon },
  { id: 'fellesskap', label: 'Fellesskap', icon: UsersIcon },
  { id: 'historikk', label: 'Historikk', icon: BarChartIcon },
]

interface TabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab-btn ${tab.id === activeTab ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="tab-icon">{tab.icon()}</span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
