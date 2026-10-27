import { useMemo } from 'react'
import { TrendingUp, Wallet, Trophy, Store } from 'lucide-react'
import StatCard from '@/components/shared/StatCard'
import { formatPrice } from '@/lib/utils'
import type { Clothe } from '@/types/database'

/**
 * Estadísticas de lo vendido: ingresos, lo invertido, beneficio, la prenda
 * con mejor margen y la plataforma con más ventas. Solo cuenta prendas con
 * precio de venta; el margen solo usa las que además tienen precio de compra.
 */
export default function SalesStats({ sold }: { sold: Clothe[] }) {
  const stats = useMemo(() => {
    const withPrice = sold.filter((c) => c.price != null)
    const revenue = withPrice.reduce((acc, c) => acc + (c.price ?? 0), 0)

    const withCost = withPrice.filter((c) => c.purchase_price != null)
    const invested = withCost.reduce((acc, c) => acc + (c.purchase_price ?? 0), 0)
    const revenueWithCost = withCost.reduce((acc, c) => acc + (c.price ?? 0), 0)
    const profit = revenueWithCost - invested

    let best: { clothe: Clothe; margin: number } | null = null
    for (const c of withCost) {
      const margin = (c.price ?? 0) - (c.purchase_price ?? 0)
      if (!best || margin > best.margin) best = { clothe: c, margin }
    }

    let vinted = 0
    let wallapop = 0
    for (const c of sold) {
      if (c.on_vinted) vinted++
      if (c.on_wallapop) wallapop++
    }
    const platform =
      vinted === 0 && wallapop === 0 ? null
      : vinted === wallapop ? { name: 'Empate', count: vinted }
      : vinted > wallapop ? { name: 'Vinted', count: vinted }
      : { name: 'Wallapop', count: wallapop }

    return { revenue, invested, profit, costCount: withCost.length, best, platform, soldCount: sold.length }
  }, [sold])

  if (stats.soldCount === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Ingresos" value={formatPrice(stats.revenue)} hint={`${stats.soldCount} ${stats.soldCount === 1 ? 'venta' : 'ventas'}`} icon={Wallet} />
      <StatCard
        label="Beneficio"
        value={stats.costCount > 0 ? formatPrice(stats.profit) : '—'}
        hint={stats.costCount > 0 ? `Invertido ${formatPrice(stats.invested)}` : 'Añade el precio de compra'}
        icon={TrendingUp}
      />
      <StatCard
        label="Mejor margen"
        value={stats.best ? formatPrice(stats.best.margin) : '—'}
        hint={stats.best ? stats.best.clothe.name : 'Sin precio de compra'}
        icon={Trophy}
      />
      <StatCard
        label="Plataforma top"
        value={stats.platform ? stats.platform.name : '—'}
        hint={stats.platform ? `${stats.platform.count} ${stats.platform.count === 1 ? 'venta' : 'ventas'}` : 'Marca dónde publicas'}
        icon={Store}
      />
    </div>
  )
}
