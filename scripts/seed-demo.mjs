#!/usr/bin/env node
/**
 * 生成一棵用于视觉验收 / 截图的演示树（不会进入产品，不会被预置）。
 * 用法：node scripts/seed-demo.mjs [目标目录] [dark|light]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const target = path.resolve(process.argv[2] ?? path.join(ROOT, '.test-data', 'demo'))
const theme = process.argv[3] === 'light' ? 'light' : 'dark'

const pad = (n) => String(n).padStart(2, '0')
const stamp = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const SNIPPETS = {
  脱稿演讲: [
    '对着镜子脱稿练了 20 分钟，中段卡了一次，后面顺了很多。',
    '把开场白重写了三遍，终于不像背稿。',
    '录了一遍音，发现自己语速太快，刻意放慢了。',
    '今天试着不看提示卡讲完，最后 30 秒有点慌。',
    '给朋友讲了一遍，他说比上次清楚。',
  ],
  即兴表达: [
    '临时被点名发言，先说了结论，居然没乱。',
    '练习用「观点—例子—回扣」讲一个小故事。',
    '在读书会上插了一次话，没有抢话。',
  ],
  写作: [
    '写了 800 字，删掉一半，剩下的更清楚了。',
    '拆了一篇喜欢的文章，看它怎么起承转合。',
    '把上周的草稿重新收了一遍结构。',
  ],
  力量训练: [
    '深蹲 5×5，最后一组有点抖。',
    '卧推加了 2.5kg，动作还算稳。',
    '今天练背，硬拉找到了发力感。',
    '热身做久了，正式组反而更轻。',
    '录了侧面视频，发现下蹲时膝盖内扣。',
  ],
  睡眠: [
    '十一点半放下手机，躺下很快就睡着了。',
    '午睡只睡了 20 分钟，下午反而清醒。',
    '睡前没喝咖啡，夜里醒的次数少了。',
  ],
  数据结构: [
    '手写了一遍并查集，路径压缩还是容易写错。',
    '把红黑树删除的四种情况又过了一遍。',
    '做了 3 道单调栈，最后一道卡在边界。',
    '给同事讲了一遍拓扑排序，讲的时候才发现自己有个地方没想清楚。',
  ],
  前端: [
    '把一个列表页的渲染从 300ms 压到 90ms。',
    '重写了组件的状态管理，少了两层 props。',
    '调了一晚上 CSS grid，终于对齐了。',
  ],
  'AI 应用': [
    '试了一个新的 embedding 方案，召回好了一些。',
    '把提示词拆成两段，输出稳定多了。',
  ],
  英语: [
    '精听 20 分钟，逐句跟读。',
    '背了 40 个词，复习了昨天的 60 个。',
    '和语伴聊了半小时，卡住的地方记下来了。',
    '读了一篇长文，只查了 5 个词。',
  ],
  日语: [
    '五十音又过了一遍，ら行还是要想一下。',
    '看了一集没有字幕的动画，听懂三成。',
    '背了 20 个 N4 单词。',
  ],
  烘焙: [
    '可颂的层次终于出来了，黄油没有漏。',
    '今天把发酵时间缩短了 20 分钟，组织更松。',
    '做了一次失败的马卡龙，裙边没起来。',
    '给家人做了戚风，这次没有塌。',
  ],
  摄影: [
    '傍晚拍了 30 张，只有两张能看。',
    '练了一下午的手动对焦。',
    '看了一本关于光的书，试着用侧逆光。',
  ],
}

const TREE = [
  {
    name: '沟通表达',
    difficulty: 0.6,
    description: '能清楚、从容地把自己的想法讲给别人听。',
    children: [
      {
        name: '口才',
        difficulty: 0.7,
        description: '在任何场合都能脱稿讲清楚一件事。',
        children: [
          {
            name: '脱稿演讲',
            difficulty: 0.75,
            description: '能不看稿、流畅地讲满 10 分钟，逻辑清楚。',
            diaries: 620,
            litAt: '2026-06-15T12:00:00.000Z',
          },
          {
            name: '即兴表达',
            difficulty: 0.6,
            description: '临时被点名也能有条理地说三分钟。',
            diaries: 24,
          },
        ],
      },
      {
        name: '写作',
        difficulty: 0.55,
        description: '能把复杂的事情写成一篇别人愿意读完的文章。',
        diaries: 210,
      },
    ],
  },
  {
    name: '健康与身心',
    difficulty: 0.5,
    description: '让身体和情绪都稳定地支撑我。',
    children: [
      {
        name: '力量训练',
        difficulty: 0.5,
        description: '深蹲、卧推、硬拉都达到体重 1 倍。',
        diaries: 540,
      },
      {
        name: '睡眠',
        difficulty: 0.3,
        description: '稳定在 23:30 前入睡，早上自然醒。',
        diaries: 180,
      },
    ],
  },
  {
    name: '数字与技术',
    difficulty: 0.7,
    description: '能独立做出有用的软件。',
    children: [
      {
        name: '编程',
        difficulty: 0.75,
        description: '能独立设计和维护一个中型项目。',
        children: [
          {
            name: '数据结构',
            difficulty: 0.8,
            description: '常见结构能手写、能讲清复杂度。',
            diaries: 430,
          },
          {
            name: '前端',
            difficulty: 0.55,
            description: '能独立完成一个有质感的桌面界面。',
            diaries: 260,
          },
        ],
      },
      {
        name: 'AI 应用',
        difficulty: 0.7,
        description: '能把模型接进真实产品，而不是停在 demo。',
        diaries: 9,
      },
    ],
  },
  {
    name: '语言',
    difficulty: 0.6,
    description: '用另一种语言生活和阅读。',
    children: [
      {
        name: '英语',
        difficulty: 0.55,
        description: '能无字幕看懂访谈，能写工作邮件。',
        diaries: 480,
        litAt: '2026-08-20T12:00:00.000Z',
      },
      {
        name: '日语',
        difficulty: 0.7,
        description: '能读懂简单的原版小说。',
        diaries: 96,
      },
    ],
  },
  {
    name: '生活与手艺',
    difficulty: 0.35,
    description: '把日子过得有一点自己的味道。',
    children: [
      {
        name: '烘焙',
        difficulty: 0.35,
        description: '能稳定做出可颂和戚风。',
        diaries: 190,
      },
      {
        name: '摄影',
        difficulty: 0.45,
        description: '能拍出自己愿意挂在墙上的照片。',
        diaries: 8,
      },
    ],
  },
]

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

function writeNode(dir, node) {
  fs.mkdirSync(dir, { recursive: true })
  const meta = {
    description: node.description ?? '',
    difficulty: node.difficulty,
  }
  if (node.litAt) meta.litAt = node.litAt
  fs.writeFileSync(path.join(dir, '.node.json'), `${JSON.stringify(meta, null, 2)}\n`)
}

const today = new Date()
today.setHours(12, 0, 0, 0)

function writeDiaries(dir, node) {
  const count = node.diaries ?? 0
  if (!count) return
  const pool = SNIPPETS[node.name] ?? [
    '今天做了一点，记下来。',
    '中间卡住了，后来慢慢顺了。',
    '没有特别大的进展，但手没有生。',
    '回头看了之前的记录，能看出变化。',
  ]
  const spanDays = Math.max(1, Math.min(count, 300))
  const used = new Map()

  for (let i = 0; i < count; i += 1) {
    const offset = Math.floor((i / count) * spanDays)
    const date = new Date(today)
    date.setDate(date.getDate() - (spanDays - 1 - offset))
    const key = stamp(date)
    const index = (used.get(key) ?? 0) + 1
    used.set(key, index)
    const fileName = index === 1 ? `${key}.md` : `${key}-${index}.md`
    const deep = i % 11 === 0
    const head = ['---', `date: ${key}`]
    if (deep) head.push('deep: true')
    head.push('---', '')
    const body = pool[i % pool.length]
    const file = path.join(dir, fileName)
    fs.writeFileSync(file, `${head.join('\n')}\n${body}\n`)
    fs.utimesSync(file, date, date)
  }
}

let nodeCount = 0

function plant(parentDir, parentPath, nodes) {
  for (const node of nodes) {
    const dir = path.join(parentDir, node.name)
    writeNode(dir, node)
    writeDiaries(dir, node)
    nodeCount += 1
    if (node.children) plant(dir, `${parentPath}${node.name}/`, node.children)
  }
}

resetDir(target)

fs.writeFileSync(
  path.join(target, 'config.json'),
  `${JSON.stringify(
    {
      apiKey: '',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      alpha: 0.6,
      kMin: 0.00025,
      kMax: 0.001,
      preferences: { theme, splitRatio: 0.24, lastSelectedId: '健康与身心/力量训练' },
    },
    null,
    2,
  )}\n`,
)

plant(target, '', TREE)

// 演示归档区：剪下的一枝，历史还在
const archived = path.join(target, '_archived', '公开演讲')
fs.mkdirSync(archived, { recursive: true })
fs.writeFileSync(
  path.join(archived, '.node.json'),
  `${JSON.stringify({ description: '曾经想练，后来先放一放。', difficulty: 0.7 }, null, 2)}\n`,
)
fs.writeFileSync(
  path.join(archived, '2026-03-02.md'),
  '---\ndate: 2026-03-02\n---\n\n第一次上台，手心全是汗。\n',
)
fs.writeFileSync(
  path.join(target, '_archived', '.archive.json'),
  `${JSON.stringify(
    [
      {
        folder: '公开演讲',
        originalPath: '沟通表达/公开演讲',
        archivedAt: '2026-04-11T09:30:00.000Z',
      },
    ],
    null,
    2,
  )}\n`,
)

console.log(`演示树已生成：${target}`)
console.log(`主题：${theme}；节点：${nodeCount}；目录大小：${fs.readdirSync(target).length} 项`)
