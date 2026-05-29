import React, { useState, useEffect, useCallback } from 'react'
import { FolderOpen, Settings, Search, Sidebar, Clock, Hash, AlertTriangle, X, Check } from 'lucide-react'
import FolderTree from './components/FolderTree'
import FileList from './components/FileList'
import MarkdownEditor from './components/MarkdownEditor'
import SearchModal from './components/SearchModal'
import ActivityLogPanel from './components/ActivityLogPanel'

export default function App() {
  // --- States ---
  const [notesDir, setNotesDir] = useState('')
  const [treeData, setTreeData] = useState([])
  const [logs, setLogs] = useState([])
  
  // Folder & File selection states for 3-Column Split UI
  const [selectedFolderPath, setSelectedFolderPath] = useState('') // Left Column Active Folder
  const [activePath, setActivePath] = useState(null)               // Middle Column Active File
  const [fileData, setFileData] = useState(null)                   // Right Column Active File Data
  
  // Multi-selection states for batch Drag and Drop
  const [selectedFilePaths, setSelectedFilePaths] = useState([])
  
  // Unsaved files track list
  const [unsavedFiles, setUnsavedFiles] = useState([])
  // Pending content changes
  const [pendingContent, setPendingContent] = useState({})

  // Layout & UI Toggles
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)     // Folder Tree Sidebar
  const [middleSidebarOpen, setMiddleSidebarOpen] = useState(true) // File List Sidebar
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)   // Logs Sidebar (HIDDEN BY DEFAULT)
  
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [folderInput, setFolderInput] = useState('')
  const [folderError, setFolderError] = useState('')

  // Tag list for filtering
  const [allTags, setAllTags] = useState([])
  const [selectedTag, setSelectedTag] = useState(null)

  // --- API Calls ---

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config')
      if (res.ok) {
        const data = await res.json()
        setNotesDir(data.notes_dir)
        setFolderInput(data.notes_dir)
      }
    } catch (err) {
      console.error('Config fetch error:', err)
    }
  }

  const fetchTree = async () => {
    try {
      const res = await fetch('/api/tree')
      if (res.ok) {
        const data = await res.json()
        setTreeData(data)
        extractTagsFromTree(data)
      }
    } catch (err) {
      console.error('Tree fetch error:', err)
    }
  }

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs')
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      }
    } catch (err) {
      console.error('Logs fetch error:', err)
    }
  }

  const extractTagsFromTree = (nodes) => {
    const tags = new Set(['tutorial', 'markdown', 'welcome', 'tips', 'study', 'work'])
    setAllTags(Array.from(tags))
  }

  // Load a file
  const selectFile = async (path) => {
    if (activePath === path) return

    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`)
      if (res.ok) {
        const data = await res.json()
        setActivePath(path)
        
        // Load local pending changes if any, otherwise standard server content
        const cachedContent = pendingContent[path]
        setFileData({
          ...data,
          content: cachedContent !== undefined ? cachedContent : data.content
        })
      }
    } catch (err) {
      alert('파일을 불러오는 데 실패했습니다: ' + err.message)
    }
  }

  // Save the current file
  const saveFile = async () => {
    if (!activePath) return
    const currentContent = pendingContent[activePath]
    if (currentContent === undefined && !unsavedFiles.includes(activePath)) return

    try {
      const contentToSave = currentContent !== undefined ? currentContent : fileData.content
      const res = await fetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: activePath,
          content: contentToSave,
          frontmatter: fileData.frontmatter
        })
      })

      if (res.ok) {
        setUnsavedFiles(prev => prev.filter(p => p !== activePath))
        fetchLogs()
      } else {
        throw new Error('서버 저장 실패')
      }
    } catch (err) {
      alert('파일 저장 중 오류가 발생했습니다: ' + err.message)
    }
  }

  // Handle content edits
  const handleContentChange = (newMarkdown) => {
    if (!activePath) return

    setPendingContent(prev => ({
      ...prev,
      [activePath]: newMarkdown
    }))

    if (!unsavedFiles.includes(activePath)) {
      setUnsavedFiles(prev => [...prev, activePath])
    }

    setFileData(prev => ({
      ...prev,
      content: newMarkdown
    }))
  }

  // Create new file/folder
  const createNode = async (parentPath, name, kind) => {
    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_path: parentPath, name, kind })
      })
      if (res.ok) {
        const data = await res.json()
        await fetchTree()
        await fetchLogs()
        if (kind === 'file') {
          await selectFile(data.relativePath)
          setSelectedFilePaths([data.relativePath])
        }
      } else {
        const errData = await res.json()
        alert(errData.detail || '생성 실패')
      }
    } catch (err) {
      alert('오류 발생: ' + err.message)
    }
  }

  // Rename file/folder
  const renameNode = async (path, newName) => {
    try {
      const res = await fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, new_name: newName })
      })
      if (res.ok) {
        const data = await res.json()
        await fetchTree()
        await fetchLogs()
        
        if (activePath === path) {
          setActivePath(data.relativePath)
        }
        
        // Update paths in the multi-select array
        setSelectedFilePaths(prev => prev.map(p => p === path ? data.relativePath : p))
      } else {
        const errData = await res.json()
        alert(errData.detail || '이름 변경 실패')
      }
    } catch (err) {
      alert('오류 발생: ' + err.message)
    }
  }

  // Send node to Recycle bin
  const deleteNode = async (path) => {
    try {
      const res = await fetch(`/api/delete?path=${encodeURIComponent(path)}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        await fetchTree()
        await fetchLogs()
        if (activePath === path) {
          setActivePath(null)
          setFileData(null)
        }
        setUnsavedFiles(prev => prev.filter(p => p !== path))
        setSelectedFilePaths(prev => prev.filter(p => p !== path))
      } else {
        const errData = await res.json()
        alert(errData.detail || '삭제 실패')
      }
    } catch (err) {
      alert('오류 발생: ' + err.message)
    }
  }

  // Move node(s) via Drag and Drop (Batch process supported)
  const moveNode = async (source, destination) => {
    const sources = Array.isArray(source) ? source : [source]
    
    try {
      // Run all moves in parallel
      const movePromises = sources.map(async (src) => {
        const res = await fetch('/api/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: src, destination })
        })
        return { path: src, ok: res.ok }
      })
      
      const results = await Promise.all(movePromises)
      const failures = results.filter(r => !r.ok)
      
      if (failures.length > 0) {
        alert(`${failures.length}개 파일 이동 실패. 목적지에 이미 동일한 파일명이 존재할 수 있습니다.`)
      }
      
      await fetchTree()
      await fetchLogs()
      
      // If our currently active file was moved, update its path
      if (activePath && sources.includes(activePath)) {
        const activeResult = results.find(r => r.path === activePath)
        if (activeResult && activeResult.ok) {
          const fileName = activePath.split('/').pop()
          const newRelPath = destination === "" ? fileName : `${destination}/${fileName}`
          setActivePath(newRelPath)
        }
      }
      
      // Clear selection list after move
      setSelectedFilePaths([])
    } catch (err) {
      alert('이동 중 오류 발생: ' + err.message)
    }
  }

  // Dynamic Folder switching with Strict Verification Loop
  const handleFolderChangeSubmit = async (e) => {
    e.preventDefault()
    setFolderError('')

    if (!folderInput.trim()) {
      setFolderError('경로를 입력해 주세요.')
      return
    }

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes_dir: folderInput.trim() })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setNotesDir(data.notes_dir)
        setFolderModalOpen(false)
        
        // Reset selections
        setSelectedFolderPath('')
        setActivePath(null)
        setFileData(null)
        setUnsavedFiles([])
        setPendingContent({})
        setSelectedFilePaths([])
        
        await fetchTree()
        await fetchLogs()
      } else {
        setFolderError(data.error || '존재하지 않는 경로이거나 접근할 수 없습니다.')
      }
    } catch (err) {
      setFolderError('서버 연결 실패: ' + err.message)
    }
  }

  const handleFolderChangeCancel = () => {
    setFolderInput(notesDir)
    setFolderError('')
    setFolderModalOpen(false)
  }

  // Local Image Upload Handler
  const handleUploadImage = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    
    if (res.ok) {
      const data = await res.json()
      await fetchLogs()
      return data.url
    } else {
      const errData = await res.json()
      throw new Error(errData.detail || '업로드 실패')
    }
  }

  // Select folder on left column
  const handleSelectFolder = (folderPath) => {
    setSelectedFolderPath(folderPath)
    setSelectedFilePaths([]) // Clear multi-selection list when changing folders
  }

  // Select file from search results
  const handleSelectSearchResult = async (path) => {
    setSearchModalOpen(false)
    const folderParts = path.split('/')
    folderParts.pop()
    const parentFolder = folderParts.join('/')
    setSelectedFolderPath(parentFolder)
    setSelectedFilePaths([path])
    
    await selectFile(path)
  }

  // Multi-select handlers for FileList
  const handleToggleSelectFile = (path) => {
    setSelectedFilePaths(prev => {
      if (prev.includes(path)) {
        return prev.filter(p => p !== path)
      } else {
        return [...prev, path]
      }
    })
  }

  const handleSelectFileRange = (rangePaths) => {
    setSelectedFilePaths(rangePaths)
  }

  const handleSetSelectedFiles = (paths) => {
    setSelectedFilePaths(paths)
  }

  // --- Keyboard Shortcuts ---
  const handleGlobalKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      saveFile()
    }
    
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      setSearchModalOpen(prev => !prev)
    }

    // Alt + 1: Toggle Folders Only sidebar
    if (e.altKey && e.key === '1') {
      e.preventDefault()
      setLeftSidebarOpen(prev => !prev)
    }

    // Alt + 2: Toggle Files Only sidebar
    if (e.altKey && e.key === '2') {
      e.preventDefault()
      setMiddleSidebarOpen(prev => !prev)
    }

    // Alt + 3: Toggle Right Activity sidebar (if needed)
    if (e.altKey && e.key === '3') {
      e.preventDefault()
      setRightSidebarOpen(prev => !prev)
    }
  }, [activePath, pendingContent, fileData, unsavedFiles])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  // --- Initial Loading ---
  useEffect(() => {
    const initialize = async () => {
      await fetchConfig()
      await fetchTree()
      await fetchLogs()
    }
    initialize()
  }, [])

  // Auto-select first note or welcome note inside the active folder on start
  useEffect(() => {
    if (treeData.length > 0 && !activePath) {
      const welcomeNode = treeData.find(n => n.name === 'Welcome.md')
      if (welcomeNode) {
        setSelectedFolderPath('') // Welcome note is at root
        setSelectedFilePaths([welcomeNode.relativePath])
        selectFile(welcomeNode.relativePath)
      }
    }
  }, [treeData])

  return (
    <div className="app-container">
      
      {/* 1. App Slim Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="app-logo">📝 MD<span>Man</span></div>
          <div className="path-display" title={notesDir}>
            <FolderOpen size={11} />
            <span>{notesDir}</span>
          </div>
          <button 
            className="btn" 
            style={{ padding: '2px 6px', height: '22px' }}
            onClick={() => { setFolderInput(notesDir); setFolderModalOpen(true); }}
            title="작업 폴더 경로 변경"
          >
            <Settings size={11} />
            <span>폴더 변경</span>
          </button>
        </div>

        <div className="header-right">
          <button 
            className="btn btn-icon" 
            onClick={() => setSearchModalOpen(true)}
            title="실시간 전체 텍스트 검색 (Ctrl+Shift+F)"
          >
            <Search size={13} />
          </button>
          
          <button 
            className={`btn btn-icon ${leftSidebarOpen ? 'btn-primary' : ''}`}
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            title="왼쪽 폴더 트리 토글 (Alt+1)"
          >
            <Sidebar size={13} />
          </button>

          <button 
            className={`btn btn-icon ${middleSidebarOpen ? 'btn-primary' : ''}`}
            onClick={() => setMiddleSidebarOpen(!middleSidebarOpen)}
            title="중앙 파일 목록 토글 (Alt+2)"
          >
            <Sidebar size={13} />
          </button>

          {/* Toggle for hidden activity logs, only shown when explicitly toggled */}
          <button 
            className={`btn btn-icon ${rightSidebarOpen ? 'btn-primary' : ''}`}
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            title="작업 기록 타임라인 토글 (Alt+3)"
            style={{ transform: 'scaleX(-1)' }}
          >
            <Clock size={13} />
          </button>
        </div>
      </header>

      {/* 2. Main Workspace (3-Column Layout) */}
      <div className="workspace-container">
        
        {/* Column 1: Folder Tree (Folders Only) */}
        <aside className={`sidebar left-sidebar ${leftSidebarOpen ? '' : 'collapsed'}`}>
          <div className="sidebar-header">
            <span>폴더 탐색기</span>
          </div>
          <FolderTree 
            treeData={treeData}
            selectedFolderPath={selectedFolderPath}
            onSelectFolder={handleSelectFolder}
            onCreateNode={createNode}
            onRenameNode={renameNode}
            onDeleteNode={deleteNode}
            onMoveNode={moveNode}
          />
        </aside>

        {/* Column 2: File List (MD Files Only with Multi-select) */}
        <aside className={`sidebar middle-sidebar ${middleSidebarOpen ? '' : 'collapsed'}`}>
          <div className="sidebar-header">
            <span>파일 목록</span>
          </div>
          <FileList 
            treeData={treeData}
            selectedFolderPath={selectedFolderPath}
            activePath={activePath}
            unsavedFiles={unsavedFiles}
            selectedFilePaths={selectedFilePaths}
            onSelectFile={selectFile}
            onToggleSelectFile={handleToggleSelectFile}
            onSelectFileRange={handleSelectFileRange}
            onSetSelectedFiles={handleSetSelectedFiles}
            onCreateFile={createNode}
            onRenameFile={renameNode}
            onDeleteFile={deleteNode}
          />
        </aside>

        {/* Column 3: Markdown Editor */}
        <main className="editor-container" style={{ flex: 1 }}>
          {fileData ? (
            <MarkdownEditor 
              filePath={activePath}
              fileData={fileData}
              isUnsaved={unsavedFiles.includes(activePath)}
              onSave={saveFile}
              onContentChange={handleContentChange}
              onUploadImage={handleUploadImage}
              onDelete={deleteNode}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>선택된 마크다운 문서가 없습니다</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>폴더를 선택하고 파일 목록에서 파일을 클릭해 보세요.</div>
            </div>
          )}
        </main>

        {/* Column 4: Hidden by default (Activity Log History) */}
        <aside className={`sidebar right-sidebar ${rightSidebarOpen ? '' : 'collapsed'}`}>
          <div className="sidebar-header">
            <span>작업 기록</span>
          </div>
          <ActivityLogPanel 
            logs={logs}
            onRefresh={fetchLogs}
          />
        </aside>
      </div>

      {/* --- 3. Folder Switcher Modal --- */}
      {folderModalOpen && (
        <div className="modal-backdrop" onClick={handleFolderChangeCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--color-warning)' }}>
                <AlertTriangle size={14} />
                <span>최상위 작업 폴더 경로 변경</span>
              </div>
              <button className="action-icon" onClick={handleFolderChangeCancel}>
                <X size={14} />
              </button>
            </div>
            
            <form onSubmit={handleFolderChangeSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>로컬 디렉토리 절대 경로</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="예: C:\Users\Username\Notes"
                    value={folderInput}
                    onChange={(e) => setFolderInput(e.target.value)}
                  />
                  {folderError && (
                    <div className="error-text">
                      <AlertTriangle size={12} />
                      <span>{folderError}</span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '8px' }}>
                  💡 존재하지 않는 경로를 입력할 경우 적용되지 않으며, 올바른 경로를 입력할 때까지 반복 요구합니다. 취소하면 원래 작업 폴더({notesDir})가 안전하게 보존됩니다.
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn" onClick={handleFolderChangeCancel}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--color-warning)', borderColor: 'var(--color-warning)' }}>
                  <Check size={12} />
                  <span>변경 적용</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 4. Full-text Search Modal --- */}
      {searchModalOpen && (
        <SearchModal 
          onClose={() => setSearchModalOpen(false)}
          onSelectResult={handleSelectSearchResult}
        />
      )}

    </div>
  )
}
