'use client';

import { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Camera, Lock, Eye, EyeOff, Shield, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';

const profileSchema = z.object({
  username: z.string().min(3, '用户名至少需要 3 个字符').max(50, '用户名不能超过 50 个字符'),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '请输入有效的手机号').optional().or(z.literal('')),
});

const passwordSchema = z.object({
  old_password: z.string().min(1, '请输入原密码'),
  new_password: z.string().min(8, '新密码至少需要 8 个字符'),
  new_password_confirm: z.string(),
}).refine((data) => data.new_password === data.new_password_confirm, {
  message: '两次输入的密码不一致',
  path: ['new_password_confirm'],
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

interface ProfileSectionProps {
  user: any;
  refreshUser: () => Promise<void>;
  showPasswordOnly?: boolean;
}

export function ProfileSection({ user, refreshUser, showPasswordOnly = false }: ProfileSectionProps) {
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { username: '', phone: '' },
    mode: 'onChange',
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { old_password: '', new_password: '', new_password_confirm: '' },
    mode: 'onChange',
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        username: user.username || '',
        phone: user.phone || '',
      });
    }
  }, [user, profileForm]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过 5MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const response = await userApi.uploadAvatar(file);
      if (response.code === 200) {
        toast.success('头像上传成功');
        await refreshUser();
      } else {
        toast.error(response.message || '上传失败');
      }
    } catch (error) {
      toast.error('网络请求失败');
    }
    setIsUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onProfileSubmit = async (data: ProfileFormValues) => {
    setIsProfileLoading(true);
    try {
      const response = await userApi.updateProfile({
        username: data.username,
        phone: data.phone || undefined,
      });
      if (response.code === 200) {
        toast.success('个人信息更新成功');
        await refreshUser();
      } else {
        toast.error(response.message || '更新失败');
      }
    } catch (error) {
      toast.error('网络请求失败');
    }
    setIsProfileLoading(false);
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setIsPasswordLoading(true);
    try {
      const response = await userApi.updatePassword({
        old_password: data.old_password,
        new_password: data.new_password,
        new_password_confirm: data.new_password_confirm,
      });
      if (response.code === 200) {
        toast.success('密码修改成功');
        passwordForm.reset();
      } else {
        toast.error(response.message || '密码修改失败');
      }
    } catch (error) {
      toast.error('网络请求失败');
    }
    setIsPasswordLoading(false);
  };

  const getAvatarUrl = (url: string | null | undefined) => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url}`;
  };

  const getUserInitials = () => user?.username?.slice(0, 2).toUpperCase() || 'U';

  if (showPasswordOnly) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="w-full max-w-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">修改密码</h3>
              <p className="text-sm text-muted-foreground">定期更换密码可以提高账户安全性</p>
            </div>
          </div>

          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="old_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>当前密码</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showOldPassword ? 'text' : 'password'}
                          placeholder="输入当前密码"
                          className="pr-10"
                          disabled={isPasswordLoading}
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="new_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新密码</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="至少 8 个字符"
                          className="pr-10"
                          disabled={isPasswordLoading}
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormDescription>密码至少需要 8 个字符</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="new_password_confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>确认新密码</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="再次输入新密码"
                          className="pr-10"
                          disabled={isPasswordLoading}
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1" disabled={isPasswordLoading || !passwordForm.formState.isDirty}>
                  {isPasswordLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      修改中...
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      确认修改
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => passwordForm.reset()}
                  disabled={isPasswordLoading || !passwordForm.formState.isDirty}
                >
                  重置
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    );
  }

  return (
    <Card className="p-4 h-full">
      <div className="grid lg:grid-cols-[200px_1fr_1fr] gap-6 h-full">
        {/* 头像区域 */}
        <div className="flex flex-col items-center justify-center gap-3 border-r pr-6">
          <div className="relative group shrink-0">
            <Avatar className="h-20 w-20 cursor-pointer ring-2 ring-muted/20">
              {user?.avatar_url ? (
                <AvatarImage src={getAvatarUrl(user.avatar_url)} alt={user.username} />
              ) : null}
              <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div
              onClick={handleAvatarClick}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              style={{ cursor: isUploadingAvatar ? 'not-allowed' : 'pointer' }}
            >
              {isUploadingAvatar ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <div className="text-center">
            <p className="font-semibold">{user?.username}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* 基本信息表单 */}
        <div className="flex flex-col">
          <div className="text-sm font-medium mb-4">基本信息</div>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1">
                <FormField
                  control={profileForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>用户名</FormLabel>
                      <FormControl>
                        <Input placeholder="用户名" className="h-10" disabled={isProfileLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>手机号</FormLabel>
                      <FormControl>
                        <Input placeholder="可选" type="tel" className="h-10" disabled={isProfileLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="submit" disabled={isProfileLoading || !profileForm.formState.isDirty}>
                  {isProfileLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  保存
                </Button>
                <Button type="button" variant="outline" onClick={() => profileForm.reset()} disabled={isProfileLoading || !profileForm.formState.isDirty}>
                  重置
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* 密码修改表单 */}
        <div className="flex flex-col border-l pl-6">
          <div className="flex items-center gap-2 text-sm font-medium mb-4">
            <Lock className="h-4 w-4" />
            修改密码
          </div>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1">
                <FormField
                  control={passwordForm.control}
                  name="old_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>当前密码</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showOldPassword ? 'text' : 'password'}
                            placeholder="当前密码"
                            className="h-10 pr-10"
                            disabled={isPasswordLoading}
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowOldPassword(!showOldPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={passwordForm.control}
                    name="new_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>新密码</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showNewPassword ? 'text' : 'password'}
                              placeholder="至少8位"
                              className="h-10 pr-10"
                              disabled={isPasswordLoading}
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="new_password_confirm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>确认密码</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="再次输入"
                              className="h-10 pr-10"
                              disabled={isPasswordLoading}
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="submit" disabled={isPasswordLoading || !passwordForm.formState.isDirty}>
                  {isPasswordLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  修改
                </Button>
                <Button type="button" variant="outline" onClick={() => passwordForm.reset()} disabled={isPasswordLoading || !passwordForm.formState.isDirty}>
                  重置
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </Card>
  );
}
