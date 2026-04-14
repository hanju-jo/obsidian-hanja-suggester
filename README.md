# Obsidian Hanja Suggester

Obsidian Vault에 이미 적어둔 한자(漢字) 표기를 자동으로 수집해 개인 사전을 만들고, 글을 쓸 때 한자 후보를 바로 제안해주는 플러그인입니다.

---

## 작동 원리

별도의 한자 데이터베이스 없이, **내 Vault 안에 이미 쓴 한자 표기**를 재활용합니다.

예를 들어 어떤 노트에 `사전(辭典)` 또는 `<ruby>辭典<rt>사전</rt></ruby>` 이라고 적혀 있다면, 플러그인이 이를 읽어 `사전 → 辭典` 항목을 사전에 등록합니다. 이후 다른 노트에서 `사전`을 선택해 명령어를 실행하면 `辭典`을 후보로 제안합니다.

---

## 기능

- **Vault 전체 인덱싱** — 마크다운 파일을 모두 읽어 한글-한자 쌍을 수집
- **사전 파일 생성** — 수집 결과를 가나다순 마크다운 표로 저장
- **한자 후보 제안** — 에디터에서 한글을 선택하고 명령어를 실행하면 후보 목록을 표시, 선택하면 한자로 자동 치환

---

## 인식하는 표기 형식

Vault 내 문서에서 아래 두 가지 형식을 찾아 사전으로 수집합니다.

| 형식 | 예시 |
|------|------|
| `한글(漢字)` | `사전(辭典)`, `대한민국(大韓民國)` |
| HTML ruby 태그 | `<ruby>辭典<rt>사전</rt></ruby>` |

---

## 설치

> 현재 공식 커뮤니티 플러그인 목록에 등록되지 않았습니다. 아래 수동 설치 방법을 사용하세요.

1. [Releases](../../releases) 페이지에서 최신 `main.js`와 `manifest.json`을 다운로드합니다.
2. Vault의 `.obsidian/plugins/hanja-suggester/` 폴더를 만들고 두 파일을 복사합니다.
3. Obsidian을 재시작한 뒤 **설정 → 커뮤니티 플러그인**에서 **Hanja Suggester**를 활성화합니다.

---

## 사용 방법

### 1단계: Vault 인덱싱

Command Palette (`Ctrl/Cmd + P`) 에서 **"전체 Vault 한자 인덱싱"** 을 실행합니다.

Vault의 모든 마크다운 파일을 읽어 한자 표기를 수집합니다. 완료되면 상단에 수집 결과 알림이 표시됩니다.

> Vault에 새 노트를 추가하거나 한자 표기를 늘린 뒤에는 인덱싱을 다시 실행해 사전을 갱신하세요.

### 2단계: 사전 확인 (선택)

**"한자 사전 파일 열기"** 명령어를 실행하면 수집된 사전을 확인할 수 있습니다.

```
대한민국:大韓民國::3
사전:辭典:말 사, 법 전:5
```

형식은 `한글:한자:뜻:사용횟수`입니다. 뜻은 libhangul 데이터에 등재된 항목에만 표시됩니다.

### 3단계: 한자 변환

1. 에디터에서 변환하고 싶은 **한글 단어를 선택**합니다.
2. Command Palette에서 **"선택한 한글에 한자 후보 표시"** 를 실행합니다.
3. 후보 목록이 열리면 원하는 한자를 클릭하거나 키보드로 선택합니다.
4. 선택한 한글이 한자로 자동 치환됩니다.

```
사전  →  辭典
```

---

## 설정

**설정 → 플러그인 옵션 → Hanja Suggester** 에서 아래 항목을 변경할 수 있습니다.

| 항목 | 기본값 | 설명 |
|------|--------|------|
| 사전 파일 경로 | `Hanja Dictionary.md` | 사전이 저장될 마크다운 파일 위치 |

---

## 자주 묻는 질문

**Q. 후보가 전혀 표시되지 않아요.**  
A. Vault에 해당 단어의 한자 표기가 아직 없는 경우입니다. 한 번이라도 `단어(漢字)` 형식으로 직접 적어두면 이후 인덱싱부터 후보로 등장합니다.

**Q. 새 노트를 쓴 후 후보가 업데이트되지 않아요.**  
A. 인덱싱은 자동으로 실행되지 않습니다. 사전을 갱신하려면 **"전체 Vault 한자 인덱싱"** 을 다시 실행하세요.

**Q. 사전 파일을 실수로 삭제했어요.**  
A. **"전체 Vault 한자 인덱싱"** 을 다시 실행하면 사전 파일이 재생성됩니다. 내부 데이터는 별도로 보관되므로 Vault 재스캔 없이도 파일만 복원됩니다.

---

## 라이선스

MIT

### 한자 뜻 데이터

이 플러그인은 빌드 시 [libhangul](https://github.com/libhangul/libhangul) 프로젝트의 `data/hanja/hanja.txt`에서 한자 뜻 데이터를 가져와 번들에 포함합니다.

해당 파일의 라이선스 고지:

> Copyright (c) 2005,2006 Choe Hwanjin  
> All rights reserved.
>
> Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
>
> 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
> 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
> 3. Neither the name of the author nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
