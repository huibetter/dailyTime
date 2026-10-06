import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Info,
  Palette,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Tag,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { isDesktopStorage } from './data/runtime-storage';
import { persistWorkspaceChanges } from './data/repository';
import { workspaceRepository } from './data/workspace-repository';
import { currentSchedule, dayLabel, monthCursor, todayKey } from './lib/date-utils';
import {
  isLocalResourceSupported,
  resolveMarkdownResourceUrls,
  resourceUrl,
  saveLocalResource,
} from './lib/resources';
import { backupToState, parseBackup, serializeBackup } from './lib/backup';
import {
  documentMarkdown,
  documentTitle,
  firstHeading,
  normalizeDocument,
  safeFileName,
} from './lib/document-utils';
import {
  EDITOR_DOCUMENT_VERSION,
  editorStateToMarkdown,
  markdownToEditorState,
  normalizeEditorState,
} from './lib/editor-document';
import { createStructuredEditorExtensions } from './lib/structured-editor';
import {
  EDITOR_FORMAT_DOCUMENT_ID,
  EDITOR_PERFORMANCE_DOCUMENT_ID,
  EDITOR_TEST_PROJECT_ID,
  createEditorTestWorkspace,
  removeEditorTestWorkspace,
} from './lib/editor-test-fixtures';
import './styles.css';

const TODAY = todayKey();
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.1.0';
const APP_COMMIT = import.meta.env.VITE_APP_COMMIT || 'unknown';
const UPDATE_REPO = 'https://github.com/huibetter/dailyTime';
const UPDATE_ENDPOINT = 'https://api.github.com/repos/huibetter/dailyTime/branches/main';
const DEFAULT_PROFILE = { name: '本机用户', workspace: '我的工作空间', avatar: '本' };
function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : fallback;
    return Array.isArray(fallback) ? (Array.isArray(value) ? value : fallback) : value;
  } catch {
    return fallback;
  }
}
function downloadMarkdown(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(filename)}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportDocuments(docs, projectName, filename) {
  const content = docs.map((doc) => documentMarkdown(doc, projectName)).join('\n---\n\n');
  downloadMarkdown(filename, content || `# ${projectName || '项目'}\n\n暂无记录\n`);
}

