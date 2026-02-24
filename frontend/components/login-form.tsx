'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要 6 个字符'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const registerSchema = z.object({
  username: z.string().min(3, '用户名至少需要 3 个字符'),
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要 6 个字符'),
  password_confirm: z.string(),
  phone: z.string().optional().or(z.literal('')),
}).refine((data) => data.password === data.password_confirm, {
  message: '两次输入的密码不一致',
  path: ['password_confirm'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function LoginForm() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      password_confirm: '',
      phone: '',
    },
  });

  const onLoginSubmit = async (data: LoginFormValues) => {
    setError('');
    setIsLoading(true);
    const result = await login(data.email, data.password);
    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.message);
    }
    setIsLoading(false);
  };

  const onRegisterSubmit = async (data: RegisterFormValues) => {
    setError('');
    setIsLoading(true);
    const result = await register({
      username: data.username,
      email: data.email,
      password: data.password,
      password_confirm: data.password_confirm,
      phone: data.phone || undefined,
    });
    if (result.success) {
      // 注册成功后切换到登录模式
      setIsLogin(true);
      registerForm.reset();
    } else {
      setError(result.message);
    }
    setIsLoading(false);
  };

  const switchMode = () => {
    setError('');
    setIsLoading(false);
    loginForm.reset();
    registerForm.reset();
    setIsLogin(!isLogin);
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Side - Decorative Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background relative overflow-hidden">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-muted/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse delay-500" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:48px_48px]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 py-16">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6">
              {isLogin ? '欢迎回来' : '加入我们'}
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              {isLogin
                ? '登录您的账户，继续您的创意之旅'
                : '创建一个新账户，开始探索无限可能'}
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span>智能分析，高效管理</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span>多媒体内容处理</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span>安全可靠的数据保护</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo for mobile */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold">{isLogin ? '欢迎回来' : '加入我们'}</h1>
            <p className="text-muted-foreground mt-2">
              {isLogin ? '登录您的账户' : '创建一个新账户'}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-card rounded-2xl border shadow-xl p-8">
            {error && (
              <div className="mb-6 rounded-lg bg-destructive/15 border border-destructive/20 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {isLogin ? (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold tracking-tight">登录账户</h2>
                  <p className="text-muted-foreground mt-2">输入您的邮箱和密码登录</p>
                </div>
                <Form {...loginForm}>
                  <form key="login-form" onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>邮箱</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="your@email.com"
                              type="email"
                              disabled={isLoading}
                              className="h-11"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>密码</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="••••••••"
                              type="password"
                              disabled={isLoading}
                              className="h-11"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full h-11 mt-6" disabled={isLoading}>
                      {isLoading ? '登录中...' : '登录'}
                    </Button>
                  </form>
                </Form>
                <div className="mt-6 text-center text-sm">
                  <span className="text-muted-foreground">还没有账户？</span>
                  <button
                    type="button"
                    onClick={switchMode}
                    className="ml-1 text-primary hover:underline font-medium"
                    disabled={isLoading}
                  >
                    立即注册
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold tracking-tight">创建账户</h2>
                  <p className="text-muted-foreground mt-2">填写以下信息注册新账户</p>
                </div>
                <Form {...registerForm}>
                  <form key="register-form" onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-5">
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>用户名</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="your_username"
                              disabled={isLoading}
                              className="h-11"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>邮箱</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="your@email.com"
                              type="email"
                              disabled={isLoading}
                              className="h-11"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>手机号（可选）</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="13800138000"
                              type="tel"
                              disabled={isLoading}
                              className="h-11"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>密码</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="••••••••"
                              type="password"
                              disabled={isLoading}
                              className="h-11"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password_confirm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>确认密码</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="••••••••"
                              type="password"
                              disabled={isLoading}
                              className="h-11"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full h-11 mt-6" disabled={isLoading}>
                      {isLoading ? '注册中...' : '注册'}
                    </Button>
                  </form>
                </Form>
                <div className="mt-6 text-center text-sm">
                  <span className="text-muted-foreground">已有账户？</span>
                  <button
                    type="button"
                    onClick={switchMode}
                    className="ml-1 text-primary hover:underline font-medium"
                    disabled={isLoading}
                  >
                    立即登录
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
