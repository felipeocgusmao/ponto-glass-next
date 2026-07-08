package app.pontoglass.ponto;

import android.graphics.Color;
import android.os.Bundle;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Edge-to-edge: draw the web content under the status and navigation bars
    // and make those bars transparent, so the app's background reaches the
    // physical screen edges instead of leaving a solid (black) system bar at
    // the bottom. The web layer already insets its content with
    // env(safe-area-inset-*), so nothing ends up hidden behind the bars.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    getWindow().setNavigationBarColor(Color.TRANSPARENT);
  }
}
