# 사입 에이전트용 OpenCLI

이 저장소는 [CrossBorder-Price-Tracker](https://github.com/hang154/CrossBorder-Price-Tracker)의
Qwen 사입 에이전트가 사용하는 브라우저·검색 실행부입니다. 에이전트 구성과 실행 순서는
[통합 README](https://github.com/hang154/CrossBorder-Price-Tracker#readme)를 확인하세요.
기존 OpenCLI의 다른 기능과 라이선스는 [원래 README](README.md)에 유지합니다.

## 이 포크에서 사용하는 기능

- `alibaba search`: Alibaba.com 검색 결과의 상품 ID·표시가·통화·MOQ·사진·판매자 링크·화면 근거를 추출합니다.
- `alibaba image-search`: 로컬 상품 사진을 실제 업로드해 이미지 검색합니다.
- `1688 search`, `1688 image-search`: 현재 글로벌 검색 화면과 사진 업로드 경로를 지원합니다. 사진 출처·해시를 보존합니다.
- `naver-shopping search`: 네이버 홈페이지 검색창에서 쇼핑 검색으로 이동합니다.
- `naver-shopping search-api`: 별도로 설정된 네이버 공식 API를 사용하는 선택 경로입니다.
- `coupang search`: 검색 노출 순서·상품 ID·표시가·리뷰 총수 등 공개 화면의 값을 가져옵니다.
- `browser`: 세션별 탭, 관측한 셀렉터, 클릭·입력·평가 도구입니다. 쿠팡 기간별 리뷰 집계와 도매꾹 검색은 tracker 쪽 코드가 이 도구를 호출합니다.

위 명령은 LLM이 아닙니다. Qwen의 계획·도구 선택·함수 호출은 tracker에서 실행하고,
OpenCLI는 실제 브라우저 조작과 관측을 수행합니다. OpenCLI 전체에 포함된 구매 관련 명령은
사입 조사 에이전트의 도구로 제공하지 않습니다.

## 설치와 연결

Node.js 20.18.1 이상, npm, 기존 Chrome과 Browser Bridge 확장 연결이 필요합니다.

```bash
npm ci
npm run build
node dist/src/main.js --help
node dist/src/main.js browser --help
```

확장 설치·연결은 [extension/README.md](extension/README.md)를 따릅니다.
`dist/`와 `node_modules/`는 백업 대상 소스가 아니며 새 환경에서 빌드합니다.
로그인·본인 확인은 기존 브라우저에서 사용자가 완료합니다. 검증 화면과 접근 제한은
실패/차단으로 반환하며, 차단 페이지를 빈 검색 성공이나 최저가로 기록하지 않습니다.

```bash
node dist/src/main.js alibaba search 'tiger eye bracelet' --limit 5 -f json
node dist/src/main.js 1688 search '虎眼石 手链' --limit 5 -f json
node dist/src/main.js naver-shopping search '호안석 팔찌' --limit 5 -f json
node dist/src/main.js coupang search '호안석 팔찌' --limit 5 -f json
# 사진 업로드 인자는 현재 명령의 --help로 확인합니다.
node dist/src/main.js alibaba image-search --help
node dist/src/main.js 1688 image-search --help
```

## 검증

```bash
npx vitest run --project adapter \
  clis/alibaba/search.test.js \
  clis/1688/search.test.js clis/1688/global-search.test.js clis/1688/assets.test.js \
  clis/naver-shopping/search.test.js \
  clis/coupang/coupang.test.js clis/coupang/utils.test.js
```

이 검사는 어댑터 파싱·호출 계약 검사입니다. 실제 사이트 접근 성공이나 로그인 상태를
보장하지 않습니다. 실제 관측 로그는 tracker 실행 폴더에서 따로 확인해야 합니다.

## 데이터 해석과 백업

가격은 목록·옵션의 관측 표시가이며 실제 수입 도착 원가가 아닙니다. 비슷한 사진과 제목만으로
동일 SKU, 재질 진위, 판매자 신뢰도, 실제 거래량을 확정하지 않습니다.

GitHub에는 코드·테스트·설명만 보관합니다. Chrome 프로필, 쿠키, 인증 키, 사용자 조사 원본은
tracker의 실행 폴더와 기존 로컬 설정에 남깁니다. tracker의 `configs/sourcing-stack.lock.json`은
함께 사용할 이 저장소의 커밋을 지정합니다.
