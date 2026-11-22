// The privacy policy, inside the app: the text of PRIVACY.md (the same file Google Play links
// to), so it reads offline and can never drift from the online version.
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import policy from '../../../PRIVACY.md?raw'
import { BackIcon } from '../components/icons'

const PRIVACY_URL = 'https://github.com/Wijnandvdm/gains-train/blob/main/PRIVACY.md'

const external = (href: string, text: ReactNode) => (
  <a href={href} target="_blank" rel="noreferrer" className="underline">
    {text}
  </a>
)

/** **Bold**, _italic_ and web links: all the markdown the policy uses within a paragraph. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_|https?:\/\/\S*[^\s.,)])/).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('_') && part.length > 1) return <em key={i}>{part.slice(1, -1)}</em>
    if (/^https?:\/\//.test(part)) return <span key={i}>{external(part, part)}</span>
    return part
  })
}

/** The policy's blocks (separated by blank lines): # title, ## headings and paragraphs. */
function blocks(markdown: string): ReactNode[] {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      if (block.startsWith('# ')) return null // the page has its own title
      if (block.startsWith('## '))
        return (
          <h2 key={i} className="pt-2 font-semibold">
            {block.slice(3)}
          </h2>
        )
      return <p key={i}>{inline(block.replace(/\s*\n\s*/g, ' '))}</p>
    })
}

export function PrivacyPage() {
  const navigate = useNavigate()
  const cameFromApp = useLocation().key !== 'default'
  return (
    <section className="flex flex-col gap-4">
      <Link
        onClick={(e) => {
          if (cameFromApp) {
            e.preventDefault()
            navigate(-1)
          }
        }}
        to="/settings"
        className="back-link"
      >
        <BackIcon />
        Settings
      </Link>
      <h1 className="text-2xl font-bold">Privacy policy</h1>
      <article className="flex flex-col gap-3 text-sm leading-relaxed">{blocks(policy)}</article>
      <p className="text-sm text-neutral-500">
        Also online: {external(PRIVACY_URL, 'the privacy policy on GitHub')}.
      </p>
    </section>
  )
}
