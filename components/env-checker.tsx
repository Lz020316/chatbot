import { AlertCircle, CheckCircle2, CheckCircle, XCircle } from "lucide-react";

interface EnvCheckerProps {
  requiredVars: string[];
}

export function EnvChecker({ requiredVars }: EnvCheckerProps) {
  const envStatus = requiredVars.map(varName => ({
    name: varName,
    isSet: !!process.env[varName],
    value: process.env[varName] ? "已配置" : "未配置"
  }));

  const allSet = envStatus.every(env => env.isSet);

  return (
    <div className="rounded-lg border p-4 bg-background">
      <div className="flex items-center gap-2 mb-3">
        {allSet ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <AlertCircle className="h-5 w-5 text-yellow-500" />
        )}
        <h3 className="font-semibold">环境变量配置状态</h3>
      </div>
      
      <div className="space-y-2">
        {envStatus.map(env => (
          <div key={env.name} className="flex items-center justify-between text-sm">
            <span className="font-mono text-muted-foreground">{env.name}</span>
            <div className="flex items-center gap-2">
              {env.isSet ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={env.isSet ? "text-green-600" : "text-red-600"}>
                {env.value}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {!allSet && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>注意：</strong>部分必需的环境变量未配置，这可能导致某些功能无法正常工作。
            请参考 <code className="bg-muted px-1 rounded">.env.example</code> 文件进行配置。
          </p>
        </div>
      )}
    </div>
  );
}

interface SingleEnvCheckerProps {
  envVar: string;
  label: string;
  description?: string;
}

export function SingleEnvChecker({ envVar, label, description }: SingleEnvCheckerProps) {
  const isConfigured = !!process.env[envVar];

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
      {isConfigured ? (
        <CheckCircle className="h-5 w-5 text-green-500" />
      ) : (
        <XCircle className="h-5 w-5 text-red-500" />
      )}
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
        <div className="text-xs text-muted-foreground">
          环境变量: {envVar}
        </div>
      </div>
      {!isConfigured && (
        <div className="text-xs text-red-500">
          未配置
        </div>
      )}
    </div>
  );
}

export function FileUploadEnvChecker() {
  const hasCosConfig = !!process.env.TENCENT_COS_SECRET_ID && !!process.env.TENCENT_COS_SECRET_KEY && !!process.env.TENCENT_COS_BUCKET;
  const hasBlobConfig = !!process.env.BLOB_READ_WRITE_TOKEN;
  const hasAnyUploadConfig = hasCosConfig || hasBlobConfig;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-yellow-500" />
        <h3 className="font-semibold">文件上传环境检查</h3>
      </div>
      
      {/* COS配置检查 */}
      <div className="space-y-2">
        <div className="font-medium text-sm text-muted-foreground">腾讯云COS（推荐）</div>
        <SingleEnvChecker
          envVar="TENCENT_COS_SECRET_ID"
          label="COS密钥ID"
          description="腾讯云COS SecretId"
        />
        <SingleEnvChecker
          envVar="TENCENT_COS_SECRET_KEY"
          label="COS密钥"
          description="腾讯云COS SecretKey"
        />
        <SingleEnvChecker
          envVar="TENCENT_COS_BUCKET"
          label="COS存储桶"
          description="COS存储桶名称"
        />
        <SingleEnvChecker
          envVar="TENCENT_COS_REGION"
          label="COS区域"
          description="COS区域，如 ap-guangzhou"
        />
        <SingleEnvChecker
          envVar="TENCENT_COS_BASE_URL"
          label="COS自定义域名（可选）"
          description="自定义域名，不设置将使用默认COS访问地址"
        />
      </div>

      {/* Vercel Blob配置检查 */}
      <div className="space-y-2">
        <div className="font-medium text-sm text-muted-foreground">Vercel Blob（备用）</div>
        <SingleEnvChecker
          envVar="BLOB_READ_WRITE_TOKEN"
          label="Vercel Blob 存储"
          description="用于文件上传存储，参考 .env.example 文件获取配置方法"
        />
      </div>
      
      <div className={`text-sm p-3 rounded-lg ${hasAnyUploadConfig ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
        <p className="font-medium">
          {hasAnyUploadConfig ? '✅ 文件上传功能可用' : '❌ 文件上传功能不可用'}
        </p>
        {hasCosConfig && (
          <p className="mt-1">优先使用腾讯云COS进行文件上传。</p>
        )}
        {hasBlobConfig && !hasCosConfig && (
          <p className="mt-1">使用Vercel Blob进行文件上传。</p>
        )}
        {!hasAnyUploadConfig && (
          <p className="mt-1">请至少配置一种文件存储方案。</p>
        )}
      </div>
    </div>
  );
}

export function CosEnvChecker() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold">腾讯云COS配置检查</h3>
      </div>
      
      <SingleEnvChecker
        envVar="TENCENT_COS_SECRET_ID"
        label="COS密钥ID"
        description="腾讯云COS SecretId，获取地址：https://console.cloud.tencent.com/cam/capi"
      />
      <SingleEnvChecker
        envVar="TENCENT_COS_SECRET_KEY"
        label="COS密钥"
        description="腾讯云COS SecretKey"
      />
      <SingleEnvChecker
        envVar="TENCENT_COS_BUCKET"
        label="COS存储桶"
        description="COS存储桶名称，获取地址：https://console.cloud.tencent.com/cos/bucket"
      />
      <SingleEnvChecker
        envVar="TENCENT_COS_REGION"
        label="COS区域"
        description="COS区域，如 ap-guangzhou、ap-beijing 等"
      />
      <SingleEnvChecker
        envVar="TENCENT_COS_BASE_URL"
        label="COS自定义域名（可选）"
        description="自定义域名，不设置将使用默认COS访问地址"
      />
    </div>
  );
}