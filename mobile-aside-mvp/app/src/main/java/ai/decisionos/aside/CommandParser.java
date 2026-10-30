package ai.decisionos.aside;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pure Java command parser: deterministic and offline, with no permission or network access. */
public final class CommandParser {
    public enum Type { OPEN, SMS, DIAL, READ, BACK, HOME, SCROLL_DOWN, SCROLL_UP, CLICK, INPUT, HELP }

    public static final class Command {
        public final Type type;
        public final String argument;
        public final String extra;
        public Command(Type type, String argument, String extra) {
            this.type = type; this.argument = argument; this.extra = extra;
        }
        public String toString() { return type + ":" + argument + ":" + extra; }
    }

    private static final Pattern SMS = Pattern.compile("^(?:문자|메시지|sms)\\s*(?:작성|보내기)?\\s*([+0-9][0-9\\s-]{7,20})(?:\\s+(.*))?$", Pattern.CASE_INSENSITIVE);
    private static final Pattern DIAL = Pattern.compile("^(?:전화|통화|다이얼)\\s*(?:걸기|열기)?\\s*([+0-9][0-9\\s-]{7,20})$", Pattern.CASE_INSENSITIVE);

    public static Command parse(String raw) {
        String s = raw == null ? "" : raw.trim();
        String lower = s.toLowerCase(Locale.ROOT);
        Matcher m = SMS.matcher(s);
        if (m.matches()) return new Command(Type.SMS, phone(m.group(1)), m.group(2) == null ? "" : m.group(2).trim());
        m = DIAL.matcher(s);
        if (m.matches()) return new Command(Type.DIAL, phone(m.group(1)), "");
        if (lower.equals("뒤로") || lower.equals("뒤로 가") || lower.equals("뒤로가기") || lower.equals("back")) return c(Type.BACK);
        if (lower.equals("홈") || lower.equals("홈으로") || lower.equals("home")) return c(Type.HOME);
        if (lower.equals("화면") || lower.equals("화면 읽어") || lower.equals("화면읽기") || lower.equals("읽어") || lower.equals("read")) return c(Type.READ);
        if (lower.equals("아래로") || lower.equals("아래로 스크롤") || lower.equals("스크롤 아래") || lower.equals("scroll down")) return c(Type.SCROLL_DOWN);
        if (lower.equals("위로") || lower.equals("위로 스크롤") || lower.equals("스크롤 위") || lower.equals("scroll up")) return c(Type.SCROLL_UP);
        if (lower.startsWith("클릭 ")) return new Command(Type.CLICK, s.substring(3).trim(), "");
        if (lower.startsWith("눌러 ")) return new Command(Type.CLICK, s.substring(3).trim(), "");
        if (s.endsWith(" 눌러")) return new Command(Type.CLICK, s.substring(0, s.length()-3).trim(), "");
        if (lower.startsWith("입력 ")) return new Command(Type.INPUT, s.substring(3).trim(), "");
        if (lower.startsWith("써 ")) return new Command(Type.INPUT, s.substring(2).trim(), "");
        if (lower.equals("네이버") || lower.contains("네이버 열어") || lower.contains("네이버 켜")) return new Command(Type.OPEN, "https://www.naver.com", "");
        if (lower.equals("구글") || lower.contains("구글 열어") || lower.contains("구글 켜")) return new Command(Type.OPEN, "https://www.google.com", "");
        if (lower.equals("유튜브") || lower.contains("유튜브 열어") || lower.contains("유튜브 켜")) return new Command(Type.OPEN, "https://www.youtube.com", "");
        if (lower.equals("브라우저") || lower.equals("웹")) return new Command(Type.OPEN, "https://www.google.com", "");
        String u = s;
        String[] prefixes = {"브라우저 ", "사이트 ", "주소 ", "웹 ", "접속 ", "열어 ", "open "};
        for (String p : prefixes) if (lower.startsWith(p)) { u = s.substring(p.length()).trim(); break; }
        if (u.endsWith(" 열어")) u = u.substring(0, u.length() - 3).trim();
        if (u.matches("(?i)^(https?://)?([a-z0-9-]+\\.)+[a-z]{2,}(?:[/?#].*)?$")) {
            if (!u.matches("(?i)^https?://.*")) u = "https://" + u;
            return new Command(Type.OPEN, u, "");
        }
        return c(Type.HELP);
    }

    private static String phone(String p) { return p.replaceAll("[\\s-]", ""); }
    private static Command c(Type t) { return new Command(t, "", ""); }
    private CommandParser() {}
}
