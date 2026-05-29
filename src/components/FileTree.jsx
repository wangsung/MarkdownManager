import React, { useState } from 'react'
import { Folder, FolderOpen, FileText, Plus, FolderPlus, Edit2, Trash2, ChevronRight, ChevronDown } from 'lucide-react'

export default function FileTree({ 
  treeData, 
  activePath, 
  unsavedFiles,
  onSelectFile, 
  onCreateNode, 
  onRenameNode, 
  onDeleteNode, 
  onMoveNode 
}) {
  const [expandedFolders, setExpandedFolders] = useState({})
  const [draggedOverPath, setDraggedOverPath] = useState(null)

  const toggleExpand = (path, e) => {
    e.stopPropagation()
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }))
  }

  // Drag and Drop handlers
  const handleDragStart = (e, path) => {
    e.stopPropagation()
    e.dataTransfer.setData('text/plain', path)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, node) => {
    e.stopPropagation()
    if (node.kind === 'directory') {
      e.preventDefault()
      setDraggedOverPath(node.relativePath)
    }
  }

  const handleDragLeave = (e) => {
    e.stopPropagation()
    setDraggedOverPath(null)
  }

  const handleDrop = (e, targetNode) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggedOverPath(null)
    
    const sourcePath = e.dataTransfer.getData('text/plain')
    if (!sourcePath) return

    // Prevent dropping into oneself or a direct parent where it already is
    if (sourcePath === targetNode.relativePath) return

    // If source is /a/b, target is /a/b/c, prevent dropping parent into child
    if (targetNode.relativePath.startsWith(sourcePath + '/')) {
      alert('상위 폴더를 하위 폴더 내부로 이동할 수 없습니다.')
      return
    }

    onMoveNode(sourcePath, targetNode.relativePath)
  }

  // Dialog triggers for CRUD
  const triggerCreateFile = (parentPath, e) => {
    e.stopPropagation()
    const name = prompt('새 마크다운 파일 이름을 입력하세요 (예: Note):')
    if (name) {
      onCreateNode(parentPath, name, 'file')
    }
  }

  const triggerCreateFolder = (parentPath, e) => {
    e.stopPropagation()
    const name = prompt('새 폴더 이름을 입력하세요:')
    if (name) {
      onCreateNode(parentPath, name, 'directory')
    }
  }

  const triggerRename = (node, e) => {
    e.stopPropagation()
    const currentName = node.kind === 'file' ? node.name.slice(0, -3) : node.name
    const newName = prompt(`새 이름을 입력하세요:`, currentName)
    if (newName && newName !== currentName) {
      onRenameNode(node.relativePath, newName)
    }
  }

  const triggerDelete = (node, e) => {
    e.stopPropagation()
    const isConfirm = window.confirm(`'${node.name}'을(를) 휴지통으로 이동하시겠습니까?`)
    if (isConfirm) {
      onDeleteNode(node.relativePath)
    }
  }

  // Recursive Tree Node Renderer
  const renderTree = (nodes, depth = 0) => {
    return nodes.map(node => {
      const isDir = node.kind === 'directory'
      const isExpanded = expandedFolders[node.relativePath]
      const isActive = activePath === node.relativePath
      const isUnsaved = unsavedFiles.includes(node.relativePath)
      const isDraggedOver = draggedOverPath === node.relativePath

      return (
        <div key={node.relativePath} className="tree-node">
          {/* Node Row */}
          <div 
            className={`tree-item-row ${isActive ? 'active' : ''} ${isDraggedOver ? 'drag-over' : ''}`}
            style={{ paddingLeft: `${depth * 10 + 6}px` }}
            onClick={(e) => isDir ? toggleExpand(node.relativePath, e) : onSelectFile(node.relativePath)}
            draggable
            onDragStart={(e) => handleDragStart(e, node.relativePath)}
            onDragOver={(e) => handleDragOver(e, node)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, node)}
          >
            <div className="tree-item-content">
              {/* Expand Toggle Chevron for Folders */}
              {isDir ? (
                <span className="tree-item-icon" onClick={(e) => toggleExpand(node.relativePath, e)}>
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              ) : (
                <span style={{ width: 12 }}></span> // Blank placeholder
              )}

              {/* Node Icon */}
              <span className={`tree-item-icon ${isDir ? 'folder' : 'file'}`}>
                {isDir ? (
                  isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />
                ) : (
                  <FileText size={14} />
                )}
              </span>

              {/* Node Text */}
              <span className="tree-item-text" title={node.name}>
                {isDir ? node.name : node.name.slice(0, -3)}
              </span>

              {/* Unsaved indicator */}
              {!isDir && isUnsaved && <span className="unsaved-dot"></span>}
            </div>

            {/* Tree CRUD Actions Hover Overlay */}
            <div className="tree-actions">
              {isDir && (
                <>
                  <button 
                    className="action-icon" 
                    title="새 마크다운 파일 생성" 
                    onClick={(e) => triggerCreateFile(node.relativePath, e)}
                  >
                    <Plus size={11} />
                  </button>
                  <button 
                    className="action-icon" 
                    title="새 폴더 생성" 
                    onClick={(e) => triggerCreateFolder(node.relativePath, e)}
                  >
                    <FolderPlus size={11} />
                  </button>
                </>
              )}
              <button 
                className="action-icon" 
                title="이름 변경" 
                onClick={(e) => triggerRename(node, e)}
              >
                <Edit2 size={11} />
              </button>
              <button 
                className="action-icon delete" 
                title="휴지통으로 삭제" 
                onClick={(e) => triggerDelete(node, e)}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          {/* Render children recursively if folder is expanded */}
          {isDir && isExpanded && node.children && (
            <div className="tree-children-container">
              {renderTree(node.children, depth + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  // Drag over target for root element (to allow moving files back to root directory)
  const handleRootDragOver = (e) => {
    e.preventDefault()
  }

  const handleRootDrop = (e) => {
    e.preventDefault()
    const sourcePath = e.dataTransfer.getData('text/plain')
    if (!sourcePath) return
    
    // Root drop destination is designated by an empty string
    onMoveNode(sourcePath, "")
  }

  return (
    <div 
      className="sidebar-content"
      onDragOver={handleRootDragOver}
      onDrop={handleRootDrop}
      style={{ minHeight: '100%' }}
    >
      {/* Root quick controls */}
      <div 
        style={{ 
          padding: '4px 8px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
          marginBottom: '4px'
        }}
      >
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>탐색기 루트</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button 
            className="action-icon" 
            title="최상위에 파일 생성" 
            onClick={(e) => triggerCreateFile("", e)}
          >
            <Plus size={11} />
          </button>
          <button 
            className="action-icon" 
            title="최상위에 폴더 생성" 
            onClick={(e) => triggerCreateFolder("", e)}
          >
            <FolderPlus size={11} />
          </button>
        </div>
      </div>

      {treeData.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
          비어 있는 폴더입니다.<br />상단 + 버튼을 눌러 새 문서를 만들어 보세요.
        </div>
      ) : (
        renderTree(treeData)
      )}
    </div>
  )
}
