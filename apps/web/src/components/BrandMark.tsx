import { cn } from '~/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.webp`}
      alt="DaedNext"
      width={40}
      height={40}
      className={cn('h-10 w-10 shrink-0 rounded-xl object-cover', className)}
    />
  )
}
