package ai.decisionos.aside;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Dependency-free native layouts. */
public final class Ui {
    public static final int BG = Color.rgb(12, 17, 23);
    public static final int PANEL = Color.rgb(24, 31, 40);
    public static final int PRIMARY = Color.rgb(128, 222, 169);
    public static final int WHITE = Color.rgb(243, 247, 249);
    public static final int MUTED = Color.rgb(162, 177, 190);
    public static int dp(Context c, float v) { return (int) (c.getResources().getDisplayMetrics().density * v + .5f); }
    public static GradientDrawable bg(int color, int radius, Context c) {
        GradientDrawable gd = new GradientDrawable(); gd.setColor(color); gd.setCornerRadius(dp(c, radius)); return gd;
    }
    public static LinearLayout vertical(Context c, int color, int pad) {
        LinearLayout l = new LinearLayout(c); l.setOrientation(LinearLayout.VERTICAL);
        l.setBackgroundColor(color); l.setPadding(dp(c,pad),dp(c,pad),dp(c,pad),dp(c,pad)); return l;
    }
    public static TextView text(Context c, String s, int size, int color, boolean bold) {
        TextView t=new TextView(c); t.setText(s); t.setTextSize(size);t.setTextColor(color);
        if(bold)t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);return t;
    }
    public static Button button(Context c, String label) {
        Button b=new Button(c);b.setAllCaps(false);b.setText(label);b.setTextColor(BG);
        b.setTextSize(13);b.setBackground(bg(PRIMARY,11,c));return b;
    }
    public static LinearLayout.LayoutParams lp(Context c,int width,int height,int top) {
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(width,height);p.topMargin=dp(c,top);return p;
    }
    public static LinearLayout.LayoutParams match(Context c,int height,int top) { return lp(c,-1,height,top); }
    private Ui(){}
}
