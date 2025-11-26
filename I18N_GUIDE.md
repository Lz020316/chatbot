# 国际化 (i18n) 使用指南

## ✨ 优化后的特性

1. **扁平化键值结构** - 不再使用 `common.key`，直接使用 `key`
2. **统一的 Hook** - 使用 `useTranslationSafe` 或 `useTranslation`
3. **防止 SSR 水合错误** - 自动处理服务端和客户端渲染差异
4. **精简的翻译文件** - 只包含实际使用的翻译

## 📁 文件结构

```
public/locales/
├── en/
│   ├── translation.json  (精简版 - 推荐使用)
│   └── common.json       (完整版 - 备用)
└── zh/
    ├── translation.json  (精简版 - 推荐使用)
    └── common.json       (完整版 - 备用)
```

## 🔧 使用方法

### 在组件中使用翻译

```tsx
import { useTranslation } from '@/hooks/use-translation-safe';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('newChat')}</h1>
      <button>{t('send')}</button>
    </div>
  );
}
```

### 添加新的翻译

1. 在 `public/locales/en/translation.json` 添加英文：
```json
{
  "myNewKey": "My New Text"
}
```

2. 在 `public/locales/zh/translation.json` 添加中文：
```json
{
  "myNewKey": "我的新文本"
}
```

3. 在组件中使用：
```tsx
{t('myNewKey')}
```

## 📝 可用的翻译键

### 常用操作
- `newChat` - 新聊天
- `send` - 发送
- `save` - 保存
- `edit` - 编辑
- `delete` - 删除
- `copy` - 复制
- `cancel` - 取消
- `close` - 关闭

### 界面元素
- `toggleSidebar` - 切换侧边栏
- `settings` - 设置
- `language` - 语言
- `theme` - 主题

### 状态提示
- `loading` - 加载中
- `error` - 错误
- `success` - 成功
- `warning` - 警告
- `copied` - 已复制

## ⚠️ 注意事项

1. **不要使用嵌套键** - 使用 `t('key')` 而不是 `t('category.key')`
2. **总是使用 `useTranslationSafe`** - 避免 SSR 水合错误
3. **保持翻译文件同步** - 确保英文和中文文件有相同的键

## 🐛 常见问题

### Q: 翻译不生效？
A: 检查是否使用了正确的键名，确保 `translation.json` 文件中存在该键。

### Q: 出现水合错误？
A: 有三种解决方案：
1. **使用 `useTranslationSafe`**（推荐）- 自动处理水合
2. **添加 `suppressHydrationWarning`** - 在显示翻译的元素上添加此属性
3. **使用 `ClientOnly` 组件** - 包裹需要客户端渲染的内容

```tsx
// 方案 1: 使用 useTranslationSafe（自动处理）
const { t } = useTranslationSafe();

// 方案 2: 添加 suppressHydrationWarning
<span suppressHydrationWarning>{t('key')}</span>

// 方案 3: 使用 ClientOnly
<ClientOnly>
  <div>{t('key')}</div>
</ClientOnly>
```

### Q: 如何添加新语言？
A: 在 `public/locales/` 下创建新的语言文件夹，并在 `components/language-switcher.tsx` 中添加语言选项。

## 🔧 高级用法

### 避免水合错误的最佳实践

1. **始终使用 `useTranslationSafe`**
```tsx
import { useTranslation } from '@/hooks/use-translation-safe';
```

2. **在文本元素上添加 `suppressHydrationWarning`**
```tsx
<span suppressHydrationWarning>{t('myKey')}</span>
```

3. **对于复杂组件，使用 `ClientOnly`**
```tsx
import { ClientOnly } from '@/components/client-only';

<ClientOnly fallback={<div>Loading...</div>}>
  <ComplexTranslatedComponent />
</ClientOnly>
```
