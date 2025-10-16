/**
 * JSP 문제은행 앱 상태 및 렌더링 로직
 * @author Codex
 */
(function () {
  const STORAGE_KEY = "jsp-practice-progress-v1";
  const THEME_KEY = "jsp-practice-theme";

  /** @typedef {"difficulty" | "recent" | "accuracy"} SortKey */

  const CONCEPT_ORDER = [
    "폼 기본 구성",
    "요청 인코딩",
    "파라미터 열거",
    "다중값 처리",
    "요청 전달",
    "세션 관리",
    "디렉티브 활용",
    "cos.jar 업로드 처리",
    "업로드 메타데이터",
    "Commons FileUpload",
    "정적 리소스 관리",
    "업로드 파일 규칙화",
    "입력 데이터 후처리",
    "업로드 모니터링",
    "요청 진단",
  ];

  const CONCEPT_INFO = {
    "폼 기본 구성": "multipart/form-data 기반 상품 등록 폼 구성법을 복습합니다.",
    "요청 인코딩": "POST 본문 파싱 전에 인코딩을 지정하는 올바른 순서를 연습합니다.",
    "파라미터 열거": "Enumeration으로 전달된 모든 파라미터를 순회해 출력합니다.",
    "다중값 처리": "checkbox · 다중 선택 값이 배열로 전달될 때의 처리 패턴을 익힙니다.",
    "cos.jar 업로드 처리": "cos MultipartRequest 생성자 5개 인자 구성과 파라미터 조회를 다룹니다.",
    "업로드 메타데이터": "원본 파일명과 저장 파일명을 모두 확인하는 패턴을 연습합니다.",
    "Commons FileUpload": "Apache Commons FileUpload로 멀티파트 요청을 파싱하고 저장합니다.",
    "정적 리소스 관리": "프로젝트 정적 리소스 경로를 JSP에서 안전하게 연결합니다.",
    "업로드 파일 규칙화": "업로드 파일명을 도메인 규칙에 맞춰 지정하고 사용하는 방법을 확인합니다.",
    "입력 데이터 후처리": "분리된 입력값을 서버에서 합쳐 가공하는 로직을 작성합니다.",
    "업로드 모니터링": "ProgressListener로 업로드 진행률을 계산하고 출력합니다.",
    "요청 진단": "요청 파라미터와 본문 길이를 가볍게 진단하는 보일러플레이트를 연습합니다.",
    "요청 전달": "RequestDispatcher로 request 속성을 전달하며 JSP 간 제어를 이동합니다.",
    "세션 관리": "세션 유지 시간과 사용자 상태를 관리하는 패턴을 익힙니다.",
    "디렉티브 활용": "page/include/taglib 디렉티브 속성을 정확히 설정하는 방법을 다룹니다.",
  };

  /**
   * @typedef {Object} ProgressItem
   * @property {string} code - 마지막으로 저장한 코드
   * @property {number} attempts - 총 시도 횟수
   * @property {number} passes - 정답 횟수
   * @property {boolean} passed - 마지막 시도가 통과했는지 여부
   * @property {string} updatedAt - ISO 문자열의 마지막 시도 시각
   */

  /**
   * 전역 상태
   */
  const state = {
    problems: Array.isArray(window.PROBLEMS) ? window.PROBLEMS : [],
    filters: {
      search: "",
      difficulty: "all",
      tag: "all",
      sort: /** @type {SortKey} */ ("difficulty"),
      concept: "all",
    },
    selectedProblemId: null,
    progress: /** @type {Record<string, ProgressItem>} */ ({}),
  };

  // DOM 참조
  const dom = {
    listView: document.getElementById("listView"),
    detailView: document.getElementById("detailView"),
    problemsList: document.getElementById("problemsList"),
    statsPanel: document.getElementById("statsPanel"),
    conceptNav: document.getElementById("conceptNav"),
    searchInput: document.getElementById("searchInput"),
    difficultyFilter: document.getElementById("difficultyFilter"),
    tagFilter: document.getElementById("tagFilter"),
    sortSelect: document.getElementById("sortSelect"),
    toggleDarkMode: document.getElementById("toggleDarkMode"),
    exportProgress: document.getElementById("exportProgress"),
    importProgress: document.getElementById("importProgress"),
    backToList: document.getElementById("backToList"),
    detailTitle: document.getElementById("detailTitle"),
    detailMeta: document.getElementById("detailMeta"),
    detailTags: document.getElementById("detailTags"),
    detailDescription: document.getElementById("detailDescription"),
    codeEditor: document.getElementById("codeEditor"),
    lineNumbers: document.querySelector(".line-numbers"),
    runTests: document.getElementById("runTests"),
    toggleHint: document.getElementById("toggleHint"),
    toggleSolution: document.getElementById("toggleSolution"),
    nextProblem: document.getElementById("nextProblem"),
    resetCode: document.getElementById("resetCode"),
    resultSummary: document.getElementById("resultSummary"),
    resultDetails: document.getElementById("resultDetails"),
    hintSection: document.getElementById("hintSection"),
    hintContent: document.getElementById("hintContent"),
    solutionSection: document.getElementById("solutionSection"),
    solutionCode: document.getElementById("solutionCode"),
    solutionExplanation: document.getElementById("solutionExplanation"),
  };

  /**
   * LocalStorage에서 진행 데이터를 읽습니다.
   * @returns {Record<string, ProgressItem>}
   */
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      return {};
    }
  }

  /**
   * 진행 데이터를 LocalStorage에 저장합니다.
   * @param {Record<string, ProgressItem>} progress
   */
  function saveProgress(progress) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  /**
   * 다크 모드 상태를 저장합니다.
   * @param {boolean} enabled
   */
  function persistTheme(enabled) {
    localStorage.setItem(THEME_KEY, enabled ? "dark" : "light");
  }

  /**
   * 저장된 다크 모드 상태를 복원합니다.
   */
  function restoreTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark") {
      document.body.classList.add("dark");
      dom.toggleDarkMode?.setAttribute("aria-pressed", "true");
    }
  }

  /**
   * 현재 필터 조건에 맞는 문제 배열을 반환합니다.
   * @returns {Array<Object>}
   */
  function getFilteredProblems() {
    const { search, difficulty, tag, sort, concept } = state.filters;
    const keyword = search.trim().toLowerCase();

    let items = state.problems.filter((problem) => {
      const matchesKeyword =
        !keyword ||
        problem.title.toLowerCase().includes(keyword) ||
        problem.description.toLowerCase().includes(keyword) ||
        problem.tags.some((t) => t.toLowerCase().includes(keyword));
      const matchesDifficulty =
        difficulty === "all" || problem.difficulty === difficulty;
      const matchesTag = tag === "all" || problem.tags.includes(tag);
      const matchesConcept = concept === "all" || problem.concept === concept;
      return matchesKeyword && matchesDifficulty && matchesTag && matchesConcept;
    });

    const progress = state.progress;

    const difficultyOrder = { 초급: 0, 중급: 1, 고급: 2 };
    items = items.sort((a, b) => {
      if (sort === "difficulty") {
        return (difficultyOrder[a.difficulty] ?? 0) - (difficultyOrder[b.difficulty] ?? 0);
      }
      if (sort === "recent") {
        const aDate = progress[a.id]?.updatedAt ? Date.parse(progress[a.id].updatedAt) : 0;
        const bDate = progress[b.id]?.updatedAt ? Date.parse(progress[b.id].updatedAt) : 0;
        return bDate - aDate;
      }
      if (sort === "accuracy") {
        const aStats = progress[a.id];
        const bStats = progress[b.id];
        const aAcc = aStats && aStats.attempts > 0 ? aStats.passes / aStats.attempts : 0;
        const bAcc = bStats && bStats.attempts > 0 ? bStats.passes / bStats.attempts : 0;
        if (bAcc !== aAcc) return bAcc - aAcc;
        return (bStats?.attempts ?? 0) - (aStats?.attempts ?? 0);
      }
      return 0;
    });

    return items;
  }

  /**
   * 통계 패널을 업데이트합니다.
   */
  function renderStats() {
    if (!dom.statsPanel) return;
    const problems = getFilteredProblems();
    const total = problems.length;
    const solved = problems.filter((p) => state.progress[p.id]?.passed).length;
    const attempts = problems.reduce(
      (sum, p) => sum + (state.progress[p.id]?.attempts ?? 0),
      0
    );

    dom.statsPanel.innerHTML = [
      `총 ${total}문제`,
      `정답 ${solved}개`,
      `시도 ${attempts}회`,
    ]
      .map((text) => `<span>${text}</span>`)
      .join('<span class="stats-dot">·</span>');
  }

  /**
   * 개념별 목차 카드를 렌더링합니다.
   */
  function renderConceptNav() {
    if (!dom.conceptNav) return;
    const activeConcept = state.filters.concept;
    const cards = [];

    cards.push(`
      <article class="concept-card ${activeConcept === "all" ? "active" : ""}" data-concept="all" tabindex="0" role="button" aria-pressed="${activeConcept === "all"}">
        <h3>전체 보기</h3>
        <p>모든 개념의 문제를 한 번에 살펴봅니다.</p>
        <span class="concept-meta">${state.problems.length}문제</span>
      </article>
    `);

    CONCEPT_ORDER.forEach((concept) => {
      const items = state.problems.filter((problem) => problem.concept === concept);
      if (!items.length) return;
      const description = CONCEPT_INFO[concept] ?? "";
      const isActive = activeConcept === concept;
      cards.push(`
        <article class="concept-card ${isActive ? "active" : ""}" data-concept="${concept}" tabindex="0" role="button" aria-pressed="${isActive}">
          <h3>${concept}</h3>
          <p>${description}</p>
          <span class="concept-meta">${items.length}문제</span>
        </article>
      `);
    });

    dom.conceptNav.innerHTML = cards.join("");
  }

  /**
   * 개념 필터를 설정합니다.
   * @param {string} concept
   */
  function setConceptFilter(concept) {
    const nextConcept = concept === "all" ? "all" : concept;
    state.filters.concept = nextConcept;
    state.filters.search = "";
    dom.searchInput && (dom.searchInput.value = "");
    renderConceptNav();
    renderProblemList();
    renderStats();
  }

  /**
   * 목록 화면을 렌더링합니다.
   */
  function renderProblemList() {
    if (!dom.problemsList) return;
    const problems = getFilteredProblems();
    dom.problemsList.innerHTML = problems
      .map((problem) => {
        const progress = state.progress[problem.id];
        const status = !progress
          ? "미시도"
          : progress.passed
          ? "정답"
          : "오답";
        const statusClass = progress
          ? progress.passed
            ? "success"
            : "fail"
          : "pending";

        const summary = Array.isArray(problem.description)
          ? problem.description[0]
          : String(problem.description || "")
              .split(/\n\s*\n/)
              .map((text) => text.trim())
              .find(Boolean) ?? "";
        const summaryText = summary.replace(/\s+/g, " ").trim();
        const shortSummary =
          summaryText.length > 140 ? `${summaryText.slice(0, 137)}…` : summaryText;

        return `
          <article class="problem-card" data-problem-id="${problem.id}">
            <header class="card-header">
              <div class="card-heading">
                ${problem.concept ? `<span class="concept-label">${problem.concept}</span>` : ""}
                <h3>${problem.title}</h3>
              </div>
              <span class="badge ${statusClass}">${status}</span>
            </header>
            <p class="card-summary">${shortSummary}</p>
            <div class="tags">
              ${problem.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
            </div>
            <p class="card-meta">난이도: ${problem.difficulty}</p>
            <button type="button" data-problem="${problem.id}">연습하기</button>
          </article>
        `;
      })
      .join("");
  }

  /**
   * ISO 문자열을 YYYY-MM-DD로 변환합니다.
   * @param {string} isoString
   * @returns {string}
   */
  function formatDate(isoString) {
    if (!isoString) return "-";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "-";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
  }

  /**
   * 문제 설명과 참고 코드를 렌더링합니다.
   * @param {Object} problem
   */
  function renderProblemDescription(problem) {
    if (!dom.detailDescription) return;
    const container = dom.detailDescription;
    container.innerHTML = "";

    const descriptionValue = problem.description ?? "";
    const paragraphs = Array.isArray(descriptionValue)
      ? descriptionValue
      : String(descriptionValue).split(/\n\s*\n/);

    paragraphs
      .map((text) => text.trim())
      .filter(Boolean)
      .forEach((text) => {
        const p = document.createElement("p");
        p.textContent = text;
        container.appendChild(p);
      });

    if (problem.referenceCode) {
      const heading = document.createElement("h4");
      heading.textContent = "요청 처리 참고 코드";
      container.appendChild(heading);

      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = problem.referenceCode;
      pre.appendChild(code);
      container.appendChild(pre);
    }
  }

  /**
   * 문제 상세 화면을 표시합니다.
   * @param {string} problemId
   */
  function showProblemDetail(problemId) {
    const problem = state.problems.find((item) => item.id === problemId);
    if (!problem || !dom.detailView || !dom.listView) return;
    state.selectedProblemId = problemId;

    dom.detailTitle.textContent = problem.title;
    dom.detailMeta.textContent = `난이도: ${problem.difficulty} · ID: ${problem.id}`;
    dom.detailTags.innerHTML = problem.tags
      .map((tag) => `<span class="tag">${tag}</span>`)
      .join("");
    renderProblemDescription(problem);

    const stored = state.progress[problem.id];
    const code = stored?.code ?? problem.starterCode ?? "";
    dom.codeEditor.value = code;
    updateLineNumbers(code);

    dom.hintContent.textContent = problem.hint ?? "힌트가 제공되지 않았습니다.";
    dom.hintSection.hidden = true;
    dom.solutionCode.textContent = problem.solutionCode ?? "";
    dom.solutionExplanation.textContent =
      problem.explanation ?? "정답 해설이 등록되지 않았습니다.";
    dom.solutionSection.hidden = true;

    dom.resultSummary.textContent = "아직 채점하지 않았습니다.";
    dom.resultSummary.className = "result-summary";
    dom.resultDetails.innerHTML = "";

    dom.listView.hidden = true;
    dom.detailView.hidden = false;
    dom.codeEditor.focus();
  }

  /**
   * 상세 화면을 닫고 목록으로 돌아갑니다.
   */
  function backToList() {
    state.selectedProblemId = null;
    if (dom.detailView) dom.detailView.hidden = true;
    if (dom.listView) dom.listView.hidden = false;
  }

  /**
   * 코드 에디터의 줄 번호를 갱신합니다.
   * @param {string} value
   */
  function updateLineNumbers(value) {
    if (!dom.lineNumbers) return;
    const lines = value.split("\n").length || 1;
    const numbers = Array.from({ length: lines }, (_, idx) => idx + 1)
      .map((line) => `<span>${line}</span>`)
      .join("\n");
    dom.lineNumbers.innerHTML = numbers;
  }

  /**
   * 현재 문제에서 사용자 입력을 채점합니다.
   */
  function gradeCurrentProblem() {
    const problem = state.problems.find((item) => item.id === state.selectedProblemId);
    if (!problem) return;
    const code = dom.codeEditor.value;
    const results = problem.tests.map((test) => runTest(test, code));
    const passed = results.every((entry) => entry.passed);

    renderResult(problem, results, passed);
    updateProgress(problem.id, code, passed);
    renderProblemList();
    renderStats();
  }

  /**
   * 단일 테스트를 실행합니다.
   * @param {Object} test
   * @param {string} code
   * @returns {{desc: string, passed: boolean}}
   */
  function runTest(test, code) {
    if (test.type === "regex" && test.pattern instanceof RegExp) {
      return { desc: test.desc, passed: test.pattern.test(code) };
    }
    if (test.type === "func" && typeof test.exec === "function") {
      let result = false;
      try {
        result = Boolean(test.exec(code));
      } catch (error) {
        console.error("테스트 함수 실행 실패:", error);
        result = false;
      }
      return { desc: test.desc, passed: result };
    }
    return { desc: test.desc, passed: false };
  }

  /**
   * 채점 결과를 화면에 반영합니다.
   * @param {Object} problem
   * @param {Array<{desc: string, passed: boolean}>} results
   * @param {boolean} passed
   */
  function renderResult(problem, results, passed) {
    dom.resultSummary.textContent = passed
      ? "✅ 정답입니다! 모든 검증을 통과했습니다."
      : "❌ 일부 검증에 실패했습니다. 항목별 결과를 확인하세요.";
    dom.resultSummary.className = `result-summary ${passed ? "success" : "fail"}`;
    dom.resultDetails.innerHTML = results
      .map(
        (item) => `
        <tr>
          <td>${item.desc}</td>
          <td>${item.passed ? "✔ 통과" : "✖ 실패"}</td>
        </tr>
      `
      )
      .join("");
  }

  /**
   * 진행 데이터를 업데이트합니다.
   * @param {string} problemId
  * @param {string} code
   * @param {boolean} passed
   */
  function updateProgress(problemId, code, passed) {
    const existing = state.progress[problemId];
    const now = new Date().toISOString();
    const nextProgress = {
      code,
      attempts: (existing?.attempts ?? 0) + 1,
      passes: (existing?.passes ?? 0) + (passed ? 1 : 0),
      passed,
      updatedAt: now,
    };
    state.progress[problemId] = nextProgress;
    saveProgress(state.progress);
  }

  /**
   * 코드 에디터를 초기화합니다.
   */
  function resetCode() {
    const problem = state.problems.find((item) => item.id === state.selectedProblemId);
    if (!problem) return;
    dom.codeEditor.value = problem.starterCode ?? "";
    updateLineNumbers(dom.codeEditor.value);
  }

  /**
   * 다음 문제를 불러옵니다.
   */
  function goToNextProblem() {
    const problems = getFilteredProblems();
    if (!problems.length) return;
    const currentIndex = problems.findIndex((item) => item.id === state.selectedProblemId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % problems.length;
    showProblemDetail(problems[nextIndex].id);
  }

  /**
   * JSON 형태로 진행 데이터를 다운로드합니다.
   */
  function exportProgress() {
    const blob = new Blob([JSON.stringify(state.progress, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jsp-progress.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 업로드한 JSON 파일을 읽어 진행 데이터를 복원합니다.
   * @param {File} file
   */
  function importProgress(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (typeof imported !== "object" || !imported) {
          alert("올바르지 않은 형식입니다.");
          return;
        }
        state.progress = imported;
        saveProgress(state.progress);
        renderProblemList();
        renderStats();
        alert("진행 내역을 불러왔습니다.");
      } catch (error) {
        console.error(error);
        alert("JSON 파싱에 실패했습니다.");
      }
    };
    reader.readAsText(file);
  }

  /**
   * 사용자 입력에 따른 필터 상태를 갱신합니다.
   */
  function bindFilterControls() {
    dom.searchInput?.addEventListener("input", (event) => {
      state.filters.search = event.target.value;
      renderProblemList();
      renderStats();
    });

    dom.difficultyFilter?.addEventListener("change", (event) => {
      state.filters.difficulty = event.target.value;
      renderProblemList();
      renderStats();
    });

    dom.tagFilter?.addEventListener("change", (event) => {
      state.filters.tag = event.target.value;
      renderProblemList();
      renderStats();
    });

    dom.sortSelect?.addEventListener("change", (event) => {
      state.filters.sort = event.target.value;
      renderProblemList();
      renderStats();
    });
  }

  /**
   * 개념 목차 카드를 클릭/키보드로 제어합니다.
   */
  function bindConceptNav() {
    if (!dom.conceptNav) return;
    dom.conceptNav.addEventListener("click", (event) => {
      const card = event.target.closest(".concept-card");
      if (!(card instanceof HTMLElement)) return;
      const concept = card.dataset.concept;
      if (!concept) return;
      setConceptFilter(concept);
    });

    dom.conceptNav.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target;
      if (!(card instanceof HTMLElement) || !card.classList.contains("concept-card")) return;
      event.preventDefault();
      const concept = card.dataset.concept;
      if (!concept) return;
      setConceptFilter(concept);
    });
  }

  /**
   * 목록 카드 클릭 이벤트를 연결합니다.
   */
  function bindListEvents() {
    dom.problemsList?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const problemId = target.dataset.problem || target.closest(".problem-card")?.dataset.problemId;
      if (problemId) {
        showProblemDetail(problemId);
      }
    });
  }

  /**
   * 상세 화면 버튼 이벤트를 연결합니다.
   */
  function bindDetailEvents() {
    dom.backToList?.addEventListener("click", backToList);
    dom.resetCode?.addEventListener("click", resetCode);
    dom.runTests?.addEventListener("click", gradeCurrentProblem);
    dom.nextProblem?.addEventListener("click", goToNextProblem);
    dom.toggleHint?.addEventListener("click", () => {
      const hidden = !dom.hintSection.hidden;
      dom.hintSection.hidden = hidden;
    });
    dom.toggleSolution?.addEventListener("click", () => {
      const hidden = !dom.solutionSection.hidden;
      dom.solutionSection.hidden = hidden;
    });
  }

  /**
   * 에디터 입력 이벤트를 설정합니다.
   */
  function bindEditorEvents() {
    dom.codeEditor?.addEventListener("input", (event) => {
      updateLineNumbers(event.target.value);
    });
  }

  /**
   * 키보드 단축키를 설정합니다.
   */
  function bindKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (!modifier) return;
      if (event.key === "Enter") {
        event.preventDefault();
        gradeCurrentProblem();
      } else if (event.key === "/") {
        event.preventDefault();
        dom.hintSection.hidden = !dom.hintSection.hidden;
      }
    });
  }

  /**
   * 다크 모드 토글 이벤트를 연결합니다.
   */
  function bindThemeToggle() {
    dom.toggleDarkMode?.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark");
      dom.toggleDarkMode.setAttribute("aria-pressed", String(isDark));
      persistTheme(isDark);
    });
  }

  /**
   * 진행 내보내기/불러오기 이벤트를 연결합니다.
   */
  function bindProgressIO() {
    dom.exportProgress?.addEventListener("click", exportProgress);
    dom.importProgress?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      importProgress(file);
      event.target.value = "";
    });
  }

  /**
   * 초기화를 수행합니다.
   */
  function init() {
    state.progress = loadProgress();
    restoreTheme();
    bindFilterControls();
    bindConceptNav();
    bindListEvents();
    bindDetailEvents();
    bindEditorEvents();
    bindKeyboardShortcuts();
    bindThemeToggle();
    bindProgressIO();
    renderConceptNav();
    renderProblemList();
    renderStats();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
