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

/** The gains train: a locomotive whose wheels are weight plates on a bar. */
export const TrainIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="9.6" cy="2.4" r="1" />
    <circle cx="12.4" cy="1.6" r="0.7" />
    <path d="M5.2 4.8h4l-.7 4" />
    <path d="M5.9 8.8l-.7-4" />
    <rect x="2.5" y="8.8" width="10.5" height="6" rx="2" />
    <path d="M13 14.8V6.2h7v8.6" />
    <path d="M12.2 5.4h8.8" />
    <rect x="15" y="7.8" width="3" height="2.8" rx=".5" />
    <path d="M1.5 15.4h20" />
    <circle cx="7" cy="18.9" r="2.6" />
    <circle cx="17" cy="18.9" r="2.6" />
    <path d="M2.6 18.9h18.8" />
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

export const GearIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2" />
    <circle cx="12" cy="12" r="7" />
  </Icon>
)

/** A train ticket with a perforated stub: saves your streak for a short week. */
export const TicketIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path
      d="M3 8V6h18v2a2.5 2.5 0 0 0 0 5v5H3v-5a2.5 2.5 0 0 0 0-5Z"
      transform="translate(0 0.5)"
    />
    <path d="M15 6.5v12" strokeDasharray="1.5 2" />
  </Icon>
)
