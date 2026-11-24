/**
 * ====================================================================
 * 기초 프로그래밍 학습자를 위한 To-Do List 로직 (app.js)
 * 
 * [단방향 데이터 흐름 원리]
 * 1. 사용자의 행동(클릭, 엔터) → 이벤트 발생 (EventListener)
 * 2. 자바스크립트 데이터(배열 todos) 조작 및 변경
 * 3. 변경된 데이터를 브라우저 LocalStorage에 저장
 * 4. 화면을 새로 그려서(render) 최신 상태 반영
 * ====================================================================
 */

// --------------------------------------------------
// 1. DOM 요소 선택 (화면의 HTML 태그들을 JS 변수로 가져오기)
// --------------------------------------------------
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const totalCountEl = document.getElementById('total-count');
const completedCountEl = document.getElementById('completed-count');

// The auth panel is a UI-only preview until a real authentication service is configured.
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupButton = document.getElementById('show-signup');
const showLoginButton = document.getElementById('show-login');
const authKicker = document.getElementById('auth-kicker');
const authTitle = document.getElementById('login-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authMessage = document.getElementById('auth-message');

function setAuthMessage(message, state = 'info') {
  authMessage.textContent = message;
  authMessage.dataset.state = state;
}

function showLoginView() {
  loginForm.hidden = false;
  signupForm.hidden = true;
  authKicker.textContent = 'SIGN IN';
  authTitle.textContent = '다시 만나 반가워요';
  authSubtitle.textContent = 'ID와 비밀번호를 입력해 주세요.';
  authMessage.textContent = '';
  delete authMessage.dataset.state;
}

function showSignupView() {
  loginForm.hidden = true;
  signupForm.hidden = false;
  authKicker.textContent = 'CREATE ACCOUNT';
  authTitle.textContent = '새 계정 만들기';
  authSubtitle.textContent = '사용할 ID와 비밀번호를 입력해 주세요.';
  authMessage.textContent = '';
  delete authMessage.dataset.state;
}

showSignupButton.addEventListener('click', showSignupView);
showLoginButton.addEventListener('click', showLoginView);

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  setAuthMessage('인증 서비스가 설정되지 않아 입력한 정보를 확인할 수 없습니다. 입력값은 저장되지 않았습니다.');
});

signupForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const password = document.getElementById('signup-password');
  const passwordConfirm = document.getElementById('signup-password-confirm');
  if (password.value !== passwordConfirm.value) {
    passwordConfirm.setCustomValidity('비밀번호가 일치하지 않습니다.');
    passwordConfirm.reportValidity();
    passwordConfirm.focus();
    passwordConfirm.setCustomValidity('');
    setAuthMessage('비밀번호가 일치하지 않습니다.', 'error');
    return;
  }

  setAuthMessage('인증 서비스가 설정되지 않아 계정을 만들 수 없습니다. 입력값은 저장되지 않았습니다.');
});

// LocalStorage에 저장할 때 사용할 키(Key) 이름
const STORAGE_KEY = 'simple_todolist_items';

// --------------------------------------------------
// 2. 상태 관리 (State): 할 일 데이터 배열
// --------------------------------------------------
// 브라우저 LocalStorage에서 기존 데이터를 불러오거나, 없으면 빈 배열([])로 초기화
let todos = loadTodosFromStorage();

/**
 * LocalStorage에서 저장된 할 일 목록을 불러오는 함수
 * @returns {Array} 할 일 객체 배열
 */
function loadTodosFromStorage() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    // JSON 문자열을 자바스크립트 객체/배열로 변환 (JSON.parse)
    return savedData ? JSON.parse(savedData) : [];
  } catch (error) {
    console.error('LocalStorage 데이터를 불러오는 중 오류가 발생했습니다:', error);
    return [];
  }
}

/**
 * 현재 todos 배열의 상태를 LocalStorage에 저장하는 함수
 */
function saveTodosToStorage() {
  try {
    // 자바스크립트 객체/배열을 JSON 문자열로 변환 (JSON.stringify)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (error) {
    console.error('LocalStorage에 데이터를 저장하는 중 오류가 발생했습니다:', error);
  }
}

// --------------------------------------------------
// 3. 핵심 4대 기능 구현
// --------------------------------------------------

/**
 * [기능 1: 할 일 추가 (Create)]
 * @param {string} text 사용자가 입력한 할 일 내용
 */
