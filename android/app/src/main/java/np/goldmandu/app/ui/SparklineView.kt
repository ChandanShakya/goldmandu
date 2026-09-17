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
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Interactive fine-gold chart with X/Y labels.
 * Tap or drag to inspect a day; listener fires with the selected index.
 */
class SparklineView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : View(context, attrs) {

  var onPointSelected: ((Int) -> Unit)? = null

  private var points: List<HistoryPoint> = emptyList()
  private var selected = -1
  private var minX = 0f
  private var plotW = 0f
  private var plotTop = 0f
  private var plotH = 0f

  private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(10f)
    textAlign = Paint.Align.LEFT
  }
  private val labelCenter = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(10f)
    textAlign = Paint.Align.CENTER
  }
  private val labelRight = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(10f)
    textAlign = Paint.Align.RIGHT
  }
  private val guidePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1f)
    color = ContextCompat.getColor(context, R.color.hairline)
  }
  private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(2.5f)
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
    color = ContextCompat.getColor(context, R.color.spark_stroke)
  }
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = ContextCompat.getColor(context, R.color.spark_fill)
  }
  private val cursorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1.5f)
    color = ContextCompat.getColor(context, R.color.accent)
  }
  private val dotFill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = ContextCompat.getColor(context, R.color.spark_stroke)
  }
  private val selFill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = ContextCompat.getColor(context, R.color.accent)
  }
  private val dotRing = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(2f)
    color = ContextCompat.getColor(context, R.color.paper)
  }
  private val tipBg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = ContextCompat.getColor(context, R.color.ink)
  }
  private val tipText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.paper)
    textSize = sp(10f)
    textAlign = Paint.Align.CENTER
  }
  private val textBounds = Rect()

  fun setPoints(newPoints: List<HistoryPoint>, selectLast: Boolean = true) {
    points = newPoints
    selected = if (selectLast && newPoints.isNotEmpty()) newPoints.lastIndex else -1
    requestLayout()
    invalidate()
  }

  fun selectIndex(index: Int) {
    if (points.isEmpty()) return
    selected = index.coerceIn(0, points.lastIndex)
    invalidate()
  }

  fun selectedIndex(): Int = selected

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
    val t = ((x - minX) / plotW).coerceIn(0f, 1f)
    val idx = (t * (points.size - 1)).roundToInt()
    if (idx != selected) {
      selected = idx
      onPointSelected?.invoke(idx)
      invalidate()
    }
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (points.size < 2) return

    val padLeft = dp(48f)
    val padRight = dp(16f)
    val padTop = dp(28f)
    val padBottom = dp(28f)
    minX = padLeft
    plotW = width - padLeft - padRight
    plotTop = padTop
    plotH = height - padTop - padBottom
    if (plotW <= 0f || plotH <= 0f) return

    val values = FloatArray(points.size) { points[it].fine.toFloat() }
    var min = Float.MAX_VALUE
    var max = -Float.MAX_VALUE
    for (v in values) {
      if (v < min) min = v
      if (v > max) max = v
    }
    if (max - min < 1f) {
      min -= 1f
      max += 1f
    }
    // Nice-ish padding so line doesn't touch edges
    val range = max - min
    val padVal = range * 0.08f
    val lo = min - padVal
    val hi = max + padVal
    val yRange = hi - lo

    fun yOf(v: Float): Float = plotTop + plotH * (1f - (v - lo) / yRange)
    fun xOf(i: Int): Float = minX + plotW * (i / (points.size - 1f))

    // Horizontal guides + Y labels (low / mid / high)
    val yTicks = floatArrayOf(min, (min + max) / 2f, max)
    for (tick in yTicks) {
      val y = yOf(tick)
      canvas.drawLine(minX, y, minX + plotW, y, guidePaint)
      val label = compactNpr(tick.toDouble())
      val baseline = y + sp(3.5f)
      canvas.drawText(label, minX - dp(6f), baseline, labelRight)
    }

    // Area + line
    val line = Path()
    val area = Path()
    val n = points.size
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
    area.lineTo(minX + plotW, plotTop + plotH)
    area.close()
    canvas.drawPath(area, fill)
    canvas.drawPath(line, stroke)

    // X labels: start, mid, end
    val xLabels = listOf(0, n / 2, n - 1)
    for (i in xLabels) {
      val x = xOf(i)
      val paint = if (i == 0) labelPaint else if (i == n - 1) labelRight else labelCenter
      val alignX = if (i == 0) minX else if (i == n - 1) minX + plotW else x
      canvas.drawText(shortDate(points[i].dateLabel), alignX, height - dp(8f), paint)
    }

    // Selection cursor
    if (selected in 0 until n) {
      val sx = xOf(selected)
      val sy = yOf(values[selected])
      canvas.drawLine(sx, plotTop, sx, plotTop + plotH, cursorPaint)
      canvas.drawCircle(sx, sy, dp(5f), selFill)
      canvas.drawCircle(sx, sy, dp(5f), dotRing)

      // Floating tip: fine-gold price (detail panel lists all metals)
      val tip = "Rs. ${Npr.format(points[selected].fine)}"
      tipText.getTextBounds(tip, 0, tip.length, textBounds)
      val tw = textBounds.width() + dp(16f)
      val th = dp(22f)
      val tipLeft = (sx - tw / 2f).coerceIn(minX, minX + plotW - tw)
      var tipTop = sy - th - dp(12f)
      if (tipTop < plotTop) tipTop = sy + dp(12f)
      canvas.drawRoundRect(tipLeft, tipTop, tipLeft + tw, tipTop + th, dp(4f), dp(4f), tipBg)
      canvas.drawText(tip, tipLeft + tw / 2f, tipTop + th / 2f + sp(3.5f), tipText)
    } else {
      // End "now" marker
      canvas.drawCircle(lastX, lastY, dp(4f), dotFill)
      canvas.drawCircle(lastX, lastY, dp(4f), dotRing)
    }
  }

  /** 2,99,500 → 3.00L for axis; full number in tip. */
  private fun compactNpr(v: Double): String {
    return when {
      v >= 100000 -> String.format(Locale.US, "%.1fL", v / 100000.0)
      v >= 1000 -> String.format(Locale.US, "%.0fk", v / 1000.0)
      else -> Npr.format(v)
    }
  }

  /** "31 Bhadra 2083" → "31 Bhadra" */
  private fun shortDate(label: String): String {
    val parts = label.split(' ')
    return if (parts.size >= 2) "${parts[0]} ${parts[1]}" else label
  }

  private fun dp(v: Float): Float = v * resources.displayMetrics.density
  private fun sp(v: Float): Float = v * resources.displayMetrics.scaledDensity
}
