// The gains train: the logo itself (the flexing locomotive), cut out of its background so it
// sits on any colour. Made from the logo by scripts/make-icons.py. It faces right, down the line.
import type { ImgHTMLAttributes } from 'react'
import train from '../assets/train.png'

export const TrainLogo = (props: ImgHTMLAttributes<HTMLImageElement>) => (
  <img src={train} alt="" aria-hidden="true" draggable={false} className="h-6 w-6" {...props} />
)
