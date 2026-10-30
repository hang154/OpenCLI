#!/usr/bin/env python3
"""Generate SHA-256, reproduce comparison and old-vs-new diff for Aside source archive.

Inputs: project source directory, optional --baseline SHA JSON.
Outputs: artifacts/sha256_report.json, artifacts/reproduction_check.csv,
         artifacts/old_vs_new_diff.csv.
Parameters: sha256; dedupe key: relative path (one per file);
calendar denominator: not applicable; random seed: none.
Run: python scripts/reproduce_result_file.py [--baseline artifacts/old_sha256_report.json]
Compare against baseline: pass --baseline; new/unmatched files are labeled.
"""
from pathlib import Path
import hashlib, json, csv, argparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
SKIP = {'.git','build','.gradle','__pycache__','artifacts'}

def collect():
    files = {}
    for f in ROOT.rglob('*'):
        if not f.is_file() or any(p in SKIP for p in f.relative_to(ROOT).parts):
            continue
        key = f.relative_to(ROOT).as_posix()
        files[key] = hashlib.sha256(f.read_bytes()).hexdigest()
    return dict(sorted(files.items()))

def writecsv(path, rows, fields):
    with path.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader();w.writerows(rows)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--baseline',type=Path)
    args=ap.parse_args(); OUT.mkdir(exist_ok=True)
    now=collect()
    old={}
    if args.baseline and args.baseline.exists():
        old=json.loads(args.baseline.read_text(encoding='utf-8')).get('sha256_by_path',{})
    report={'algorithm':'sha256','dedupe_key':'relative_file_path','calendar_denominator':'not_applicable',
            'random_seed':None,'sha256_by_path':now}
    (OUT/'sha256_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    diff=[]
    for path in sorted(set(now)|set(old)):
        before,after=old.get(path,''),now.get(path,'')
        state='UNCHANGED' if before==after else ('ADDED' if not before else ('REMOVED' if not after else 'CHANGED'))
        diff.append({'path':path,'old_sha256':before,'new_sha256':after,'status':state})
    writecsv(OUT/'old_vs_new_diff.csv',diff,['path','old_sha256','new_sha256','status'])
    check=[{'path':p,'expected_sha256':h,'actual_sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),
            'match':str(h==hashlib.sha256((ROOT/p).read_bytes()).hexdigest()).lower()} for p,h in now.items()]
    writecsv(OUT/'reproduction_check.csv',check,['path','expected_sha256','actual_sha256','match'])
    assert all(r['match']=='true' for r in check)
    print('Validated',len(check),'files and wrote hashes/comparisons to',OUT)
if __name__=='__main__': main()
