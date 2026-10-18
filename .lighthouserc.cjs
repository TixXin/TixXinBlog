/**
 * @file .lighthouserc.cjs
 * @description 默认 Nexus 主题的移动端性能预算；采集前由手动 CI 启动生产产物并核验页面。
 * 初始门槛及演示数据边界见 docs/lighthouse-ci.md。
 */
module.exports = {
  ci: {
    collect: {
      url: ['http://127.0.0.1:4173/', 'http://127.0.0.1:4173/articles/1', 'http://127.0.0.1:4173/flash'],
      numberOfRuns: 3,
      settings: {
        // 保留 Lighthouse 默认移动设备与模拟节流，不关闭动画、不屏蔽图片请求。
        onlyCategories: ['performance', 'accessibility', 'seo'],
        chromeFlags: '--no-sandbox',
      },
    },
    assert: {
      // 对每个 URL 的三次结果取中位数，避免默认 optimistic 只选最好的一次。
      assertions: {
        'categories:performance': ['error', { minScore: 0.7, aggregationMethod: 'median' }],
        'categories:accessibility': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'categories:seo': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'http-status-code': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
        'is-crawlable': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
      },
    },
    upload: {
      // 仅写 CI 工作区，随后保存为 Actions artifact，不使用临时公开报告托管。
      target: 'filesystem',
      outputDir: '.artifacts/lighthouse/reports',
    },
  },
}
