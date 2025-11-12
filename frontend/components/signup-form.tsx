"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { register, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    password_confirm: "",
    phone: "",
  });

  // 如果已经登录，重定向到dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // 验证密码匹配
    if (formData.password !== formData.password_confirm) {
      toast.error("密码不匹配");
      setIsLoading(false);
      return;
    }

    // 验证密码长度
    if (formData.password.length < 8) {
      toast.error("密码至少需要8个字符");
      setIsLoading(false);
      return;
    }

    // 验证密码复杂度：至少包含一个大写字母、一个小写字母和一个数字
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      toast.error("密码必须包含至少一个大写字母、一个小写字母和一个数字");
      setIsLoading(false);
      return;
    }

    // 验证用户名格式（3-20个字符，只允许字母、数字和下划线）
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(formData.username)) {
      toast.error("用户名必须是3-20个字符，只能包含字母、数字和下划线");
      setIsLoading(false);
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("请输入有效的邮箱地址");
      setIsLoading(false);
      return;
    }

    // 验证手机号格式（11位数字，以1开头）
    if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      toast.error("请输入有效的11位手机号码");
      setIsLoading(false);
      return;
    }

    try {
      const result = await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.password_confirm,
        phone: formData.phone,
      });

      if (result.success) {
        toast.success("注册成功！欢迎加入 Epipremnum");
        router.push("/dashboard");
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error("注册过程中发生错误，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">创建您的账户</h1>
          <p className="text-muted-foreground text-sm text-balance">
            填写下方表单以创建您的 Epipremnum 账户
          </p>
        </div>

  
        <Field>
          <FieldLabel htmlFor="username">用户名</FieldLabel>
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="请输入3-20位用户名"
            required
            value={formData.username}
            onChange={handleInputChange}
            disabled={isLoading}
            autoComplete="username"
          />
          <FieldDescription>3-20个字符，只能包含字母、数字和下划线。</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="email">邮箱地址</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="name@example.com"
            required
            value={formData.email}
            onChange={handleInputChange}
            disabled={isLoading}
            autoComplete="email"
          />
          <FieldDescription>
            我们将使用此邮箱与您联系。我们不会与任何人分享您的邮箱。
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="请输入密码"
            required
            value={formData.password}
            onChange={handleInputChange}
            disabled={isLoading}
            autoComplete="new-password"
          />
          <FieldDescription>密码至少需要8个字符，必须包含大小写字母和数字。</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="password_confirm">确认密码</FieldLabel>
          <Input
            id="password_confirm"
            name="password_confirm"
            type="password"
            placeholder="请再次输入密码"
            required
            value={formData.password_confirm}
            onChange={handleInputChange}
            disabled={isLoading}
            autoComplete="new-password"
          />
          <FieldDescription>请再次输入密码以确认。</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="phone">手机号</FieldLabel>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="请输入手机号"
            required
            value={formData.phone}
            onChange={handleInputChange}
            disabled={isLoading}
            autoComplete="tel"
          />
          <FieldDescription>请输入11位手机号码，用于账户找回等功能。</FieldDescription>
        </Field>

        <Field>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                注册中...
              </>
            ) : (
              "创建账户"
            )}
          </Button>
        </Field>

        <FieldSeparator>或继续使用</FieldSeparator>

        <Field>
          <Button variant="outline" type="button" className="w-full" disabled>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="mr-2 h-4 w-4"
            >
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                fill="currentColor"
              />
            </svg>
            使用 GitHub 注册
          </Button>
        </Field>

        <FieldDescription className="text-center">
          已有账户？{" "}
          <a href="/login" className="underline underline-offset-4">
            立即登录
          </a>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
