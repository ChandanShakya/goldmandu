package np.goldmandu.app

import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/** Pad content below the status bar / above the nav bar (edge-to-edge). */
object Insets {
  fun apply(activity: AppCompatActivity, root: View) {
    WindowCompat.setDecorFitsSystemWindows(activity.window, false)
    ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
      v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      insets
    }
    root.requestApplyInsets()
  }
}
