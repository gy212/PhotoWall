import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/layout/Layout';
import FrontendReady from './components/FrontendReady';
import { useThemeColor } from './hooks/useThemeColor';
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
  useThemeColor();

  return (
    <QueryClientProvider client={queryClient}>
      <FrontendReady />
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<Layout />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
