import {
  App,
  Editor,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  SuggestModal,
  TFile,
} from "obsidian";
import HANJA_MEANINGS from "hanja-data";

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

interface HanjaEntry {
  hanja: string;
  count: number;
  sources: string[];
  meaning?: string;
}

// 한글 → 한자 후보 목록
type HanjaDictionary = Record<string, HanjaEntry[]>;

interface HanjaSuggesterSettings {
  dictionaryFilePath: string;
}

interface PluginData {
  settings: HanjaSuggesterSettings;
  dictionary: HanjaDictionary;
}

const DEFAULT_SETTINGS: HanjaSuggesterSettings = {
  dictionaryFilePath: "Hanja Dictionary.md",
};

// ─── 정규식 ──────────────────────────────────────────────────────────────────

// 한글 음절: \uAC00-\uD7A3
// 한자 (CJK 통합 한자 + 확장 A + 호환 한자): \u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF
const HANJA_RE = "[\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF]";
const HANGUL_RE = "[\\uAC00-\\uD7A3]";

// 패턴 1: 한글(漢字)  예) 사전(辭典), 한자 (漢字)
const PATTERN_PAREN =
  new RegExp(`(${HANGUL_RE}+)\\s*\\((${HANJA_RE}+)\\)`, "g");

// 패턴 2: <ruby>漢字<rt>한글</rt></ruby>  예) <ruby>韓字<rt>한자</rt></ruby>
//   → 한자가 먼저, 한글 읽기가 <rt> 안에 위치
const PATTERN_RUBY =
  new RegExp(`<ruby>(${HANJA_RE}+)<rt>(${HANGUL_RE}+)<\\/rt><\\/ruby>`, "gi");

// ─── 메인 플러그인 ────────────────────────────────────────────────────────────

export default class HanjaSuggesterPlugin extends Plugin {
  settings: HanjaSuggesterSettings = DEFAULT_SETTINGS;
  dictionary: HanjaDictionary = {};

  async onload() {
    await this.loadPluginData();

    // 명령어 1: 전체 Vault 인덱싱
    this.addCommand({
      id: "index-vault-hanja",
      name: "전체 Vault 한자 인덱싱",
      callback: () => this.indexVault(),
    });

    // 명령어 2: 사전 파일 열기
    this.addCommand({
      id: "open-hanja-dictionary",
      name: "한자 사전 파일 열기",
      callback: () => this.openDictionaryFile(),
    });

    // 명령어 3: 선택 텍스트에 한자 후보 표시
    this.addCommand({
      id: "suggest-hanja-for-selection",
      name: "선택한 한글에 한자 후보 표시",
      editorCallback: (editor: Editor) => {
        const selected = editor.getSelection().trim();
        if (!selected) {
          new Notice("한글 텍스트를 먼저 선택하세요.");
          return;
        }
        this.showHanjaSuggestions(editor, selected);
      },
    });

    // 설정 탭 등록
    this.addSettingTab(new HanjaSuggesterSettingTab(this.app, this));

    console.log("Hanja Suggester 플러그인 로드 완료");
  }

  onunload() {
    console.log("Hanja Suggester 플러그인 언로드");
  }

  // ─── 인덱싱 ──────────────────────────────────────────────────────────────

  async indexVault(): Promise<void> {
    new Notice("⏳ Vault 인덱싱을 시작합니다...");
    this.dictionary = {};

    const markdownFiles = this.app.vault.getMarkdownFiles();
    const dictionaryPath = this.settings.dictionaryFilePath;
    let fileCount = 0;

    for (const file of markdownFiles) {
      // 사전 파일 자체는 건너뜀
      if (file.path === dictionaryPath) continue;

      try {
        const content = await this.app.vault.read(file);
        this.extractPairsFromText(content, file.basename);
        fileCount++;
      } catch (e) {
        console.warn(`파일 읽기 실패: ${file.path}`, e);
      }
    }

    // 뜻 데이터 적용 (빌드 시 번들된 libhangul hanja.txt 기반)
    for (const [korean, hanjaList] of Object.entries(this.dictionary)) {
      for (const entry of hanjaList) {
        entry.meaning = HANJA_MEANINGS[`${korean}:${entry.hanja}`] ?? "";
      }
    }

    await this.savePluginData();
    await this.writeDictionaryFile();

    const wordCount = Object.keys(this.dictionary).length;
    new Notice(
      `✅ 인덱싱 완료!\n${fileCount}개 파일 / ${wordCount}개 단어 수집`
    );
  }

