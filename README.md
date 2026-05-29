# MDMan - 마크다운 폴더 관리자

로컬 웹 서버 기반의 마크다운 폴더 관리 및 실시간 미리보기 편집기입니다. 에버노트 스타일의 3단 스플릿 레이아웃과 라이브 WYSIWYG 편집기를 결합하여 파일 시스템 기반으로 문서를 손쉽게 관리할 수 있습니다.

---

## 🚀 퀵 스타트 (설치 및 실행 방법)

로컬 환경에 패키지를 설치하고 서버를 가동하는 방법입니다.

### 1. 사전 요구사항
- Python 3.10 이상이 컴퓨터에 설치되어 있어야 합니다.
- Node.js 및 npm이 설치되어 있어야 합니다.

### 2. 설치 및 빌드
터미널을 열고 다음 명령어를 순서대로 실행합니다.

```bash
# 1. 백엔드 Python 의존성 설치
pip install -r requirements.txt

# 2. 프론트엔드 Node 패키지 설치
npm install

# 3. 프론트엔드 프로덕션 빌드 컴파일
npm run build
```

### 3. 서버 실행
- **Windows**: 폴더 내의 **`run_mdman.bat`** 파일을 마우스로 더블 클릭합니다.
- 자동으로 로컬 API 서버가 백기라운드에서 가동되며, 기본 웹 브라우저가 열리며 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**으로 바로 접속됩니다.

---

## 📂 디렉토리 구조 (Directory Structure)

프로젝트를 구성하는 주요 파일 및 폴더들의 역할입니다.

- **`mdman_server.py`**: FastAPI 백엔드 통합 웹 서버 코어 파일
- **`run_mdman.bat`**: 윈도우용 서버 실행 배치 파일 (서버 가동 및 브라우저 자동 연결)
- **`config.json`**: 최상위 마크다운 작업 폴더 경로 관리 설정 파일
- **`requirements.txt`**: 백엔드 구동에 필요한 Python 의존성 목록
- **`package.json` / `vite.config.js`**: Node 의존성 목록 및 프론트엔드 Vite 프록시 빌드 설정
- **`dist/`**: 컴파일 완료된 정적 웹 리소스 배포 저장 폴더
- **`src/`**: React 프론트엔드 소스 파일 폴더
  * `main.jsx`: React 진입 파일
  * `App.jsx`: 프론트엔드 전역 상태 및 3단 스플릿 레이아웃 제어 컨트롤러
  * `index.css`: 초밀착 디자인 변수, 다크 테마 및 GFM 마크다운 스타일시트
  * `components/`: UI 세부 기능별 컴포넌트 목록 (FolderTree, FileList, MarkdownEditor, SearchModal, ActivityLogPanel)

---

## ✨ 주요 기능 (Key Features)

- **3단 분할 레이아웃**
  * **1단 (좌측)**: 폴더 전용 계층 트리 뷰 (파일 제외, 디렉토리 탐색 전용)
  * **2단 (중앙)**: 선택한 폴더 내부의 마크다운 파일 평탄 목록
  * **3단 (우측)**: TipTap 기반 GFM 마크다운 라이브 WYSIWYG 편집기 및 미리보기
- **다중 선택 및 폴더 일괄 이동 (Drag & Drop)**
  * `Ctrl + 클릭` (선택 토글), `Shift + 클릭` (범위 선택), 마우스 호버 시 노출되는 체크박스로 다중 파일 선택 지원
  * 선택된 다수 파일을 1단의 특정 폴더로 드래그앤드롭하여 일괄 물리적 이동 처리 (백엔드 병렬 처리)
- **실시간 전체 텍스트 검색**
  * `Ctrl + Shift + F` 단축키를 통해 폴더 내 모든 파일의 제목 및 본문 텍스트 내용을 실시간 검색 및 라인 하이라이팅 매칭
- **안전한 휴지통 삭제**
  * 파일 삭제 시 로컬 디렉토리에서 영구 삭제되지 않고 OS 실제 휴지통으로 이동 (`send2trash` 적용)
- **로컬 이미지 업로드**
  * 에디터 내 붙여넣기(Paste) 및 드롭(Drop) 시 `assets/` 폴더로 자동 이미지 업로드 및 링크 삽입
- **독립 운용 설계**
  * 네임스페이스가 지정된 `mdman_server.py`로 서버가 구동되어 다른 로컬 프로젝트와의 충돌을 원천 차단

---

## 🛠️ 기술 스택 (Technology Stack)

- **프론트엔드**: React 18, Vite 5, TipTap editor (WYSIWYG GFM), Lucide-react, Vanilla CSS (Evernote preview 테마 반영)
- **백엔드**: Python, FastAPI, Uvicorn, Send2Trash, python-multipart

---

## 🔒 라이선스 (License)
MIT License