import ai.decisionos.aside.CommandParser;
public class TestParser {
    private static int tested = 0;
    private static void check(String input, CommandParser.Type type, String arg, String extra) {
        CommandParser.Command c=CommandParser.parse(input);tested++;
        if(c.type!=type||!c.argument.equals(arg)||!c.extra.equals(extra))
            throw new AssertionError(input+" expected "+type+"/"+arg+"/"+extra+" got "+c);
    }
    public static void main(String[]args){
        check("네이버 열어",CommandParser.Type.OPEN,"https://www.naver.com","");
        check("구글 열어",CommandParser.Type.OPEN,"https://www.google.com","");
        check("브라우저 example.com",CommandParser.Type.OPEN,"https://example.com","");
        check("example.com",CommandParser.Type.OPEN,"https://example.com","");
        check("문자 01012345678 안녕하세요",CommandParser.Type.SMS,"01012345678","안녕하세요");
        check("문자 +82 10 1234 5678 hi",CommandParser.Type.SMS,"+821012345678","hi");
        check("전화 01012345678",CommandParser.Type.DIAL,"01012345678","");
        check("전화 걸기 01012345678",CommandParser.Type.DIAL,"01012345678","");
        check("화면 읽어",CommandParser.Type.READ,"","");
        check("클릭 검색",CommandParser.Type.CLICK,"검색","");
        check("검색 눌러",CommandParser.Type.CLICK,"검색","");
        check("입력 안녕하세요",CommandParser.Type.INPUT,"안녕하세요","");
        check("뒤로",CommandParser.Type.BACK,"","");
        check("홈",CommandParser.Type.HOME,"","");
        check("아래로",CommandParser.Type.SCROLL_DOWN,"","");
        check("위로",CommandParser.Type.SCROLL_UP,"","");
        check("의미없는 말",CommandParser.Type.HELP,"","");
        System.out.println("PASS "+tested+" parser cases");
    }
}
