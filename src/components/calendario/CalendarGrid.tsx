import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { cx } from '@/lib/utils'
import { MonthDay, WEEKDAY_LABELS, monthLabel } from '@/lib/calendar'
import { WearWithRefs } from '@/hooks/useWears'

export default function CalendarGrid({
  year,
  month,
  days,
  wearsByDate,
  onSelectDay,
  onPrev,
  onNext,
  onToday,
}: {
  year: number
  month: number
  days: MonthDay[]
  wearsByDate: Map<string, WearWithRefs[]>
  onSelectDay: (iso: string) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={onPrev} className="p-2 rounded-lg hover:bg-surface-soft"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-lg font-semibold min-w-[10ch] text-center">{monthLabel(year, month)}</h2>
          <button onClick={onNext} className="p-2 rounded-lg hover:bg-surface-soft"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <button onClick={onToday} className="text-sm text-brand-700 hover:underline">Hoy</button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="text-center text-[11px] font-medium text-muted py-1">{w}</div>
        ))}

        {days.map((d) => {
          const wears = wearsByDate.get(d.iso) ?? []
          const hasPlanned = wears.some((w) => w.planned)
          const allPlanned = wears.length > 0 && wears.every((w) => w.planned)
          const previews = wears
            .map((w) => w.clothes?.image_url ?? w.outfits?.cover_image_url)
            .filter(Boolean) as string[]
          return (
            <button
              key={d.iso}
              onClick={() => onSelectDay(d.iso)}
              className={cx(
                'aspect-square rounded-lg text-left p-1 flex flex-col transition relative',
                d.inMonth ? 'bg-surface border border-line' : 'bg-surface-soft/60 border border-transparent text-muted/70',
                d.isToday && 'ring-2 ring-brand-600',
                wears.length > 0 && 'hover:shadow-sm'
              )}
            >
              <span className={cx('text-[11px] font-medium leading-none', d.isToday && 'text-brand-700')}>
                {d.date.getDate()}
              </span>

              {hasPlanned && (
                <Clock className="absolute top-1 right-1 w-2.5 h-2.5 text-brand-600" />
              )}

              {previews.length > 0 && (
                <div
                  className={cx(
                    'flex-1 min-h-0 mt-1 grid gap-0.5',
                    previews.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
                    allPlanned && 'opacity-70'
                  )}
                >
                  {previews.slice(0, 2).map((src, i) => (
                    <div key={i} className="relative min-h-0 overflow-hidden rounded-md bg-surface-soft">
                      <img src={src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      {i === 1 && previews.length > 2 && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-semibold text-white">
                          +{previews.length - 1}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {wears.length > 0 && previews.length === 0 && (
                <div className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-brand-600" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