  /** 텍스트에서 한글-한자 패턴을 찾아 사전에 추가 */
  private extractPairsFromText(text: string, sourceName: string): void {
    // 패턴 1: 한글(漢字)
    this.applyPattern(PATTERN_PAREN, text, sourceName, 1, 2);
    // 패턴 2: <ruby>漢字<rt>한글</rt></ruby>  (그룹 순서: 한자=1, 한글=2)
    this.applyPattern(PATTERN_RUBY, text, sourceName, 2, 1);
  }

  /**
   * 정규식을 텍스트에 적용하여 사전에 쌍을 추가한다.
   * @param pattern  실행할 정규식 (g 플래그 필수)
   * @param text     대상 텍스트
   * @param source   출처 파일 이름
   * @param koreanGroup  한글 캡처 그룹 번호
   * @param hanjaGroup   한자 캡처 그룹 번호
   */
  private applyPattern(
    pattern: RegExp,
    text: string,
    source: string,
    koreanGroup: number,
    hanjaGroup: number
  ): void {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const korean = match[koreanGroup];
      const hanja = match[hanjaGroup];

      if (!this.dictionary[korean]) {
        this.dictionary[korean] = [];
      }

      const existing = this.dictionary[korean].find((e) => e.hanja === hanja);
      if (existing) {
        existing.count++;
        if (!existing.sources.includes(source)) {
          existing.sources.push(source);
        }
      } else {
        this.dictionary[korean].push({ hanja, count: 1, sources: [source] });
      }
    }
  }

  // ─── 사전 파일 ────────────────────────────────────────────────────────────

  async writeDictionaryFile(): Promise<void> {
    const entries = Object.entries(this.dictionary);

    if (entries.length === 0) {
      new Notice("사전이 비어 있습니다. 먼저 인덱싱을 실행하세요.");
      return;
    }

    // 한글 가나다순 정렬
    entries.sort(([a], [b]) => a.localeCompare(b, "ko"));

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const lines: string[] = [
      "# 한자 사전 (Hanja Dictionary)",
      "",
      `> **마지막 업데이트:** ${dateStr} ${timeStr}  `,
      `> **총 표제어:** ${entries.length}개`,
      "",
      "---",
      "",
    ];

    for (const [korean, hanjaList] of entries) {
      // 같은 한글에 여러 한자가 있으면 빈도 내림차순
      const sorted = [...hanjaList].sort((a, b) => b.count - a.count);
      for (const entry of sorted) {
        lines.push(`${korean}:${entry.hanja}:${entry.meaning ?? ""}:${entry.count}`);
      }
    }

    const content = lines.join("\n");
    const filePath = this.settings.dictionaryFilePath;
    const existing = this.app.vault.getAbstractFileByPath(filePath);

    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(filePath, content);
    }
  }

  async openDictionaryFile(): Promise<void> {
    const filePath = this.settings.dictionaryFilePath;
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      new Notice("사전 파일이 없습니다. 먼저 '전체 Vault 한자 인덱싱'을 실행하세요.");
      return;
    }

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }

  // ─── 한자 후보 표시 ───────────────────────────────────────────────────────

  showHanjaSuggestions(editor: Editor, korean: string): void {
    const candidates = this.dictionary[korean];

    if (!candidates || candidates.length === 0) {
      new Notice(`"${korean}"에 대한 한자 후보가 없습니다.\n인덱싱 후 다시 시도하거나 Vault에 해당 단어의 한자 표기가 없을 수 있습니다.`);
      return;
    }

    new HanjaSuggestModal(this.app, korean, candidates, (chosen) => {
      // 선택한 한글을 한자로 치환
      editor.replaceSelection(chosen);
    }).open();
  }

  // ─── 데이터 저장/로드 ─────────────────────────────────────────────────────

  async loadPluginData(): Promise<void> {
    const raw = (await this.loadData()) as Partial<PluginData> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw?.settings ?? {});
    this.dictionary = raw?.dictionary ?? {};
  }

  async savePluginData(): Promise<void> {
    const data: PluginData = {
      settings: this.settings,
      dictionary: this.dictionary,
    };
    await this.saveData(data);
  }
}

