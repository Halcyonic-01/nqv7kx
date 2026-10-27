import { BarChart, LineChart } from 'echarts/charts'
import {
  AxisPointerComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  MarkLineComponent,
  MarkAreaComponent,
  CanvasRenderer,
])

export type ChartOption = echarts.EChartsCoreOption
export type ChartClick = { dataIndex: number; seriesName?: string }

type Props = {
  option: ChartOption
  height: number
  label: string
  /** Charts in the same group share the crosshair. */
  group?: string
  className?: string
  onClick?: (event: ChartClick) => void
}

export function EChart({ option, height, label, group, className, onClick }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    const node = el.current
    if (!node) return
    const instance = echarts.init(node, null, { renderer: 'canvas' })
    chart.current = instance
    if (group) {
      instance.group = group
      echarts.connect(group)
    }
    const ro = new ResizeObserver(() => instance.resize())
    ro.observe(node)
    return () => {
      ro.disconnect()
      instance.dispose()
      chart.current = null
    }
  }, [group])

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true })
  }, [option])

  useEffect(() => {
    const instance = chart.current
    if (!instance || !onClick) return
    const handler = (e: unknown) => onClick(e as ChartClick)
    instance.on('click', handler)
    return () => {
      instance.off('click', handler)
    }
  }, [onClick, group])

  return <div ref={el} role="img" aria-label={label} style={{ height }} className={className} />
}
