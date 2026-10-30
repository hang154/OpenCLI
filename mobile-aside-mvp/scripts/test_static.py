#!/usr/bin/env python3
"""Static security smoke test; input project files; no random/date/dedupe steps.
Run: python scripts/test_static.py. Expected source paths relative to script's parent.
No generated output. Old-vs-new validation performed by reproduce_result_file.py.
"""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base=root/'app/src/main/java/ai/decisionos/aside'
activity=(base/'MainActivity.java').read_text()
service=(base/'AsideAccessibilityService.java').read_text()
manifest=(root/'app/src/main/AndroidManifest.xml').read_text()
assert 'getSharedPreferences("aside_prefs",MODE_PRIVATE)' in activity
assert 'getSharedPreferences("aside_prefs",MODE_PRIVATE)' in service
assert 'aside_access_disclosure_ack' in activity and 'aside_access_disclosure_ack' in service
assert 'android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"' in manifest
for x in ['android.permission.INTERNET','android.permission.SEND_SMS','android.permission.READ_SMS','android.permission.CALL_PHONE']:
    assert x not in manifest,x
assert 'Intent.ACTION_SENDTO' in (base/'CommandRouter.java').read_text()
assert 'Intent.ACTION_DIAL' in (base/'CommandRouter.java').read_text()
assert 'if(node.isPassword())' in service
assert '4~8자리 숫자는 직접 입력하세요' in service
assert '"확인"' in service and '"완료"' in service
print('PASS consent/permission/security smoke tests')
