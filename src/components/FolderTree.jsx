import React, { useState } from 'react'
import { Folder, FolderOpen, Plus, FolderPlus, Edit2, Trash2, ChevronRight, ChevronDown } from 'lucide-react'

export default function FolderTree({ 
  treeData, 
  selectedFolderPath, 
  onSelectFolder, 
  onCreateNode, 
  onRenameNode, 
  onDeleteNode, 
  onMoveNode 
}) {
  const [expandedFolders, setExpandedFolders] = useState({ "": true }) // Root expanded by default
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
    e.dataTransfer.setData('node-type', 'directory')
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, path) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggedOverPath(path)
  }

  const handleDragLeave = (e) => {
    e.stopPropagation()
    setDraggedOverPath(null)
  }

  const handleDrop = (e, targetPath) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggedOverPath(null)
    
    // Check for JSON array representing multi-drag
    const jsonPaths = e.dataTransfer.getData('application/json')
    if (jsonPaths) {
      try {
        const sourcePaths = JSON.parse(jsonPaths)
        if (Array.isArray(sourcePaths) && sourcePaths.length > 0) {
          const validSources = sourcePaths.filter(src => {
            if (src === targetPath) return false
            if (targetPath.startsWith(src + '/')) return false
            return true
          })
          if (validSources.length > 0) {
            onMoveNode(validSources, targetPath)
          }
          return
        }
      } catch (err) {
        console.error('Drop JSON parsing error:', err)
      }
    }

    // Fallback for single item drag
    const sourcePath = e.dataTransfer.getData('text/plain')
    if (!sourcePath) return

    // Prevent dropping into oneself
    if (sourcePath === targetPath) return

    // Prevent dropping parent into child
    if (targetPath.startsWith(sourcePath + '/')) {
      alert('상위 폴더를 하위 폴더 내부로 이동할 수 없습니다.')
      return
    }

    onMoveNode(sourcePath, targetPath)
  }

  // Dialog triggers for Folder CRUD
  const triggerCreateFolder = (parentPath, e) => {
    e.stopPropagation()
    const name = prompt('새 폴더 이름을 입력하세요:')
    if (name) {
      onCreateNode(parentPath, name, 'directory')
    }
  }

  const triggerRename = (path, currentName, e) => {
    e.stopPropagation()
    const newName = prompt(`새 이름을 입력하세요:`, currentName)
    if (newName && newName !== currentName) {
      onRenameNode(path, newName)
    }
  }

  const triggerDelete = (path, name, e) => {
    e.stopPropagation()
    const isConfirm = window.confirm(`폴더 '${name}'와 그 내용물을 모두 휴지통으로 이동하시겠습니까?`)
    if (isConfirm) {
      onDeleteNode(path)
    }
  }

  // Recursive Tree Node Renderer (FOLDERS ONLY)
  const renderTree = (nodes, depth = 0) => {
    // Filter to only directories
    const dirNodes = nodes.filter(node => node.kind === 'directory')

    return dirNodes.map(node => {
      const isExpanded = expandedFolders[node.relativePath]
      const isSelected = selectedFolderPath === node.relativePath
      const isDraggedOver = draggedOverPath === node.relativePath

      return (
        <div key={node.relativePath} className="tree-node">
          {/* Node Row */}
          <div 
            className={`tree-item-row ${isSelected ? 'active' : ''} ${isDraggedOver ? 'drag-over' : ''}`}
            style={{ paddingLeft: `${depth * 10 + 6}px` }}
            onClick={() => onSelectFolder(node.relativePath)}
            draggable
            onDragStart={(e) => handleDragStart(e, node.relativePath)}
            onDragOver={(e) => handleDragOver(e, node.relativePath)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, node.relativePath)}
          >
            <div className="tree-item-content">
              {/* Expand Toggle Chevron */}
              <span className="tree-item-icon" onClick={(e) => toggleExpand(node.relativePath, e)}>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>

              {/* Folder Icon */}
              <span className="tree-item-icon folder">
                {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
              </span>

              {/* Node Text */}
              <span className="tree-item-text" title={node.name}>
                {node.name}
              </span>
            </div>

            {/* Folder Actions Hover Overlay */}
            <div className="tree-actions">
              <button 
                className="action-icon" 
                title="새 폴더 생성" 
                onClick={(e) => triggerCreateFolder(node.relativePath, e)}
              >
                <FolderPlus size={11} />
              </button>
              <button 
                className="action-icon" 
                title="이름 변경" 
                onClick={(e) => triggerRename(node.relativePath, node.name, e)}
              >
                <Edit2 size={11} />
              </button>
              <button 
                className="action-icon delete" 
                title="휴지통으로 삭제" 
                onClick={(e) => triggerDelete(node.relativePath, node.name, e)}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          {/* Render children recursively if folder is expanded */}
          {isExpanded && node.children && (
            <div className="tree-children-container">
              {renderTree(node.children, depth + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  // Root drop zone handlers
  const handleRootDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggedOverPath("")
  }

  const handleRootDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggedOverPath(null)
    
    const jsonPaths = e.dataTransfer.getData('application/json')
    if (jsonPaths) {
      try {
        const sourcePaths = JSON.parse(jsonPaths)
        if (Array.isArray(sourcePaths) && sourcePaths.length > 0) {
          const validSources = sourcePaths.filter(src => src !== "")
          if (validSources.length > 0) {
            onMoveNode(validSources, "")
          }
          return
        }
      } catch (err) {
        console.error('Root Drop JSON parsing error:', err)
      }
    }

    const sourcePath = e.dataTransfer.getData('text/plain')
    if (!sourcePath) return
    if (sourcePath === "") return
    onMoveNode(sourcePath, "")
  }

  return (
    <div className="sidebar-content">
      {/* Root quick controls */}
      <div 
        className={`tree-item-row ${selectedFolderPath === "" ? 'active' : ''} ${draggedOverPath === "" ? 'drag-over' : ''}`}
        style={{ 
          padding: '4px 8px', 
          height: '28px',
          margin: '0 4px 6px 4px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
        }}
        onClick={() => onSelectFolder("")}
        onDragOver={handleRootDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleRootDrop}
      >
        <div className="tree-item-content">
          <span className="tree-item-icon folder">
            <FolderOpen size={14} />
          </span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>루트 폴더 (Root)</span>
        </div>
        <div className="tree-actions" style={{ display: 'flex' }}>
          <button 
            className="action-icon" 
            title="최상위에 폴더 생성" 
            onClick={(e) => triggerCreateFolder("", e)}
          >
            <FolderPlus size={11} />
          </button>
        </div>
      </div>

      <div style={{ padding: '0 4px' }}>
        {renderTree(treeData)}
      </div>
    </div>
  )
}
