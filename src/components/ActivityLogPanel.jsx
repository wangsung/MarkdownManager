import React from 'react'
import { Clock, RefreshCw } from 'lucide-react'

export default function ActivityLogPanel({ logs, onRefresh }) {
  return (
    <div className="sidebar-content" style={{ padding: '4px' }}>
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
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={10} /> 최근 활동 기록
        </span>
        <button 
          className="action-icon" 
          title="새로고침" 
          onClick={onRefresh}
        >
          <RefreshCw size={10} />
        </button>
      </div>

      <div className="log-timeline">
        {logs.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
            기록된 활동이 없습니다.
          </div>
        ) : (
          logs.map((log, index) => {
            const actionClass = log.action.toLowerCase()
            return (
              <div key={index} className="log-item">
                <div className="log-meta">
                  <span className={`log-badge ${actionClass}`}>
                    {log.action}
                  </span>
                  <span className="log-time">{log.timestamp.split(' ')[1]}</span>
                </div>
                <div className="log-details" title={log.details}>
                  {log.details}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
