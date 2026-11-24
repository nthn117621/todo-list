/**
 * ====================================================================
 * AI Todo Assistant (chatbot.js)
 * 11주차 과제: 외부 API나 서버 없이 브라우저에서 100% 동작하는
 * 로컬 지능형 할 일 비서 챗봇 엔진
 * 
 * [지원 기능]
 * 1. 미완료 할 일 목록 조회
 * 2. 완료된 할 일 목록 조회
 * 3. 전체 할 일 현황 요약 (진척도 % 포함)
 * 4. 지능형 우선순위 추천 (키워드 및 등록순 가중치)
 * 5. 특정 키워드 할 일 검색
 * 6. 채팅을 통한 할 일 추가 및 완료 (중복 모호성 해결 & 확인 절차)
 * ====================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------
  // 1. DOM 요소 선택
  // --------------------------------------------------
  const toggleBtn = document.getElementById('chatbot-toggle-btn');
  const chatWindow = document.getElementById('chatbot-window');
  const closeBtn = document.getElementById('chatbot-close-btn');
  const clearBtn = document.getElementById('chatbot-clear-btn');
  const messagesContainer = document.getElementById('chatbot-messages');
  const chatForm = document.getElementById('chatbot-form');
  const chatInput = document.getElementById('chatbot-input');
  const quickChips = document.querySelectorAll('.quick-chip');

  // 열기/닫기 아이콘
  const chatOpenIcon = toggleBtn ? toggleBtn.querySelector('.chat-open-icon') : null;
  const chatCloseIcon = toggleBtn ? toggleBtn.querySelector('.chat-close-icon') : null;

  // --------------------------------------------------
  // 2. 대화 상태 관리 (State Machine)
  // --------------------------------------------------
  // pendingAction: 사용자 확인(Confirmation) 또는 모호성 해결(Clarification) 대기 상태
  // { type: 'CONFIRM_ADD', text: '...' }
  // { type: 'AMBIGUOUS_COMPLETE', candidates: [...], originalQuery: '...' }
  // { type: 'CONFIRM_COMPLETE', todo: { id, text, completed } }
  let pendingAction = null;

  // --------------------------------------------------
  // 3. UI 헬퍼 함수
  // --------------------------------------------------

  /**
   * 챗봇 창 열기/닫기 토글
   */
  function toggleChatWindow() {
    const isOpen = chatWindow.classList.contains('active');
    if (isOpen) {
      chatWindow.classList.remove('active');
      chatWindow.setAttribute('aria-hidden', 'true');
      if (chatOpenIcon) chatOpenIcon.style.display = 'block';
      if (chatCloseIcon) chatCloseIcon.style.display = 'none';
    } else {
      chatWindow.classList.add('active');
      chatWindow.setAttribute('aria-hidden', 'false');
      if (chatOpenIcon) chatOpenIcon.style.display = 'none';
      if (chatCloseIcon) chatCloseIcon.style.display = 'block';
      chatInput.focus();

      // 첫 실행 시 환영 메시지 출력
      if (messagesContainer.children.length === 0) {
        showGreeting();
      }
    }
  }

  /**
   * 챗봇 스크롤을 항상 최하단으로 이동
   */
  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * HTML 특수문자 이스케이프 (XSS 방지)
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 텍스트 내 줄바꿈 및 마크다운(굵은글씨) 간단 변환
   */
  function formatMessageText(text) {
    let formatted = escapeHtml(text);
    // **굵은 글씨** 변환
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // 줄바꿈 \n -> <br>
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
  }

  /**
   * 메시지 버블 화면에 추가
   * @param {string} sender 'bot' 또는 'user'
   * @param {string} text 표시할 텍스트
   * @param {Array} actionButtons 선택적 액션 버튼 배열 [{ label, action, value, styleClass }]
   */
  function appendMessage(sender, text, actionButtons = null) {
    const msgWrapper = document.createElement('div');
    msgWrapper.className = `chat-message ${sender}`;

    if (sender === 'bot') {
      const avatar = document.createElement('div');
      avatar.className = 'bot-avatar-small';
      avatar.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2"></rect>
          <circle cx="12" cy="5" r="2"></circle>
          <path d="M12 7v4"></path>
          <line x1="8" y1="16" x2="8" y2="16"></line>
          <line x1="16" y1="16" x2="16" y2="16"></line>
        </svg>
      `;
      msgWrapper.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    bubble.innerHTML = formatMessageText(text);

    // 상호작용 액션 버튼이 있을 경우 추가
    if (actionButtons && actionButtons.length > 0) {
      const btnContainer = document.createElement('div');
      btnContainer.className = 'chat-action-group';

      actionButtons.forEach(btnInfo => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chat-action-btn ${btnInfo.styleClass || ''}`;
        btn.textContent = btnInfo.label;
        btn.dataset.action = btnInfo.action;
        if (btnInfo.value !== undefined) {
          btn.dataset.value = btnInfo.value;
        }
        btnContainer.appendChild(btn);
      });

      bubble.appendChild(btnContainer);
    }

    msgWrapper.appendChild(bubble);
    messagesContainer.appendChild(msgWrapper);
    scrollToBottom();
  }

  /**
   * 첫 환영 메시지 출력
   */
  function showGreeting() {
    const welcome = 
      "안녕하세요! 🤖 **AI Todo Assistant**입니다.\n" +
      "할 일 목록 조회, 우선순위 추천, 할 일 추가 및 완료를 도와드립니다.\n\n" +
      "아래 퀵 버튼을 누르거나 자연어로 자유롭게 질문해보세요!";
    appendMessage('bot', welcome);
  }

  /**
   * 도움말 메시지 출력
   */
  function showHelp() {
    const helpText = 
      "💡 **사용 가능한 주요 명령어 안내:**\n\n" +
      "• **미완료 조회:** `남은 할 일`, `안 한 일`, `pending`\n" +
      "• **완료 조회:** `완료된 일`, `끝낸 일`, `done`\n" +
      "• **전체 요약:** `요약`, `현황`, `통계`\n" +
      "• **우선순위 추천:** `뭐부터 할까?`, `우선순위`, `추천`\n" +
      "• **할 일 검색:** `검색 [단어]`, `[단어] 찾아줘`\n" +
      "• **할 일 추가:** `추가 [내용]`, `[내용] 추가해줘`\n" +
      "• **할 일 완료:** `완료 [내용]`, `[내용] 완료했어`";
    appendMessage('bot', helpText);
  }

  // --------------------------------------------------
  // 4. 로컬 지능형 엔진: 기능별 처리 로직
  // --------------------------------------------------

  /**
   * 현재 실제 todos 배열 가져오기 (동적 로드)
   */
  function getCurrentTodos() {
    if (window.todoApp && typeof window.todoApp.getTodos === 'function') {
      return window.todoApp.getTodos();
    }
    return [];
  }

  /**
   * 기능 1: 미완료 할 일 목록 조회
   */
  function handleShowIncomplete() {
    const todos = getCurrentTodos();
    const incomplete = todos.filter(t => !t.completed);

    if (todos.length === 0) {
      appendMessage('bot', "현재 등록된 할 일이 없습니다. 새 할 일을 추가해보세요! 📝");
      return;
    }

    if (incomplete.length === 0) {
      appendMessage('bot', "🎉 모든 할 일을 완료하셨습니다! 남은 할 일이 없습니다. 대단해요!");
      return;
    }

    let response = `📋 **현재 남은 할 일 (${incomplete.length}개):**\n\n`;
    const actionButtons = [];

    incomplete.forEach((todo, idx) => {
      response += `${idx + 1}. ⭕ ${todo.text}\n`;
      // 바로 완료할 수 있는 버튼 제공
      actionButtons.push({
        label: `✔ ${idx + 1}번 완료`,
        action: 'request-complete-by-id',
        value: todo.id,
        styleClass: 'btn-outline-primary'
      });
    });

    appendMessage('bot', response.trim(), actionButtons);
  }

  /**
   * 기능 2: 완료된 할 일 목록 조회
   */
  function handleShowCompleted() {
    const todos = getCurrentTodos();
    const completed = todos.filter(t => t.completed);

    if (todos.length === 0) {
      appendMessage('bot', "현재 등록된 할 일이 없습니다.");
      return;
    }

    if (completed.length === 0) {
      appendMessage('bot', "아직 완료된 할 일이 없습니다. 첫 번째 할 일을 완료해보세요! 💪");
      return;
    }

    let response = `✅ **완료된 할 일 (${completed.length}개):**\n\n`;
    completed.forEach((todo, idx) => {
      response += `${idx + 1}. ✔️ ~~${todo.text}~~\n`;
    });

    appendMessage('bot', response.trim());
  }

  /**
   * 기능 3: 전체 할 일 요약 & 진척도
   */
  function handleSummarize() {
    const todos = getCurrentTodos();
    const total = todos.length;

    if (total === 0) {
      appendMessage('bot', "등록된 할 일이 없어 요약할 내용이 없습니다. 먼저 할 일을 등록해보세요! ✨");
      return;
    }

    const completed = todos.filter(t => t.completed).length;
    const incomplete = total - completed;
    const percent = Math.round((completed / total) * 100);

    // 텍스트 프로그레스 바 생성 (10칸)
    const filledBlocks = Math.round(percent / 10);
    const emptyBlocks = 10 - filledBlocks;
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

    let feedback = "";
    if (percent === 100) {
      feedback = "🏆 대단합니다! 오늘의 모든 목표를 100% 달성하셨습니다!";
    } else if (percent >= 70) {
      feedback = "🔥 마무리 단계입니다! 조금만 더 집중해 볼까요?";
    } else if (percent >= 40) {
      feedback = "🚀 절반 가까이 해냈습니다! 꾸준히 전진하고 계시네요.";
    } else {
      feedback = "🌱 시작이 반입니다! 가장 가벼운 일부터 하나씩 해결해봐요.";
    }

    const summary = 
      `📊 **할 일 진행 현황 요약:**\n\n` +
      `• 전체 할 일: **${total}개**\n` +
      `• 완료된 일: **${completed}개** ✅\n` +
      `• 남은 할 일: **${incomplete}개** ⭕\n` +
      `• 달성률: **${percent}%** [${progressBar}]\n\n` +
      feedback;

    appendMessage('bot', summary);
  }

  /**
   * 기능 4: 지능형 우선순위 추천 (Rule/Heuristic Engine)
   */
  function handleRecommend() {
    const todos = getCurrentTodos();
    const incomplete = todos.filter(t => !t.completed);

    if (todos.length === 0) {
      appendMessage('bot', "등록된 할 일이 없습니다. 추천을 위해 먼저 할 일을 등록해주세요! 📌");
      return;
    }

    if (incomplete.length === 0) {
      appendMessage('bot', "🎉 모든 할 일이 이미 완료되었습니다! 충분한 휴식을 취하시거나 새로운 목표를 등록해보세요.");
      return;
    }

    // 긴급/중요 키워드 목록
    const urgentKeywords = ['급한', '긴급', '오늘', '마감', '과제', '시험', '제출', '중요', 'urgent', 'due', 'exam', 'homework', 'asap', '핵심'];

    let bestItem = null;
    let highestScore = -1;
    let bestReason = "";

    incomplete.forEach((item, index) => {
      let score = 0;
      const reasons = [];

      // 1. 키워드 분석
      const matchedKeyword = urgentKeywords.find(kw => item.text.toLowerCase().includes(kw));
      if (matchedKeyword) {
        score += 20;
        reasons.push(`'${matchedKeyword}' 키워드가 포함된 중요/긴급 항목`);
      }

      // 2. 등록 순서 가중치 (먼저 등록된 항목 우선)
      const fifoWeight = (incomplete.length - index) * 2;
      score += fifoWeight;
      if (index === 0 && !matchedKeyword) {
        reasons.push("가장 먼저 등록하여 대기 중인 항목");
      }

      // 3. Quick-win (글자수가 적당히 짧은 작업은 시작 탄력을 주기에 유리)
      if (item.text.length <= 12) {
        score += 5;
        if (!matchedKeyword) {
          reasons.push("빠르게 끝내 집중력을 높이기 좋은 작업(Quick-win)");
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestItem = item;
        bestReason = reasons.join(', ') || "현재 목록에서 가장 권장되는 작업";
      }
    });

    const response = 
      `💡 **AI 우선순위 추천 작업:**\n\n` +
      `👉 **"${bestItem.text}"**\n\n` +
      `📌 **추천 사유:** ${bestReason}\n\n` +
      `지금 이 작업을 시작해보는 건 어떨까요?`;

    appendMessage('bot', response, [
      {
        label: '✔ 이 작업 완료하기',
        action: 'request-complete-by-id',
        value: bestItem.id,
        styleClass: 'btn-confirm'
      }
    ]);
  }

  /**
   * 기능 5: 특정 키워드 할 일 검색
   */
  function handleSearch(query) {
    const trimmed = query.trim();
    if (!trimmed) {
      appendMessage('bot', "검색할 단어를 함께 입력해주세요! 예: `검색 과제` 또는 `과제 찾아줘`");
      return;
    }

    const todos = getCurrentTodos();
    const queryLower = trimmed.toLowerCase();
    const matches = todos.filter(t => t.text.toLowerCase().includes(queryLower));

    if (matches.length === 0) {
      appendMessage('bot', `🔍 **'${trimmed}'** 관련 할 일을 찾지 못했습니다.`);
      return;
    }

    let response = `🔍 **'${trimmed}' 검색 결과 (${matches.length}개):**\n\n`;
    const actionButtons = [];

    matches.forEach((todo, idx) => {
      const statusIcon = todo.completed ? '✅ [완료]' : '⭕ [미완료]';
      const textDisplay = todo.completed ? `~~${todo.text}~~` : todo.text;
      response += `${idx + 1}. ${statusIcon} ${textDisplay}\n`;

      // 미완료 항목인 경우 완료 버튼 제공
      if (!todo.completed) {
        actionButtons.push({
          label: `✔ '${todo.text.slice(0, 10)}' 완료`,
          action: 'request-complete-by-id',
          value: todo.id,
          styleClass: 'btn-outline-primary'
        });
      }
    });

    appendMessage('bot', response.trim(), actionButtons.length > 0 ? actionButtons : null);
  }

  /**
   * 기능 6-A: 할 일 추가 요청 (확인 절차 포함)
   */
  function requestAddTask(taskText) {
    const trimmed = taskText.trim();
    if (!trimmed) {
      appendMessage('bot', "추가할 할 일 내용을 입력해주세요. 예: `추가 자바스크립트 복습`");
      return;
    }

    // Confirmation 상태 설정
    pendingAction = {
      type: 'CONFIRM_ADD',
      text: trimmed
    };

    const promptText = `새로운 할 일 **"${trimmed}"**을(를) 추가할까요?`;
    appendMessage('bot', promptText, [
      { label: '✅ 추가 확인', action: 'confirm-action', styleClass: 'btn-confirm' },
      { label: '❌ 취소', action: 'cancel-action', styleClass: 'btn-cancel' }
    ]);
  }

  /**
   * 실제 할 일 추가 실행 (확인 후)
   */
  function executeAddTask(taskText) {
    try {
      if (window.todoApp && typeof window.todoApp.addTodo === 'function') {
        window.todoApp.addTodo(taskText);
        appendMessage('bot', `🎉 **"${taskText}"**이(가) 할 일 목록에 추가되었습니다!`);
      } else {
        appendMessage('bot', "할 일을 추가하는 중 오류가 발생했습니다.");
      }
    } finally {
      // 확인/실행 후 pendingAction 반드시 초기화 (Requirement 2)
      pendingAction = null;
    }
  }

  /**
   * 기능 6-B: 할 일 완료 요청 (모호성 해결 & 확인 절차 포함)
   */
  function requestCompleteTask(targetQuery) {
    const trimmed = targetQuery.trim();
    if (!trimmed) {
      appendMessage('bot', "완료할 할 일의 내용이나 번호를 입력해주세요. 예: `완료 과제` 또는 `1번 완료`");
      return;
    }

    const todos = getCurrentTodos();
    const incomplete = todos.filter(t => !t.completed);

    if (incomplete.length === 0) {
      appendMessage('bot', "현재 완료할 수 있는 미완료 할 일이 없습니다.");
      return;
    }

    // 1. 번호 입력인지 확인 (예: '1', '1번', '2')
    const numberMatch = trimmed.match(/^(\d+)번?$/);
    if (numberMatch) {
      const index = parseInt(numberMatch[1], 10) - 1;
      if (index >= 0 && index < incomplete.length) {
        const targetTodo = incomplete[index];
        askCompleteConfirmation(targetTodo);
        return;
      } else {
        appendMessage('bot', `현재 1번부터 ${incomplete.length}번까지의 미완료 할 일이 있습니다. 번호를 다시 확인해주세요.`);
        return;
      }
    }

    // 2. 키워드 기반 미완료 항목 검색
    const queryLower = trimmed.toLowerCase();
    const matches = incomplete.filter(t => t.text.toLowerCase().includes(queryLower));

    // 미완료 중에는 없지만 이미 완료된 항목에 있는지 확인
    if (matches.length === 0) {
      const alreadyDone = todos.filter(t => t.completed && t.text.toLowerCase().includes(queryLower));
      if (alreadyDone.length > 0) {
        appendMessage('bot', `ℹ️ **"${alreadyDone[0].text}"**은(는) 이미 완료 처리된 할 일입니다! ✅`);
        return;
      }
      appendMessage('bot', `😅 **'${trimmed}'**와(과) 일치하는 미완료 할 일을 찾지 못했습니다. 목록을 다시 확인해주세요.`);
      return;
    }

    // 3. 모호성(Ambiguity) 처리: 일치하는 항목이 2개 이상일 때
    // 다중 매칭 시 절대로 둘 다 완료하지 않고, 반드시 사용자에게 고유 ID 기반 선택을 요청함 (Requirement 1, 4)
    if (matches.length > 1) {
      pendingAction = {
        type: 'AMBIGUOUS_COMPLETE',
        candidates: matches,
        originalQuery: trimmed
      };

      let prompt = `🤔 **'${trimmed}'** 관련 할 일이 ${matches.length}개 발견되었습니다.\n어떤 할 일을 완료 처리할까요?\n\n`;
      const buttons = [];

      matches.forEach((todo, idx) => {
        prompt += `${idx + 1}. ⭕ ${todo.text}\n`;
        buttons.push({
          label: `${idx + 1}번 선택`,
          action: 'select-ambiguous-candidate',
          value: todo.id,
          styleClass: 'btn-outline-primary'
        });
      });

      buttons.push({ label: '❌ 취소', action: 'cancel-action', styleClass: 'btn-cancel' });
      appendMessage('bot', prompt.trim(), buttons);
      return;
    }

    // 4. 일치하는 항목이 정확히 1개일 때 -> 고유 ID 기반 확인 절차 진행
    askCompleteConfirmation(matches[0]);
  }

  /**
   * 완료 전 사용자 확인(Confirmation) 요청 (고유 ID 기반 저장)
   */
  function askCompleteConfirmation(todo) {
    if (!todo || todo.id === undefined) return;

    // 고유 ID 및 텍스트를 명시적으로 보관 (Requirement 1)
    pendingAction = {
      type: 'CONFIRM_COMPLETE',
      todoId: Number(todo.id),
      todoText: todo.text
    };

    const promptText = `**"${todo.text}"**을(를) 완료 처리할까요?`;
    appendMessage('bot', promptText, [
      { label: '✅ 완료 확인', action: 'confirm-action', styleClass: 'btn-confirm' },
      { label: '❌ 취소', action: 'cancel-action', styleClass: 'btn-cancel' }
    ]);
  }

  /**
   * 실제 할 일 완료 실행 (고유 ID로 정확히 단일 항목만 토글 수행)
   */
  function executeCompleteTask(todoId, todoText) {
    try {
      if (window.todoApp && typeof window.todoApp.toggleTodo === 'function') {
        // 고유 ID로 명시적 토글 호출 (Requirement 1 & 4)
        window.todoApp.toggleTodo(todoId);
        appendMessage('bot', `🎊 **"${todoText}"** 완료 처리되었습니다! 수고하셨습니다.`);
      } else {
        appendMessage('bot', "완료 처리 중 오류가 발생했습니다.");
      }
    } finally {
      // 성공/실패 무관 확인 상태 즉시 초기화 (Requirement 2)
      pendingAction = null;
    }
  }

  // --------------------------------------------------
  // 5. 대화 의도(Intent) 분석기 (Local NLP Engine)
  // --------------------------------------------------

  /**
   * 사용자 텍스트의 의도를 판별하고 적절한 동작 실행
   */
  function processUserInput(rawText) {
    const text = rawText.trim();
    if (!text) return;

    // 1. 사용자 메시지 버블 추가
    appendMessage('user', text);

    // 2. 대기 중인 확인(Confirmation) 또는 모호성 선택이 있는 경우 우선 처리
    if (pendingAction) {
      handlePendingAction(text);
      return;
    }

    const lower = text.toLowerCase();

    // --------------------------------------------------
    // 의도 A: 할 일 추가 (Add Task)
    // 패턴: "추가: [내용]", "추가 [내용]", "[내용] 추가해줘", "add [내용]"
    // --------------------------------------------------
    const addPrefixMatch = text.match(/^(?:추가\s*:\s*|추가\s+|add\s+|create\s+)(.+)$/i);
    const addSuffixMatch = text.match(/^(.+?)\s*(?:추가해줘|추가해|등록해줘|등록|넣어줘|추가)$/i);

    if (addPrefixMatch) {
      requestAddTask(addPrefixMatch[1]);
      return;
    }
    if (addSuffixMatch && !/^(남은|미완료|완료된|완료한)/.test(text)) {
      requestAddTask(addSuffixMatch[1]);
      return;
    }

    // --------------------------------------------------
    // 의도 B: 할 일 완료 (Complete Task)
    // 패턴: "완료: [내용]", "완료 [내용]", "[내용] 완료", "[내용] 끝냈어", "done [내용]"
    // --------------------------------------------------
    const completePrefixMatch = text.match(/^(?:완료\s*:\s*|완료\s+|complete\s+|done\s+)(.+)$/i);
    const completeSuffixMatch = text.match(/^(.+?)\s*(?:완료해줘|완료해|완료했어|완료함|완료|끝냈어|끝남|끝냈다|끝|체크해줘|다\s*했어)$/i);

    // 단, "완료된 일 보여줘" 같은 조회 질의와 충돌하지 않도록 방어
    const isShowCompletedQuery = /(?:완료된|완료한|끝낸)\s*(?:할\s*일|목록|리스트|것|거|일)/.test(text);

    if (completePrefixMatch && !isShowCompletedQuery) {
      requestCompleteTask(completePrefixMatch[1]);
      return;
    }
    if (completeSuffixMatch && !isShowCompletedQuery) {
      requestCompleteTask(completeSuffixMatch[1]);
      return;
    }

    // --------------------------------------------------
    // 의도 C: 특정 할 일 검색 (Search)
    // 패턴: "검색 [내용]", "[내용] 검색", "[내용] 찾아줘", "search [내용]"
    // --------------------------------------------------
    const searchPrefixMatch = text.match(/^(?:검색\s+|search\s+|find\s+)(.+)$/i);
    const searchSuffixMatch = text.match(/^(.+?)\s*(?:검색해줘|검색|찾아줘|있는지\s*찾아)$/i);

    if (searchPrefixMatch) {
      handleSearch(searchPrefixMatch[1]);
      return;
    }
    if (searchSuffixMatch) {
      handleSearch(searchSuffixMatch[1]);
      return;
    }

    // --------------------------------------------------
    // 의도 D: 우선순위 추천 (Recommend)
    // 패턴: "뭐부터", "추천", "우선순위", "recommend", "what first"
    // --------------------------------------------------
    if (/(?:뭐부터|어떤\s*거\s*먼저|어느\s*것\s*부터|우선순위|먼저\s*할|추천|recommend|priority)/i.test(text)) {
      handleRecommend();
      return;
    }

    // --------------------------------------------------
    // 의도 E: 전체 할 일 요약 (Summarize)
    // 패턴: "요약", "현황", "상태", "브리핑", "summary", "status"
    // --------------------------------------------------
    if (/(?:요약|전체\s*상태|현황|브리핑|통계|진척도|summary|status|overview)/i.test(text)) {
      handleSummarize();
      return;
    }

    // --------------------------------------------------
    // 의도 F: 완료된 할 일 조회 (Show Completed)
    // 패턴: "완료된", "완료한", "끝낸", "completed"
    // --------------------------------------------------
    if (/(?:완료된|완료한|끝낸|한\s*일|다\s*한|완료\s*목록|completed)/i.test(text)) {
      handleShowCompleted();
      return;
    }

    // --------------------------------------------------
    // 의도 G: 미완료 할 일 조회 (Show Incomplete)
    // 패턴: "미완료", "안 한", "남은", "남아", "incomplete", "pending"
    // --------------------------------------------------
    if (/(?:미완료|안\s*한|남은|남아\s*있는|해야\s*할|남았|진행\s*중|incomplete|pending)/i.test(text)) {
      handleShowIncomplete();
      return;
    }

    // --------------------------------------------------
    // 의도 H: 인사 및 도움말 (Greeting & Help)
    // --------------------------------------------------
    if (/(?:안녕|하이|hi|hello|도움말|도움|help|기능|사용법)/i.test(text)) {
      showHelp();
      return;
    }

    // --------------------------------------------------
    // 의도 파악 불가 시: 친절한 안내 및 퀵 버튼 유도
    // --------------------------------------------------
    appendMessage(
      'bot',
      `"${text}"에 대한 명령을 이해하지 못했습니다. 😅\n` +
      `아래 추천 질문을 선택하시거나, \`도움말\`을 입력해 지원 명령어를 확인해보세요!`
    );
  }

  /**
   * 확인(Confirmation) 또는 모호성(Ambiguity) 처리 상태에서의 사용자 응답 처리
   */
  function handlePendingAction(userInput) {
    const trimmed = userInput.trim().toLowerCase();

    // 1. 확인(긍정) 응답: '확인', '네', '응', 'yes', 'y', 'ㅇㅇ', 'ok'
    const isAffirmative = /^(?:확인|네|응|yes|y|ㅇㅇ|예|그래|좋아|ok|진행)$/i.test(trimmed);
    // 2. 취소(부정) 응답: '취소', '취소해줘', '아니', 'no', 'n', 'ㄴㄴ', 'cancel' 등
    const isNegative = /^(?:취소.*|아니.*|no|n|ㄴㄴ|cancel|그만.*|패스|안할래)$/i.test(trimmed);

    if (isNegative) {
      appendMessage('bot', "작업이 취소되었습니다. 할 일은 변경되지 않았습니다. 😊");
      pendingAction = null;
      return;
    }

    // A. 할 일 추가 확인 단계
    if (pendingAction.type === 'CONFIRM_ADD') {
      if (isAffirmative) {
        executeAddTask(pendingAction.text);
      } else {
        appendMessage('bot', `추가를 진행하려면 **[확인]**을, 중단하려면 **[취소]**를 입력해주세요.`);
      }
      return;
    }

    // B. 할 일 완료 확인 단계 (고유 ID 기반 완료 실행)
    if (pendingAction.type === 'CONFIRM_COMPLETE') {
      if (isAffirmative) {
        executeCompleteTask(pendingAction.todoId, pendingAction.todoText);
      } else {
        appendMessage('bot', `완료 처리를 진행하려면 **[확인]**을, 중단하려면 **[취소]**를 입력해주세요.`);
      }
      return;
    }

    // C. 모호성 다중 후보 선택 단계
    if (pendingAction.type === 'AMBIGUOUS_COMPLETE') {
      const candidates = pendingAction.candidates;
      const numMatch = trimmed.match(/^(\d+)번?$/);

      if (numMatch) {
        const choiceIdx = parseInt(numMatch[1], 10) - 1;
        if (choiceIdx >= 0 && choiceIdx < candidates.length) {
          const selected = candidates[choiceIdx];
          askCompleteConfirmation(selected);
          return;
        }
      }

      // 텍스트 부분 일치로 후보 다시 필터링
      const refined = candidates.filter(c => c.text.toLowerCase().includes(trimmed));
      if (refined.length === 1) {
        askCompleteConfirmation(refined[0]);
        return;
      }

      appendMessage(
        'bot',
        `선택할 항목의 번호(1~${candidates.length})를 입력하시거나, 취소하시려면 '취소'를 입력해주세요.`
      );
    }
  }

  // --------------------------------------------------
  // 6. 이벤트 위임: 인라인 액션 버튼 클릭 처리
  // --------------------------------------------------
  messagesContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.chat-action-btn');
    if (!btn) return;

    const action = btn.dataset.action;
    const value = btn.dataset.value;

    if (action === 'confirm-action') {
      if (pendingAction) {
        if (pendingAction.type === 'CONFIRM_ADD') {
          executeAddTask(pendingAction.text);
        } else if (pendingAction.type === 'CONFIRM_COMPLETE') {
          executeCompleteTask(pendingAction.todoId, pendingAction.todoText);
        }
      }
    } else if (action === 'cancel-action') {
      appendMessage('bot', "작업이 취소되었습니다. 할 일은 변경되지 않았습니다. 🚫");
      pendingAction = null;
    } else if (action === 'request-complete-by-id') {
      const todoId = Number(value);
      const todos = getCurrentTodos();
      const target = todos.find(t => t.id === todoId);
      if (target) {
        askCompleteConfirmation(target);
      } else {
        appendMessage('bot', "해당 할 일을 찾을 수 없습니다.");
      }
    } else if (action === 'select-ambiguous-candidate') {
      const todoId = Number(value);
      const todos = getCurrentTodos();
      const target = todos.find(t => t.id === todoId);
      if (target) {
        askCompleteConfirmation(target);
      }
    }
  });

  // --------------------------------------------------
  // 7. 폼 전송 및 퀵 버튼 이벤트 등록
  // --------------------------------------------------
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value;
    chatInput.value = '';
    processUserInput(text);
  });

  quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const cmd = chip.dataset.cmd;
      if (cmd) {
        processUserInput(cmd);
      }
    });
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleChatWindow);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', toggleChatWindow);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      messagesContainer.innerHTML = '';
      pendingAction = null;
      showGreeting();
    });
  }

})();
