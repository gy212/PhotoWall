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
  getAutoScanStatus,
  getDirectoryScanStates,
  startAutoScan,
  stopAutoScan,
  resetDirectoryScanFrequency,
  checkOcrAvailable,
  getOcrStats,
  getOcrProgress,
  startOcrProcessing,
  stopOcrProcessing,
  resetFailedOcr,
} from '@/services/api';
import type { SyncFolder, AutoScanStatus, DirectoryScanState } from '@/services/api';
import type { AppSettings, OcrStats, OcrProgress } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { Icon, IconName } from '@/components/common/Icon';

// 设置分类配置 - 使用Material Symbols图标
const settingsSections = [
  { id: 'sync', label: '文件夹同步', icon: 'folder_managed' },
  { id: 'appearance', label: '外观', icon: 'contrast' },
  { id: 'scan', label: '照片扫描', icon: 'image_search' },
  { id: 'ocr', label: '文字识别', icon: 'text_fields' },
  { id: 'thumbnail', label: '缩略图', icon: 'photo_size_select_large' },
  { id: 'performance', label: '性能', icon: 'speed' },
];

// Helper: HSL to Hex
const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// Helper: Hex to Hue (approximated)
const hexToHue = (hex: string) => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else if (hex.length === 7) {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  }
  r /= 255;
  g /= 255;
  b /= 255;
  const cmin = Math.min(r,g,b),
        cmax = Math.max(r,g,b),
        delta = cmax - cmin;
  let h = 0;
  
  if (delta === 0) h = 0;
  else if (cmax === r) h = ((g - b) / delta) % 6;
  else if (cmax === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return h;
}

