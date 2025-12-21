import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { open } from '@tauri-apps/plugin-dialog';
import {
  getSettings,
  saveSettings,
  resetSettings,
  getSyncFolders,
  addSyncFolder,
  removeSyncFolder,
  indexDirectories,
} from '@/services/api';
import type { SyncFolder } from '@/services/api';
import { useTheme } from '@/hooks/useTheme';
import type { AppSettings, ThemeMode } from '@/types';

// 设置分类配置 - 使用Material Symbols图标
const settingsSections = [
  { id: 'sync', label: '文件夹同步', icon: 'folder_managed' },
  { id: 'appearance', label: '外观', icon: 'contrast' },
  { id: 'scan', label: '照片扫描', icon: 'image_search' },
  { id: 'thumbnail', label: '缩略图', icon: 'photo_size_select_large' },
  { id: 'performance', label: '性能', icon: 'speed' },
];

function SettingsPage() {
  const { theme: currentTheme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [syncFolders, setSyncFolders] = useState<SyncFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState('sync');
  
  // 各区块的 ref
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    void loadSettings();
    void loadSyncFolders();
  }, []);

  // 监听滚动，更新当前活动区块
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const container = e.target as HTMLElement;
      const scrollTop = container.scrollTop;
      
      let currentSection = 'sync';
      for (const section of settingsSections) {
        const el = sectionRefs.current[section.id];
        if (el && el.offsetTop - 100 <= scrollTop) {
          currentSection = section.id;
        }
      }
      setActiveSection(currentSection);
    };

    const contentArea = document.getElementById('settings-content');
    if (contentArea) {
      contentArea.addEventListener('scroll', handleScroll);
      return () => contentArea.removeEventListener('scroll', handleScroll);
    }
  }, [loading]);

  const scrollToSection = (sectionId: string) => {
    const el = sectionRefs.current[sectionId];
    const container = document.getElementById('settings-content');
    if (el && container) {
      container.scrollTo({
        top: el.offsetTop - 24,
        behavior: 'smooth'
      });
    }
    setActiveSection(sectionId);
  };

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      // 使用前端 useTheme 的主题状态，而非后端保存的主题
      // 因为 useTheme 通过 localStorage 持久化，是实时的主题状态
      setSettings({ ...data, theme: currentTheme });
    } catch (err) {
      showMessage('error', `加载设置失败: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncFolders = async () => {
    try {
      const folders = await getSyncFolders();
      setSyncFolders(folders);
    } catch (err) {
      console.error('加载同步文件夹失败:', err);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      showMessage('success', '设置已保存');
    } catch (err) {
      showMessage('error', `保存失败: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('确定要重置所有设置为默认值吗？')) return;
    setSaving(true);
    try {
      const defaults = await resetSettings();
      setSettings(defaults);
      setTheme(defaults.theme);
      showMessage('success', '设置已重置为默认值');
    } catch (err) {
      showMessage('error', `重置失败: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (theme: ThemeMode) => {
    if (!settings) return;
    const newSettings = { ...settings, theme };
    setSettings(newSettings);
    setTheme(theme);
    // 立即保存主题到后端，确保同步
    try {
      await saveSettings(newSettings);
    } catch (err) {
      console.error('保存主题设置失败:', err);
    }
  };

  const handleAddSyncFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择要同步的文件夹',
      });

      if (selected && typeof selected === 'string') {
        await addSyncFolder(selected);
        await loadSyncFolders();
        showMessage('success', '文件夹已添加到同步列表');
      }
    } catch (err) {
      showMessage('error', `添加文件夹失败: ${err}`);
    }
  };

  const handleRemoveSyncFolder = async (folderPath: string) => {
    try {
      await removeSyncFolder(folderPath);
      await loadSyncFolders();
      showMessage('success', '文件夹已从同步列表移除');
    } catch (err) {
      showMessage('error', `移除文件夹失败: ${err}`);
    }
  };

  const handleSyncNow = async () => {
    if (syncFolders.length === 0) {
      showMessage('error', '请先添加要同步的文件夹');
      return;
    }

    setSyncing(true);
    try {
      const folderPaths = syncFolders.filter((f) => f.isValid).map((f) => f.path);
      if (folderPaths.length === 0) {
        showMessage('error', '没有有效的同步文件夹');
        return;
      }
      const result = await indexDirectories(folderPaths);
      showMessage('success', `同步完成：索引 ${result.indexed} 张照片，跳过 ${result.skipped} 张`);
    } catch (err) {
      showMessage('error', `同步失败: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex h-full items-center justify-center bg-surface rounded-xl">
        <div className="text-center text-on-surface-variant">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-surface rounded-xl flex flex-col overflow-hidden">
      {message && (
        <div
          className={clsx(
            'fixed top-6 right-6 z-50 rounded-xl px-6 py-3 shadow-lg backdrop-blur-md animate-in slide-in-from-right-4 duration-300',
            message.type === 'success'
              ? 'bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-200'
              : 'bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-200'
          )}
        >
          {message.text}
        </div>
      )}

      {/* 页面头部 */}
      <div className="p-6 pb-0">
        <h2 className="text-4xl font-black leading-tight tracking-tight text-on-surface">设置</h2>
        <p className="pt-1 text-base font-normal leading-normal text-on-surface-variant">
          管理您的应用程序设置和偏好。
        </p>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-row gap-8 p-6 min-h-0 overflow-hidden">
        {/* 左侧设置导航 */}
        <aside className="w-56 flex-shrink-0 self-start">
          <nav className="flex flex-col gap-2">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                  activeSection === section.id
                    ? 'bg-button text-on-surface'
                    : 'text-on-surface-variant hover:bg-button/60'
                )}
              >
                <span className="material-symbols-outlined text-xl">{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </nav>

          {/* 底部操作按钮 */}
          <div className="pt-6 mt-6 border-t border-outline/30 space-y-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full btn btn-primary h-10"
            >
              {saving ? '保存中...' : '保存设置'}
            </button>
            <button
              onClick={handleReset}
              disabled={saving}
              className="w-full btn btn-secondary h-10"
            >
              恢复默认设置
            </button>
          </div>
        </aside>

        {/* 右侧内容区域 */}
        <main id="settings-content" className="flex-1 h-full min-h-0 overflow-y-auto pr-2">
          <div className="max-w-4xl space-y-6">
            {/* Folder Sync */}
            <section 
              ref={(el) => { sectionRefs.current['sync'] = el; }}
              className="card p-6"
            >
              <h3 className="text-lg font-semibold text-on-surface">文件夹同步</h3>
              <p className="text-sm text-on-surface-variant mb-4">管理自动扫描新照片的文件夹。</p>
              
              {/* 同步文件夹列表 */}
              <div className="flex flex-col gap-3">
                {syncFolders.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-outline/40 py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl opacity-40 mb-3">folder_off</span>
                    <p className="text-sm">尚未添加同步文件夹</p>
                  </div>
                ) : (
                  syncFolders.map((folder) => (
                    <div
                      key={folder.path}
                      className={clsx(
                        'group flex items-center justify-between gap-4 rounded-xl p-4 transition-all',
                        folder.isValid
                          ? 'bg-button hover:bg-outline/40'
                          : 'bg-red-50 dark:bg-red-900/20'
                      )}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <span className={clsx(
                          'material-symbols-outlined filled text-2xl',
                          folder.isValid ? 'text-primary' : 'text-red-400'
                        )}>folder</span>
                        <div className="flex flex-col min-w-0 flex-1">
                          <p className="font-medium text-on-surface truncate">
                            {folder.path}
                          </p>
                          {!folder.isValid && (
                            <p className="text-sm text-red-500">文件夹不存在或无法访问</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSyncFolder(folder.path)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-button hover:text-red-500"
                        title="移除文件夹"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add folder and sync buttons */}
              <div className="mt-4 flex flex-col items-start gap-3">
                <button
                  type="button"
                  onClick={handleAddSyncFolder}
                  className="btn btn-primary h-9 px-4 gap-2"
                >
                  <span className="material-symbols-outlined text-xl">add</span>
                  <span>添加文件夹</span>
                </button>
                
                {syncFolders.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSyncNow}
                    disabled={syncing}
                    className="btn btn-secondary h-9 px-4 gap-2"
                  >
                    {syncing ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span>同步中...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xl">sync</span>
                        <span>立即同步 ({syncFolders.length} 个文件夹)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </section>

            {/* Appearance */}
            <section 
              ref={(el) => { sectionRefs.current['appearance'] = el; }}
              className="card p-6"
            >
              <h3 className="text-lg font-semibold text-on-surface">外观</h3>
              <p className="text-sm text-on-surface-variant mb-4">选择应用程序的外观。系统模式将跟随您的操作系统设置。</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(['light', 'dark', 'system'] as ThemeMode[]).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => handleThemeChange(theme)}
                    className={clsx(
                      'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors',
                      currentTheme === theme
                        ? 'border-primary'
                        : 'border-transparent hover:border-outline'
                    )}
                  >
                    <div className={clsx(
                      'h-16 w-full rounded-lg border shadow-inner',
                      theme === 'light' && 'border-outline/40 bg-white',
                      theme === 'dark' && 'border-gray-700 bg-gray-900',
                      theme === 'system' && 'border-outline/40 bg-gradient-to-br from-white from-50% to-gray-900 to-50%'
                    )}></div>
                    <span className={clsx(
                      'font-medium',
                      currentTheme === theme ? 'text-primary' : 'text-on-surface-variant'
                    )}>
                      {theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Photo Scanning */}
            <section 
              ref={(el) => { sectionRefs.current['scan'] = el; }}
              className="card overflow-hidden"
            >
              <div className="p-6 pb-2">
                <h3 className="text-lg font-semibold text-on-surface">照片扫描</h3>
                <p className="text-sm text-on-surface-variant">配置应用程序如何查找和处理您的照片。</p>
              </div>
              <div className="divide-y divide-outline/30">
                <div className="flex items-center justify-between p-4 pl-6">
                  <div>
                    <p className="font-medium text-on-surface">启动时扫描新照片</p>
                    <p className="text-sm text-on-surface-variant">应用打开时自动检查同步文件夹。</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.scan.autoScan}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          scan: { ...settings.scan, autoScan: e.target.checked },
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-button after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-outline/30 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 pl-6">
                  <div>
                    <p className="font-medium text-on-surface">递归扫描子文件夹</p>
                    <p className="text-sm text-on-surface-variant">扫描时包含所有嵌套文件夹。</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.scan.recursive}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          scan: { ...settings.scan, recursive: e.target.checked },
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-button after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-outline/30 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20"></div>
                  </label>
                </div>
              </div>
            </section>

            {/* Thumbnails */}
            <section 
              ref={(el) => { sectionRefs.current['thumbnail'] = el; }}
              className="card p-6"
            >
              <h3 className="text-lg font-semibold text-on-surface">缩略图</h3>
              <p className="text-sm text-on-surface-variant mb-6">配置缩略图生成和缓存设置。</p>
              <div className="flex flex-col gap-6">
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="font-medium text-on-surface">缓存大小限制</label>
                    <span className="text-sm text-on-surface-variant">{settings.thumbnail.cacheSizeMb} MB</span>
                  </div>
                  <p className="text-sm text-on-surface-variant mb-3">较大的缓存可以加快浏览速度，但会占用更多磁盘空间。</p>
                  <input
                    type="range"
                    min="100"
                    max="10000"
                    step="100"
                    value={settings.thumbnail.cacheSizeMb}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        thumbnail: { ...settings.thumbnail, cacheSizeMb: parseInt(e.target.value) || 1024 },
                      })
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-button accent-primary"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="font-medium text-on-surface">缩略图质量</label>
                    <span className="text-sm text-on-surface-variant">{settings.thumbnail.quality}%</span>
                  </div>
                  <p className="text-sm text-on-surface-variant mb-3">更高的质量生成更清晰的缩略图，但会占用更多存储空间。</p>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={settings.thumbnail.quality}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        thumbnail: { ...settings.thumbnail, quality: parseInt(e.target.value) },
                      })
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-button accent-primary"
                  />
                </div>
              </div>
            </section>

            {/* Performance */}
            <section 
              ref={(el) => { sectionRefs.current['performance'] = el; }}
              className="card p-6"
            >
              <h3 className="text-lg font-semibold text-on-surface">性能</h3>
              <p className="text-sm text-on-surface-variant mb-6">调整设置以优化应用程序的速度和资源使用。</p>
              <div className="flex flex-col gap-6">
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="font-medium text-on-surface">扫描线程数</label>
                    <span className="text-sm text-on-surface-variant">{settings.performance.scanThreads === 0 ? '自动' : settings.performance.scanThreads}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant mb-3">用于扫描照片的线程数。设置为 0 则自动设置。</p>
                  <input
                    type="range"
                    min="0"
                    max="16"
                    value={settings.performance.scanThreads}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        performance: { ...settings.performance, scanThreads: parseInt(e.target.value) || 0 },
                      })
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-button accent-primary"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="font-medium text-on-surface">缩略图线程数</label>
                    <span className="text-sm text-on-surface-variant">{settings.performance.thumbnailThreads === 0 ? '自动' : settings.performance.thumbnailThreads}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant mb-3">用于生成缩略图的线程数。设置为 0 则自动设置。</p>
                  <input
                    type="range"
                    min="0"
                    max="16"
                    value={settings.performance.thumbnailThreads}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        performance: { ...settings.performance, thumbnailThreads: parseInt(e.target.value) || 0 },
                      })
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-button accent-primary"
                  />
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default SettingsPage;
