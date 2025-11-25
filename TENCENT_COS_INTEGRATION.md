# 腾讯云COS文件上传集成方案

## 概述

本项目现已支持腾讯云COS（Cloud Object Storage）作为文件上传的存储方案，同时保留原有的Vercel Blob作为备用方案。系统会优先尝试使用COS上传，如果COS配置不完整或上传失败，会自动回退到Vercel Blob。

## 功能特点

- **双存储支持**：优先使用腾讯云COS，失败时自动回退到Vercel Blob
- **智能切换**：无需手动切换，系统自动选择可用的存储方案
- **完整兼容**：保持原有的文件类型和大小限制（JPEG/PNG，≤5MB）
- **配置检查**：提供环境变量配置检查工具
- **错误处理**：增强的错误提示和日志记录

## 环境变量配置

### 腾讯云COS配置（推荐）

```env
# 腾讯云COS配置（可选，用于文件上传）
# 获取方式：https://cloud.tencent.com/document/product/436/7751
TENCENT_COS_SECRET_ID=your_secret_id
TENCENT_COS_SECRET_KEY=your_secret_key
TENCENT_COS_BUCKET=your_bucket_name
TENCENT_COS_REGION=ap-guangzhou
# 可选：自定义域名，如果不设置将使用默认的COS访问地址
TENCENT_COS_BASE_URL=https://your-custom-domain.com
```

#### 配置说明：

1. **TENCENT_COS_SECRET_ID**: 腾讯云API密钥ID
   - 获取地址：https://console.cloud.tencent.com/cam/capi
   - 创建子账号并授予COS权限

2. **TENCENT_COS_SECRET_KEY**: 腾讯云API密钥
   - 与SecretId配对使用
   - 请妥善保管，不要泄露

3. **TENCENT_COS_BUCKET**: 存储桶名称
   - 获取地址：https://console.cloud.tencent.com/cos/bucket
   - 创建存储桶并设置合适的权限

4. **TENCENT_COS_REGION**: 存储桶所在区域
   - 常见值：ap-guangzhou、ap-beijing、ap-shanghai等
   - 根据你的存储桶实际区域设置

5. **TENCENT_COS_BASE_URL**（可选）: 自定义域名
   - 如果你为COS配置了自定义域名
   - 不设置将使用默认的COS访问地址

### Vercel Blob配置（备用）

```env
# Vercel Blob配置（原有配置，现作为备用方案）
BLOB_READ_WRITE_TOKEN=your_blob_token
```

## 技术实现

### 1. 后端API路由

创建了新的API路由 `/api/files/upload-cos`，处理腾讯云COS文件上传：

- **文件验证**：保持原有的文件类型和大小验证
- **认证检查**：确保用户已登录
- **COS上传**：使用腾讯云COS SDK进行文件上传
- **URL构建**：生成可访问的文件URL
- **错误处理**：详细的错误信息和状态码

### 2. 前端上传逻辑

更新了文件上传函数，实现智能切换：

```typescript
// 首先尝试使用COS上传
const cosResponse = await fetch("/api/files/upload-cos", {
  method: "POST",
  body: formData,
});

if (cosResponse.ok) {
  // COS上传成功，返回结果
  return { url, name, contentType };
}

// COS上传失败，回退到Vercel Blob
console.log("COS上传失败，回退到Vercel Blob上传");
const blobResponse = await fetch("/api/files/upload", {
  method: "POST",
  body: formData,
});
```

### 3. 配置检查工具

提供了完整的环境变量配置检查：

- **FileUploadEnvChecker**: 综合检查所有文件上传相关配置
- **CosEnvChecker**: 专门检查腾讯云COS配置
- **实时状态**：显示配置是否完整
- **使用说明**：提供详细的配置指导

## 使用方法

### 1. 配置腾讯云COS

1. 登录腾讯云控制台
2. 创建或获取API密钥（SecretId和SecretKey）
3. 创建COS存储桶
4. 在`.env.local`文件中配置相关环境变量

### 2. 验证配置

使用配置检查工具验证环境变量是否正确设置：

```tsx
import { FileUploadEnvChecker } from "@/components/env-checker";

// 在设置页面或调试页面使用
<FileUploadEnvChecker />
```

### 3. 文件上传

文件上传功能与之前保持一致，用户无需任何额外操作：

1. 点击附件按钮
2. 选择文件（JPEG/PNG，≤5MB）
3. 系统自动选择最优存储方案进行上传

## 优势对比

| 特性 | 腾讯云COS | Vercel Blob |
|------|----------|-------------|
| **成本** | 按量付费，成本较低 | 免费额度有限 |
| **速度** | 国内访问速度快 | 全球CDN加速 |
| **稳定性** | 企业级服务 | 依托Vercel平台 |
| **功能** | 丰富的对象存储功能 | 简单的文件存储 |
| **适用场景** | 国内用户、大文件存储 | 国际用户、快速集成 |

## 故障排除

### 常见问题

1. **COS上传失败**
   - 检查API密钥是否正确
   - 确认存储桶是否存在
   - 验证存储桶权限设置
   - 检查网络连接

2. **回退到Vercel Blob**
   - 检查COS环境变量是否完整
   - 查看控制台错误日志
   - 确认COS服务是否正常

3. **文件访问问题**
   - 检查COS存储桶的访问权限
   - 验证自定义域名配置
   - 确认文件URL生成逻辑

### 调试方法

1. **查看控制台日志**：前端会输出详细的错误信息
2. **使用配置检查工具**：快速验证环境变量设置
3. **检查网络请求**：使用浏览器开发者工具查看上传请求
4. **验证COS配置**：使用腾讯云控制台测试存储桶访问

## 最佳实践

1. **优先使用COS**：对于国内用户，COS提供更好的访问速度和成本优势
2. **配置回退机制**：确保至少有一种存储方案可用
3. **监控上传状态**：关注上传成功率和错误率
4. **定期检查配置**：确保API密钥和存储桶配置的有效性
5. **安全考虑**：使用子账号和最小权限原则

## 更新日志

- **2024年**：添加腾讯云COS支持，实现双存储方案
- **之前**：仅支持Vercel Blob文件上传

## 相关链接

- [腾讯云COS官方文档](https://cloud.tencent.com/document/product/436)
- [腾讯云COS SDK for Node.js](https://cloud.tencent.com/document/product/436/8629)
- [Vercel Blob文档](https://vercel.com/docs/vercel-blob)
- [项目文件上传指南](./FILE_UPLOAD_GUIDE.md)