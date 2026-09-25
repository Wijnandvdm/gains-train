// Small stroke icons (24×24 grid), coloured via currentColor.
import type { SVGProps } from 'react'

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-6 w-6"
      {...props}
    />
  )
}

export const DumbbellIcon = () => (
  <Icon>
    <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
  </Icon>
)

export const HistoryIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)

export const ListIcon = () => (
  <Icon>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="4.5" cy="6.5" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="17.5" r="1" />
  </Icon>
)

export const ChartIcon = () => (
  <Icon>
    <path d="M4 20V4M4 20h16" />
    <path d="m7.5 15 4-4.5 3 3L20 7" />
  </Icon>
)

export const SearchIcon = () => (
  <Icon className="h-5 w-5">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
)

export const BackIcon = () => (
  <Icon>
    <path d="M15 5.5 8.5 12l6.5 6.5" />
  </Icon>
)