function addTodo(text) {
  // 1. 공백 제거 (앞뒤 불필요한 띄어쓰기 제거)
  const trimmedText = text.trim();

  // 2. 예외 처리: 빈 문자열이거나 공백만 입력된 경우 차단
  if (trimmedText === '') {
    // 입력창에 빨간 테두리 및 흔들림 애니메이션 피드백
    todoInput.classList.add('input-error');
    setTimeout(() => todoInput.classList.remove('input-error'), 400);
    todoInput.focus();
    return;
  }

  // 3. 새 할 일 객체 생성
  const newTodo = {
    id: Date.now(),      // 고유 식별자 (현재 시간을 밀리초 숫자로 활용)
    text: trimmedText,   // 안전하게 정리된 텍스트
    completed: false     // 초기 완료 상태는 항상 false (미완료)
  };

  // 4. 데이터 배열(todos)의 맨 끝에 새 항목 추가
  todos.push(newTodo);

  // 5. 변경사항 저장 및 화면 다시 그리기
  saveTodosToStorage();
  render();

  // 6. 입력창 비우기 및 포커스 유지
  todoInput.value = '';
  todoInput.focus();
}

/**
 * [기능 2: 완료/미완료 토글 (Toggle Complete)]
 * @param {number} id 상태를 바꿀 할 일의 고유 id
 */
function toggleTodo(id) {
  // id가 일치하는 항목을 찾아 completed 속성을 반전 (true ↔ false)
  todos = todos.map(todo => {
    if (todo.id === id) {
      return { ...todo, completed: !todo.completed };
    }
    return todo;
  });

  // 변경사항 저장 및 화면 다시 그리기
  saveTodosToStorage();
  render();
}

/**
 * [기능 3: 할 일 삭제 (Delete)]
 * @param {number} id 삭제할 할 일의 고유 id
 */
function deleteTodo(id) {
  // id가 일치하지 않는 항목들만 남겨서 새 배열 생성 (filter 메서드 활용)
  todos = todos.filter(todo => todo.id !== id);

  // 변경사항 저장 및 화면 다시 그리기
  saveTodosToStorage();
  render();
}

/**
 * [기능 4: 목록 조회 및 화면 렌더링 (Read & Render)]
 * 현재 todos 배열의 최신 상태를 바탕으로 HTML 화면을 구성합니다.
 */
function render() {
  // 1. 기존 리스트 내부 비우기
  todoList.innerHTML = '';

  // 2. 화면 상태 처리: 할 일이 0개인 경우 (Empty State)
  if (todos.length === 0) {
    emptyState.classList.add('visible');
  } else {
    emptyState.classList.remove('visible');

    // 3. 할 일이 있을 경우 각 항목을 순회하며 DOM 요소 생성
    todos.forEach(todo => {
      // <li> 요소 생성
      const li = document.createElement('li');
      li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
      li.dataset.id = todo.id;

      // 좌측 콘텐츠 그룹 (체크박스 + 텍스트)
      const contentGroup = document.createElement('div');
      contentGroup.className = 'todo-content-group';

      // 체크박스 <input type="checkbox">
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'todo-checkbox';
      checkbox.checked = todo.completed;
      checkbox.setAttribute('aria-label', `${todo.text} 완료 여부`);
      checkbox.addEventListener('change', () => toggleTodo(todo.id));

      // 텍스트 <span> (XSS 방지를 위해 textContent로 안전하게 삽입)
      const textSpan = document.createElement('span');
      textSpan.className = 'todo-text';
      textSpan.textContent = todo.text;
      // 텍스트를 클릭해도 완료 토글이 동작하도록 편의 제공
      textSpan.addEventListener('click', () => toggleTodo(todo.id));

      contentGroup.appendChild(checkbox);
      contentGroup.appendChild(textSpan);

      // 삭제 버튼 <button>
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.setAttribute('aria-label', `${todo.text} 삭제`);
      deleteBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      `;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 이벤트 전파 방지
        deleteTodo(todo.id);
      });

      // li에 조립 후 ul에 추가
      li.appendChild(contentGroup);
      li.appendChild(deleteBtn);
      todoList.appendChild(li);
    });
  }

  // 4. 통계 요약 갱신 (전체 개수 및 완료된 개수)
  const totalCount = todos.length;
  const completedCount = todos.filter(t => t.completed).length;

  totalCountEl.textContent = totalCount;
  completedCountEl.textContent = completedCount;
}

// --------------------------------------------------
// 4. 이벤트 리스너 등록
// --------------------------------------------------

// 폼 제출 이벤트 (Enter 키 입력 또는 추가 버튼 클릭 시 발생)
todoForm.addEventListener('submit', (event) => {
  event.preventDefault(); // 폼 제출 시 브라우저가 새로고침되는 기본 동작 방지
  addTodo(todoInput.value);
});

// --------------------------------------------------
// 5. 초기 실행 (화면이 로드될 때 첫 렌더링)
// --------------------------------------------------
render();
