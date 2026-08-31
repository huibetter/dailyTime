import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, FileText, Menu, MoreHorizontal, Paperclip, Plus, Search, Settings, Tag, Upload, X, Trash2, Download, Palette } from 'lucide-react';
import './styles.css';
import type { Attachment, DocumentItem, DocumentStatus, Project } from './types/domain';
import { attachmentRepository, backupRepository, documentRepository, projectRepository } from './services/repositories';
import { addDays, currentSchedule, dayLabel, displayUpdated, nextAction, sortDocumentsByPlan, todayIso } from './utils/domain';
import { markdownFallback, renderMarkdown } from './utils/markdown';

const statuses: DocumentStatus[] = ['未开始', '进行中', '已完成'];

function excerpt(content: string) {
  return content.replace(/[#>*\-\[\]`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 70) || '暂无内容';
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [projectId, setProjectId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState<'notes' | 'calendar'>('notes');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [month, setMonth] = useState(new Date().getMonth());
  const [newProject, setNewProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState('');
  const [projectMenu, setProjectMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const reload = async () => {
    setBusy(true);
    console.info('[DailyTime] runtime:', (window as Window & { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }).__TAURI_INTERNALS__ || (window as Window & { __TAURI__?: unknown }).__TAURI__ ? 'tauri' : 'web');
    console.info('[DailyTime] loading projects and documents');
    try {
      const [nextProjects, nextDocs] = await Promise.all([projectRepository.list(), documentRepository.list()]);
      setProjects(nextProjects);
      setDocs(nextDocs);
      setProjectId((current) => nextProjects.some((p) => p.id === current) ? current : nextProjects[0]?.id ?? '');
      setSelectedId((current) => nextDocs.some((d) => d.id === current) ? current : nextDocs[0]?.id ?? '');
      console.info('[DailyTime] loaded project count:', nextProjects.length, 'document count:', nextDocs.length);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载数据失败');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);



  const currentProject = projects.find((project) => project.id === projectId) ?? projects[0];
  const selected = docs.find((doc) => doc.id === selectedId && doc.projectId === currentProject?.id) ?? docs.find((doc) => doc.projectId === currentProject?.id) ?? docs[0];
  const projectDocs = useMemo(() => sortDocumentsByPlan(docs.filter((doc) => doc.projectId === currentProject?.id && (!query || `${doc.title} ${doc.content} ${doc.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())))), [docs, currentProject?.id, query]);
  if (busy && projects.length === 0 && docs.length === 0) {
    return <StartupError title="DailyTime 正在启动" detail="正在初始化本地工作区…" onRetry={() => void reload()} />;
  }

  if (error && projects.length === 0 && docs.length === 0) {
    return <StartupError title="DailyTime 启动失败" detail={error} onRetry={() => void reload()} />;
  }

  const updateDocument = async (patch: Partial<Omit<DocumentItem, 'id' | 'createdAt' | 'attachments'>>) => {
    if (!selected) return;
    try {
      const updated = await documentRepository.update(selected.id, patch);
      setDocs((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
  };

  const createDocument = async () => {
    if (!currentProject) return;
    const created = await documentRepository.create(currentProject.id);
    setDocs((items) => [created, ...items]);
    setSelectedId(created.id);
    setView('notes');
    setMode('write');
  };

  const createProject = async () => {
    if (!projectDraft.trim()) return;
    const created = await projectRepository.create(projectDraft.trim());
    setProjects((items) => [...items, created]);
    setProjectId(created.id);
    setProjectDraft('');
    setNewProject(false);
  };

  const updateProject = async (patch: Partial<Pick<Project, 'name' | 'color'>>) => {
    if (!currentProject) return;
    const updated = await projectRepository.update(currentProject.id, patch);
    setProjects((items) => items.map((item) => item.id === updated.id ? updated : item));
  };

  const insert = (before: string, after = '') => {
    if (!selected || !area.current) return;
    const input = area.current;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    void updateDocument({ content: `${selected.content.slice(0, start)}${before}${selected.content.slice(start, end)}${after}${selected.content.slice(end)}` });
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + before.length, end + before.length); });
  };

  const addFile = async (file: File, kind: Attachment['kind'] = 'attachment') => {
    if (!selected) return;
    try {
      const attachment = await attachmentRepository.add(selected.id, file, kind);
      const content = kind === 'image' ? `${selected.content}\n\n![${attachment.originalName}](${attachment.relativePath})\n` : selected.content;
      const updated = await documentRepository.update(selected.id, { content });
      setDocs((items) => items.map((item) => item.id === selected.id ? { ...item, ...updated, attachments: [...item.attachments, attachment] } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : '附件保存失败'); }
  };

  const onPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const item = [...(event.clipboardData.items ?? [])].find((entry) => entry.type.startsWith('image/'));
    if (!item) return;
    event.preventDefault();
    const file = item.getAsFile();
    if (file) void addFile(file, 'image');
  };

  const onDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    for (const file of [...event.dataTransfer.files]) void addFile(file, file.type.startsWith('image/') ? 'image' : 'attachment');
  };

  return <div className={`app-shell ${mobileOpen ? 'mobile-open' : ''}`}>
    <aside className="sidebar"><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={17}/></button>
      <div className="brand"><span className="brand-mark">✦</span><div><b>DailyTime</b><small>项目管理器</small></div></div>
      <div className="side-actions"><button className={view === 'notes' ? 'active' : ''} onClick={() => setView('notes')}><FileText size={15}/>文档</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={15}/>项目排期</button></div>
      <div className="project-title"><span>项目空间</span><button onClick={() => setNewProject(true)} title="新建项目"><Plus size={14}/></button></div>
      <div className="projects">{projects.map((project) => <div className={`project-row ${currentProject?.id === project.id ? 'selected' : ''}`} key={project.id}><button onClick={() => { setProjectId(project.id); setProjectMenu(null); }}><i style={{ background: project.color }}/>{project.name}<small>{docs.filter((doc) => doc.projectId === project.id).length}</small></button><button className="icon-btn" onClick={() => setProjectMenu(projectMenu === project.id ? null : project.id)}><MoreHorizontal size={14}/></button>{projectMenu === project.id && <div className="project-menu"><label>项目名称<input value={project.name} onChange={(event) => void updateProject({ name: event.target.value })} onBlur={() => setProjectMenu(null)}/></label><label>颜色<input type="color" value={project.color} onChange={(event) => void projectRepository.update(project.id, { color: event.target.value }).then((updated) => setProjects((items) => items.map((item) => item.id === updated.id ? updated : item)))}/></label></div>}</div>)}</div>
      <div className="sidebar-foot"><button onClick={() => void backupRepository.export()}><Download size={14}/>导出备份</button><button title="设置"><Settings size={14}/></button></div>
    </aside>
    <main className="main"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={17}/></button><div className="search"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目文档、标签或内容"/></div><span className="save-state">{busy ? '正在加载…' : error ? error : '本地自动保存'}</span></header>
      {view === 'calendar' ? <Calendar projects={projects} docs={docs} month={month} setMonth={setMonth} onOpen={(id, pid) => { setProjectId(pid); setSelectedId(id); setView('notes'); }}/> : <div className="notes-layout"><section className="note-list"><div className="list-heading"><div><small>PROJECT DOCUMENTS</small><h1>{currentProject?.name ?? '项目文档'}</h1></div><button onClick={() => void createDocument()}><Plus size={16}/></button></div><div className="project-summary"><div><b>{projectDocs.length}</b><small>文档</small></div><div><b>{projectDocs.filter((doc) => doc.status === '已完成').length}</b><small>已完成</small></div><div><b>{projectDocs.filter((doc) => doc.plannedDate).length}</b><small>已排期</small></div></div><div className="project-next">下一项 <strong>{nextAction(projectDocs)?.title ?? '暂无待推进事项'}</strong></div><div className="note-count">{projectDocs.length} 份项目文档 · 按计划日期</div><div className="note-timeline">{Object.entries(projectDocs.reduce<Record<string, DocumentItem[]>>((groups, doc) => { const key = doc.plannedDate ?? 'none'; (groups[key] ??= []).push(doc); return groups; }, {})).map(([date, items]) => <div className="timeline-group" key={date}><div className="timeline-date"><span className="timeline-node"/><b>{date === 'none' ? '未安排' : dayLabel(date)}</b>{date !== 'none' && <small>{date}</small>}</div><div className="timeline-notes">{items.map((doc) => <button className={`note-item ${selected?.id === doc.id ? 'selected' : ''}`} key={doc.id} onClick={() => setSelectedId(doc.id)}><div><FileText size={14}/><b>{doc.title}</b></div><p>{excerpt(doc.content)}</p><small>{doc.plannedTime ?? '未设置时间'} · {displayUpdated(doc.updatedAt)}{doc.status === '已完成' && ' · 已完成'}</small></button>)}</div></div>)}</div></section><Editor selected={selected} projects={projects} mode={mode} setMode={setMode} area={area} update={updateDocument} insert={insert} onPaste={onPaste} onDrop={onDrop} addFile={addFile} onDelete={async () => { if (!selected || !window.confirm('确定删除这篇文档吗？')) return; await documentRepository.delete(selected.id); const remaining = docs.filter((doc) => doc.id !== selected.id); setDocs(remaining); setSelectedId(remaining.find((doc) => doc.projectId === currentProject?.id)?.id ?? ''); }} /></div>}
    </main>
    {newProject && <div className="modal"><div className="modal-box"><div><b>新建项目</b><button onClick={() => setNewProject(false)}><X size={16}/></button></div><p>项目用于承载一组具有共同背景和节奏的文档。</p><input autoFocus value={projectDraft} onChange={(event) => setProjectDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createProject(); }}/><footer><button onClick={() => setNewProject(false)}>取消</button><button onClick={() => void createProject()}>创建项目</button></footer></div></div>}
  </div>;
}

function Editor({ selected, projects, mode, setMode, area, update, insert, onPaste, onDrop, addFile, onDelete }: { selected?: DocumentItem; projects: Project[]; mode: 'write' | 'preview'; setMode: React.Dispatch<React.SetStateAction<'write' | 'preview'>>; area: React.RefObject<HTMLTextAreaElement | null>; update: (patch: Partial<Omit<DocumentItem, 'id' | 'createdAt' | 'attachments'>>) => Promise<void>; insert: (before: string, after?: string) => void; onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void; onDrop: (event: React.DragEvent<HTMLTextAreaElement>) => void; addFile: (file: File, kind?: Attachment['kind']) => Promise<void>; onDelete: () => Promise<void> }) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    let active = true;
    if (selected) {
      void renderMarkdown(selected.content)
        .then((html) => { if (active) setPreview(html); })
        .catch((cause) => {
          console.error('[DailyTime] markdown preview failed', cause);
          if (active) setPreview(markdownFallback(selected.content));
        });
    }
    return () => { active = false; };
  }, [selected?.content]);
  if (!selected) return <section className="editor empty-editor"><FileText size={30}/><p>选择或创建一篇文档开始记录。</p></section>;
  const project = projects.find((item) => item.id === selected.projectId);
  return <section className="editor"><div className="editor-head"><span><i style={{ background: project?.color }}/>{project?.name}</span><div><label><Upload size={14}/>上传<input type="file" multiple onChange={(event) => { for (const file of [...(event.target.files ?? [])]) void addFile(file); event.currentTarget.value = ''; }}/></label><button onClick={() => void update({ status: selected.status === '已完成' ? '未开始' : '已完成' })}>{selected.status === '已完成' ? <Check size={14}/> : <Clock3 size={14}/>} {selected.status === '已完成' ? '已完成' : '标记完成'}</button><button className="danger-btn" onClick={() => void onDelete()}><Trash2 size={14}/></button></div></div><div className="document-meta"><input className="title-input" value={selected.title} onChange={(event) => void update({ title: event.target.value })}/><div className="meta-fields"><label>状态<select value={selected.status} onChange={(event) => void update({ status: event.target.value as DocumentStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label>计划日期<input type="date" value={selected.plannedDate ?? ''} onChange={(event) => void update({ plannedDate: event.target.value || null })}/></label><label>时间<input type="time" value={selected.plannedTime ?? ''} onChange={(event) => void update({ plannedTime: event.target.value || null })}/></label></div></div><div className="format-bar"><button className={mode === 'write' ? 'on' : ''} onClick={() => setMode('write')}>编辑</button><button className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')}>预览</button><span/><button onClick={() => insert('## ')}>H2</button><button onClick={() => insert('**', '**')}><b>B</b></button><button onClick={() => insert('- [ ] ')}>☑</button><button onClick={() => insert('> ')}>❞</button><button onClick={() => insert('`', '`')}>˂/˃</button></div><div className="paper">{mode === 'write' ? <textarea ref={area} value={selected.content} onChange={(event) => void update({ content: event.target.value })} onPaste={onPaste} onDrop={onDrop} onDragOver={(event) => event.preventDefault()} placeholder="记录项目背景、阶段结论、会议纪要和下一步行动……"/> : <div className="preview" dangerouslySetInnerHTML={{ __html: preview }}/>}<div className="paper-foot"><div>{selected.tags.map((tag) => <span key={tag}><Tag size={10}/>{tag}</span>)}<button onClick={() => void update({ tags: [...selected.tags, '新标签'] })}><Plus size={11}/>标签</button></div><small>{selected.content.length} 字符 · 自动保存</small></div></div>{selected.attachments.length > 0 && <div className="attachments"><b><Paperclip size={13}/>附件</b>{selected.attachments.map((attachment) => <span key={attachment.id}>{attachment.originalName} · {Math.ceil(attachment.size / 1024)} KB</span>)}</div>}</section>;
}

function Calendar({ projects, docs, month, setMonth, onOpen }: { projects: Project[]; docs: DocumentItem[]; month: number; setMonth: React.Dispatch<React.SetStateAction<number>>; onOpen: (id: string, projectId: string) => void }) {
  const year = new Date().getFullYear();
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: first + total }, (_, index) => index < first ? null : index - first + 1);
  return <div className="page"><div className="page-head calendar-head"><div><small>PROJECT SCHEDULE</small><h1>项目排期</h1><p>每种颜色代表一个项目，点击项目文档直接回到编辑。</p></div><div className="month"><button onClick={() => setMonth((value) => Math.max(0, value - 1))}><ChevronLeft size={17}/></button><b>{year} 年 {month + 1} 月</b><button onClick={() => setMonth((value) => Math.min(11, value + 1))}><ChevronRight size={17}/></button></div></div><div className="legend">{projects.map((project) => <span key={project.id}><i style={{ background: project.color }}/>{project.name}</span>)}</div><div className="calendar"><div className="weekdays">{['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day, index) => { const date = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''; const items = docs.filter((doc) => doc.plannedDate === date); return <div className={`cell ${date === todayIso() ? 'today' : ''}`} key={`${date}-${index}`}><b>{day}</b>{items.map((doc) => { const project = projects.find((item) => item.id === doc.projectId); return <button key={doc.id} style={{ borderLeftColor: project?.color }} onClick={() => onOpen(doc.id, doc.projectId)}><i style={{ background: project?.color }}/>{doc.title}</button>; })}</div>; })}</div></div></div>;
}

function StartupError({ title, detail, onRetry }: { title: string; detail: string; onRetry: () => void }) {
  return <div className="startup-error"><div className="startup-error-card"><span className="brand-mark">✦</span><h1>{title}</h1><p>无法加载本地工作区数据，请重试。</p><code>{detail}</code><button onClick={onRetry}>重新加载</button></div></div>;
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return <StartupError title="DailyTime 页面渲染失败" detail={this.state.error.message} onRetry={() => window.location.reload()} />;
    return this.props.children;
  }
}

export default function Root() {
  return <AppErrorBoundary><App /></AppErrorBoundary>;
}
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('DailyTime 无法找到 React 挂载节点 #root');
}
console.info('[DailyTime] React mount start');
createRoot(rootElement).render(<Root />);
