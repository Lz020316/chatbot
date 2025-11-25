# 文件上传功能文档

## 概述

文件上传功能允许用户在聊天界面中上传图片文件（JPEG/PNG），支持拖拽上传和剪贴板粘贴上传。该功能集成在模型选择系统中，不同模型对文件上传的支持程度不同。

## 环境变量配置

文件上传功能依赖以下环境变量：

### 必需环境变量

```bash
BLOB_READ_WRITE_TOKEN=****  # Vercel Blob存储令牌
```

### 获取方式

1. **Vercel Blob Token**: 
   - 访问 [Vercel Blob文档](https://vercel.com/docs/vercel-blob)
   - 创建Blob存储并获取读写令牌
   - 在Vercel控制台的项目设置中添加环境变量

2. **本地开发**:
   ```bash
   cp .env.example .env.local
   # 编辑 .env.local 文件，添加 BLOB_READ_WRITE_TOKEN
   ```

## 模型兼容性

### 支持文件上传的模型
- **Grok Vision** (`chat-model`): 完全支持文件上传和图像识别

### 不支持文件上传的模型  
- **Grok Reasoning** (`chat-model-reasoning`): 禁用文件上传功能

### 模型选择影响
- 选择推理模型时，文件上传按钮会被禁用
- 用户尝试点击会显示提示："Grok Reasoning 不支持文件上传功能"
- 模型切换时会自动验证文件上传兼容性

## 技术实现

### 文件上传流程

1. **用户交互**:
   ```typescript
   // 点击附件按钮
   <AttachmentsButton 
     fileInputRef={fileInputRef}
     selectedModelId={selectedModelId}
     status={status}
   />
   ```

2. **模型验证**:
   ```typescript
   const isReasoningModel = selectedModelId === "chat-model-reasoning";
   if (isReasoningModel) {
     toast.error(`${selectedModel?.name} 不支持文件上传功能`);
     return;
   }
   ```

3. **文件处理**:
   - 文件大小限制：5MB
   - 支持的文件类型：JPEG、PNG
   - 使用FormData进行文件传输

4. **API上传**:
   ```typescript
   const response = await fetch("/api/files/upload", {
     method: "POST",
     body: formData,
   });
   ```

### 错误处理

#### 500错误处理
当BLOB_READ_WRITE_TOKEN未配置时，会显示详细的错误信息：
```
上传失败

可能原因：BLOB_READ_WRITE_TOKEN 环境变量未配置
```

#### 其他错误处理
- **401错误**: 用户未授权
- **400错误**: 文件格式或大小不符合要求
- **网络错误**: 连接问题导致的上传失败

## 使用示例

### 基础文件上传
```typescript
const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(event.target.files || []);
  setUploadQueue(files.map(file => file.name));
  
  try {
    const uploadPromises = files.map(file => uploadFile(file));
    const uploadedAttachments = await Promise.all(uploadPromises);
    // 处理上传成功的文件
  } catch (error) {
    console.error("文件上传错误:", error);
  }
};
```

### 剪贴板图片上传
```typescript
const handlePaste = async (event: ClipboardEvent) => {
  const imageItems = Array.from(event.clipboardData?.items || [])
    .filter(item => item.type.startsWith('image/'));
  
  if (imageItems.length === 0) return;
  
  event.preventDefault();
  // 处理粘贴的图片上传
};
```

## 组件架构

### 核心组件
- **AttachmentsButton**: 文件选择触发按钮
- **uploadFile**: 文件上传核心函数
- **PreviewAttachment**: 上传文件预览组件

### 状态管理
- **uploadQueue**: 上传队列状态
- **attachments**: 已上传的附件列表
- **selectedModelId**: 当前选择的模型ID

## 配置检查

使用环境变量检查组件验证配置：

```tsx
import { FileUploadEnvChecker } from "@/components/env-checker";

// 在设置页面中使用
<FileUploadEnvChecker />
```

## 故障排除

### 常见问题

1. **500错误**
   - 检查BLOB_READ_WRITE_TOKEN是否配置
   - 验证Vercel Blob存储是否启用
   - 查看控制台详细错误信息

2. **文件上传按钮禁用**
   - 确认当前模型是否支持文件上传
   - 检查聊天状态是否为"ready"

3. **上传失败**
   - 验证文件格式（JPEG/PNG）
   - 检查文件大小（<5MB）
   - 确认网络连接状态

### 调试信息

开启调试模式查看详细日志：
```typescript
console.error("File upload error:", error);
console.log("Selected model:", selectedModelId);
console.log("Upload status:", status);
```

## 相关文件

- `/components/multimodal-input.tsx` - 主要上传逻辑
- `/app/(chat)/api/files/upload/route.ts` - API路由处理
- `/components/env-checker.tsx` - 环境变量检查
- `/.env.example` - 环境变量配置示例