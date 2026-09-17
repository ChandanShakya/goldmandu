package np.goldmandu.app.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.DashPathEffect
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

/**
 * Three-series price chart.
 * Fine + Tejabi share the left Y axis; Silver uses the right axis (different scale).
 * Tap/drag to inspect a day.
 */
class SparklineView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : View(context, attrs) {

  var onPointSelected: ((Int) -> Unit)? = null

  private var points: List<HistoryPoint> = emptyList()
  private var selected = -1

  private var padLeft = 0f
  private var padRight = 0f
  private var plotW = 0f
  private var plotTop = 0f
  private var plotH = 0f

  private val labelRight = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(9.5f)
    textAlign = Paint.Align.RIGHT
  }
  private val labelLeft = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(9.5f)
    textAlign = Paint.Align.LEFT
  }
  private val labelCenter = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(9.5f)
    textAlign = Paint.Align.CENTER
  }
  private val legendPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = ContextCompat.getColor(context, R.color.muted)
    textSize = sp(10f)
    textAlign = Paint.Align.LEFT
  }
  private val guidePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1f)
    color = ContextCompat.getColor(context, R.color.hairline)
  }

  private val fineStroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(2.4f)
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
    color = ContextCompat.getColor(context, R.color.series_fine)
  }
  private val tejabiStroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1.8f)
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
    pathEffect = DashPathEffect(floatArrayOf(dp(6f), dp(4f)), 0f)
    color = ContextCompat.getColor(context, R.color.series_tejabi)
  }
  private val silverStroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1.8f)
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
    color = ContextCompat.getColor(context, R.color.series_silver)
  }
  private val fineFill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = ContextCompat.getColor(context, R.color.spark_fill)
  }
  private val cursorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1.5f)
    color = ContextCompat.getColor(context, R.color.accent)
  }
  private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(1.5f)
    color = ContextCompat.getColor(context, R.color.paper)
  }
  private val fineDot = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = ContextCompat.getColor(context, R.color.series_fine)
  }
  private val tejabiDot = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = ContextCompat.getColor(context, R.color.series_tejabi)
  }
  private val silverDot = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = ContextCompat.getColor(context, R.color.series_silver)
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
    invalidate()
  }

  fun selectIndex(index: Int) {
    if (points.isEmpty()) return
    selected = index.coerceIn(0, points.lastIndex)
    invalidate()
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
    val t = ((x - padLeft) / plotW).coerceIn(0f, 1f)
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

    val legendH = dp(18f)
    padLeft = dp(52f)
    padRight = dp(52f)
    plotTop = legendH + dp(10f)
    plotH = height - plotTop - dp(26f)
    plotW = width - padLeft - padRight
    if (plotW <= 0f || plotH <= 0f) return

    drawLegend(canvas)

    val fine = FloatArray(points.size) { points[it].fine.toFloat() }
    val tejabi = FloatArray(points.size) { points[it].tejabi?.toFloat() ?: points[it].fine.toFloat() }
    val silver = FloatArray(points.size) { points[it].silver?.toFloat() ?: 0f }

    val (fineLo, fineHi) = rangeOf(fine, tejabi)
    val (silverLo, silverHi) = rangeOf(silver.filter { it > 0f }.toFloatArray().ifEmpty { floatArrayOf(1f) })

    fun yGold(v: Float): Float = plotTop + plotH * (1f - (v - fineLo) / (fineHi - fineLo))
    fun ySilver(v: Float): Float = plotTop + plotH * (1f - (v - silverLo) / (silverHi - silverLo))
    fun xOf(i: Int): Float = padLeft + plotW * (i / (points.size - 1f))

    // Guides from gold ticks; silver labels on the right at the same y positions
    val goldTicks = floatArrayOf(fineLo + (fineHi - fineLo) * 0.02f, (fineLo + fineHi) / 2f, fineHi - (fineHi - fineLo) * 0.02f)
    val silverTicks = floatArrayOf(silverLo + (silverHi - silverLo) * 0.02f, (silverLo + silverHi) / 2f, silverHi - (silverHi - silverLo) * 0.02f)
    for (k in goldTicks.indices) {
      val y = yGold(goldTicks[k])
      canvas.drawLine(padLeft, y, padLeft + plotW, y, guidePaint)
      canvas.drawText(compactNpr(goldTicks[k].toDouble()), padLeft - dp(6f), y + sp(3.5f), labelRight)
      canvas.drawText(compactNpr(silverTicks[k].toDouble()), padLeft + plotW + dp(6f), y + sp(3.5f), labelLeft)
    }

    // Fine area under the main line
    val area = Path()
    val fineLine = Path()
    val tejabiLine = Path()
    val silverLine = Path()
    val n = points.size
    for (i in 0 until n) {
      val x = xOf(i)
      val yf = yGold(fine[i])
      val yt = yGold(tejabi[i])
      val ys = ySilver(silver[i])
      if (i == 0) {
        fineLine.moveTo(x, yf)
        tejabiLine.moveTo(x, yt)
        if (silver[i] > 0f) silverLine.moveTo(x, ys)
        area.moveTo(x, plotTop + plotH)
        area.lineTo(x, yf)
      } else {
        fineLine.lineTo(x, yf)
        tejabiLine.lineTo(x, yt)
        if (silver[i] > 0f) {
          if (i > 0 && silver[i - 1] <= 0f) silverLine.moveTo(x, ys)
          else silverLine.lineTo(x, ys)
        }
      }
      if (i == n - 1) area.lineTo(x, yf)
    }
    area.lineTo(padLeft + plotW, plotTop + plotH)
    area.close()

    canvas.drawPath(area, fineFill)
    canvas.drawPath(silverLine, silverStroke)
    canvas.drawPath(tejabiLine, tejabiStroke)
    canvas.drawPath(fineLine, fineStroke)

    // X labels
    val xLabels = listOf(0, n / 2, n - 1)
    for (i in xLabels) {
      val x = xOf(i)
      val paint = if (i == 0) labelLeft else if (i == n - 1) labelRight else labelCenter
      val alignX = if (i == 0) padLeft else if (i == n - 1) padLeft + plotW else x
      canvas.drawText(shortDate(points[i].dateLabel), alignX, height - dp(6f), paint)
    }

    // Selection
    if (selected in 0 until n) {
      val sx = xOf(selected)
      canvas.drawLine(sx, plotTop, sx, plotTop + plotH, cursorPaint)
      canvas.drawCircle(sx, yGold(fine[selected]), dp(4f), fineDot)
      canvas.drawCircle(sx, yGold(fine[selected]), dp(4f), ringPaint)
      canvas.drawCircle(sx, yGold(tejabi[selected]), dp(3.5f), tejabiDot)
      canvas.drawCircle(sx, yGold(tejabi[selected]), dp(3.5f), ringPaint)
      if (silver[selected] > 0f) {
        canvas.drawCircle(sx, ySilver(silver[selected]), dp(3.5f), silverDot)
        canvas.drawCircle(sx, ySilver(silver[selected]), dp(3.5f), ringPaint)
      }

      val tip = "Rs. ${Npr.format(points[selected].fine)}"
      tipText.getTextBounds(tip, 0, tip.length, textBounds)
      val tw = textBounds.width() + dp(16f)
      val th = dp(22f)
      val tipLeft = (sx - tw / 2f).coerceIn(padLeft, padLeft + plotW - tw)
      var tipTop = yGold(fine[selected]) - th - dp(12f)
      if (tipTop < plotTop) tipTop = yGold(fine[selected]) + dp(12f)
      canvas.drawRoundRect(tipLeft, tipTop, tipLeft + tw, tipTop + th, dp(4f), dp(4f), tipBg)
      canvas.drawText(tip, tipLeft + tw / 2f, tipTop + th / 2f + sp(3.5f), tipText)
    }
  }

  private fun drawLegend(canvas: Canvas) {
    val y = dp(12f)
    var x = padLeft
    val items = listOf(
      Triple("Fine", fineDot, fineStroke.strokeWidth),
      Triple("Tejabi", tejabiDot, tejabiStroke.strokeWidth),
      Triple("Silver", silverDot, silverStroke.strokeWidth),
    )
    for ((label, paint, _) in items) {
      canvas.drawCircle(x + dp(3f), y - sp(3f), dp(3.5f), paint)
      canvas.drawText(label, x + dp(10f), y, legendPaint)
      x += dp(10f) + legendPaint.measureText(label) + dp(14f)
    }
  }

  private fun rangeOf(vararg series: FloatArray): Pair<Float, Float> {
    var min = Float.MAX_VALUE
    var max = -Float.MAX_VALUE
    for (arr in series) {
      for (v in arr) {
        if (v <= 0f) continue
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    if (min == Float.MAX_VALUE) {
      min = 0f
      max = 1f
    }
    if (max - min < 1f) {
      min -= 1f
      max += 1f
    }
    val pad = (max - min) * 0.08f
    return (min - pad) to (max + pad)
  }

  private fun compactNpr(v: Double): String {
    return when {
      v >= 100000 -> String.format(Locale.US, "%.1fL", v / 100000.0)
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
