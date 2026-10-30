package ai.decisionos.aside;

import android.Manifest;
import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.text.InputType;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Explicit user-triggered accessibility actions only. No event logging or cloud connectivity. */
public class AsideAccessibilityService extends AccessibilityService {
    public static volatile AsideAccessibilityService instance;
    private WindowManager wm;
    private LinearLayout overlay;
    private WindowManager.LayoutParams params;
    private EditText prompt;
    private TextView output;
    private SpeechRecognizer recognizer;
    private boolean expanded;

    @Override protected void onServiceConnected() {
        super.onServiceConnected();
        if(!getSharedPreferences(MainActivity.class.getName(),MODE_PRIVATE).getBoolean("aside_access_disclosure_ack",false)) {
            disableSelf(); return;
        }
        instance=this;
        wm=(WindowManager)getSystemService(WINDOW_SERVICE);
        createOverlay();
    }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) {
        // Deliberately do not collect, store, or forward passive screen events.
    }
    @Override public void onInterrupt() { }

    private void createOverlay(){
        overlay=new LinearLayout(this); overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setPadding(Ui.dp(this,4),Ui.dp(this,4),Ui.dp(this,4),Ui.dp(this,4));
        showBubble();
        params=new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        params.gravity=Gravity.TOP | Gravity.END;
        params.x=Ui.dp(this,8);params.y=Ui.dp(this,110);
        wm.addView(overlay,params);
    }
    private void showBubble(){
        expanded=false;
        overlay.removeAllViews();
        Button bubble=Ui.button(this,"ASIDE ●");
        bubble.setOnClickListener(v->showPanel());
        overlay.addView(bubble,new LinearLayout.LayoutParams(Ui.dp(this,92),Ui.dp(this,50)));
        if(params!=null) {params.flags |= WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;wm.updateViewLayout(overlay,params);}
    }
    private void showPanel(){
        expanded=true;
        overlay.removeAllViews();
        LinearLayout panel=Ui.vertical(this,Ui.PANEL,12);
        panel.setBackground(Ui.bg(Ui.PANEL,14,this));
        panel.setElevation(Ui.dp(this,8));
        overlay.addView(panel,new LinearLayout.LayoutParams(Ui.dp(this,302),-2));
        LinearLayout header=new LinearLayout(this);header.setOrientation(LinearLayout.HORIZONTAL);
        TextView title=Ui.text(this,"ASIDE / CONTROL",15,Ui.PRIMARY,true);
        header.addView(title,new LinearLayout.LayoutParams(0,Ui.dp(this,45),1));
        Button close=Ui.button(this,"접기");close.setOnClickListener(v->showBubble());
        header.addView(close,new LinearLayout.LayoutParams(Ui.dp(this,65),Ui.dp(this,42)));
        panel.addView(header);
        prompt=new EditText(this);prompt.setTextSize(14);prompt.setTextColor(Ui.WHITE);prompt.setHintTextColor(Ui.MUTED);
        prompt.setHint("예: 클릭 검색");prompt.setSingleLine(true);
        prompt.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        prompt.setPadding(Ui.dp(this,9),0,Ui.dp(this,9),0);prompt.setBackground(Ui.bg(Ui.BG,8,this));
        panel.addView(prompt,Ui.match(this,46,6));
        LinearLayout controls=new LinearLayout(this);controls.setOrientation(LinearLayout.HORIZONTAL);
        button(controls,"실행",()->{String s=prompt.getText().toString();run(s);},1);
        button(controls,"🎤",this::listen,1);
        button(controls,"읽기",()->run("화면 읽어"),1);
        panel.addView(controls,Ui.match(this,-2,8));
        LinearLayout nav=new LinearLayout(this);nav.setOrientation(LinearLayout.HORIZONTAL);
        button(nav,"뒤로",()->run("뒤로"),1);
        button(nav,"홈",()->run("홈"),1);
        button(nav,"↓ 스크롤",()->run("아래로"),1);
        panel.addView(nav,Ui.match(this,-2,6));
        output=Ui.text(this,"명령을 입력하거나 🎤을 누르세요.",12,Ui.MUTED,false);
        output.setMaxLines(9);output.setTextIsSelectable(true);
        panel.addView(output,Ui.match(this,-2,10));
        params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        wm.updateViewLayout(overlay,params);
    }
    private void button(LinearLayout parent,String label,Runnable callback,int weight){
        Button b=Ui.button(this,label);b.setTextSize(11);b.setOnClickListener(v->callback.run());
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,Ui.dp(this,44),weight);p.rightMargin=Ui.dp(this,4);
        parent.addView(b,p);
    }
    private void run(String command){
        if(command.trim().isEmpty()){status("명령을 입력하세요.");return;}
        CommandRouter.run(this,this,command,this::status);
    }
    private void status(String s){runOnUiThread(()->{if(output!=null)output.setText(s);});}
    private void runOnUiThread(Runnable r){new android.os.Handler(getMainLooper()).post(r);}

    public void execute(CommandParser.Command command,CommandRouter.Result cb){
        switch(command.type){
            case READ: cb.show(readScreen());return;
            case BACK: performGlobalAction(GLOBAL_ACTION_BACK);cb.show("뒤로 가기");return;
            case HOME: performGlobalAction(GLOBAL_ACTION_HOME);cb.show("홈으로 이동");return;
            case SCROLL_DOWN: swipe(false);cb.show("아래로 스크롤");return;
            case SCROLL_UP: swipe(true);cb.show("위로 스크롤");return;
            case CLICK: cb.show(clickText(command.argument));return;
            case INPUT: cb.show(typeText(command.argument));return;
            default: cb.show("지원되지 않는 명령");
        }
    }

    private AccessibilityNodeInfo currentAppRoot(){
        List<AccessibilityWindowInfo> windows=getWindows();
        AccessibilityNodeInfo candidate=null;
        if(windows!=null)for(AccessibilityWindowInfo w:windows){
            if(w.getType()!=AccessibilityWindowInfo.TYPE_APPLICATION)continue;
            AccessibilityNodeInfo root=w.getRoot();if(root==null)continue;
            CharSequence pkg=root.getPackageName();
            if(pkg!=null && pkg.toString().equals(getPackageName()))continue;
            if(w.isActive()||w.isFocused())return root;
            if(candidate==null)candidate=root;
        }
        return candidate;
    }
    private String readScreen(){
        AccessibilityNodeInfo root=currentAppRoot();
        if(root==null)return "다른 앱 화면을 찾지 못했습니다. 브라우저를 연 뒤 다시 시도하세요.";
        Set<String> text=new LinkedHashSet<>();
        gather(root,text,0);
        if(text.isEmpty())return "읽을 수 있는 화면 텍스트가 없습니다. 보안 화면·이미지는 제한될 수 있습니다.";
        StringBuilder b=new StringBuilder("현재 화면:\n");
        for(String s:text){if(b.length()+s.length()>1600){b.append("\n(이하 생략)");break;}b.append("• ").append(s).append('\n');}
        return b.toString();
    }
    private static boolean sensitive(String s){
        String l=s.toLowerCase(Locale.ROOT);
        return l.contains("비밀번호") || l.contains("password") || l.contains("인증번호") ||
                l.contains("otp") || l.contains("verification code") || l.contains("카드번호") ||
                l.contains("보안코드") || l.contains("cvv") || l.contains("cvc");
    }
    private void gather(AccessibilityNodeInfo node,Set<String> out,int depth){
        if(node==null||depth>19||out.size()>45||node.isPassword())return;
        if(node.getText()!=null){
            String s=node.getText().toString().trim();
            if(!s.isEmpty() && !sensitive(s) && s.length()<160)out.add(s.replaceAll("\\b\\d{4,8}\\b","[숨김]"));
        }
        if(node.getContentDescription()!=null){
            String s=node.getContentDescription().toString().trim();
            if(!s.isEmpty() && !sensitive(s) && s.length()<160)out.add(s.replaceAll("\\b\\d{4,8}\\b","[숨김]"));
        }
        for(int i=0;i<node.getChildCount();i++)gather(node.getChild(i),out,depth+1);
    }
    private static boolean dangerousClick(String s){
        String x=s.toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
        String[] banned={"결제","구매확정","주문완료","송금","이체","보내기","전송","발송",
            "통화","전화걸기","인증","로그인","login","pay","checkout","confirm","send","submit","delete","삭제","허용","동의"};
        for(String token:banned)if(x.contains(token))return true;
        return false;
    }
    private String clickText(String target){
        if(target.isEmpty())return "클릭할 버튼 이름을 적어 주세요.";
        if(dangerousClick(target))return "민감한 확정/전송/권한 작업은 사용자가 직접 눌러야 합니다.";
        AccessibilityNodeInfo root=currentAppRoot();if(root==null)return "조작할 다른 앱 화면이 없습니다.";
        AccessibilityNodeInfo found=findNode(root,target,0);
        if(found==null)return "'"+target+"' 버튼을 찾지 못했습니다.";
        AccessibilityNodeInfo p=found;
        for(int i=0;i<5&&p!=null;i++,p=p.getParent()){
            if(p.isPassword())return "보안 입력란은 조작하지 않습니다.";
            if(p.isClickable()&&p.performAction(AccessibilityNodeInfo.ACTION_CLICK))return "클릭: "+target;
        }
        return "버튼을 찾았지만 클릭할 수 없습니다.";
    }
    private AccessibilityNodeInfo findNode(AccessibilityNodeInfo n,String target,int depth){
        if(n==null||depth>20||n.isPassword())return null;
        String t=target.toLowerCase(Locale.ROOT);
        CharSequence a=n.getText(),b=n.getContentDescription();
        if((a!=null&&a.toString().toLowerCase(Locale.ROOT).contains(t)) ||
           (b!=null&&b.toString().toLowerCase(Locale.ROOT).contains(t)))return n;
        for(int i=0;i<n.getChildCount();i++){
            AccessibilityNodeInfo found=findNode(n.getChild(i),target,depth+1);
            if(found!=null)return found;
        }
        return null;
    }
    private String typeText(String value){
        if(value.isEmpty())return "입력할 내용을 적어 주세요.";
        if(value.length()>500)return "한 번에 500자까지만 입력합니다.";
        AccessibilityNodeInfo root=currentAppRoot();if(root==null)return "입력 대상 앱이 없습니다.";
        AccessibilityNodeInfo node=root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        if(node==null || !node.isEditable())return "다른 앱의 텍스트 입력칸을 먼저 터치하세요.";
        if(node.isPassword())return "비밀번호는 직접 입력해야 합니다.";
        CharSequence hint=node.getHintText();
        if(hint!=null&&sensitive(hint.toString()))return "인증/보안 입력란은 자동 입력하지 않습니다.";
        Bundle b=new Bundle();b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,value);
        return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,b) ? "현재 입력칸에 텍스트를 입력했습니다." : "해당 입력칸에 입력하지 못했습니다.";
    }
    private void swipe(boolean upward){
        int w=getResources().getDisplayMetrics().widthPixels;
        int h=getResources().getDisplayMetrics().heightPixels;
        Path p=new Path();p.moveTo(w*.52f,upward?h*.30f:h*.77f);p.lineTo(w*.52f,upward?h*.77f:h*.30f);
        GestureDescription.StrokeDescription stroke=new GestureDescription.StrokeDescription(p,0,420);
        dispatchGesture(new GestureDescription.Builder().addStroke(stroke).build(),null,null);
    }

    public void listen(){
        if(Build.VERSION.SDK_INT<31){status("Android 12 이상 기기에서만 로컬 음성 인식 지원");return;}
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            status("마이크 권한이 필요합니다. Aside 앱에서 음성 권한을 허용하세요.");
            Intent open=new Intent(this,MainActivity.class);open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(open);return;
        }
        if(!SpeechRecognizer.isOnDeviceRecognitionAvailable(this)){
            status("기기에 온디바이스 음성인식 서비스가 없습니다. 텍스트 명령으로 시험하세요.");return;
        }
        if(recognizer!=null){recognizer.destroy();recognizer=null;}
        try{
            recognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener(){
                @Override public void onReadyForSpeech(Bundle params){status("듣고 있어요… 한국어로 명령하세요.");}
                @Override public void onBeginningOfSpeech(){}
                @Override public void onRmsChanged(float rmsdB){}
                @Override public void onBufferReceived(byte[] buffer){}
                @Override public void onEndOfSpeech(){status("음성 인식 중…");}
                @Override public void onError(int error){status("음성인식 실패 ("+error+"). 로컬 언어팩 설치 여부를 확인하세요.");}
                @Override public void onResults(Bundle results){
                    ArrayList<String> matches=results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if(matches!=null&&!matches.isEmpty()){
                        String cmd=matches.get(0);status("인식: "+cmd);run(cmd);
                    }else status("인식된 말이 없습니다.");
                }
                @Override public void onPartialResults(Bundle partialResults){}
                @Override public void onEvent(int type,Bundle params){}
            });
            Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"ko-KR");
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
            recognizer.startListening(intent);
        }catch(Exception e){status("로컬 음성인식을 시작할 수 없습니다: "+e.getClass().getSimpleName());}
    }

    @Override public void onDestroy(){
        if(recognizer!=null){recognizer.destroy();recognizer=null;}
        if(wm!=null&&overlay!=null){try{wm.removeView(overlay);}catch(Exception ignored){}}
        if(instance==this)instance=null;
        super.onDestroy();
    }
}
