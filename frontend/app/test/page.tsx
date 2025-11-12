import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function TestPage() {
  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">shadcn/ui 测试页面</h1>
        <p className="text-muted-foreground">
          这个页面用来验证 shadcn/ui 组件是否正确安装和配置
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Button 组件</CardTitle>
            <CardDescription>测试不同样式的按钮组件</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button>默认按钮</Button>
              <Button variant="secondary">次要按钮</Button>
              <Button variant="destructive">危险按钮</Button>
              <Button variant="outline">边框按钮</Button>
              <Button variant="ghost">幽灵按钮</Button>
              <Button variant="link">链接按钮</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm">小按钮</Button>
              <Button size="default">默认大小</Button>
              <Button size="lg">大按钮</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Input 组件</CardTitle>
            <CardDescription>测试输入框和标签组件</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" type="email" placeholder="输入你的邮箱" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" type="password" placeholder="输入你的密码" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disabled">禁用的输入框</Label>
              <Input id="disabled" disabled placeholder="这个输入框被禁用了" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>综合测试</CardTitle>
          <CardDescription>一个包含多种组件的综合示例</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名</Label>
                <Input id="name" placeholder="请输入姓名" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">电话</Label>
                <Input id="phone" type="tel" placeholder="请输入电话号码" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">日期</Label>
                <Input id="date" type="date" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button>提交</Button>
              <Button variant="outline">取消</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}