// ─── 한자 후보 선택 모달 ─────────────────────────────────────────────────────

interface HanjaCandidate {
  entry: HanjaEntry;
  korean: string;
}

class HanjaSuggestModal extends SuggestModal<HanjaCandidate> {
  private candidates: HanjaCandidate[];
  private onChoose: (hanja: string) => void;

  constructor(
    app: App,
    korean: string,
    entries: HanjaEntry[],
    onChoose: (hanja: string) => void
  ) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder(`"${korean}" 의 한자 후보를 검색하세요...`);

    // 빈도 내림차순 정렬
    this.candidates = [...entries]
      .sort((a, b) => b.count - a.count)
      .map((entry) => ({ entry, korean }));
  }

  getSuggestions(query: string): HanjaCandidate[] {
    if (!query) return this.candidates;
    return this.candidates.filter(
      (c) =>
        c.entry.hanja.includes(query) ||
        c.entry.sources.some((s) =>
          s.toLowerCase().includes(query.toLowerCase())
        )
    );
  }

  renderSuggestion(candidate: HanjaCandidate, el: HTMLElement): void {
    const { entry, korean } = candidate;
    const wrapper = el.createDiv({ cls: "hanja-suggestion-item" });

    // 한자 + 한글 표기
    const main = wrapper.createDiv({ cls: "hanja-suggestion-main" });
    main.createSpan({ cls: "hanja-char", text: entry.hanja });
    main.createSpan({ cls: "hanja-korean", text: ` (${korean})` });

    // 빈도 + 출처
    const meta = wrapper.createDiv({ cls: "hanja-suggestion-meta" });
    meta.createSpan({
      text: `${entry.count}회 사용 · 출처: ${entry.sources.slice(0, 3).join(", ")}${entry.sources.length > 3 ? ` 외 ${entry.sources.length - 3}개` : ""}`,
    });
  }

  onChooseSuggestion(candidate: HanjaCandidate, _evt: MouseEvent | KeyboardEvent): void {
    this.onChoose(candidate.entry.hanja);
  }
}

// ─── 설정 탭 ──────────────────────────────────────────────────────────────────

class HanjaSuggesterSettingTab extends PluginSettingTab {
  plugin: HanjaSuggesterPlugin;

  constructor(app: App, plugin: HanjaSuggesterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Hanja Suggester 설정" });

    new Setting(containerEl)
      .setName("사전 파일 경로")
      .setDesc(
        "한자 사전이 저장될 마크다운 파일 경로 (Vault 루트 기준). 예: Hanja Dictionary.md 또는 Reference/Hanja.md"
      )
      .addText((text) =>
        text
          .setPlaceholder("Hanja Dictionary.md")
          .setValue(this.plugin.settings.dictionaryFilePath)
          .onChange(async (value) => {
            this.plugin.settings.dictionaryFilePath = value.trim() || "Hanja Dictionary.md";
            await this.plugin.savePluginData();
          })
      );

    // 현재 사전 통계
    const dict = this.plugin.dictionary;
    const wordCount = Object.keys(dict).length;
    const totalEntries = Object.values(dict).reduce(
      (sum, entries) => sum + entries.length,
      0
    );

    if (wordCount > 0) {
      containerEl.createEl("h3", { text: "현재 사전 현황" });
      const info = containerEl.createEl("p");
      info.setText(`표제어: ${wordCount}개 / 한자 항목: ${totalEntries}개`);
    }

    containerEl.createEl("h3", { text: "명령어 안내" });
    const ul = containerEl.createEl("ul");
    [
      "전체 Vault 한자 인덱싱 — Vault 전체를 스캔하여 사전 갱신",
      "한자 사전 파일 열기 — 생성된 사전 MD 파일을 엶",
      "선택한 한글에 한자 후보 표시 — 에디터에서 한글 선택 후 실행",
    ].forEach((desc) => ul.createEl("li", { text: desc }));
  }
}
