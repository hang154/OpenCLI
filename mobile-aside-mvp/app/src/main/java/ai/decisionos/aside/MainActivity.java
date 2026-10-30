package ai.decisionos.aside;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** User-operated setup and command console; service overlay handles other apps. */
public class MainActivity extends Activity {
    private TextView status, serviceState;
    private CheckBox consent;
    private EditText command;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Ui.BG);
        getWindow().setNavigationBarColor(Ui.BG);
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(Ui.BG);
        LinearLayout content = Ui.vertical(this, Ui.BG, 22);
        scroll.addView(content);
        TextView kicker = Ui.text(this, "DECISIONOS AI   /   ON-DEVICE MVP", 11, Ui.PRIMARY, true);
        content.addView(kicker, Ui.match(this,-2,12));
        content.addView(Ui.text(this, "Aside Mobile", 32, Ui.WHITE, true), Ui.match(this,-2,10));
        content.addView(Ui.text(this, "한 번 설치하고, 다른 앱 위에서 명령하세요.", 15, Ui.MUTED, false), Ui.match(this,-2,9));

        LinearLayout card = Ui.vertical(this, Ui.PANEL, 16); card.setBackground(Ui.bg(Ui.PANEL, 16, this));
        content.addView(card, Ui.match(this,-2,22));
        card.addView(Ui.text(this, "01  접근성 서비스", 18, Ui.WHITE, true));
        serviceState = Ui.text(this, "연결 상태 확인 중", 13, Ui.MUTED, false);
        card.addView(serviceState, Ui.match(this,-2,8));
        TextView disclosure = Ui.text(this,
            "접근성을 켜면 Aside는 화면의 텍스트·버튼을 읽고, 사용자가 지시한 클릭·입력·스크롤을 수행할 수 있습니다. " +
            "화면 정보는 기기 외부로 전송하거나 저장하지 않습니다. 비밀번호·인증번호를 수집하지 않으며 문자 전송, 전화 연결, 결제 확정은 실행하지 않습니다. " +
            "설정에서 언제든 끌 수 있습니다.", 13, Ui.WHITE, false);
        disclosure.setLineSpacing(Ui.dp(this,4),1f);
        card.addView(disclosure, Ui.match(this,-2,12));
        consent = new CheckBox(this);
        consent.setButtonTintList(android.content.res.ColorStateList.valueOf(Ui.PRIMARY));
        consent.setTextColor(Ui.WHITE); consent.setTextSize(13);
        consent.setText("화면 읽기·조작 범위와 위험을 이해했으며 사용에 동의합니다.");
        consent.setChecked(getPreferences(MODE_PRIVATE).getBoolean("aside_access_disclosure_ack", false));
        consent.setOnCheckedChangeListener((button, checked) ->
            getPreferences(MODE_PRIVATE).edit().putBoolean("aside_access_disclosure_ack",checked).apply());
        card.addView(consent, Ui.match(this,-2,9));
        android.widget.Button settings = Ui.button(this,"접근성 설정 열기 → Aside 허용");
        settings.setOnClickListener(v -> {
            if (!consent.isChecked()) { show("먼저 접근성 사용에 동의해 주세요."); return; }
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
        });
        card.addView(settings, Ui.match(this,50,9));

        LinearLayout micCard = Ui.vertical(this,Ui.PANEL,16); micCard.setBackground(Ui.bg(Ui.PANEL,16,this));
        content.addView(micCard, Ui.match(this,-2,16));
        micCard.addView(Ui.text(this,"02  음성 · 텍스트 명령",18,Ui.WHITE,true));
        micCard.addView(Ui.text(this,"음성은 기기 내 음성인식 엔진이 있는 경우에만 동작합니다. 앱은 인터넷 권한이 없습니다.",13,Ui.MUTED,false),Ui.match(this,-2,7));
        command = new EditText(this);
        command.setSingleLine(true);
        command.setTextColor(Ui.WHITE);command.setHintTextColor(Ui.MUTED);command.setTextSize(15);
        command.setHint("예: 네이버 열어 / 클릭 검색");
        command.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        command.setBackground(Ui.bg(Ui.BG,9,this));
        command.setPadding(Ui.dp(this,12),0,Ui.dp(this,12),0);
        micCard.addView(command,Ui.match(this,49,13));
        LinearLayout actions = new LinearLayout(this); actions.setOrientation(LinearLayout.HORIZONTAL);
        android.widget.Button execute = Ui.button(this, "명령 실행");
        execute.setOnClickListener(v -> runCommand(command.getText().toString()));
        LinearLayout.LayoutParams b = new LinearLayout.LayoutParams(0,Ui.dp(this,50),1);
        actions.addView(execute,b);
        android.widget.Button voice = Ui.button(this,"오프라인 음성 🎤");
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0,Ui.dp(this,50),1);p.leftMargin=Ui.dp(this,8);
        actions.addView(voice,p);
        voice.setOnClickListener(v -> startMicrophone());
        micCard.addView(actions,Ui.match(this,-2,12));

        LinearLayout demos = Ui.vertical(this,Ui.PANEL,16);demos.setBackground(Ui.bg(Ui.PANEL,16,this));
        content.addView(demos,Ui.match(this,-2,16));
        demos.addView(Ui.text(this,"03  빠른 테스트",18,Ui.WHITE,true));
        String[] samples={"네이버 열어", "문자 01012345678 테스트입니다", "전화 01012345678", "화면 읽어", "아래로", "뒤로"};
        for(String sample:samples) {
            android.widget.Button btn=Ui.button(this,sample);
            btn.setOnClickListener(v->runCommand(sample));
            demos.addView(btn,Ui.match(this,43,8));
        }
        status = Ui.text(this,"테스트: 먼저 접근성 권한을 켠 뒤 'ASIDE' 버블을 누르세요.",13,Ui.MUTED,false);
        status.setTextIsSelectable(true); content.addView(status,Ui.match(this,-2,20));
        TextView footer=Ui.text(this,"MVP · 디버그 테스트 · 서버/AI 연결 없음 · Android 8+",11,Ui.MUTED,false);
        footer.setGravity(Gravity.CENTER);content.addView(footer,Ui.match(this,-2,24));
        setContentView(scroll);
    }

    @Override public void onResume() {
        super.onResume();
        if(serviceState!=null) serviceState.setText(AsideAccessibilityService.instance!=null ? "● 연결됨 — 다른 앱 위의 ASIDE 버튼 사용 가능" : "○ 꺼짐 — 설정에서 Aside 화면 조작 서비스를 켜세요");
    }

    private void runCommand(String s) {
        if(s.trim().isEmpty()) {show("명령을 입력하세요.");return;}
        CommandRouter.run(this,AsideAccessibilityService.instance,s,this::show);
    }
    private void show(String msg){runOnUiThread(()->{if(status!=null)status.setText(msg);});}

    private void startMicrophone() {
        if(Build.VERSION.SDK_INT<31){show("Android 12 이상에서 온디바이스 음성인식을 지원합니다.");return;}
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},11);return;
        }
        if(AsideAccessibilityService.instance==null){show("먼저 접근성 서비스를 켜세요.");return;}
        AsideAccessibilityService.instance.listen();
        show("음성 명령을 기다리는 중…");
    }
    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions,int[] results){
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if(requestCode==11 && results.length>0 && results[0]==PackageManager.PERMISSION_GRANTED)startMicrophone();
        else if(requestCode==11)show("마이크 권한 없이 텍스트 명령을 사용할 수 있습니다.");
    }
}
