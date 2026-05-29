import React, { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
import { Save, FileCode, CheckCircle, AlertCircle, Hash, Eye, Edit3, Trash2 } from 'lucide-react'

export default function MarkdownEditor({ 
  filePath, 
  fileData, 
  isUnsaved, 
  onSave, 
  onContentChange,
  onUploadImage,
  onDelete
}) {
  const [isEditMode, setIsEditMode] = useState(true)

  // Initialize TipTap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4]
        }
      }),
      // GFM Link extension to make hyperlinks clickable and open in new tab
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer'
        }
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: '-'
      })
    ],
    content: fileData.content || '',
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown()
      onContentChange(markdown)
    },
    editorProps: {
      attributes: {
        class: 'ProseMirror'
      },
      handleDOMEvents: {
        drop: (view, event) => {
          const files = event.dataTransfer?.files
          if (files && files.length > 0) {
            const file = files[0]
            if (file.type.startsWith('image/')) {
              event.preventDefault()
              uploadAndInsertImage(file)
              return true
            }
          }
          return false
        },
        paste: (view, event) => {
          const files = event.clipboardData?.files
          if (files && files.length > 0) {
            const file = files[0]
            if (file.type.startsWith('image/')) {
              event.preventDefault()
              uploadAndInsertImage(file)
              return true
            }
          }
          return false
        }
      }
    }
  }, [filePath]) // Re-initialize when active file changes

  // Sync content when loading a new file
  useEffect(() => {
    if (editor && fileData) {
      const currentMarkdown = editor.storage.markdown.getMarkdown()
      if (currentMarkdown !== fileData.content) {
        editor.commands.setContent(fileData.content || '')
      }
    }
  }, [fileData, editor])

  // Dynamically set editability when mode toggles
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditMode)
    }
  }, [isEditMode, editor])

  const uploadAndInsertImage = async (file) => {
    try {
      const url = await onUploadImage(file)
      if (url && editor) {
        editor.commands.insertContent(`\n![이미지](${url})\n`)
        const newMarkdown = editor.storage.markdown.getMarkdown()
        onContentChange(newMarkdown)
      }
    } catch (err) {
      alert('이미지 업로드에 실패했습니다: ' + err.message)
    }
  }

  // Word & Character count calculations
  const textContent = editor?.getText() || ''
  const charCount = textContent.length
  const wordCount = textContent.trim().split(/\s+/).filter(Boolean).length

  // Render tags badges from frontmatter
  const tags = fileData.frontmatter?.tags || []

  // Extract folder name and filename with extension
  const pathParts = filePath.split('/')
  const fileNameWithExt = pathParts[pathParts.length - 1]
  const fileName = fileNameWithExt.slice(0, -3) // without .md

  return (
    <div className="editor-container">
      {/* Editor Compact Header (Frame) */}
      <div className="editor-header">
        <div className="editor-file-info" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileCode size={13} className="tree-item-icon file" />
          {/* Prominent Filename inside frame */}
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '12px' }}>{fileNameWithExt}</span>
          
          {/* File System timestamps in frame */}
          <span 
            className="editor-breadcrumb" 
            style={{ 
              fontSize: '10px', 
              color: 'var(--text-muted)', 
              fontFamily: 'var(--font-mono)',
              marginLeft: '8px'
            }}
          >
            [ Created: {fileData.created || 'N/A'}   Updated: {fileData.updated || 'N/A'} ]
          </span>
          {isUnsaved && <span className="unsaved-dot" title="저장되지 않은 변경사항이 있음"></span>}
        </div>

        {/* YAML tags */}
        <div className="editor-tags" style={{ marginRight: 'auto', marginLeft: '12px' }}>
          {tags.length > 0 ? (
            tags.map(tag => (
              <span key={tag} className="tag-badge">
                <Hash size={9} />
                {tag}
              </span>
            ))
          ) : (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>태그 없음</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Pill Switcher for Edit vs Preview Mode */}
          <div style={{ 
            display: 'flex', 
            background: 'rgba(0,0,0,0.3)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '4px', 
            padding: '2px'
          }}>
            <button 
              className={`btn ${isEditMode ? 'btn-primary' : ''}`} 
              style={{ padding: '2px 6px', border: 'none', borderRadius: '3px', height: '20px', fontSize: '10px' }}
              onClick={() => setIsEditMode(true)}
              title="편집 모드로 전환"
            >
              <Edit3 size={10} style={{ marginRight: '2px' }} />
              <span>Edit</span>
            </button>
            <button 
              className={`btn ${!isEditMode ? 'btn-primary' : ''}`} 
              style={{ padding: '2px 6px', border: 'none', borderRadius: '3px', height: '20px', fontSize: '10px' }}
              onClick={() => setIsEditMode(false)}
              title="미리보기 모드로 전환"
            >
              <Eye size={10} style={{ marginRight: '2px' }} />
              <span>Preview</span>
            </button>
          </div>

          {/* Save Button */}
          {isEditMode && (
            <button 
              className={`btn ${isUnsaved ? 'btn-primary' : ''}`}
              onClick={onSave}
              title="마크다운 문서 저장 (Ctrl+S)"
              style={{ height: '22px', padding: '2px 8px' }}
            >
              <Save size={11} />
              <span>저장</span>
            </button>
          )}

          {/* Delete Button */}
          <button 
            className="btn"
            style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.25)', height: '22px', padding: '2px 8px' }}
            onClick={() => {
              const confirm = window.confirm(`'${fileName}' 문서를 정말 휴지통으로 이동하시겠습니까?`)
              if (confirm) {
                onDelete(filePath)
              }
            }}
            title="이 문서 삭제 (휴지통으로 이동)"
          >
            <Trash2 size={11} />
            <span>삭제</span>
          </button>
        </div>
      </div>

      {/* Tiptap Editor / Preview Surface (Viewer side) - Filename and Meta are hidden here */}
      <div className="editor-workspace">
        <div className={`tiptap-editor-wrapper ${isEditMode ? '' : 'markdown-body'}`} style={{ width: '100%', maxWidth: '800px' }}>
          <div className={isEditMode ? '' : 'markdown-body'}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Editor Compact Footer */}
      <div className="editor-footer">
        <div className="footer-stats">
          <span>{charCount.toLocaleString()} 글자</span>
          <span>•</span>
          <span>{wordCount.toLocaleString()} 단어</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isUnsaved ? (
            <>
              <AlertCircle size={10} style={{ color: 'var(--color-warning)' }} />
              <span style={{ color: 'var(--color-warning)' }}>미저장 변경사항이 있습니다. (Ctrl+S)</span>
            </>
          ) : (
            <>
              <CheckCircle size={10} style={{ color: 'var(--color-success)' }} />
              <span style={{ color: 'var(--color-success)' }}>디스크와 동기화됨</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
