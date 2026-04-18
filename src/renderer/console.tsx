import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

type NetworkLogEntry = {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: any;
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: string;
  duration?: number;
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getStatusColor(code?: number): string {
  if (!code) return '#888';
  if (code >= 200 && code < 300) return '#4caf50';
  if (code >= 300 && code < 400) return '#ff9800';
  if (code >= 400) return '#f44336';
  return '#888';
}

function formatJson(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function Console() {
  const [logs, setLogs] = useState<NetworkLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<NetworkLogEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    const res = await window.pageops.console.getLogs();
    if (res.ok) {
      setLogs(res.data);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, [fetchLogs, autoRefresh]);

  const handleClear = async () => {
    await window.pageops.console.clearLogs();
    setLogs([]);
    setSelectedLog(null);
  };

  const handleExport = async () => {
    const res = await window.pageops.console.exportLogs();
    if (res.ok) {
      alert(`Logs exported to: ${res.filePath}`);
    } else if (!res.canceled) {
      alert(`Export failed: ${res.error?.message}`);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 13
    },
    toolbar: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderBottom: '1px solid #333',
      background: '#252526'
    },
    button: {
      padding: '4px 12px',
      background: '#0e639c',
      color: '#fff',
      border: 'none',
      borderRadius: 3,
      cursor: 'pointer',
      fontSize: 12
    },
    buttonSecondary: {
      padding: '4px 12px',
      background: '#3c3c3c',
      color: '#fff',
      border: '1px solid #555',
      borderRadius: 3,
      cursor: 'pointer',
      fontSize: 12
    },
    checkbox: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 12,
      cursor: 'pointer'
    },
    main: {
      display: 'flex',
      flex: 1,
      overflow: 'hidden'
    },
    logList: {
      width: 400,
      borderRight: '1px solid #333',
      overflow: 'auto',
      background: '#1e1e1e'
    },
    logItem: {
      padding: '8px 12px',
      borderBottom: '1px solid #333',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    },
    logItemSelected: {
      background: '#094771'
    },
    logHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    },
    method: {
      fontWeight: 'bold',
      fontSize: 11,
      padding: '2px 6px',
      borderRadius: 3,
      background: '#424242',
      color: '#fff'
    },
    status: {
      fontWeight: 'bold',
      fontSize: 11,
      padding: '2px 6px',
      borderRadius: 3,
      color: '#fff'
    },
    url: {
      fontSize: 12,
      color: '#9cdcfe',
      wordBreak: 'break-all',
      fontFamily: 'Consolas, Monaco, monospace'
    },
    meta: {
      display: 'flex',
      gap: 12,
      fontSize: 11,
      color: '#858585'
    },
    detailPanel: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#1e1e1e'
    },
    tabs: {
      display: 'flex',
      borderBottom: '1px solid #333',
      background: '#252526'
    },
    tab: {
      padding: '8px 16px',
      cursor: 'pointer',
      fontSize: 12,
      borderBottom: '2px solid transparent'
    },
    tabActive: {
      borderBottomColor: '#0e639c',
      color: '#fff'
    },
    tabContent: {
      flex: 1,
      overflow: 'auto',
      padding: 12
    },
    section: {
      marginBottom: 16
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#858585',
      textTransform: 'uppercase',
      marginBottom: 8,
      letterSpacing: 0.5
    },
    codeBlock: {
      background: '#252526',
      padding: 12,
      borderRadius: 3,
      fontFamily: 'Consolas, Monaco, monospace',
      fontSize: 12,
      overflow: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      color: '#d4d4d4',
      border: '1px solid #333',
      maxHeight: 400
    },
    emptyState: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#858585',
      fontSize: 14
    },
    headerRow: {
      display: 'flex',
      padding: '4px 0',
      borderBottom: '1px solid #333',
      fontSize: 12
    },
    headerKey: {
      width: 200,
      color: '#9cdcfe',
      flexShrink: 0
    },
    headerValue: {
      color: '#ce9178',
      wordBreak: 'break-word'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <button style={styles.button} onClick={fetchLogs}>Refresh</button>
        <button style={styles.buttonSecondary} onClick={handleClear}>Clear</button>
        <button style={styles.buttonSecondary} onClick={handleExport}>Export</button>
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#858585' }}>
          {logs.length} requests
        </span>
      </div>

      <div style={styles.main}>
        <div style={styles.logList}>
          {logs.map((log) => (
            <div
              key={log.id}
              style={{
                ...styles.logItem,
                ...(selectedLog?.id === log.id ? styles.logItemSelected : {})
              }}
              onClick={() => {
                setSelectedLog(log);
                setActiveTab('request');
              }}
            >
              <div style={styles.logHeader}>
                <span style={styles.method}>{log.method}</span>
                {log.statusCode && (
                  <span
                    style={{
                      ...styles.status,
                      background: getStatusColor(log.statusCode)
                    }}
                  >
                    {log.statusCode}
                  </span>
                )}
                {log.error && (
                  <span style={{ ...styles.status, background: '#f44336' }}>ERR</span>
                )}
              </div>
              <div style={styles.url}>{log.url}</div>
              <div style={styles.meta}>
                <span>{formatTimestamp(log.timestamp)}</span>
                <span>{formatDuration(log.duration)}</span>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div style={{ ...styles.emptyState, height: 200 }}>No requests yet</div>
          )}
        </div>

        <div style={styles.detailPanel}>
          {!selectedLog ? (
            <div style={styles.emptyState}>Select a request to view details</div>
          ) : (
            <>
              <div style={styles.tabs}>
                <div
                  style={{
                    ...styles.tab,
                    ...(activeTab === 'request' ? styles.tabActive : {})
                  }}
                  onClick={() => setActiveTab('request')}
                >
                  Request
                </div>
                <div
                  style={{
                    ...styles.tab,
                    ...(activeTab === 'response' ? styles.tabActive : {})
                  }}
                  onClick={() => setActiveTab('response')}
                >
                  Response
                </div>
              </div>

              <div style={styles.tabContent}>
                {activeTab === 'request' ? (
                  <>
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>General</div>
                      <div style={styles.codeBlock}>
                        {selectedLog.method} {selectedLog.url}
                      </div>
                    </div>

                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Request Headers</div>
                      {Object.keys(selectedLog.requestHeaders || {}).length === 0 ? (
                        <div style={{ ...styles.codeBlock, color: '#858585' }}>No headers</div>
                      ) : (
                        <div style={styles.codeBlock}>
                          {Object.entries(selectedLog.requestHeaders || {}).map(([key, value]) => (
                            <div key={key} style={styles.headerRow}>
                              <span style={styles.headerKey}>{key}:</span>
                              <span style={styles.headerValue}>{value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedLog.requestBody && (
                      <div style={styles.section}>
                        <div style={styles.sectionTitle}>Request Body</div>
                        <pre style={styles.codeBlock}>
                          {formatJson(selectedLog.requestBody)}
                        </pre>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Status</div>
                      <div style={styles.codeBlock}>
                        {selectedLog.statusCode ? (
                          <span style={{ color: getStatusColor(selectedLog.statusCode) }}>
                            {selectedLog.statusCode} {selectedLog.error ? `(${selectedLog.error})` : ''}
                          </span>
                        ) : selectedLog.error ? (
                          <span style={{ color: '#f44336' }}>{selectedLog.error}</span>
                        ) : (
                          <span style={{ color: '#858585' }}>No response</span>
                        )}
                        {selectedLog.duration && (
                          <span style={{ marginLeft: 16, color: '#858585' }}>
                            Duration: {formatDuration(selectedLog.duration)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Response Headers</div>
                      {!selectedLog.responseHeaders || Object.keys(selectedLog.responseHeaders).length === 0 ? (
                        <div style={{ ...styles.codeBlock, color: '#858585' }}>No headers</div>
                      ) : (
                        <div style={styles.codeBlock}>
                          {Object.entries(selectedLog.responseHeaders || {}).map(([key, value]) => (
                            <div key={key} style={styles.headerRow}>
                              <span style={styles.headerKey}>{key}:</span>
                              <span style={styles.headerValue}>{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Response Body</div>
                      {selectedLog.responseBody ? (
                        <pre style={styles.codeBlock}>
                          {formatJson(selectedLog.responseBody)}
                        </pre>
                      ) : (
                        <div style={{ ...styles.codeBlock, color: '#858585' }}>No body</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Console />);
}
