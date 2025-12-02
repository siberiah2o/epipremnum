"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  DEFAULT_ANALYSIS_CONFIG,
  ANALYSIS_SCENARIOS,
  getAllCategories,
  getAllTags
} from '@/lib/analysis-scenarios';
import type { AIAnalysisOptions } from '../types/analysis';

interface AnalysisConfigProps {
  options: AIAnalysisOptions;
  onOptionsChange: (options: AIAnalysisOptions) => void;
  disabled?: boolean;
}

export function AnalysisConfig({ options, onOptionsChange, disabled = false }: AnalysisConfigProps) {
  const handleOptionChange = (key: keyof AIAnalysisOptions, value: any) => {
    onOptionsChange({
      ...options,
      [key]: value
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">AI分析配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 基础选项 */}
        <div className="space-y-4">
          <h4 className="font-medium">基础分析选项</h4>

          <div className="flex items-center justify-between">
            <Label htmlFor="generate-title">生成标题</Label>
            <Switch
              id="generate-title"
              checked={options.generate_title ?? true}
              onCheckedChange={(checked) => handleOptionChange('generate_title', checked)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="generate-description">生成描述</Label>
            <Switch
              id="generate-description"
              checked={options.generate_description ?? true}
              onCheckedChange={(checked) => handleOptionChange('generate_description', checked)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="generate-categories">生成分类</Label>
            <Switch
              id="generate-categories"
              checked={options.generate_categories ?? true}
              onCheckedChange={(checked) => handleOptionChange('generate_categories', checked)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="generate-tags">生成标签</Label>
            <Switch
              id="generate-tags"
              checked={options.generate_tags ?? true}
              onCheckedChange={(checked) => handleOptionChange('generate_tags', checked)}
              disabled={disabled}
            />
          </div>
        </div>

        <Separator />

        {/* 有限场景分析 */}
        <div className="space-y-4">
          <h4 className="font-medium">有限场景分析</h4>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="limited-scenarios">启用有限场景</Label>
              <p className="text-sm text-muted-foreground">
                限制AI在预定义场景内分析，减少不相关的分类和标签
              </p>
            </div>
            <Switch
              id="limited-scenarios"
              checked={options.limited_scenarios ?? true}
              onCheckedChange={(checked) => handleOptionChange('limited_scenarios', checked)}
              disabled={disabled}
            />
          </div>

          {(options.limited_scenarios ?? true) && (
            <div className="space-y-3">
              <div>
                <Label>预定义场景</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  前端将根据以下场景过滤AI生成的分类和标签
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {ANALYSIS_SCENARIOS.map((scenario) => (
                    <div key={scenario.id} className="p-2 border rounded-md">
                      <div className="font-medium text-sm">{scenario.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {scenario.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* 数量限制 */}
        <div className="space-y-4">
          <h4 className="font-medium">数量限制</h4>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="max-categories">最大分类数量</Label>
                <Badge variant="secondary">{options.max_categories ?? 3}</Badge>
              </div>
              <Slider
                id="max-categories"
                min={1}
                max={10}
                step={1}
                value={[options.max_categories ?? 3]}
                onValueChange={([value]) => handleOptionChange('max_categories', value)}
                disabled={disabled}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="max-tags">最大标签数量</Label>
                <Badge variant="secondary">{options.max_tags ?? 5}</Badge>
              </div>
              <Slider
                id="max-tags"
                min={1}
                max={15}
                step={1}
                value={[options.max_tags ?? 5]}
                onValueChange={([value]) => handleOptionChange('max_tags', value)}
                disabled={disabled}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* 置信度阈值 */}
        <div className="space-y-4">
          <h4 className="font-medium">置信度控制</h4>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="confidence-threshold">置信度阈值</Label>
              <Badge variant="secondary">{((options.confidence_threshold ?? 0.7) * 100).toFixed(0)}%</Badge>
            </div>
            <Slider
              id="confidence-threshold"
              min={0.1}
              max={1.0}
              step={0.1}
              value={[options.confidence_threshold ?? 0.7]}
              onValueChange={([value]) => handleOptionChange('confidence_threshold', value)}
              disabled={disabled}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground mt-1">
              只保留置信度高于此阈值的分类和标签
            </p>
          </div>
        </div>

        {/* 当前配置预览 */}
        <div className="p-3 bg-muted rounded-md">
          <h4 className="font-medium mb-2">配置预览</h4>
          <div className="text-sm space-y-1">
            <div>分类数量: {options.max_categories ?? 3}</div>
            <div>标签数量: {options.max_tags ?? 5}</div>
            <div>有限场景: {options.limited_scenarios ? '启用' : '禁用'}</div>
            <div>置信度: {((options.confidence_threshold ?? 0.7) * 100).toFixed(0)}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}