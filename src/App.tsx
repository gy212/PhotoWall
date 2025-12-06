import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import AlbumsPage from './pages/AlbumsPage';
import TagsPage from './pages/TagsPage';
import SettingsPage from './pages/SettingsPage';
import FavoritesPage from './pages/FavoritesPage';
import TrashPage from './pages/TrashPage';
import FoldersPage from './pages/FoldersPage';
import './index.css';

// 创建 QueryClient 实例 - 优化缓存策略
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000, // 30分钟内数据视为新鲜
      gcTime: 60 * 60 * 1000,    // 1小时后回收缓存
      retry: 2,
      refetchOnWindowFocus: false, // 避免窗口获焦时重复请求
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="albums" element={<AlbumsPage />} />
            <Route path="tags" element={<TagsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="trash" element={<TrashPage />} />
            <Route path="folders" element={<FoldersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
