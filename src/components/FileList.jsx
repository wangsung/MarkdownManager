import React, { useState } from 'react'
import { FileText, Plus, Edit2, Trash2 } from 'lucide-react'

export default function FileList({
  treeData,
  selectedFolderPath,
  activePath,
  unsavedFiles,
  selectedFilePaths = [],
  onSelectFile,
  onToggleSelectFile,
  onSelectFileRange,
  onSetSelectedFiles,
  onCreateFile,
  onRenameFile,
  onDeleteFile
}) {
  const [lastClickedPath, setLastClickedPath] = useState(null)

  // Helper to find the files in the selected folder path
  const getFilesForPath = (nodes, targetPath) => {
    if (targetPath === "") {
      return nodes.filter(node => node.kind === 'file')
    }

    const findFolder = (nodeList, path) => {
      for (const node of nodeList) {
        if (node.kind === 'directory') {
          if (node.relativePath === path) {
            return node
          }
          if (node.children) {
            const found = findFolder(node.children, path)
            if (found) return found
          }
        }
      }
      return null
    }

    const folderNode = findFolder(nodes, targetPath)
    return folderNode && folderNode.children ? folderNode.children.filter(n => n.kind === 'file') : []
  }

  const files = getFilesForPath(treeData, selectedFolderPath)

  // Native row click handling (with Shift / Ctrl modifiers)
  const handleRowClick = (e, file) => {
    const path = file.relativePath
    
    if (e.ctrlKey || e.metaKey) {
      // Ctrl + Click: Toggle individual file selection
      e.preventDefault()
      onToggleSelectFile(path)
      setLastClickedPath(path)
    } 
    else if (e.shiftKey && lastClickedPath) {
      // Shift + Click: Select range of files
      e.preventDefault()
      const allPaths = files.map(f => f.relativePath)
      const lastIndex = allPaths.indexOf(lastClickedPath)
      const currentIndex = allPaths.indexOf(path)
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const rangePaths = allPaths.slice(start, end + 1)
        onSelectFileRange(rangePaths)
      }
    } 
    else {
      // Standard Click: Clear others, select this single file, open in editor
      onSetSelectedFiles([path])
      onSelectFile(path)
      setLastClickedPath(path)
    }
  }

  // Checkbox state handling (prevents opening in editor)
  const handleCheckboxChange = (e, file) => {
    e.stopPropagation()
    onToggleSelectFile(file.relativePath)
    setLastClickedPath(file.relativePath)
  }

  // Drag start handler for files (supporting multi-drag)
  const handleDragStart = (e, file) => {
    e.stopPropagation()
    const path = file.relativePath

    let pathsToDrag = [...selectedFilePaths]
    
    // If the dragged item is not part of the active selection, drag only this item
    if (!pathsToDrag.includes(path)) {
      pathsToDrag = [path]
      onSetSelectedFiles([path])
    }

    // Serialize multiple files list
    e.dataTransfer.setData('application/json', JSON.stringify(pathsToDrag))
    e.dataTransfer.setData('text/plain', path) // fallback
    e.dataTransfer.setData('node-type', 'file')
    e.dataTransfer.effectAllowed = 'move'

    // HTML5 Drag Image text/visual clue
    if (pathsToDrag.length > 1) {
      const dragGhost = document.createElement('div')
      dragGhost.style.padding = '4px 8px'
      dragGhost.style.background = 'var(--bg-panel)'
      dragGhost.style.border = '1px solid var(--color-purple)'
      dragGhost.style.color = '#fff'
      dragGhost.style.borderRadius = '4px'
      dragGhost.style.fontSize = '11px'
      dragGhost.style.position = 'absolute'
      dragGhost.style.top = '-1000px'
      dragGhost.textContent = `📝 마크다운 파일 ${pathsToDrag.length}개 이동 중`
      document.body.appendChild(dragGhost)
      e.dataTransfer.setDragImage(dragGhost, 0, 0)
      setTimeout(() => document.body.removeChild(dragGhost), 0)
    }
  }

  const triggerCreateFile = () => {
    const name = prompt('새 마크다운 파일 이름을 입력하세요 (예: Note):')
    if (name) {
      onCreateFile(selectedFolderPath, name, 'file')
    }
  }

  const triggerRename = (file, e) => {
    e.stopPropagation()
    const currentName = file.name.slice(0, -3) // Remove .md
    const newName = prompt(`새 이름을 입력하세요:`, currentName)
    if (newName && newName !== currentName) {
      onRenameFile(file.relativePath, newName)
    }
  }

  const triggerDelete = (file, e) => {
    e.stopPropagation()
    const isConfirm = window.confirm(`파일 '${file.name}'을(를) 휴지통으로 이동하시겠습니까?`)
    if (isConfirm) {
      onDeleteFile(file.relativePath)
    }
  }

  const getDisplayFolderName = (path) => {
    if (path === "") return "루트 폴더"
    return path.split('/').pop()
  }

  return (
    <div className="sidebar-content" style={{ padding: '4px' }}>
      
      {/* Header with Quick Add File */}
      <div 
        style={{ 
          padding: '4px 8px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
          marginBottom: '6px'
        }}
      >
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
          [{getDisplayFolderName(selectedFolderPath)}] 파일 ({files.length})
        </span>
        <button 
          className="action-icon" 
          title="이 폴더에 새 마크다운 파일 추가" 
          onClick={triggerCreateFile}
        >
          <Plus size={11} />
        </button>
      </div>

      {/* File List Items */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {files.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.4' }}>
            이 폴더에는 마크다운 파일이 없습니다.<br />상단 + 버튼을 눌러 추가해 보세요.
          </div>
        ) : (
          files.map(file => {
            const isActive = activePath === file.relativePath
            const isSelected = selectedFilePaths.includes(file.relativePath)
            const isUnsaved = unsavedFiles.includes(file.relativePath)

            return (
              <div 
                key={file.relativePath}
                className={`file-list-item-row ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={(e) => handleRowClick(e, file)}
                draggable
                onDragStart={(e) => handleDragStart(e, file)}
              >
                <div className="file-list-item-content">
                  {/* Premium Select Checkbox */}
                  <input
                    type="checkbox"
                    className="file-list-checkbox"
                    checked={isSelected}
                    onChange={(e) => handleCheckboxChange(e, file)}
                  />

                  <span className="tree-item-icon file">
                    <FileText size={14} />
                  </span>
                  <span className="file-list-item-text" title={file.name}>
                    {file.name.slice(0, -3)}
                  </span>
                  {isUnsaved && <span className="unsaved-dot"></span>}
                </div>

                <div className="file-list-actions">
                  <button 
                    className="action-icon" 
                    title="이름 변경" 
                    onClick={(e) => triggerRename(file, e)}
                  >
                    <Edit2 size={11} />
                  </button>
                  <button 
                    className="action-icon delete" 
                    title="휴지통으로 삭제" 
                    onClick={(e) => triggerDelete(file, e)}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Selection stats helper */}
      {selectedFilePaths.length > 1 && (
        <div 
          style={{ 
            marginTop: '8px', 
            padding: '4px 8px', 
            background: 'rgba(139, 92, 246, 0.05)', 
            border: '1px solid rgba(139, 92, 246, 0.1)', 
            borderRadius: '4px',
            color: '#c084fc',
            fontSize: '10px',
            textAlign: 'center'
          }}
        >
          📝 파일 <strong>{selectedFilePaths.length}</strong>개 선택됨 <br />
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>드래그해서 한 번에 폴더로 이동 가능</span>
        </div>
      )}
    </div>
  )
}
