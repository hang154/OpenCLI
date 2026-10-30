package ai.decisionos.aside;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.text.TextUtils;

/** Uses platform Intents for high-risk actions; no direct SMS send or call permission. */
public final class CommandRouter {
    public interface Result { void show(String message); }

    public static void run(Context ctx, AsideAccessibilityService service, String raw, Result result) {
        CommandParser.Command cmd = CommandParser.parse(raw);
        try {
            switch (cmd.type) {
                case OPEN:
                    Uri url = Uri.parse(cmd.argument);
                    if (!"https".equalsIgnoreCase(url.getScheme()) && !"http".equalsIgnoreCase(url.getScheme())) {
                        result.show("허용되지 않은 주소 형식"); return;
                    }
                    launch(ctx, new Intent(Intent.ACTION_VIEW, url));
                    result.show("브라우저 열기: " + url.getHost()); return;
                case SMS:
                    Intent sms = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + cmd.argument));
                    sms.putExtra("sms_body", cmd.extra);
                    launch(ctx, sms);
                    result.show("문자 작성창을 열었습니다. 발송은 직접 확인하세요."); return;
                case DIAL:
                    launch(ctx, new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + cmd.argument)));
                    result.show("전화 다이얼러를 열었습니다. 통화는 직접 시작하세요."); return;
                case HELP:
                    result.show("예시: 네이버 열어 / 문자 01012345678 안녕 / 전화 01012345678 / 화면 읽어 / 클릭 검색 / 입력 안녕하세요 / 아래로 / 뒤로 / 홈"); return;
                default:
                    if (service == null) { result.show("화면 조작을 하려면 접근성 서비스를 먼저 켜세요."); return; }
                    service.execute(cmd, result);
            }
        } catch (Exception ex) {
            result.show("실행 실패: " + ex.getClass().getSimpleName());
        }
    }

    private static void launch(Context ctx, Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (intent.resolveActivity(ctx.getPackageManager()) == null) {
            // On Android 11+ package-visibility filtering can hide handlers; try explicit start.
            ctx.startActivity(intent);
        } else ctx.startActivity(intent);
    }
    private CommandRouter() {}
}
