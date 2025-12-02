'use client'

import React, { useState } from 'react'
import { Pagination } from './pagination'

/**
 * 翻页组件使用示例
 */
export function PaginationExample() {
  const [currentPage, setCurrentPage] = useState(1)

  // 模拟不同场景的页数
  const scenarios = [
    { name: '少量页面 (5页)', totalPages: 5 },
    { name: '中等页面 (15页)', totalPages: 15 },
    { name: '大量页面 (50页)', totalPages: 50 },
    { name: '海量页面 (200页)', totalPages: 200 }
  ]

  return (
    <div className="space-y-8 p-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold mb-4">翻页组件优化示例</h2>
        <p className="text-gray-600 mb-6">
          展示不同页数和模式下的翻页组件表现，防止溢出并保持良好的用户体验
        </p>
      </div>

      {scenarios.map((scenario) => (
        <div key={scenario.name} className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-lg mb-2">{scenario.name}</h3>

            {/* 完整模式 - 适合宽容器 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">完整模式 (适合宽容器):</h4>
              <div className="p-3 bg-gray-50 rounded border overflow-hidden">
                <Pagination
                  currentPage={currentPage}
                  totalPages={scenario.totalPages}
                  onPageChange={setCurrentPage}
                  maxVisiblePages={5}
                  compact={false}
                  showQuickJumper={true}
                  showTotalPages={true}
                />
              </div>
            </div>

            {/* 紧凑模式 - 适合窄容器 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">紧凑模式 (适合窄容器):</h4>
              <div className="p-3 bg-gray-50 rounded border overflow-hidden max-w-md">
                <Pagination
                  currentPage={currentPage}
                  totalPages={scenario.totalPages}
                  onPageChange={setCurrentPage}
                  maxVisiblePages={3}
                  compact={true}
                  showQuickJumper={true}
                  showTotalPages={true}
                />
              </div>
            </div>

            {/* 极简模式 - 适合非常窄的容器 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">极简模式 (适合侧边栏等窄容器):</h4>
              <div className="p-3 bg-gray-50 rounded border overflow-hidden max-w-xs">
                <Pagination
                  currentPage={currentPage}
                  totalPages={scenario.totalPages}
                  onPageChange={setCurrentPage}
                  maxVisiblePages={3}
                  compact={true}
                  showQuickJumper={scenario.totalPages > 10}
                  showTotalPages={false}
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* 使用指南 */}
      <div className="border rounded-lg p-4 bg-blue-50">
        <h3 className="font-medium text-lg mb-2">使用指南</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li><strong>完整模式</strong>: 适合页面内容区域，显示完整的文字和按钮</li>
          <li><strong>紧凑模式</strong>: 适合侧边栏、对话框等空间有限的场景</li>
          <li><strong>maxVisiblePages</strong>: 控制显示的页码数量，防止页码过多时溢出</li>
          <li><strong>自动省略</strong>: 当页数较多时自动显示省略号，保持界面整洁</li>
          <li><strong>响应式设计</strong>: 自动适应容器宽度，支持横向滚动</li>
        </ul>
      </div>
    </div>
  )
}