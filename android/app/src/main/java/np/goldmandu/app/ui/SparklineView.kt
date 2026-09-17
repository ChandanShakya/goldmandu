package np.goldmandu.app.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import androidx.core.content.ContextCompat
import np.goldmandu.app.Npr
import np.goldmandu.app.R
import np.goldmandu.app.data.HistoryPoint
import java.util.Locale
import kotlin.math.roundToInt

enum class MetalSeries { FINE, TEJABI, SILVER }

/**
 * Single-series price chart with edge-to-edge plot (minimal side padding).
 * Tap/drag to inspect a day.
 */
class SparklineView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : View(context, attrs) {

  var onPointSelected: ((Int) -> Unit)? = null

  private var points: List<HistoryPoint> = emptyList()
  private var selected = -1
  private var series = MetalSeries.FINE

  private var plotLeft = 0f
  private var plotW = 0f
  private var plotTop = 0f
  private var plotH = 0f

  private val yLabel = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(10f)
    textAlign = Paint.Align.LEFT
  }
  private val yLabelRight = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(10f)
    textAlign = Paint.Align.RIGHT
  }
  private val xLabel = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(10f)
    textAlign = Paint.Align.CENTER
  }
  private val xLabelEnd = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(10f)
    textAlign = Paint.Align.RIGHT
  }
  private val xLabelStart = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(10f)
    textAlign = Paint.Align.LEFT
  }
  private val guidePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1f)
    color = ContextCompat.getColor(context, R.color.hairline)
  }
  private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(2.4f)
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
  }
  private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
  }
  private val cursorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1.5f)
    color = ContextCompat.getColor(context, R.color.accent)
  }
  private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1.8f)
    color = ContextCompat.getColor(context, R.color.paper)
  }
  private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
  }
  private val tipBg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = ContextCompat.getColor(context, R.color.ink)
  }
  private val tipText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.paper)
    textSize = sp(11f)
    textAlign = Paint.Align.CENTER
  }
  private val textBounds = Rect()

  fun setPoints(newPoints: List<HistoryPoint>, selectLast: Boolean = true) {
    points = newPoints
    selected = if (selectLast && newPoints.isNotEmpty()) newPoints.lastIndex else -1
    invalidate()
  }

  fun selectIndex(index: Int) {
    if (points.isEmpty()) return
    selected = index.coerceIn(0, points.lastIndex)
    invalidate()
  }

  fun selectedIndex(): Int = selected

  fun setSeries(metal: MetalSeries) {
    if (series != metal) {
      series = metal
      applySeriesColors()
      invalidate()
    }
  }

  private fun applySeriesColors() {
    val color = ContextCompat.getColor(
      context,
      when (series) {
        MetalSeries.FINE -> R.color.series_fine
        MetalSeries.TEJABI -> R.color.series_tejabi
        MetalSeries.SILVER -> R.color.series_silver
      },
    )
    linePaint.color = color
    dotPaint.color = color
    fillPaint.color = when (series) {
      MetalSeries.FINE -> ContextCompat.getColor(context, R.color.spark_fill)
      else -> (color and 0x00FFFFFF) or 0x1A000000
    }
  }

  init {
    applySeriesColors()
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (points.isEmpty()) return false
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN,
      MotionEvent.ACTION_MOVE,
      -> {
        parent?.requestDisallowInterceptTouchEvent(true)
        selectFromX(event.x)
        return true
      }
      MotionEvent.ACTION_UP,
      MotionEvent.ACTION_CANCEL,
      -> {
        parent?.requestDisallowInterceptTouchEvent(false)
        return true
      }
    }
    return super.onTouchEvent(event)
  }

  private fun selectFromX(x: Float) {
    if (plotW <= 0f || points.size < 2) return
    val t = ((x - plotLeft) / plotW).coerceIn(0f, 1f)
    val idx = (t * (points.size - 1)).roundToInt()
    if (idx != selected) {
      selected = idx
      onPointSelected?.invoke(idx)
      invalidate()
    }
  }

  private fun valueAt(p: HistoryPoint): Float = when (series) {
    MetalSeries.FINE -> p.fine.toFloat()
    MetalSeries.TEJABI -> (p.tejabi ?: p.fine).toFloat()
    MetalSeries.SILVER -> (p.silver ?: 0f).toFloat()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (points.size < 2) return

    // Edge-to-edge: tiny inset only for tip/round caps
    val inset = dp(4f)
    plotLeft = inset
    plotW = width - inset * 2
    plotTop = dp(22f)
    plotH = height - plotTop - dp(24f)
    if (plotW <= 0f || plotH <= 0f) return

    val values = FloatArray(points.size) { valueAt(points[it]) }
    var min = Float.MAX_VALUE
    var max = -Float.MAX_VALUE
    for (v in values) {
      if (v <= 0f) continue
      if (v < min) min = v
      if (v > max) max = v
    }
    if (min == Float.MAX_VALUE) {
      min = 0f
      max = 1f
    }
    if (max - min < 1f) {
      min -= 1f
      max += 1f
    }
    val padVal = (max - min) * 0.06f
    val lo = min - padVal
    val hi = max + padVal

    fun yOf(v: Float): Float = plotTop + plotH * (1f - (v - lo) / (hi - lo))
    fun xOf(i: Int): Float = plotLeft + plotW * (i / (points.size - 1f))

    val ticks = floatArrayOf(min, (min + max) / 2f, max)
    for (tick in ticks) {
      val y = yOf(tick)
      canvas.drawLine(plotLeft, y, plotLeft + plotW, y, guidePaint)
      // Labels sit on the plot edge (no reserved gutter)
      canvas.drawText(compactNpr(tick.toDouble()), plotLeft + dp(4f), y - dp(3f), yLabel)
      canvas.drawText(
        compactNpr(tick.toDouble()),
        plotLeft + plotW - dp(4f),
        y - dp(3f),
        yLabelRight,
      )
    }

    val n = points.size
    val line = Path()
    val area = Path()
    var lastX = 0f
    var lastY = 0f
    for (i in 0 until n) {
      val x = xOf(i)
      val y = yOf(values[i])
      lastX = x
      lastY = y
      if (i == 0) {
        line.moveTo(x, y)
        area.moveTo(x, plotTop + plotH)
        area.lineTo(x, y)
      } else {
        line.lineTo(x, y)
        area.lineTo(x, y)
      }
    }
    area.lineTo(plotLeft + plotW, plotTop + plotH)
    area.close()
    canvas.drawPath(area, fillPaint)
    canvas.drawPath(line, linePaint)

    val xLabels = listOf(0, n / 2, n - 1)
    for (i in xLabels) {
      val alignX = when (i) {
        0 -> plotLeft
        n - 1 -> plotLeft + plotW
        else -> xOf(i)
      }
      val paint = when (i) {
        0 -> xLabelStart
        n - 1 -> xLabelEnd
        else -> xLabel
      }
      canvas.drawText(shortDate(points[i].dateLabel), alignX, height - dp(6f), paint)
    }

    if (selected in 0 until n) {
      val sx = xOf(selected)
      val sy = yOf(values[selected])
      canvas.drawLine(sx, plotTop, sx, plotTop + plotH, cursorPaint)
      canvas.drawCircle(sx, sy, dp(5f), dotPaint)
      canvas.drawCircle(sx, sy, dp(5f), ringPaint)

      val tip = "Rs. ${Npr.format(valueAt(points[selected]).toDouble())}"
      tipText.getTextBounds(tip, 0, tip.length, textBounds)
      val tw = textBounds.width() + dp(14f)
      val th = dp(24f)
      val tipLeft = (sx - tw / 2f).coerceIn(0f, width - tw)
      var tipTop = sy - th - dp(10f)
      if (tipTop < 0f) tipTop = sy + dp(10f)
      canvas.drawRoundRect(tipLeft, tipTop, tipLeft + tw, tipTop + th, dp(4f), dp(4f), tipBg)
      canvas.drawText(tip, tipLeft + tw / 2f, tipTop + th / 2f + sp(4f), tipText)
    } else {
      canvas.drawCircle(lastX, lastY, dp(4f), dotPaint)
      canvas.drawCircle(lastX, lastY, dp(4f), ringPaint)
    }
  }

  private fun compactNpr(v: Double): String {
    return when {
      v >= 100000 -> String.format(Locale.US, "%.2fL", v / 100000.0)
      v >= 1000 -> String.format(Locale.US, "%.0fk", v / 1000.0)
      else -> Npr.format(v)
    }
  }

  private fun shortDate(label: String): String {
    val parts = label.split(' ')
    return if (parts.size >= 2) "${parts[0]} ${parts[1]}" else label
  }

  private fun dp(v: Float): Float = v * resources.displayMetrics.density
  private fun sp(v: Float): Float = v * resources.displayMetrics.scaledDensity
}
