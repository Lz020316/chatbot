import COS from "cos-nodejs-sdk-v5";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

// 初始化COS客户端
const cos = new COS({
  SecretId: process.env.TENCENT_COS_SECRET_ID,
  SecretKey: process.env.TENCENT_COS_SECRET_KEY,
});

// COS配置
const COS_CONFIG = {
  Bucket: process.env.TENCENT_COS_BUCKET || "",
  Region: process.env.TENCENT_COS_REGION || "ap-guangzhou",
  BaseUrl: process.env.TENCENT_COS_BASE_URL || "",
};

// 文件验证模式
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: "文件大小应小于5MB",
    })
    .refine((file) => ["image/jpeg", "image/png"].includes(file.type), {
      message: "文件类型应为JPEG或PNG",
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "未授权访问" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("请求体为空", { status: 400 });
  }

  // 检查COS配置
  if (
    !COS_CONFIG.Bucket ||
    !process.env.TENCENT_COS_SECRET_ID ||
    !process.env.TENCENT_COS_SECRET_KEY
  ) {
    return NextResponse.json(
      { error: "COS配置不完整，请检查环境变量" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "未上传文件" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // 获取文件名
    const filename = (formData.get("file") as File).name;
    const timestamp = Date.now();
    const key = `uploads/${timestamp}_${filename}`;

    // 将Blob转换为Buffer
    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);

    try {
      // 上传到腾讯云COS
      const cosResult = await cos.putObject({
        Bucket: COS_CONFIG.Bucket,
        Region: COS_CONFIG.Region,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      });

      // 构建访问URL
      const url = COS_CONFIG.BaseUrl
        ? `${COS_CONFIG.BaseUrl}/${key}`
        : `https://${COS_CONFIG.Bucket}.cos.${COS_CONFIG.Region}.myqcloud.com/${key}`;

      const result = {
        url,
        pathname: key,
        contentType: file.type,
        size: file.size,
        etag: cosResult.ETag,
      };

      return NextResponse.json(result);
    } catch (cosError) {
      console.error("COS上传错误:", cosError);
      return NextResponse.json(
        { error: "COS上传失败，请检查配置" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("处理请求错误:", error);
    return NextResponse.json({ error: "处理请求失败" }, { status: 500 });
  }
}