function App() {
  const [projects, setProjects] = useState([]);
  const [docs, setDocs] = useState([]);
  const [desktopReady, setDesktopReady] = useState(false);
  const desktopHydrated = useRef(false);
  const [project, setProject] = useState(null);
  const [view, setView] = useState('notes');
  const [settingsSection, setSettingsSection] = useState('general');
  const [projectScheduleId, setProjectScheduleId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [projectQuery, setProjectQuery] = useState('');
  const [month, setMonth] = useState(monthCursor);
  const [newProject, setNewProject] = useState(false);
  const [draft, setDraft] = useState('');
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readStored('dt-sidebar-collapsed', false),
  );
  const [timelineWidth, setTimelineWidth] = useState(() => readStored('dt-timeline-width', 224));
  const [openMenu, setOpenMenu] = useState(null);
  const [theme, setTheme] = useState(() => readStored('dt-theme', 'light'));
  const [compact, setCompact] = useState(() => readStored('dt-compact', false));
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  const [profileReady, setProfileReady] = useState(false);
  const [persistence, setPersistence] = useState({ status: 'idle', message: '' });
  const [dirtyDocuments, setDirtyDocuments] = useState([]);
  const [exitPrompt, setExitPrompt] = useState(false);
  const allowClose = useRef(false);
  const uploadInput = useRef(null);
  const menuRef = useRef(null);
  const undoStack = useRef([]);
  const undoConfirm = useRef(null);
  const workspaceRef = useRef({ projects: [], docs: [] });
  const editorDrafts = useRef(new Map());
  const editorSnapshots = useRef(new Map());
  const persistenceState = useRef({
    persisted: { projects: [], docs: [] },
    pending: null,
    running: false,
  });
  useEffect(() => {
    Promise.all([workspaceRepository.loadState(), workspaceRepository.loadSettings()])
      .then(([state, settings]) => {
        const nextProfile = settings || DEFAULT_PROFILE;
        const normalizedDocs = state.docs.map((document) => {
          const normalized = normalizeDocument(document);
          if (normalized.editorState) return normalized;
          return {
            ...normalized,
            editorState: markdownToEditorState(normalized.content),
            contentFormat: 'tiptap-json',
          };
        });
        const migratedState = { projects: state.projects, docs: normalizedDocs };
        workspaceRef.current = migratedState;
        persistenceState.current.persisted = { projects: state.projects, docs: state.docs };
        setProjects(state.projects);
        setDocs(normalizedDocs);
        setProject(state.projects[0]?.id ?? null);
        setSelectedId(state.docs[0]?.id ?? null);
        setProfile(nextProfile);
        desktopHydrated.current = true;
        setDesktopReady(true);
        setProfileReady(true);
        if (normalizedDocs.some((document, index) => !state.docs[index]?.editorState)) {
          persistWorkspaceChanges(workspaceRepository, {
            previous: { projects: state.projects, docs: state.docs },
            next: migratedState,
          })
            .then(() => {
              persistenceState.current.persisted = migratedState;
            })
            .catch((error) => console.error('Markdown 文档迁移失败', error));
        }
        if (!settings && isDesktopStorage())
          workspaceRepository
            .saveSettings(nextProfile)
            .catch((error) => console.error('本机配置迁移失败', error));
      })
      .catch((error) => {
        console.error('DailyTime 数据库初始化失败', error);
        setDesktopReady(true);
        setProfileReady(true);
      });
  }, []);
  function snapshot() {
    return workspaceRef.current;
  }
  function queuePersistence(next) {
    if (!desktopReady || !desktopHydrated.current) return;
    const state = persistenceState.current;
    state.pending = next;
    if (state.running) return;
    state.running = true;
    setPersistence({ status: 'saving', message: '正在保存' });
    const flush = async () => {
      while (state.pending) {
        const target = state.pending;
        state.pending = null;
        await persistWorkspaceChanges(workspaceRepository, {
          previous: state.persisted,
          next: target,
        });
        state.persisted = target;
      }
      state.running = false;
      setPersistence({ status: 'saved', message: '已保存' });
    };
    flush().catch((error) => {
      state.running = false;
      setPersistence({ status: 'error', message: '保存失败' });
      console.error('DailyTime 数据保存失败', error);
    });
  }
  function commit(nextProjects, nextDocs, undoMessage = '') {
    const previous = snapshot();
    const next = { projects: nextProjects, docs: nextDocs };
    workspaceRef.current = next;
    undoStack.current.push({ snapshot: previous, undoMessage });
    if (undoStack.current.length > 80) undoStack.current.shift();
    setProjects(nextProjects);
    setDocs(nextDocs);
    queuePersistence(next);
  }
  function undo() {
    const entry = undoStack.current.pop();
    if (!entry) return;
    if (entry.undoMessage) {
      undoConfirm.current = entry;
      if (!window.confirm(entry.undoMessage)) {
        undoStack.current.push(entry);
        undoConfirm.current = null;
        return;
      }
    }
    const previous = snapshot();
    const next = entry.snapshot;
    workspaceRef.current = next;
    setProjects(next.projects);
    setDocs(next.docs);
    queuePersistence(next);
  }
  useEffect(() => {
    const handleUndo = (event) => {
      const key = event.key.toLowerCase();
      const target = event.target;
      const isFormField =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey && !isFormField) {
        event.preventDefault();
        undo();
      }
    };
    document.addEventListener('keydown', handleUndo);
    return () => document.removeEventListener('keydown', handleUndo);
  });
  useEffect(() => {
    const handleSave = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (selectedId) void saveDocument(selectedId);
    };
    const handleBeforeUnload = (event) => {
      if (!dirtyDocuments.length) return;
      event.preventDefault();
      event.returnValue = '当前有未保存的文档修改。';
    };
    document.addEventListener('keydown', handleSave);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('keydown', handleSave);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dirtyDocuments, selectedId]);
  useEffect(() => {
    if (!isDesktopStorage()) return undefined;
    let disposed = false;
    let unlisten;
    getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (allowClose.current || !dirtyDocuments.length) return;
        event.preventDefault();
        setExitPrompt(true);
      })
      .then((cleanup) => {
        if (disposed) cleanup();
        else unlisten = cleanup;
      })
      .catch((error) => console.error('监听窗口关闭失败', error));
    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [dirtyDocuments]);

  useEffect(
    () => localStorage.setItem('dt-sidebar-collapsed', JSON.stringify(sidebarCollapsed)),
    [sidebarCollapsed],
  );
  useEffect(
    () => localStorage.setItem('dt-timeline-width', JSON.stringify(timelineWidth)),
    [timelineWidth],
  );
  useEffect(() => localStorage.setItem('dt-theme', JSON.stringify(theme)), [theme]);
  useEffect(() => localStorage.setItem('dt-compact', JSON.stringify(compact)), [compact]);
  useEffect(() => {
    if (!profileReady) return;
    if (isDesktopStorage())
      workspaceRepository.saveSettings(profile).catch((error) => {
        setPersistence({ status: 'error', message: '配置保存失败' });
        console.error('本机配置保存失败', error);
      });
    else {
      try {
        localStorage.setItem('dt-profile', JSON.stringify(profile));
      } catch (error) {
        setPersistence({ status: 'error', message: '配置保存失败' });
        console.error('本机配置保存失败', error);
      }
    }
  }, [profile, profileReady]);
  useEffect(() => {
    document.body.dataset.theme = theme;
    document.body.classList.toggle('compact-mode', compact);
  }, [theme, compact]);
  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMobile(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);
  const selected =
    docs.find((d) => d.id === selectedId && d.project === project) ||
    docs.find((d) => d.project === project) ||
    null;
  const projectDocs = useMemo(
    () =>
      docs.filter(
        (d) =>
          d.project === project &&
          (!query ||
            `${d.title} ${d.content} ${(d.tags || []).join(' ')}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [docs, project, query],
  );
  const visibleProjects = useMemo(
    () =>
      projects.filter(
        (item) => !projectQuery || item.name.toLowerCase().includes(projectQuery.toLowerCase()),
      ),
    [projects, projectQuery],
  );
  const updateDoc = (id, patch) => {
    const current = snapshot();
    const next = current.docs.map((d) => {
      if (d.id !== id) return d;
      const nextContent = patch.content ?? d.content;
      return {
        ...d,
        ...patch,
        content: nextContent,
        title: firstHeading(nextContent) || d.title || '未命名便笺',
        updated: '刚刚',
      };
    });
    commit(current.projects, next);
  };
  const update = (patch) => selected && updateDoc(selected.id, patch);
  function updateEditorDraft(id, editorState) {
    const normalized = normalizeEditorState(editorState);
    if (!normalized) return;
    editorDrafts.current.set(id, normalized);
    setDirtyDocuments((items) => {
      if (items.includes(id)) return items;
      setPersistence({ status: 'dirty', message: '有未保存修改' });
      return [...items, id];
    });
  }
  async function saveDocument(id) {
    const original = snapshot().docs.find((item) => item.id === id);
    if (!original) return false;
    const editorState = editorDrafts.current.get(id) || original.editorState;
    const markdown = editorState ? editorStateToMarkdown(editorState) : original.content;
    const savedDraftSnapshot = editorState ? JSON.stringify(editorState) : null;
    const document = {
      ...original,
      editorState,
      contentFormat: editorState ? 'tiptap-json' : original.contentFormat,
      content: markdown,
      title: firstHeading(markdown) || original.title,
      updated: '刚刚',
    };
    setPersistence({ status: 'saving', message: '正在保存' });
    try {
      await workspaceRepository.upsertDocument(document);
      const latestDraft = editorDrafts.current.get(id);
      const draftChanged = latestDraft && JSON.stringify(latestDraft) !== savedDraftSnapshot;
      if (!draftChanged) editorDrafts.current.delete(id);
      const nextDocs = snapshot().docs.map((item) =>
        item.id === id
          ? { ...document, ...(draftChanged ? { editorState: latestDraft } : {}) }
          : item,
      );
      workspaceRef.current = { ...snapshot(), docs: nextDocs };
      setDocs(nextDocs);
      const persisted = persistenceState.current.persisted;
      persistenceState.current.persisted = {
        ...persisted,
        docs: [...persisted.docs.filter((item) => item.id !== id), document],
      };
      if (!draftChanged) {
        setDirtyDocuments((items) => items.filter((item) => item !== id));
        setPersistence({ status: 'saved', message: '已保存' });
      } else {
        setPersistence({ status: 'dirty', message: '保存后仍有新修改' });
      }
      return true;
    } catch (error) {
      setPersistence({ status: 'error', message: '保存失败，请重试' });
      console.error('DailyTime 文档保存失败', error);
      return false;
    }
  }
  async function saveDirtyDocuments() {
    for (const id of dirtyDocuments) {
      if (!(await saveDocument(id))) return false;
    }
    return true;
  }
  async function saveAndClose() {
    if (!(await saveDirtyDocuments())) return;
    allowClose.current = true;
    setExitPrompt(false);
    await getCurrentWindow().close();
  }
  async function discardAndClose() {
    allowClose.current = true;
    setExitPrompt(false);
    await getCurrentWindow().close();
  }
  function deleteDoc(id) {
    const current = snapshot();
    const remaining = current.docs.filter((d) => d.id !== id);
    commit(current.projects, remaining);
    setSelectedId((currentId) =>
      currentId === id ? (remaining.find((d) => d.project === project)?.id ?? null) : currentId,
    );
  }
  function updateEditorTests(regenerate = false) {
    const next = createEditorTestWorkspace(snapshot());
    commit(next.projects, next.docs, regenerate ? '' : '是否撤回编辑器测试项目？');
    setProject(EDITOR_TEST_PROJECT_ID);
    setSelectedId(EDITOR_FORMAT_DOCUMENT_ID);
    setProjectScheduleId(null);
    setView('notes');
    setPersistence({
      status: 'saved',
      message: regenerate ? '测试文档已重新生成' : '测试项目已生成',
    });
  }
  function deleteEditorTests() {
    const next = removeEditorTestWorkspace(snapshot());
    commit(next.projects, next.docs, '是否撤回删除编辑器测试项目？');
    setProject(next.projects[0]?.id ?? null);
    setSelectedId(next.docs[0]?.id ?? null);
    setPersistence({ status: 'saved', message: '测试项目已删除' });
  }
  function closeMenus() {
    setOpenMenu(null);
  }
  function openSettings() {
    setSettingsSection('general');
    setView('settings');
    setMobile(false);
    closeMenus();
  }
  function openProjectNotes(id) {
    setProject(id);
    setProjectScheduleId(null);
    setView('notes');
    setMobile(false);
  }
  function openProjectSchedule(id) {
    setProject(id);
    setProjectScheduleId(id);
    setMonth(monthCursor());
    setView('calendar');
    setMobile(false);
  }
  function openGlobalSchedule() {
    setProjectScheduleId(null);
    setMonth(monthCursor());
    setView('calendar');
    setMobile(false);
  }
  function openDocumentTask(projectId, id) {
    setProject(projectId);
    setProjectScheduleId(null);
    setSelectedId(id);
    setView('notes');
    setMobile(false);
  }
  function create() {
    closeMenus();
    const schedule = currentSchedule();
    const d = {
      id: Date.now(),
      project,
      title: '未命名便笺',
      content: '# 未命名便笺\n\n开始记录这项工作的背景、思考和下一步。\n\n## 下一步\n\n- [ ] ',
      updated: '刚刚',
      planned: schedule.date,
      plannedTime: schedule.time,
      status: '未开始',
      tags: [],
      attachments: [],
    };
    commit(projects, [d, ...docs], `是否撤回新建文档“${d.title}”？`);
    setSelectedId(d.id);
    setProjectScheduleId(null);
    setView('notes');
  }
  function addProject() {
    if (!draft.trim()) return;
    const p = { id: `p-${Date.now()}`, name: draft.trim(), color: '#8ca69b' };
    commit([...projects, p], docs);
    setProject(p.id);
    setSelectedId(null);
    setProjectScheduleId(null);
    setView('notes');
    setDraft('');
    setNewProject(false);
  }
  function confirmDeleteProject() {
    if (!projectToDelete) return;
    const remaining = projects.filter((item) => item.id !== projectToDelete.id);
    commit(
      remaining,
      docs.filter((item) => item.project !== projectToDelete.id),
    );
    if (project === projectToDelete.id) {
      setProject(remaining[0]?.id ?? null);
      setSelectedId(null);
      setProjectScheduleId(null);
      setView('notes');
    }
    setProjectToDelete(null);
  }
  async function importResource(file) {
    if (!isLocalResourceSupported()) {
      setPersistence({ status: 'error', message: '浏览器版不支持导入本地图片，请使用桌面端' });
      return null;
    }
    try {
      return await saveLocalResource(selected.id, file);
    } catch (error) {
      setPersistence({ status: 'error', message: '本地资源保存失败' });
      console.error('DailyTime 本地资源保存失败', error);
      return null;
    }
  }
  async function upload(e) {
    const files = [...e.target.files];
    if (files.length && selected) {
      const resources = (await Promise.all(files.map(importResource))).filter(Boolean);
      if (resources.length) update({ attachments: [...selected.attachments, ...resources] });
    }
    e.target.value = '';
    closeMenus();
  }
  function pasteImage(file, editor) {
    void importResource(file).then((resource) => {
      if (!resource || !selected) return;
      void resourceUrl(resource.relativePath).then((src) =>
        editor
          .chain()
          .focus()
          .setImage({
            src,
            markdownSrc: `dt-resource:${resource.relativePath}`,
            alt: resource.originalName,
            title: resource.originalName,
          })
          .run(),
      );
      update({
        attachments: [...selected.attachments, resource],
      });
    });
  }
  function exportBackup() {
    const backupDocs = docs.map((document) => {
      const editorState =
        editorDrafts.current.get(document.id) ||
        document.editorState ||
        markdownToEditorState(document.content);
      return {
        ...document,
        editorState,
        contentFormat: 'tiptap-json',
        content: editorStateToMarkdown(editorState),
      };
    });
    const content = serializeBackup(
      {
        projects,
        docs: backupDocs,
        profile,
        preferences: { theme, compact, sidebarCollapsed, timelineWidth },
      },
      APP_VERSION,
    );
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DailyTime-${todayKey()}.dailytime`;
    link.click();
    URL.revokeObjectURL(url);
    setPersistence({ status: 'saved', message: '备份已导出' });
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const envelope = parseBackup(await file.text());
      if (
        !window.confirm(
          `确认导入 ${envelope.data.projects.length} 个项目和 ${envelope.data.docs.length} 条记录吗？`,
        )
      )
        return;
      const state = backupToState(envelope);
      commit(state.projects, state.docs, '是否撤回备份导入？');
      setProfile(envelope.data.profile);
      setTheme(envelope.data.preferences.theme);
      setCompact(envelope.data.preferences.compact);
      setSidebarCollapsed(envelope.data.preferences.sidebarCollapsed);
      setTimelineWidth(envelope.data.preferences.timelineWidth);
      setProject(state.projects[0]?.id ?? null);
      setSelectedId(state.docs[0]?.id ?? null);
      setProjectScheduleId(null);
      setView('notes');
    } catch (error) {
      setPersistence({ status: 'error', message: '备份导入失败' });
      console.error('DailyTime 备份导入失败', error);
    }
  }
  function exportSelected() {
    if (selected) {
      const name = projects.find((item) => item.id === selected.project)?.name;
      const draft = editorDrafts.current.get(selected.id);
      const document = draft
        ? { ...selected, editorState: draft, content: editorStateToMarkdown(draft) }
        : selected;
      downloadMarkdown(documentTitle(document), documentMarkdown(document, name));
    }
  }
  const menu = (name, label, Icon, items) => (
    <div className="top-menu">
      <button
        className={`top-menu-trigger ${openMenu === name ? 'active' : ''}`}
        aria-expanded={openMenu === name}
        onClick={() => setOpenMenu(openMenu === name ? null : name)}
      >
        <span>{label}</span>
      </button>
      {openMenu === name && (
        <div className="top-menu-panel" role="menu">
          {items}
        </div>
      )}
    </div>
  );
  if (!desktopReady) return <div className="app-loading">正在打开 DailyTime…</div>;
  return (
    <div
      className={`app ${mobile ? 'mobile-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
    >
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <div className="sidebar-copy">
            <b>DailyTime</b>
            <small>项目管理器</small>
          </div>
          <button className="mobile-close" aria-label="关闭侧边栏" onClick={() => setMobile(false)}>
            <X size={17} />
          </button>
        </div>
        <div className="side-title">
          <span className="sidebar-copy">项目</span>
          <button aria-label="新建项目" onClick={() => setNewProject(true)}>
            <Plus size={15} />
          </button>
        </div>
        <label className="project-search">
          <Search size={12} />
          <input
            value={projectQuery}
            onChange={(event) => setProjectQuery(event.target.value)}
            placeholder="检索项目名称"
            aria-label="检索项目名称"
          />
        </label>
        <div className="projects">
          {visibleProjects.map((p) => (
            <React.Fragment key={p.id}>
              <div className={`project-row ${project === p.id ? 'active' : ''}`}>
                <button
                  className="project-select"
                  title={p.name}
                  onClick={() => openProjectNotes(p.id)}
                >
                  <i style={{ background: p.color }} />
                  <span className="sidebar-copy">{p.name}</span>
                  <em className="sidebar-copy">{docs.filter((d) => d.project === p.id).length}</em>
                </button>
                <button
                  className="project-export"
                  aria-label={`导出${p.name}`}
                  title="导出项目记录"
                  onClick={(event) => {
                    event.stopPropagation();
                    exportDocuments(
                      docs.filter((d) => d.project === p.id),
                      p.name,
                      p.name,
                    );
                  }}
                >
                  <Download size={13} />
                </button>
                <button
                  className="project-delete"
                  aria-label={`删除项目${p.name}`}
                  title="删除项目"
                  onClick={(event) => {
                    event.stopPropagation();
                    setProjectToDelete(p);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {project === p.id && !sidebarCollapsed && (
                <div className="sidebar-subprojects">
                  {docs
                    .filter((doc) => doc.project === p.id)
                    .map((doc) => (
                      <button
                        key={doc.id}
                        className={`sidebar-subproject ${selectedId === doc.id ? 'active' : ''}`}
                        title={documentTitle(doc)}
                        onClick={() => openDocumentTask(p.id, doc.id)}
                      >
                        <FileText size={12} />
                        <span>{documentTitle(doc)}</span>
                      </button>
                    ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="side-divider" />
        <div className="view-links">
          <button
            className={view === 'calendar' && !projectScheduleId ? 'active' : ''}
            title="总项目排期"
            onClick={openGlobalSchedule}
          >
            <CalendarDays size={15} />
            <span className="sidebar-copy">总项目排期</span>
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar" ref={menuRef}>
          <div className="topbar-left">
            <button
              className="sidebar-toggle"
              aria-label="切换侧边栏"
              title="切换侧边栏"
              onClick={() => {
                if (window.matchMedia('(max-width: 920px)').matches) setMobile(!mobile);
                else setSidebarCollapsed(!sidebarCollapsed);
              }}
            >
              <PanelLeft size={17} />
            </button>
            <button
              className={`top-menu-trigger ${view === 'settings' ? 'active' : ''}`}
              onClick={openSettings}
            >
              设置
            </button>
            {menu(
              'edit',
              '编辑',
              null,
              <>
                <button
                  className="top-menu-item"
                  role="menuitem"
                  onClick={() => {
                    undo();
                    closeMenus();
                  }}
                >
                  撤回上次修改
                </button>
                <button
                  className="top-menu-item"
                  role="menuitem"
                  onClick={() => window.alert('快捷键：N 新建文档，⌘/Ctrl + K 搜索')}
                >
                  快捷键说明
                </button>
              </>,
            )}
            {projects.length > 0 &&
              menu(
                'switch',
                '切换',
                null,
                <>
                  <button
                    className={`top-menu-item ${view === 'notes' && !projectScheduleId ? 'selected' : ''}`}
                    role="menuitem"
                    onClick={() => {
                      setProjectScheduleId(null);
                      setView('notes');
                      closeMenus();
                    }}
                  >
                    {projects.find((p) => p.id === project)?.name || '当前项目'} · 项目文档
                  </button>
                  <button
                    className={`top-menu-item ${view === 'calendar' && projectScheduleId === project ? 'selected' : ''}`}
                    role="menuitem"
                    onClick={() => {
                      setProjectScheduleId(project);
                      setMonth(monthCursor());
                      setView('calendar');
                      closeMenus();
                    }}
                  >
                    {projects.find((p) => p.id === project)?.name || '当前项目'} · 项目排期
                  </button>
                </>,
              )}
          </div>
          <div className="top-right">
            <span
              className={`save-status save-status-${persistence.status}`}
              role="status"
              aria-live="polite"
              title={persistence.message}
            >
              {persistence.status === 'saving' && '保存中…'}
              {persistence.status === 'dirty' && '未保存'}
              {persistence.status === 'saved' && '已保存'}
              {persistence.status === 'error' && '保存失败'}
            </span>
            {view !== 'settings' && (
              <label className="search">
                <Search size={15} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索项目文档"
                />
              </label>
            )}
            <input ref={uploadInput} type="file" multiple hidden onChange={upload} />
            <div className="user-menu">
              <button
                className="user-avatar"
                aria-label="打开本机配置"
                aria-expanded={openMenu === 'user'}
                onClick={() => setOpenMenu(openMenu === 'user' ? null : 'user')}
              >
                {profile?.avatar || '?'}
              </button>
              {openMenu === 'user' && (
                <div className="top-menu-panel user-panel" role="menu">
                  <div className="user-summary">
                    <b>{profile?.name || '本机用户'}</b>
                    <small>{profile?.workspace || '我的工作空间'}</small>
                  </div>
                  <button className="top-menu-item" role="menuitem" onClick={openSettings}>
                    <UserRound size={14} />
                    本机配置
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {view === 'settings' ? (
          <SettingsPage
            {...{
              section: settingsSection,
              setSection: setSettingsSection,
              profile,
              setProfile,
              theme,
              setTheme,
              compact,
              setCompact,
              onExportBackup: exportBackup,
              onImportBackup: importBackup,
              hasEditorTests: projects.some((item) => item.id === EDITOR_TEST_PROJECT_ID),
              onGenerateEditorTests: () => updateEditorTests(false),
              onRegenerateEditorTests: () => updateEditorTests(true),
              onDeleteEditorTests: deleteEditorTests,
              onBack: () => {
                setView('notes');
                closeMenus();
              },
            }}
          />
        ) : view === 'notes' ? (
          project ? (
            <NotesView
              {...{
                projects,
                project,
                projectDocs,
                selected,
                setSelectedId,
                create,
                editorDrafts,
                editorSnapshots,
                update,
                updateEditorDraft,
                deleteDoc,
                exportSelected,
                upload,
                pasteImage,
                dirtyDocuments,
                saveDocument,
                timelineWidth,
                setTimelineWidth,
              }}
            />
          ) : (
            <EmptyWorkspace onCreate={() => setNewProject(true)} />
          )
        ) : (
          <Calendar
            {...{
              projects,
              docs,
              month,
              setMonth,
              onTaskClick: openDocumentTask,
              projectFilter: projectScheduleId,
            }}
          />
        )}
      </main>
      {newProject && (
        <div className="modal" onMouseDown={() => setNewProject(false)}>
          <div className="modal-box" onMouseDown={(e) => e.stopPropagation()}>
            <div>
              <b>新建项目</b>
              <button onClick={() => setNewProject(false)}>
                <X size={16} />
              </button>
            </div>
            <p>项目用于组织目标、文档与执行节奏，并在排期中查看安排。</p>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProject()}
              placeholder="例如：年度规划"
            />
            <footer>
              <button onClick={() => setNewProject(false)}>取消</button>
              <button onClick={addProject}>创建项目</button>
            </footer>
          </div>
        </div>
      )}
      {projectToDelete && (
        <div className="modal" onMouseDown={() => setProjectToDelete(null)}>
          <div className="modal-box project-delete-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div>
              <b>删除项目</b>
              <button onClick={() => setProjectToDelete(null)}>
                <X size={16} />
              </button>
            </div>
            <p>
              确定删除“{projectToDelete.name}”吗？该项目中的{' '}
              {docs.filter((item) => item.project === projectToDelete.id).length}{' '}
              份文档及其关联数据将被永久删除。
            </p>
            <footer>
              <button onClick={() => setProjectToDelete(null)}>取消</button>
              <button className="danger-action" onClick={confirmDeleteProject}>
                删除项目
              </button>
            </footer>
          </div>
        </div>
      )}
      {exitPrompt && (
        <div className="modal" onMouseDown={() => setExitPrompt(false)}>
          <div className="modal-box" onMouseDown={(event) => event.stopPropagation()}>
            <div>
              <b>有未保存的修改</b>
              <button onClick={() => setExitPrompt(false)}>
                <X size={16} />
              </button>
            </div>
            <p>关闭 DailyTime 前，是否保存当前未保存的文档？</p>
            <footer>
              <button onClick={() => setExitPrompt(false)}>取消</button>
              <button className="danger-action" onClick={() => void discardAndClose()}>
                放弃退出
              </button>
              <button className="primary-action" onClick={() => void saveAndClose()}>
                保存并退出
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
function EmptyWorkspace({ onCreate }) {
  return (
    <section className="empty-workspace">
      <div>
        <span className="brand-mark">✦</span>
        <h1>还没有项目</h1>
        <p>从一个项目开始，记录目标、文档和执行节奏。</p>
        <button onClick={onCreate}>
          <Plus size={16} />
          新建项目
        </button>
      </div>
    </section>
  );
}
function SettingsPage({
  section,
  setSection,
  profile,
  setProfile,
  theme,
  setTheme,
  compact,
  setCompact,
  onExportBackup,
  onImportBackup,
  hasEditorTests,
  onGenerateEditorTests,
  onRegenerateEditorTests,
  onDeleteEditorTests,
  onBack,
}) {
  const [update, setUpdate] = useState({ status: 'idle' });
  const backupInput = useRef(null);
  async function checkUpdate() {
    setUpdate({ status: 'checking' });
    try {
      const response = await fetch(UPDATE_ENDPOINT, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) throw new Error(`GitHub API ${response.status}`);
      const branch = await response.json();
      const sha = branch.commit?.sha;
      if (!sha) throw new Error('远程分支信息不完整');
      const same = APP_COMMIT !== 'unknown' && APP_COMMIT === sha;
      setUpdate({
        status: same ? 'latest' : 'available',
        sha,
        message: branch.commit?.commit?.message || 'main 分支最新提交',
      });
    } catch (error) {
      console.error('检查更新失败', error);
      setUpdate({ status: 'error' });
    }
  }
  const sections = [
    { id: 'general', label: '通用', description: '账户与工作空间', Icon: UserRound },
    { id: 'appearance', label: '外观', description: '主题与布局', Icon: Palette },
    { id: 'backup', label: '备份', description: '导出与恢复', Icon: Download },
    { id: 'editor-tests', label: '编辑器测试', description: '格式与性能验收', Icon: FileText },
    { id: 'about', label: '关于', description: '版本与更新', Icon: Info },
  ];
  return (
    <div className="settings-page">
      <aside className="settings-nav">
        <button className="settings-back" onClick={onBack}>
          <ArrowLeft size={15} />
          返回工作区
        </button>
        <div className="settings-nav-title">
          <Settings2 size={17} />
          <div>
            <b>设置</b>
            <small>DailyTime</small>
          </div>
        </div>
        <nav aria-label="设置分类">
          {sections.map(({ id, label, description, Icon }) => (
            <button
              key={id}
              className={section === id ? 'active' : ''}
              onClick={() => setSection(id)}
            >
              <Icon size={16} />
              <span>
                <b>{label}</b>
                <small>{description}</small>
              </span>
            </button>
          ))}
        </nav>
      </aside>
      <section className="settings-content">
        {section === 'general' && (
          <>
            <div className="settings-heading">
              <small>GENERAL</small>
              <h1>通用</h1>
              <p>管理你的本机身份和工作空间信息。</p>
            </div>
            <div className="settings-section">
              <div className="settings-section-heading">
                <UserRound size={17} />
                <div>
                  <h2>本机配置</h2>
                  <p>这些信息只保存在当前设备中。</p>
                </div>
              </div>
              <label className="settings-field">
                名称
                <input
                  value={profile?.name || ''}
                  onChange={(e) =>
                    setProfile((value) => ({
                      ...value,
                      name: e.target.value,
                      avatar: e.target.value.trim().slice(0, 1).toUpperCase() || '?',
                    }))
                  }
                  placeholder="例如：Huibetter"
                />
              </label>
              <label className="settings-field">
                工作空间
                <input
                  value={profile?.workspace || ''}
                  onChange={(e) => setProfile((value) => ({ ...value, workspace: e.target.value }))}
                  placeholder="例如：我的工作空间"
                />
              </label>
            </div>
          </>
        )}
        {section === 'backup' && (
          <>
            <div className="settings-heading">
              <small>BACKUP</small>
              <h1>备份</h1>
              <p>导出当前工作区，或从 `.dailytime` 文件恢复本地数据。</p>
            </div>
            <div className="settings-section">
              <div className="settings-section-heading">
                <Download size={17} />
                <div>
                  <h2>工作区备份</h2>
                  <p>备份包含项目、文档、标签、配置和界面偏好。</p>
                </div>
              </div>
              <div className="settings-actions">
                <button className="primary-action" onClick={onExportBackup}>
                  <Download size={14} />
                  导出备份
                </button>
                <input
                  ref={backupInput}
                  type="file"
                  accept=".dailytime,application/json"
                  hidden
                  onChange={onImportBackup}
                />
                <button className="secondary-action" onClick={() => backupInput.current?.click()}>
                  <Upload size={14} />
                  导入备份
                </button>
              </div>
              <small className="settings-hint">
                导入前会校验文件格式，并要求确认覆盖当前工作区。
              </small>
            </div>
          </>
        )}{' '}
        {section === 'editor-tests' && (
          <>
            <div className="settings-heading">
              <small>EDITOR VALIDATION</small>
              <h1>编辑器测试</h1>
              <p>生成可重复使用的格式覆盖与长文档性能测试内容。</p>
            </div>
            <div className="settings-section">
              <div className="settings-section-heading">
                <FileText size={17} />
                <div>
                  <h2>测试项目</h2>
                  <p>包含核心 Markdown 格式示例和 200 段长文档，不修改其他项目。</p>
                </div>
              </div>
              <div className="settings-actions">
                {hasEditorTests ? (
                  <>
                    <button className="primary-action" onClick={onRegenerateEditorTests}>
                      <RefreshCw size={14} />
                      重新生成测试文档
                    </button>
                    <button className="secondary-action" onClick={onDeleteEditorTests}>
                      <Trash2 size={14} />
                      删除测试项目
                    </button>
                  </>
                ) : (
                  <button className="primary-action" onClick={onGenerateEditorTests}>
                    <Plus size={14} />
                    生成编辑器测试项目
                  </button>
                )}
              </div>
            </div>
          </>
        )}
        {section === 'appearance' && (
          <>
            <div className="settings-heading">
              <small>APPEARANCE</small>
              <h1>外观</h1>
              <p>调整 DailyTime 在当前设备上的显示方式。</p>
            </div>
            <div className="settings-section">
              <div className="settings-section-heading">
                <Palette size={17} />
                <div>
                  <h2>主题</h2>
                  <p>选择应用使用的颜色主题。</p>
                </div>
              </div>
              <div className="theme-options">
                {[
                  ['light', '浅色'],
                  ['system', '跟随系统'],
                  ['dark', '深色'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={theme === value ? 'selected' : ''}
                    onClick={() => setTheme(value)}
                  >
                    <span className={`theme-preview ${value}`} />
                    <b>{label}</b>
                    {theme === value && <Check size={15} />}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-section">
              <div className="settings-row">
                <div>
                  <h2>紧凑模式</h2>
                  <p>减少列表与导航中的垂直间距。</p>
                </div>
                <button
                  className={`settings-toggle ${compact ? 'on' : ''}`}
                  role="switch"
                  aria-checked={compact}
                  onClick={() => setCompact((value) => !value)}
                >
                  <span />
                </button>
              </div>
            </div>
          </>
        )}
        {section === 'about' && (
          <>
            <div className="settings-heading">
              <small>ABOUT</small>
              <h1>关于</h1>
              <p>查看 DailyTime 版本并检查远程主分支。</p>
            </div>
            <div className="settings-section about-card">
              <div className="about-brand">
                <span className="brand-mark">✦</span>
                <div>
                  <h2>DailyTime</h2>
                  <p>项目管理器</p>
                </div>
                <strong>v{APP_VERSION}</strong>
              </div>
              <div className="about-details">
                <div>
                  <span>代码仓库</span>
                  <a href={UPDATE_REPO} target="_blank" rel="noreferrer">
                    huibetter/dailyTime <ExternalLink size={12} />
                  </a>
                </div>
                <div>
                  <span>更新目标</span>
                  <b>origin/main</b>
                </div>
                <div>
                  <span>本地构建</span>
                  <b>{APP_COMMIT === 'unknown' ? '未记录提交' : APP_COMMIT.slice(0, 7)}</b>
                </div>
              </div>
              <div className="update-panel">
                <div>
                  <div className="update-icon">
                    <RefreshCw size={16} />
                  </div>
                  <div>
                    <h2>检查更新</h2>
                    <p>
                      {update.status === 'checking'
                        ? '正在检查 origin/main…'
                        : update.status === 'latest'
                          ? '当前已是 main 最新提交。'
                          : update.status === 'available'
                            ? `main 有新的提交：${update.message}`
                            : update.status === 'error'
                              ? '暂时无法连接 GitHub，请稍后重试。'
                              : '检查远程 main 分支是否有新的提交。'}
                    </p>
                    {(update.status === 'available' ||
                      update.status === 'latest' ||
                      update.status === 'remote') &&
                      update.sha && <small>远程提交 {update.sha.slice(0, 7)}</small>}
                  </div>
                </div>
                <button
                  className="primary-action"
                  disabled={update.status === 'checking'}
                  onClick={checkUpdate}
                >
                  <RefreshCw size={14} className={update.status === 'checking' ? 'spin' : ''} />
                  {update.status === 'checking' ? '检查中' : '检查更新'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
function MarkdownEditor({ selected, editorState, editorSnapshots, updateEditorDraft, pasteImage }) {
  const surfaceRef = useRef(null);
  const editor = useEditor(
    {
      extensions: createStructuredEditorExtensions(),
      content: editorState || selected.editorState || markdownToEditorState(selected.content),
      onCreate: ({ editor: current }) => {
        const snapshot = editorSnapshots.current.get(selected.id);
        if (!snapshot) return;
        try {
          current.commands.setTextSelection(snapshot.selection);
        } catch {
          editorSnapshots.current.delete(selected.id);
          return;
        }
        requestAnimationFrame(() => {
          if (surfaceRef.current) surfaceRef.current.scrollTop = snapshot.scrollTop;
        });
      },
      onSelectionUpdate: ({ editor: current }) => {
        editorSnapshots.current.set(selected.id, {
          selection: {
            anchor: current.state.selection.anchor,
            head: current.state.selection.head,
          },
          scrollTop: surfaceRef.current?.scrollTop || 0,
        });
      },
      onUpdate: ({ editor: current }) => {
        updateEditorDraft(selected.id, {
          type: 'doc',
          version: EDITOR_DOCUMENT_VERSION,
          ...current.getJSON(),
        });
      },
      editorProps: {
        attributes: {
          class: 'tiptap-document',
          'aria-label': 'Markdown 文档编辑器',
          spellcheck: 'false',
        },
        handlePaste: (_view, event) => {
          const imageItem = [...(event.clipboardData?.items || [])].find((item) =>
            item.type.startsWith('image/'),
          );
          if (!imageItem) return false;
          const file = imageItem.getAsFile();
          if (file) pasteImage(file, editor);
          return true;
        },
      },
      immediatelyRender: false,
    },
    [selected.id],
  );
  const imageInput = useRef(null);

  useEffect(() => {
    if (!editor) return undefined;
    let active = true;
    const source = editorStateToMarkdown(editor.getJSON());
    resolveMarkdownResourceUrls(source).then((resolved) => {
      if (!active) return;
      const sources = [...resolved.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
      [...editor.view.dom.querySelectorAll('img')].forEach((image, index) => {
        if (sources[index]) image.setAttribute('src', sources[index]);
      });
    });
    return () => {
      active = false;
    };
  }, [editor, selected.id]);

  if (!editor) return <div className="markdown-editor-surface" />;

  const buttons = [
    [
      'H1',
      () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      editor.isActive('heading', { level: 1 }),
    ],
    [
      'H2',
      () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      editor.isActive('heading', { level: 2 }),
    ],
    ['B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold')],
    ['I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic')],
    ['S', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike')],
    ['</>', () => editor.chain().focus().toggleCode().run(), editor.isActive('code')],
    ['引用', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote')],
    ['列表', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList')],
    ['1.', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList')],
    ['任务', () => editor.chain().focus().toggleTaskList().run(), editor.isActive('taskList')],
    ['代码块', () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock')],
    ['分隔线', () => editor.chain().focus().setHorizontalRule().run(), false],
  ];

  return (
    <div className="markdown-editor-surface markdown-live-editor" ref={surfaceRef}>
      <div className="structured-editor-toolbar" role="toolbar" aria-label="格式工具栏">
        {buttons.map(([label, action, active]) => (
          <button
            key={label}
            type="button"
            className={active ? 'active' : ''}
            title={label}
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={action}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => imageInput.current?.click()}
        >
          图片
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const href = window.prompt('输入链接地址');
            if (href) editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
          }}
        >
          链接
        </button>
      </div>
      <input
        type="file"
        accept="image/*"
        hidden
        value=""
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) pasteImage(file, editor);
        }}
        ref={imageInput}
      />
      <EditorContent editor={editor} />
    </div>
  );
}
function NotesView({
  projects,
  project,
  projectDocs,
  selected,
  setSelectedId,
  create,
  editorDrafts,
  editorSnapshots,
  update,
  updateEditorDraft,
  deleteDoc,
  exportSelected,
  upload,
  pasteImage,
  dirtyDocuments,
  saveDocument,
  timelineWidth,
  setTimelineWidth,
}) {
  const projectName = projects.find((p) => p.id === project)?.name || '未命名项目';
  const groups = projectDocs.reduce((all, d) => {
    const key = d.planned || 'none';
    (all[key] ??= []).push(d);
    return all;
  }, {});
  const ordered = Object.entries(groups).sort(([a], [b]) =>
    a === 'none' ? 1 : b === 'none' ? -1 : b.localeCompare(a),
  );
  ordered.forEach(([, items]) =>
    items.sort((a, b) => (b.plannedTime || '00:00').localeCompare(a.plannedTime || '00:00')),
  );
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const tagManagerRef = useRef(null);
  const layoutRef = useRef(null);
  const resizing = useRef(false);

  useEffect(() => {
    const close = (e) => {
      if (tagManagerRef.current && !tagManagerRef.current.contains(e.target))
        setTagManagerOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  function handleTaskKeyDown(doc, e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedId(doc.id);
    }
  }
  function removeTask(doc, e) {
    e.stopPropagation();
    if (window.confirm('确定删除“' + documentTitle(doc) + '”吗？')) deleteDoc(doc.id);
  }
  function addTag() {
    const value = tagDraft.trim();
    if (!value || selected.tags.includes(value)) return;
    update({ tags: [...selected.tags, value] });
    setTagDraft('');
  }
  function startTagEdit(tag) {
    setEditingTag(tag);
    setEditingTagValue(tag);
  }
  function saveTagEdit(tag) {
    const value = editingTagValue.trim();
    if (value && value !== tag && !selected.tags.includes(value))
      update({ tags: selected.tags.map((item) => (item === tag ? value : item)) });
    setEditingTag(null);
    setEditingTagValue('');
  }
  function removeTag(tag) {
    if (window.confirm('确定删除标签“' + tag + '”吗？'))
      update({ tags: selected.tags.filter((item) => item !== tag) });
  }
  function resizeTimeline(e) {
    if (!layoutRef.current) return;
    const rect = layoutRef.current.getBoundingClientRect();
    const next = Math.min(420, Math.max(180, e.clientX - rect.left));
    setTimelineWidth(next);
  }
  function startTimelineResize(e) {
    e.preventDefault();
    resizing.current = true;
    const move = (nextEvent) => {
      if (resizing.current) resizeTimeline(nextEvent);
    };
    const stop = () => {
      resizing.current = false;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
    resizeTimeline(e);
  }
  function handleResizeKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setTimelineWidth((value) =>
        Math.min(420, Math.max(180, value + (e.key === 'ArrowLeft' ? -10 : 10))),
      );
    }
  }
  return (
    <div
      className="notes-layout"
      ref={layoutRef}
      style={{ '--timeline-width': `${timelineWidth}px` }}
    >
      <section className="note-list">
        <div className="list-heading">
          <div>
            <small>PROJECT DOCUMENTS</small>
            <h1>{projectName}</h1>
          </div>
          <button onClick={create}>
            <Plus size={16} />
          </button>
        </div>
        <div className="note-count">{projectDocs.length} 份项目文档 · 按计划日期</div>
        <div className="note-timeline">
          {ordered.map(([date, items]) => (
            <div className="timeline-group" key={date}>
              <div className="timeline-date">
                <span className="timeline-node" />
                <b>{date === 'none' ? '未安排' : dayLabel(date)}</b>
                {date !== 'none' && <small>{date}</small>}
              </div>
              <div className="timeline-notes">
                {items.map((d) => (
                  <article
                    className={`note-item ${selected?.id === d.id ? 'selected' : ''}`}
                    key={d.id}
                  >
                    <button
                      className="note-select"
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      onKeyDown={(e) => handleTaskKeyDown(d, e)}
                    >
                      <div className="note-title-row">
                        <FileText size={14} />
                        <b>{documentTitle(d)}</b>
                      </div>
                      <p>
                        {d.content
                          .replace(/^#\s+.*(?:\r?\n|$)/m, '')
                          .replace(/[#>*\-\[\]]/g, '')
                          .trim()
                          .slice(0, 65)}
                      </p>
                    </button>
                    <div className="note-meta-row">
                      <small>
                        {d.plannedTime || '未设置时间'} · {d.updated}
                        {d.status === '已完成' && ' · 已完成'}
                      </small>
                      <button
                        className="note-delete"
                        type="button"
                        aria-label={`删除${documentTitle(d)}`}
                        title="删除项目日程"
                        onClick={(e) => removeTask(d, e)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <button
        className="timeline-resizer"
        aria-label="调整时间线宽度"
        title="拖动调整时间线宽度"
        role="separator"
        onPointerDown={startTimelineResize}
        onKeyDown={handleResizeKeyDown}
      />
      <section className="editor">
        {selected && (
          <>
            <div className="editor-head">
              <span>
                <i style={{ background: projects.find((p) => p.id === selected.project)?.color }} />
                {projects.find((p) => p.id === selected.project)?.name}
              </span>
              <div className="editor-actions">
                <button className="editor-export" onClick={exportSelected} title="导出当前记录">
                  <Download size={14} /> 导出
                </button>
                <div className="editor-tags" ref={tagManagerRef}>
                  <div className="tag-chips">
                    {selected.tags.map((t) => (
                      <span key={t}>
                        <Tag size={10} />
                        {t}
                      </span>
                    ))}
                  </div>
                  <button
                    className="tag-manager-trigger"
                    onClick={() => setTagManagerOpen((value) => !value)}
                  >
                    <Tag size={11} />
                    {selected.tags.length ? '标签' : '添加标签'}
                  </button>
                  {tagManagerOpen && (
                    <div className="tag-manager-panel">
                      <strong>管理标签</strong>
                      <div className="tag-manager-list">
                        {selected.tags.map((tag) => (
                          <div className="tag-manager-row" key={tag}>
                            {editingTag === tag ? (
                              <input
                                autoFocus
                                value={editingTagValue}
                                onChange={(e) => setEditingTagValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    saveTagEdit(tag);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingTag(null);
                                    setEditingTagValue('');
                                  }
                                }}
                                onBlur={() => saveTagEdit(tag)}
                              />
                            ) : (
                              <span>
                                <Tag size={10} />
                                {tag}
                              </span>
                            )}
                            <div>
                              {editingTag === tag ? (
                                <button aria-label="保存标签" onClick={() => saveTagEdit(tag)}>
                                  <Check size={12} />
                                </button>
                              ) : (
                                <button
                                  aria-label={`编辑标签${tag}`}
                                  onClick={() => startTagEdit(tag)}
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                              <button aria-label={`删除标签${tag}`} onClick={() => removeTag(tag)}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="tag-add-row">
                        <input
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTag();
                            }
                          }}
                          placeholder="新增标签"
                        />
                        <button aria-label="添加标签" onClick={addTag}>
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <label>
                  <Upload size={14} /> 上传
                  <input type="file" multiple onChange={upload} />
                </label>
                <button
                  onClick={() =>
                    update({ status: selected.status === '已完成' ? '未开始' : '已完成' })
                  }
                >
                  {selected.status === '已完成' ? <Check size={14} /> : <Clock3 size={14} />}{' '}
                  {selected.status === '已完成' ? '已完成' : '标记完成'}
                </button>
              </div>
            </div>
            <div className="paper">
              <MarkdownEditor
                selected={selected}
                editorState={editorDrafts.current.get(selected.id)}
                editorSnapshots={editorSnapshots}
                updateEditorDraft={updateEditorDraft}
                pasteImage={pasteImage}
              />
              <div className="paper-foot">
                <small>
                  {selected.content.length} 字符 ·{' '}
                  {dirtyDocuments.includes(selected.id) ? '未保存修改 · Ctrl+S 保存' : '已保存'}
                </small>
                <button
                  type="button"
                  onClick={() => void saveDocument(selected.id)}
                  disabled={!dirtyDocuments.includes(selected.id)}
                >
                  保存
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
function Calendar({ projects, docs, month, setMonth, onTaskClick, projectFilter }) {
  const { year, month: monthIndex } = month;
  const first = new Date(year, monthIndex, 1).getDay(),
    total = new Date(year, monthIndex + 1, 0).getDate(),
    cells = Array.from({ length: first + total }, (_, i) => (i < first ? null : i - first + 1));
  const visibleProjects = projectFilter ? projects.filter((p) => p.id === projectFilter) : projects;
  const visibleDocs = projectFilter ? docs.filter((d) => d.project === projectFilter) : docs;
  const scheduledDocs = visibleDocs.filter((d) => d.planned);
  const projectName = visibleProjects[0]?.name;
  return (
    <div className="page">
      <div className="page-head calendar-head">
        <div>
          <small>PROJECT SCHEDULE</small>
          <h1>{projectFilter ? projectName : '总项目排期'}</h1>
          <p>
            {projectFilter
              ? '仅显示当前项目的计划，点击日程返回项目文档。'
              : '显示所有项目的计划，点击日程返回对应项目文档。'}
          </p>
        </div>
        <div className="month">
          <button
            onClick={() =>
              setMonth((value) => {
                const date = new Date(value.year, value.month - 1, 1);
                return { year: date.getFullYear(), month: date.getMonth() };
              })
            }
          >
            <ChevronLeft size={17} />
          </button>
          <b>
            {year} 年 {monthIndex + 1} 月
          </b>
          <button
            onClick={() =>
              setMonth((value) => {
                const date = new Date(value.year, value.month + 1, 1);
                return { year: date.getFullYear(), month: date.getMonth() };
              })
            }
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="legend">
        {visibleProjects.map((p) => (
          <span key={p.id}>
            <i style={{ background: p.color }} />
            {p.name}
          </span>
        ))}
      </div>
      <div className="calendar">
        <div className="weekdays">
          {['日', '一', '二', '三', '四', '五', '六'].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((day, i) => {
            const date = day
              ? `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              : '';
            const items = scheduledDocs.filter((d) => d.planned === date);
            return (
              <div className={`cell ${date === TODAY ? 'today' : ''}`} key={i}>
                <b>{day}</b>
                {items.map((d) => {
                  const p = projects.find((x) => x.id === d.project);
                  return (
                    <button
                      key={d.id}
                      style={{ borderLeftColor: p?.color }}
                      onClick={() => onTaskClick(d.project, d.id)}
                    >
                      <i style={{ background: p?.color }} />
                      {d.title}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        {!scheduledDocs.length && (
          <p className="calendar-empty">{projectFilter ? '当前项目暂无排期' : '暂无项目排期'}</p>
        )}
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
