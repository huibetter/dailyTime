import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, ArchiveRestore, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp,
  Clock3, File, FileText, Folder, FolderOpen, Image, Inbox, LayoutList, Menu, MoreHorizontal,
  Paperclip, Plus, Search, Settings, Sparkles, Tag, Trash2, Upload, X
} from 'lucide-react';
import './styles.css';

const TODAY = '2026-08-26';
const seedProjects = [
  { id: 'inbox', name: '收集箱', color: '#d9ab42', system: true },
  { id: 'product', name: '产品迭代', color: '#66a6a0' },
  { id: 'client', name: '客户项目', color: '#b07cb4' },
  { id: 'growth', name: '个人成长', color: '#d88d60' },
];
const seedDocs = [
  { id: 1, project: 'product', title: '首页信息架构梳理', excerpt: '完成首页信息架构梳理，明确首屏的核心价值传达。', content: '# 首页信息架构梳理\n\n> 目标：让用户在 5 秒内理解 DailyTime 能解决什么问题。\n\n## 当前结论\n\n- [x] 明确首屏核心价值\n- [ ] 补充用户场景入口\n- [ ] 与视觉同学确认信息层级\n\n## 需要继续思考\n\n首页不应该只是任务列表，而应该是一个可以持续沉淀工作上下文的地方。\n\n![首页草图](https://images.unsplash.com/photo-1558655146-d09347e92766?w=900)', updated: '今天 09:42', planned: '2026-08-26', status: '进行中', tags: ['设计', '本周重点'], attachments: ['首页改版草案.pdf'], cover: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=900' },
  { id: 2, project: 'product', title: '用户访谈记录整理', excerpt: '整理访谈原始记录，提炼用户在每日工作流中的真实痛点。', content: '# 用户访谈记录整理\n\n## 访谈对象\n\n- 产品经理 2 位\n- 设计师 3 位\n- 独立开发者 2 位\n\n## 观察\n\n> 大多数人不是缺少待办清单，而是缺少工作上下文的连续记录。', updated: '昨天 18:10', planned: '2026-08-27', status: '未开始', tags: ['研究'], attachments: [] },
  { id: 3, project: 'client', title: '周报数据可视化', excerpt: '将客户周报中的关键指标转换为可读的趋势图表。', content: '# 周报数据可视化\n\n## 本周需要交付\n\n- [ ] 统一指标口径\n- [ ] 完成趋势图\n- [ ] 输出可分享版本', updated: '昨天 15:35', planned: '2026-08-26', status: '未开始', tags: ['交付', '客户'], attachments: ['数据源.xlsx'] },
  { id: 4, project: 'product', title: '设计评审会纪要', excerpt: '记录首页视觉方向、交互细节与后续行动项。', content: '# 设计评审会纪要\n\n## 已达成共识\n\n1. 用工作空间承载上下文。\n2. 用文档而不是卡片承载完整内容。\n3. 时间规划只作为文档属性存在。', updated: '8 月 25 日', planned: '2026-08-25', status: '已归档', tags: ['会议'], attachments: [] },
  { id: 5, project: 'growth', title: '阅读《设计的心理学》', excerpt: '阅读摘录、个人思考与可以应用在当前项目中的原则。', content: '# 阅读《设计的心理学》\n\n## 摘录\n\n好的设计应该让复杂的事情变得自然。\n\n## 我的思考\n\n把今天的工作写下来，本身也是在降低未来重新理解它的成本。', updated: '8 月 24 日', planned: '2026-08-28', status: '未开始', tags: ['输入'], attachments: [] },
];

function formatDate(value) { if (!value) return '未规划'; const d = new Date(`${value}T12:00:00`); return `${d.getMonth() + 1} 月 ${d.getDate()} 日`; }
function projectName(projects, id) { return projects.find(p => p.id === id)?.name || '收集箱'; }
function markdownToHtml(text) {
  return text.split('\n').map((line, index) => {
    const inline = line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
    if (line.startsWith('# ')) return `<h1>${inline.slice(2)}</h1>`;
    if (line.startsWith('## ')) return `<h2>${inline.slice(3)}</h2>`;
    if (line.startsWith('### ')) return `<h3>${inline.slice(4)}</h3>`;
    if (line.startsWith('> ')) return `<blockquote>${inline.slice(2)}</blockquote>`;
    if (line.startsWith('- [x] ')) return `<p class="md-check checked"><span>✓</span>${inline.slice(6)}</p>`;
    if (line.startsWith('- [ ] ')) return `<p class="md-check"><span></span>${inline.slice(6)}</p>`;
    if (line.startsWith('- ')) return `<li>${inline.slice(2)}</li>`;
    if (!line.trim()) return '<div class="md-gap"></div>';
    return `<p>${inline}</p>`;
  }).join('');
}

function App() {
  const [projects, setProjects] = useState(() => JSON.parse(localStorage.getItem('dt-projects') || 'null') || seedProjects);
  const [docs, setDocs] = useState(() => JSON.parse(localStorage.getItem('dt-docs') || 'null') || seedDocs);
  const [activeProject, setActiveProject] = useState('product');
  const [selectedId, setSelectedId] = useState(1);
  const [query, setQuery] = useState('');
  const [editorMode, setEditorMode] = useState('write');
  const [showPlanner, setShowPlanner] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState('');
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => localStorage.setItem('dt-docs', JSON.stringify(docs)), [docs]);
  useEffect(() => localStorage.setItem('dt-projects', JSON.stringify(projects)), [projects]);

  const selected = docs.find(d => d.id === selectedId) || docs[0];
  const visibleDocs = useMemo(() => docs.filter(d => {
    const projectMatch = activeProject === 'all' || d.project === activeProject;
    const archiveMatch = showArchive ? d.status === '已归档' : d.status !== '已归档';
    const text = `${d.title} ${d.excerpt} ${d.tags.join(' ')}`.toLowerCase();
    return projectMatch && archiveMatch && (!query || text.includes(query.toLowerCase()));
  }).sort((a, b) => b.id - a.id), [docs, activeProject, query, showArchive]);

  function updateDoc(patch) { setDocs(prev => prev.map(d => d.id === selected.id ? { ...d, ...patch, updated: '刚刚' } : d)); }
  function createDoc() { const doc = { id: Date.now(), project: activeProject === 'all' || activeProject === 'inbox' ? 'product' : activeProject, title: '未命名便笺', excerpt: '开始记录这项工作的背景、思考与下一步。', content: '# 未命名便笺\n\n开始记录这项工作的背景、思考与下一步。\n\n## 下一步\n\n- [ ] ', updated: '刚刚', planned: TODAY, status: '未开始', tags: [], attachments: [] }; setDocs(prev => [doc, ...prev]); setSelectedId(doc.id); setShowArchive(false); }
  function deleteDoc() { if (!selected) return; setDocs(prev => prev.filter(d => d.id !== selected.id)); setSelectedId(visibleDocs.find(d => d.id !== selected.id)?.id || docs.find(d => d.id !== selected.id)?.id); }
  function addProject() { if (!projectDraft.trim()) return; const project = { id: `project-${Date.now()}`, name: projectDraft.trim(), color: '#8ba99b' }; setProjects(prev => [...prev, project]); setActiveProject(project.id); setProjectDraft(''); setShowNewProject(false); }
  function insertMarkdown(prefix, suffix = '') { const area = textareaRef.current; if (!area) return; const start = area.selectionStart; const end = area.selectionEnd; const value = selected.content; const next = value.slice(0, start) + prefix + value.slice(start, end) + suffix + value.slice(end); updateDoc({ content: next }); requestAnimationFrame(() => { area.focus(); area.setSelectionRange(start + prefix.length, end + prefix.length); }); }
  function uploadFiles(event) { const files = [...event.target.files]; if (!files.length) return; updateDoc({ attachments: [...selected.attachments, ...files.map(f => `${f.name} · ${Math.ceil(f.size / 1024)} KB`)] }); }

  return <div className={`app ${mobileSidebar ? 'sidebar-open' : ''}`}>
    <aside className="app-sidebar">
      <div className="brand"><div className="brand-logo"><Sparkles size={16}/></div><div><b>DailyTime</b><span>WORK NOTES</span></div><button className="mobile-close" onClick={() => setMobileSidebar(false)}><X size={18}/></button></div>
      <button className="new-doc" onClick={createDoc}><Plus size={16}/> 新建便笺 <kbd>N</kbd></button>
      <div className="sidebar-label">我的空间 <button onClick={() => setShowNewProject(true)}><Plus size={15}/></button></div>
      <nav>{projects.map(project => <button className={`project-link ${activeProject === project.id && !showArchive ? 'active' : ''}`} key={project.id} onClick={() => { setActiveProject(project.id); setShowArchive(false); setMobileSidebar(false); }}><span className="project-dot" style={{ background: project.color }}/>{project.name}<em>{project.system ? docs.filter(d => d.status !== '已归档').length : docs.filter(d => d.project === project.id && d.status !== '已归档').length}</em></button>)}</nav>
      <div className="sidebar-divider"/>
      <button className={`utility-link ${showArchive ? 'active' : ''}`} onClick={() => { setShowArchive(true); setActiveProject('all'); setMobileSidebar(false); }}><Archive size={15}/> 归档文档 <em>{docs.filter(d => d.status === '已归档').length}</em></button>
      <button className="utility-link"><Tag size={15}/> 标签管理</button>
      <div className="sidebar-bottom"><div className="workspace-tip"><Sparkles size={15}/><div><b>把工作写下来</b><span>让每次回到项目时，都能快速找回上下文。</span></div></div><button className="utility-link"><Settings size={15}/> 设置</button><button className="utility-link"><CircleHelp size={15}/> 帮助</button><div className="user"><div className="user-avatar">H</div><div><b>Huibetter</b><span>个人工作空间</span></div><MoreHorizontal size={16}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileSidebar(true)}><Menu size={20}/></button><div className="crumb"><span>{showArchive ? '归档文档' : projectName(projects, activeProject)}</span><ChevronRight size={14}/><b>{selected?.title || '未命名便笺'}</b></div><div className="top-tools"><label className="search-box"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索文档..."/><kbd>⌘ K</kbd></label><button className="toolbar-icon"><Clock3 size={17}/></button><div className="user-avatar small">H</div></div></header>
      <div className="workspace">
        <section className="doc-list-panel"><div className="list-head"><div><span className="eyebrow">{showArchive ? 'ARCHIVE' : 'DOCUMENTS'}</span><h1>{showArchive ? '归档文档' : projectName(projects, activeProject)}</h1></div><button className="compact-add" onClick={createDoc}><Plus size={16}/></button></div><div className="list-summary">{visibleDocs.length} 篇文档 <button><LayoutList size={15}/><ChevronDown size={14}/></button></div><div className="doc-list">{visibleDocs.map(doc => <button key={doc.id} className={`doc-item ${selected?.id === doc.id ? 'selected' : ''}`} onClick={() => setSelectedId(doc.id)}><div className="doc-item-title"><FileText size={15}/><b>{doc.title}</b></div><p>{doc.excerpt}</p><div className="doc-item-meta"><span>{doc.updated}</span>{doc.planned && <span><CalendarDays size={11}/>{formatDate(doc.planned)}</span>}</div></button>)}{visibleDocs.length === 0 && <div className="no-docs"><Inbox size={22}/><b>还没有文档</b><span>新建一篇便笺，开始积累工作上下文。</span></div>}</div></section>
        <section className="editor-panel">{selected ? <><div className="editor-top"><div className="editor-path"><span className="status-dot" style={{ background: projects.find(p => p.id === selected.project)?.color || '#8ba99b' }}/><span>{projectName(projects, selected.project)}</span><ChevronRight size={13}/><span className="muted">最后编辑于 {selected.updated}</span></div><div className="editor-actions"><label className="upload-btn"><Upload size={15}/> 上传<input type="file" multiple onChange={uploadFiles}/></label><button className="archive-btn" onClick={() => updateDoc({ status: selected.status === '已归档' ? '未开始' : '已归档' })}>{selected.status === '已归档' ? <ArchiveRestore size={15}/> : <Archive size={15}/>} {selected.status === '已归档' ? '恢复' : '归档'}</button><button onClick={deleteDoc} className="danger-icon"><Trash2 size={16}/></button></div></div><div className="editor-toolbar"><button className={editorMode === 'write' ? 'active' : ''} onClick={() => setEditorMode('write')}>编辑</button><button className={editorMode === 'preview' ? 'active' : ''} onClick={() => setEditorMode('preview')}>预览</button><span/><button onClick={() => insertMarkdown('## ')}>H2</button><button onClick={() => insertMarkdown('**', '**')}><b>B</b></button><button onClick={() => insertMarkdown('- [ ] ')}>☑</button><button onClick={() => insertMarkdown('> ')}>❞</button><button onClick={() => insertMarkdown('`', '`')}>˂/˃</button></div><div className="document-wrap">{editorMode === 'write' ? <textarea ref={textareaRef} className="markdown-editor" value={selected.content} onChange={e => updateDoc({ content: e.target.value })} spellCheck="false" /> : <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: markdownToHtml(selected.content) }} />}<div className="document-footer"><div className="tag-row">{selected.tags.map(tag => <span key={tag}><Tag size={11}/>{tag}</span>)}<button onClick={() => updateDoc({ tags: [...selected.tags, '新标签'] })}><Plus size={12}/> 添加标签</button></div><div className="word-count">{selected.content.length} 字符 · 自动保存</div></div></div></> : <div className="no-selection"><FileText size={30}/><h2>选择一篇便笺开始工作</h2><p>把想法、背景、决策和下一步放在同一个地方。</p></div>}</section>
        {selected && <aside className="inspector"><div className="inspector-head"><b>文档信息</b><button><MoreHorizontal size={17}/></button></div><label className="field-label">标题<input value={selected.title} onChange={e => updateDoc({ title: e.target.value, excerpt: e.target.value })}/></label><div className="inspector-status"><span>状态</span><select value={selected.status} onChange={e => updateDoc({ status: e.target.value })}><option>未开始</option><option>进行中</option><option>已完成</option><option>已归档</option></select></div><div className="planner-card"><div className="planner-heading"><div className="planner-icon"><CalendarDays size={16}/></div><div><b>工作规划</b><span>时间是文档的属性，不是文档本身。</span></div></div><label>计划日期<input type="date" value={selected.planned || ''} onChange={e => updateDoc({ planned: e.target.value })}/></label><label>提醒时间<select value={selected.reminder || '不提醒'} onChange={e => updateDoc({ reminder: e.target.value })}><option>不提醒</option><option>当天 09:00</option><option>提前 1 天</option><option>提前 1 周</option></select></label><button className="open-planner" onClick={() => setShowPlanner(!showPlanner)}><Clock3 size={14}/> {showPlanner ? '收起规划' : '查看相关工作规划'}</button>{showPlanner && <div className="planner-list"><span><i/>计划于 {formatDate(selected.planned)} 完成</span><span><i/>当前状态：{selected.status}</span></div>}</div><div className="inspector-block"><div className="block-title"><span>附件</span><label><Plus size={13}/> 添加<input type="file" multiple onChange={uploadFiles}/></label></div>{selected.attachments.length ? selected.attachments.map(file => <div className="attachment" key={file}><File size={15}/><span>{file}</span><MoreHorizontal size={14}/></div>) : <div className="empty-attachment"><Paperclip size={15}/> 暂无附件</div>}</div><div className="inspector-block"><div className="block-title"><span>归档</span></div><p className="archive-copy">完成后的文档可以归档保存，项目列表保持清爽，但内容永远可找回。</p><button className="archive-wide" onClick={() => updateDoc({ status: selected.status === '已归档' ? '未开始' : '已归档' })}>{selected.status === '已归档' ? <><ArchiveRestore size={14}/> 恢复到项目</> : <><Archive size={14}/> 归档这篇文档</>}</button></div></aside>}
      </div>
    </main>
    {showNewProject && <div className="modal-layer" onMouseDown={() => setShowNewProject(false)}><div className="small-modal" onMouseDown={e => e.stopPropagation()}><div className="modal-title"><b>新建工作空间</b><button onClick={() => setShowNewProject(false)}><X size={17}/></button></div><p>用工作空间组织同一项目中的所有文档。</p><input autoFocus value={projectDraft} onChange={e => setProjectDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProject()} placeholder="例如：年度规划"/><div className="modal-buttons"><button onClick={() => setShowNewProject(false)}>取消</button><button className="primary" onClick={addProject}>创建空间</button></div></div></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