function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [syncFolders, setSyncFolders] = useState<SyncFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanIntervalOpen, setScanIntervalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState('sync');
  const [autoScanStatus, setAutoScanStatus] = useState<AutoScanStatus | null>(null);
  const [directoryScanStates, setDirectoryScanStates] = useState<DirectoryScanState[]>([]);
  const [ocrAvailable, setOcrAvailable] = useState<boolean | null>(null);
  const [ocrStats, setOcrStats] = useState<OcrStats | null>(null);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);

  // Store actions
  const {
    themeColor,
    setThemeColor,
    theme,
    setTheme,
    highRefreshUi,
    setHighRefreshUi,
  } = useSettingsStore();

  // Local Hue State
  const [hue, setHue] = useState(15); // Default Terracotta

  // 各区块的 ref
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    void loadSettings();
    void loadSyncFolders();
    void loadAutoScanStatus();
    void loadOcrStatus();
  }, []);

  // Sync hue from themeColor when loaded
  useEffect(() => {
    if (themeColor) {
        setHue(hexToHue(themeColor));
    }
  }, [themeColor]);

  // 监听滚动，更新当前活动区块
  useEffect(() => {
    const handleScroll = () => {
      const container = document.getElementById('settings-content');
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      // 检查是否滚动到底部 (给予 5px 误差)
      if (Math.abs(scrollHeight - clientHeight - scrollTop) <= 5) {
        setActiveSection(settingsSections[settingsSections.length - 1].id);
        return;
      }

      // 使用 getBoundingClientRect 计算相对位置
      let currentSection = 'sync';
      for (const section of settingsSections) {
        const el = sectionRefs.current[section.id];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= containerRect.top + 100) {
            currentSection = section.id;
          }
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
      setSettings(data);

      // 同步 Store 中的外观设置
      if (data.appearance?.themeColor) {
        setThemeColor(data.appearance.themeColor);
      }
      if (data.theme) {
          setTheme(data.theme);
      }
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

  const loadAutoScanStatus = async () => {
    try {
      const [status, states] = await Promise.all([
        getAutoScanStatus(),
        getDirectoryScanStates(),
      ]);
      setAutoScanStatus(status);
      setDirectoryScanStates(states);
    } catch (err) {
      console.error('加载自动扫描状态失败:', err);
    }
  };

  const loadOcrStatus = async () => {
    try {
      const [available, stats, progress] = await Promise.all([
        checkOcrAvailable(),
        getOcrStats(),
        getOcrProgress(),
      ]);
      setOcrAvailable(available);
      setOcrStats(stats);
      setOcrProgress(progress);
      setOcrProcessing(progress.isRunning);
    } catch (err) {
      console.error('加载 OCR 状态失败:', err);
      setOcrAvailable(false);
    }
  };

  const handleStartOcr = async () => {
    try {
      setOcrProcessing(true);
      const progress = await startOcrProcessing();
      setOcrProgress(progress);
      showMessage('success', 'OCR 处理已启动');
      // 定期刷新进度
      const interval = setInterval(async () => {
        try {
          const newProgress = await getOcrProgress();
          setOcrProgress(newProgress);
          if (!newProgress.isRunning) {
            clearInterval(interval);
            setOcrProcessing(false);
            await loadOcrStatus();
            showMessage('success', 'OCR 处理完成');
          }
        } catch {
          clearInterval(interval);
          setOcrProcessing(false);
        }
      }, 2000);
    } catch (err) {
      setOcrProcessing(false);
      showMessage('error', `启动 OCR 失败: ${err}`);
    }
  };

  const handleStopOcr = async () => {
    try {
      await stopOcrProcessing();
      setOcrProcessing(false);
      await loadOcrStatus();
      showMessage('success', 'OCR 处理已停止');
    } catch (err) {
      showMessage('error', `停止 OCR 失败: ${err}`);
    }
  };

  const handleResetFailedOcr = async () => {
    try {
      const count = await resetFailedOcr();
      await loadOcrStatus();
      showMessage('success', `已重置 ${count} 张失败的照片`);
    } catch (err) {
      showMessage('error', `重置失败: ${err}`);
    }
  };

  const handleToggleAutoScan = async () => {
    try {
      if (autoScanStatus?.running) {
        await stopAutoScan();
        showMessage('success', '自动扫描服务已停止');
      } else {
        await startAutoScan();
        showMessage('success', '自动扫描服务已启动');
      }
      await loadAutoScanStatus();
    } catch (err) {
      showMessage('error', `操作失败: ${err}`);
    }
  };

  const handleResetScanFrequency = async (dirPath: string) => {
    try {
      await resetDirectoryScanFrequency(dirPath);
      await loadAutoScanStatus();
      showMessage('success', '扫描频率已重置');
    } catch (err) {
      showMessage('error', `重置失败: ${err}`);
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
      // 构造包含外观设置的完整设置对象
      const settingsToSave = {
        ...settings,
        theme: theme,
        appearance: {
          themeColor: themeColor,
          fontSizeScale: 1.0, // Default for now
        }
      };
      await saveSettings(settingsToSave);
      showMessage('success', '设置已保存');
      await loadAutoScanStatus();
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
      if (defaults.appearance) {
         setThemeColor(defaults.appearance.themeColor);
      }
      if (defaults.theme) {
          setTheme(defaults.theme);
      }
      showMessage('success', '设置已重置为默认值');
    } catch (err) {
      showMessage('error', `重置失败: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleHueChange = (newHue: number) => {
      setHue(newHue);
      const hex = hslToHex(newHue, 64, 60); // Keep saturation/lightness consistent
      setThemeColor(hex);
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
        await loadAutoScanStatus();
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
      await loadAutoScanStatus();
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
      <div className="flex h-full items-center justify-center glass-panel rounded-xl">
        <div className="text-center text-white/70">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-400 border-t-transparent mx-auto" />
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background rounded-xl flex flex-col overflow-hidden text-primary">
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
        <h2 className="text-2xl font-semibold leading-tight tracking-tight text-primary">设置</h2>
        <p className="pt-1 text-sm font-normal leading-normal text-secondary">
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
                    ? 'bg-primary/10 text-primary shadow-sm border border-primary/20'
                    : 'text-secondary hover:bg-surface hover:text-primary'
                )}
              >
                <Icon name={section.icon as IconName} className="text-xl" />
                <span>{section.label}</span>
              </button>
            ))}
          </nav>

          {/* 底部操作按钮 */}
          <div className="pt-6 mt-6 border-t border-outline/30 space-y-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 bg-primary hover:bg-primary-dark active:scale-[0.98] text-white rounded-lg font-medium transition-all"
            >
              {saving ? '保存中...' : '保存设置'}
            </button>
            <button
              onClick={handleReset}
              disabled={saving}
              className="w-full py-2 bg-element hover:bg-hover text-secondary hover:text-primary rounded-lg font-medium transition-colors border border-border"
            >
              恢复默认设置
            </button>
          </div>
        </aside>

        {/* 右侧内容区域 */}
        <main id="settings-content" className="flex-1 h-full min-h-0 overflow-y-auto pr-2 relative">
          <div className="max-w-4xl space-y-6">
            {/* Folder Sync */}
            <section
              ref={(el) => { sectionRefs.current['sync'] = el; }}
              className="card p-6 rounded-2xl"
            >
              <h3 className="text-lg font-semibold text-primary">文件夹同步</h3>
              <p className="text-sm text-secondary mb-4">管理自动扫描新照片的文件夹。</p>

              {/* 同步文件夹列表 */}
              <div className="flex flex-col gap-3">
                {syncFolders.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-outline/40 py-12 text-center text-on-surface-variant">
                    <Icon name="folder_off" className="text-4xl opacity-40 mb-3" />
                    <p className="text-sm">尚未添加同步文件夹</p>
                  </div>
                ) : (
                  syncFolders.map((folder) => (
                    <div
                      key={folder.path}
                      className={clsx(
                        'group flex items-center justify-between gap-4 rounded-xl p-4 transition-all border',
                        folder.isValid
                          ? 'bg-surface border-border hover:bg-hover'
                          : 'bg-red-500/10 border-red-500/20 text-red-100'
                      )}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <Icon name="folder" className={clsx(
                          'text-2xl',
                          folder.isValid ? 'text-primary' : 'text-red-400'
                        )} filled />
                        <div className="flex flex-col min-w-0 flex-1">
                          <p className="font-medium text-primary truncate">
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
                        <Icon name="delete" className="text-xl" />
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
                  <Icon name="add" className="text-xl" />
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
                        <Icon name="sync" className="text-xl" />
                        <span>立即同步 ({syncFolders.length} 个文件夹)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </section>

            {/* Appearance Section */}
            <section
              ref={(el) => { sectionRefs.current['appearance'] = el; }}
              className="card p-8 rounded-[2rem] border-outline/20"
            >
              <div className="mb-8">
                <h3 className="text-3xl font-serif text-primary mb-1">外观</h3>
                <p className="text-sm text-secondary">个性化您的应用程序主题。</p>
              </div>

              <div className="space-y-8">
                {/* Theme Mode Switcher */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-base font-medium text-primary">主题模式</p>
                    <div className="flex w-full max-w-[320px] items-center rounded-full border border-border bg-surface p-1 shadow-sm">
                      {(['light', 'system', 'dark'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setTheme(mode)}
                          className={clsx(
                            'flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors',
                            theme === mode
                              ? 'bg-primary text-white shadow-sm'
                              : 'text-secondary hover:text-primary hover:bg-hover'
                          )}
                        >
                          <Icon
                            name={mode === 'light' ? 'light_mode' : mode === 'dark' ? 'dark_mode' : 'settings_brightness'}
                            className="text-base"
                          />
                          <span>
                            {mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '自动'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-secondary leading-relaxed">
                    选择浅色、深色模式或跟随系统设置。深色模式经过专门优化，提供舒适的沉浸式体验。
                  </p>
                </div>

                <div className="h-px bg-outline/10 w-full" />

                {/* Theme Color */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-base font-medium text-primary">主题颜色</p>
                    <span className="text-xs font-mono text-secondary bg-surface px-2 py-1 rounded border border-border uppercase">
                      {themeColor}
                    </span>
                  </div>

                  {/* Hue Slider */}
                  <div className="relative h-9 w-full rounded-full p-1 border border-primary/35 bg-surface shadow-inner mb-6">
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={hue}
                      onChange={(e) => handleHueChange(parseInt(e.target.value))}
                      className="hue-slider w-full h-full cursor-pointer rounded-full"
                      style={{
                        background:
                          'linear-gradient(to right, #f87171, #fb923c, #fbbf24, #a3e635, #4ade80, #2dd4bf, #22d3ee, #38bdf8, #60a5fa, #818cf8, #a78bfa, #c084fc, #e879f9, #f472b6, #f87171)',
                      }}
                    />
                  </div>

                  {/* Preview Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-3 transition-colors">
                      <div className="h-2 w-12 rounded-full bg-secondary/20" />
                      <div className="h-10 w-10 rounded-xl bg-primary/80" />
                      <div className="h-2 w-20 rounded-full bg-secondary/15" />
                    </div>
                    <div className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between transition-colors">
                      <div className="flex flex-col gap-2">
                        <div className="h-2 w-16 rounded-full bg-primary/80" />
                        <div className="h-2 w-12 rounded-full bg-secondary/15" />
                      </div>
                      <div className="h-7 w-7 rounded-full border-2 border-primary/70 bg-surface" />
                    </div>
                    <div className="p-4 rounded-xl bg-primary text-white flex flex-col justify-center items-center gap-2 transition-colors">
                      <Icon name="check_circle" className="text-2xl" />
                      <span className="text-xs font-medium opacity-90">Active</span>
                    </div>
                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-center gap-3 transition-colors">
                      <Icon name="palette" className="text-primary text-xl" />
                      <span className="text-sm font-medium text-primary">Accent</span>
                    </div>
                  </div>
                  
                  <p className="mt-6 text-xs text-secondary leading-relaxed">
                    拖动滑块选择您喜欢的主题色。系统会自动生成协调的配色方案（固定饱和度与亮度），确保在任何颜色下都保持良好的可读性与视觉舒适度。
                  </p>
                </div>
              </div>
            </section>

            {/* Photo Scanning */}
            <section
              ref={(el) => { sectionRefs.current['scan'] = el; }}
              className="card"
            >
              <div className="p-6 pb-2">
                <h3 className="text-lg font-semibold text-primary">照片扫描</h3>
                <p className="text-sm text-secondary">配置应用程序如何查找和处理您的照片。</p>
              </div>
              <div className="divide-y divide-white/5">
                <div className="flex items-center justify-between p-4 pl-6">
                  <div>
                    <p className="font-medium text-primary">自动扫描</p>
                    <p className="text-sm text-secondary">定期自动检查同步文件夹中的新照片。</p>
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
                {settings.scan.autoScan && (
                  <div className="flex items-center justify-between p-4 pl-6">
                    <div>
                      <p className="font-medium text-primary">扫描间隔</p>
                      <p className="text-sm text-secondary">自动扫描的时间间隔（分钟）。</p>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setScanIntervalOpen(!scanIntervalOpen)}
                        className="flex items-center gap-2 rounded-lg bg-button px-3 py-2 text-sm text-primary border border-border hover:bg-hover transition-colors"
                      >
                        {settings.scan.scanInterval / 60 >= 60
                          ? `${settings.scan.scanInterval / 3600} 小时`
                          : `${settings.scan.scanInterval / 60} 分钟`}
                        <Icon name="expand_more" className={clsx("text-base transition-transform", scanIntervalOpen && "rotate-180")} />
                      </button>
                      {scanIntervalOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-lg bg-surface border border-border shadow-xl overflow-hidden">
                          {[
                            { value: 5, label: '5 分钟' },
                            { value: 10, label: '10 分钟' },
                            { value: 15, label: '15 分钟' },
                            { value: 30, label: '30 分钟' },
                            { value: 60, label: '1 小时' },
                            { value: 120, label: '2 小时' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setSettings({
                                  ...settings,
                                  scan: { ...settings.scan, scanInterval: option.value * 60 },
                                });
                                setScanIntervalOpen(false);
                              }}
                              className={clsx(
                                "w-full px-4 py-2 text-sm text-left hover:bg-element transition-colors",
                                settings.scan.scanInterval / 60 === option.value
                                  ? "text-primary bg-primary/10"
                                  : "text-secondary"
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between p-4 pl-6">
                  <div>
                    <p className="font-medium text-primary">递归扫描子文件夹</p>
                    <p className="text-sm text-secondary">扫描时包含所有嵌套文件夹。</p>
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

                {/* 自动扫描服务状态 */}
                <div className="p-4 pl-6 border-t border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium text-primary">自动扫描服务</p>
                      <p className="text-sm text-secondary">
                        智能定时扫描（阶梯式频率）
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
                        autoScanStatus?.running
                          ? "bg-green-500/20 text-green-400"
                          : "bg-secondary/20 text-secondary"
                      )}>
                        <span className={clsx(
                          "w-2 h-2 rounded-full",
                          autoScanStatus?.running ? "bg-green-400 animate-pulse" : "bg-secondary"
                        )} />
                        {autoScanStatus?.running ? '运行中' : '已停止'}
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleAutoScan}
                        className={clsx(
                          "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                          autoScanStatus?.running
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-primary/20 text-primary hover:bg-primary/30"
                        )}
                      >
                        {autoScanStatus?.running ? '停止' : '启动'}
                      </button>
                    </div>
                  </div>

                  {/* 实时监控开关 */}
                  <div className="flex items-center justify-between py-3 border-t border-white/5">
                    <div>
                      <p className="text-sm font-medium text-primary">实时监控</p>
                      <p className="text-xs text-secondary">监控文件变化，新增/修改/删除时立即响应</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={settings.scan.realtimeWatch}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            scan: { ...settings.scan, realtimeWatch: e.target.checked },
                          })
                        }
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-button after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-outline/30 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20"></div>
                    </label>
                  </div>

                  {/* 目录扫描状态列表 */}
                  {directoryScanStates.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-secondary mb-2">监控目录状态</p>
                      {directoryScanStates.map((state) => (
                        <div
                          key={state.dirId}
                          className="flex items-center justify-between gap-4 p-3 rounded-lg bg-surface border border-border"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-primary truncate">{state.dirPath}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-secondary">
                              <span className="flex items-center gap-1">
                                <Icon name="speed" className="text-sm" />
                                x{state.scanMultiplier}
                              </span>
                              {state.nextScanTime && (
                                <span className="flex items-center gap-1">
                                  <Icon name="schedule" className="text-sm" />
                                  {new Date(state.nextScanTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Icon name="photo_library" className="text-sm" />
                                {state.fileCount}
                              </span>
                            </div>
                          </div>
                          {state.scanMultiplier > 1 && (
                            <button
                              type="button"
                              onClick={() => handleResetScanFrequency(state.dirPath)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-secondary hover:text-primary hover:bg-hover rounded transition-colors"
                              title="重置扫描频率为 x1"
                            >
                              <Icon name="sync" className="text-sm" />
                              重置
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* OCR 文字识别 */}
            <section
              ref={(el) => { sectionRefs.current['ocr'] = el; }}
              className="card p-6 rounded-2xl"
            >
              <h3 className="text-lg font-semibold text-primary">文字识别 (OCR)</h3>
              <p className="text-sm text-secondary mb-4">
                识别照片中的文字，支持通过文字内容搜索照片。
              </p>

              {/* OCR 可用性状态 */}
              <div className="mb-6 p-4 rounded-xl bg-surface border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon
                      name={ocrAvailable ? 'check_circle' : 'error'}
                      className={clsx(
                        'text-2xl',
                        ocrAvailable ? 'text-green-500' : 'text-red-500'
                      )}
                    />
                    <div>
                      <p className="font-medium text-primary">
                        Tesseract OCR {ocrAvailable ? '已安装' : '未安装'}
                      </p>
                      <p className="text-sm text-secondary">
                        {ocrAvailable
                          ? '可以识别照片中的中英文文字'
                          : '请安装 Tesseract OCR 以启用文字识别功能'}
                      </p>
                    </div>
                  </div>
                  {!ocrAvailable && (
                    <a
                      href="https://github.com/UB-Mannheim/tesseract/wiki"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary h-9 px-4 gap-2"
                    >
                      <Icon name="open_in_new" className="text-lg" />
                      <span>下载安装</span>
                    </a>
                  )}
                </div>
              </div>

              {/* OCR 统计信息 */}
              {ocrAvailable && ocrStats && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-primary mb-3">处理统计</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="p-3 rounded-lg bg-surface border border-border text-center">
                      <p className="text-2xl font-semibold text-primary">{ocrStats.totalPhotos}</p>
                      <p className="text-xs text-secondary">总照片</p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface border border-border text-center">
                      <p className="text-2xl font-semibold text-yellow-500">{ocrStats.pending}</p>
                      <p className="text-xs text-secondary">待处理</p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface border border-border text-center">
                      <p className="text-2xl font-semibold text-green-500">{ocrStats.processed}</p>
                      <p className="text-xs text-secondary">已处理</p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface border border-border text-center">
                      <p className="text-2xl font-semibold text-red-500">{ocrStats.failed}</p>
                      <p className="text-xs text-secondary">失败</p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface border border-border text-center">
                      <p className="text-2xl font-semibold text-secondary">{ocrStats.noText}</p>
                      <p className="text-xs text-secondary">无文字</p>
                    </div>
                  </div>
                </div>
              )}

              {/* OCR 处理进度 */}
              {ocrAvailable && ocrProcessing && ocrProgress && (
                <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-primary">正在处理...</p>
                    <span className="text-sm text-secondary">
                      {ocrProgress.processed} / {ocrProgress.total}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary/20 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${ocrProgress.total > 0 ? (ocrProgress.processed / ocrProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  {ocrProgress.failed > 0 && (
                    <p className="mt-2 text-xs text-red-500">
                      {ocrProgress.failed} 张处理失败
                    </p>
                  )}
                </div>
              )}

              {/* OCR 操作按钮 */}
              {ocrAvailable && (
                <div className="flex flex-wrap gap-3">
                  {ocrProcessing ? (
                    <button
                      type="button"
                      onClick={handleStopOcr}
                      className="btn btn-secondary h-9 px-4 gap-2"
                    >
                      <Icon name="stop" className="text-lg" />
                      <span>停止处理</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartOcr}
                      disabled={!ocrStats || ocrStats.pending === 0}
                      className="btn btn-primary h-9 px-4 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="play_arrow" className="text-lg" />
                      <span>
                        {ocrStats && ocrStats.pending > 0
                          ? `开始处理 (${ocrStats.pending} 张)`
                          : '没有待处理的照片'}
                      </span>
                    </button>
                  )}
                  {ocrStats && ocrStats.failed > 0 && !ocrProcessing && (
                    <button
                      type="button"
                      onClick={handleResetFailedOcr}
                      className="btn btn-secondary h-9 px-4 gap-2"
                    >
                      <Icon name="refresh" className="text-lg" />
                      <span>重试失败 ({ocrStats.failed})</span>
                    </button>
                  )}
                </div>
              )}

              {/* 使用说明 */}
              <div className="mt-6 p-4 rounded-xl bg-surface/50 border border-border">
                <p className="text-sm text-secondary leading-relaxed">
                  <Icon name="info" className="text-base align-middle mr-1" />
                  OCR 处理完成后，您可以在搜索框中直接输入照片中的文字来搜索照片。
                  例如：搜索"咖啡"可以找到拍摄了咖啡店招牌的照片。
                </p>
              </div>
            </section>

            <section
              ref={(el) => { sectionRefs.current['thumbnail'] = el; }}
              className="card p-6 rounded-2xl"
            >
              <h3 className="text-lg font-semibold text-primary">缩略图</h3>
              <p className="text-sm text-secondary mb-6">配置缩略图生成和缓存设置。</p>
              <div className="flex flex-col gap-6">
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="font-medium text-primary">缓存大小限制</label>
                    <span className="text-sm text-secondary">{settings.thumbnail.cacheSizeMb} MB</span>
                  </div>
                  <p className="text-sm text-secondary mb-3">较大的缓存可以加快浏览速度，但会占用更多磁盘空间。</p>
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
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary/20 accent-primary"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="font-medium text-primary">缩略图质量</label>
                    <span className="text-sm text-secondary">{settings.thumbnail.quality}%</span>
                  </div>
                  <p className="text-sm text-secondary mb-3">更高的质量生成更清晰的缩略图，但会占用更多存储空间。</p>
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
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary/20 accent-primary"
                  />
                </div>
              </div>
            </section>

            <section
              ref={(el) => { sectionRefs.current['performance'] = el; }}
              className="card p-6 rounded-2xl"
            >
              <h3 className="text-lg font-semibold text-primary">性能</h3>
              <p className="text-sm text-secondary mb-6">调整设置以优化应用程序的速度和资源使用。</p>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between gap-6">
                  <div className="min-w-0">
                    <label className="font-medium text-primary">高刷模式 (120Hz)</label>
                    <p className="text-sm text-secondary mt-1">
                      减少重特效，优先保证滚动与切换的帧率稳定。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHighRefreshUi(!highRefreshUi)}
                    className={clsx(
                      'relative h-7 w-12 rounded-full border transition-colors',
                      highRefreshUi ? 'bg-primary border-primary' : 'bg-element border-border'
                    )}
                    aria-pressed={highRefreshUi}
                    aria-label="高刷模式"
                  >
                    <span
                      className={clsx(
                        'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                        highRefreshUi && 'translate-x-5'
                      )}
                    />
                  </button>
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="font-medium text-primary">扫描线程数</label>
                    <span className="text-sm text-secondary">{settings.performance.scanThreads === 0 ? '自动' : settings.performance.scanThreads}</span>
                  </div>
                  <p className="text-sm text-secondary mb-3">用于扫描照片的线程数。设置为 0 则自动设置。</p>
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
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary/20 accent-primary"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="font-medium text-primary">缩略图线程数</label>
                    <span className="text-sm text-secondary">{settings.performance.thumbnailThreads === 0 ? '自动' : settings.performance.thumbnailThreads}</span>
                  </div>
                  <p className="text-sm text-secondary mb-3">用于生成缩略图的线程数。设置为 0 则自动设置。</p>
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
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary/20 accent-primary"
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
