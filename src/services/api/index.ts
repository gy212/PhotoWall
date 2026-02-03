/**
 * API 模块统一导出
 *
 * 保持向后兼容，所有现有导入路径继续有效
 */

// 类型导出
export * from './types';

// 扫描和索引
export * from './scanner';

// 照片查询
export * from './photos';

// 标签管理
export * from './tags';

// 相册管理
export * from './albums';

// 工具函数
export * from './utils';

// 文件操作
export * from './fileOps';

// 设置管理
export * from './settings';

// 文件夹同步
export * from './sync';

// 回收站功能
export * from './trash';

// 文件夹视图
export * from './folders';

// 桌面模糊
export * from './blur';

// 照片编辑
export * from './editor';

// 智能相册
export * from './smartAlbums';

// OCR 文字识别
export * from './ocr';
