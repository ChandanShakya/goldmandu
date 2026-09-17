package np.goldmandu.app.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat
import np.goldmandu.app.R

/** Canvas sparkline — no chart library. */
class SparklineView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : View(context, attrs) {

  private var values: FloatArray = floatArrayOf()

  private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = dp(2f)
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
    color = ContextCompat.getColor(context, R.color.spark_stroke)
  }

  private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = ContextCompat.getColor(context, R.color.spark_fill)
  }

  fun setValues(points: List<Double>) {
    values = points.map { it.toFloat() }.toFloatArray()
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (values.size < 2) return

    val pad = dp(12f)
    val w = width - pad * 2
    val h = height - pad * 2
    if (w <= 0 || h <= 0) return

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

    val line = Path()
    val area = Path()
    val n = values.size
    for (i in 0 until n) {
      val x = pad + w * (i / (n - 1f))
      val t = (values[i] - min) / (max - min)
      val y = pad + h * (1f - t)
      if (i == 0) {
        line.moveTo(x, y)
        area.moveTo(x, height - pad)
        area.lineTo(x, y)
      } else {
        line.lineTo(x, y)
        area.lineTo(x, y)
      }
    }
    area.lineTo(pad + w, height - pad)
    area.close()

    canvas.drawPath(area, fill)
    canvas.drawPath(line, stroke)
  }

  private fun dp(v: Float): Float = v * resources.displayMetrics.density
}
