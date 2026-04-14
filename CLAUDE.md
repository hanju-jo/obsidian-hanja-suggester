# Hanja Suggester — CLAUDE.md

Obsidian 플러그인. Vault 전체를 스캔해 기존 문서에서 한글-한자 변환 쌍을 수집하고, 에디터에서 선택한 한글 텍스트에 한자 후보를 제안한다.

## 프로젝트 구조

```
hanja-suggester/
├── main.ts              # 전체 소스 (TypeScript)
├── main.js              # 빌드 산출물 — 직접 편집 금지
├── hanja-data.d.ts      # 빌드 시 주입되는 가상 모듈 타입 선언
├── manifest.json        # Obsidian 플러그인 메타데이터
├── package.json
├── tsconfig.json
└── esbuild.config.mjs   # 빌드 스크립트 (hanja.txt 다운로드 포함)
```

## 개발 명령어

```bash
npm install          # 최초 1회
npm run dev          # watch 모드 (개발 중) — 최초 1회 hanja.txt 다운로드 후 캐시 재사용
npm run build        # 타입 검사 + 프로덕션 번들 — 매번 hanja.txt 최신본 다운로드
```

빌드 시 GitHub에서 libhangul/hanja.txt를 받아 esbuild 가상 모듈(`hanja-data`)로 번들에 포함한다.  
dev 모드는 `.hanja-data-cache.json`을 캐시로 사용한다(`.gitignore`에 포함됨).

## Obsidian 설치 방법

```bash
VAULT=~/path/to/your/vault
mkdir -p "$VAULT/.obsidian/plugins/hanja-suggester"
cp main.js manifest.json "$VAULT/.obsidian/plugins/hanja-suggester/"
```

이후 Obsidian → 설정 → 커뮤니티 플러그인 → **Hanja Suggester** 활성화.

## 인식하는 한자 표기 패턴

| 패턴 | 예시 | 비고 |
|------|------|------|
| `한글(漢字)` | `사전(辭典)` | 공백 허용: `사전 (辭典)` |
| `<ruby>漢字<rt>한글</rt></ruby>` | `<ruby>韓字<rt>한자</rt></ruby>` | HTML ruby 어노테이션 |

두 패턴 모두 인덱싱 시 동일한 사전 엔트리로 합산된다.

## 아키텍처

### 데이터 흐름

```
Vault MD 파일들
    ↓ indexVault()
extractPairsFromText()  ← PATTERN_PAREN + PATTERN_RUBY
    ↓
HanjaDictionary (메모리)
    ↓ HANJA_MEANINGS[`${korean}:${hanja}`]  ← 빌드 시 번들된 libhangul 데이터
    ↓ (entry.meaning 필드 채움)
    ↓ savePluginData()         ↓ writeDictionaryFile()
data.json (플러그인 저장소)    Hanja Dictionary.md (사람이 읽는 파일)
```

### 주요 타입

```typescript
interface HanjaEntry {
  hanja: string;     // 漢字 문자열
  count: number;     // 발견 횟수 (빈도순 정렬에 사용)
  sources: string[]; // 출처 파일 basename 목록
  meaning?: string;  // 뜻 (빌드 시 번들된 libhangul 데이터 기반, 없으면 빈 문자열)
}

type HanjaDictionary = Record<string, HanjaEntry[]>;
// 키: 한글 단어, 값: 한자 후보 목록 (count 내림차순)
```

### 클래스 구성

- `HanjaSuggesterPlugin` — 플러그인 진입점. 명령어 등록, 인덱싱, 사전 파일 관리.
- `HanjaSuggestModal` — `SuggestModal<HanjaCandidate>` 확장. 후보를 빈도순으로 표시하고 선택 시 `한글(漢字)` 형식으로 치환.
- `HanjaSuggesterSettingTab` — 사전 파일 경로 설정 및 현재 사전 통계 표시.

## 플러그인 명령어

| 명령어 ID | 이름 | 동작 |
|-----------|------|------|
| `index-vault-hanja` | 전체 Vault 한자 인덱싱 | Vault 스캔 후 사전 갱신 |
| `open-hanja-dictionary` | 한자 사전 파일 열기 | 사전 MD 파일을 에디터에서 열기 |
| `suggest-hanja-for-selection` | 선택한 한글에 한자 후보 표시 | 선택 텍스트 → 후보 모달 → `한글(漢字)` 치환 |

## 데이터 저장

- **`data.json`** (`{vault}/.obsidian/plugins/hanja-suggester/data.json`): 설정 + 사전을 JSON으로 저장. Obsidian `loadData()` / `saveData()` API 사용.
- **사전 MD 파일** (기본: `Hanja Dictionary.md`): 사람이 읽을 수 있는 가나다순 목록. 설정에서 경로 변경 가능.
  - 형식: `한글:한자:뜻:사용횟수` (예: `사전:辭典:말 사, 법 전:5`)
  - 뜻은 libhangul 데이터에 등재된 항목에만 채워짐. 미등재 항목은 빈 문자열.

## 버전 관리 규칙

`manifest.json`과 `package.json`의 `version` 필드를 항상 동일하게 유지한다.
