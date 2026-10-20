import type { CenterStats, TreeNode } from '../../shared/types'

export interface LayoutBall {
  id: string
  name: string
  depth: number
  brightness: number
  marks: number
  lit: boolean
  size: number
  x: number
  y: number
  isCenter: boolean
  node: TreeNode | null
}

export interface LayoutLink {
  id: string
  depth: number
  x1: number
  y1: number
  x2: number
  y2: number
  brightness: number
  onFocusPath: boolean
}

export interface LayoutRing {
  depth: number
  radius: number
}

export interface LayoutBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  cx: number
  cy: number
  width: number
  height: number
}

export interface TreeLayout {
  balls: LayoutBall[]
  links: LayoutLink[]
  rings: LayoutRing[]
  bounds: LayoutBounds
  maxDepth: number
  center: LayoutBall
}

const SIZES = [132, 72, 58, 49, 43, 38, 34, 31]

export function ballSizeAt(depth: number): number {
  return SIZES[Math.min(depth, SIZES.length - 1)]
}

function weightOf(node: TreeNode, cache: Map<string, number>): number {
  const cached = cache.get(node.id)
  if (cached !== undefined) return cached
  let weight = 1
  if (node.children.length > 0) {
    weight = 0
    for (const child of node.children) weight += weightOf(child, cache)
  }
  cache.set(node.id, weight)
  return weight
}

/**
 * 中心辐射布局：
 * - 角度按「叶子的数量」分配，保证扇形宽度和子树的体量成正比；
 * - 半径按深度递增，并保证同一环上的球不会挤在一起；
 * - 根节点的角度朝正上方，单枝会自然向上生长。
 */
export function buildLayout(nodes: TreeNode[], center: CenterStats): TreeLayout {
  const cache = new Map<string, number>()
  const counts = new Map<number, number>()
  let maxDepth = 0

  const measure = (node: TreeNode, depth: number): void => {
    maxDepth = Math.max(maxDepth, depth)
    counts.set(depth, (counts.get(depth) ?? 0) + 1)
    for (const child of node.children) measure(child, depth + 1)
  }
  for (const node of nodes) measure(node, 1)

  const radii = new Map<number, number>()
  let previous = 0
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const count = counts.get(depth) ?? 0
    const size = ballSizeAt(depth)
    const around = (count * (size + 18)) / (Math.PI * 2)
    const radial = previous + (ballSizeAt(depth - 1) + size) / 2 + (depth === 1 ? 58 : 30)
    const radius = Math.max(around, radial, depth === 1 ? 208 : 0)
    radii.set(depth, radius)
    previous = radius
  }

  const balls: LayoutBall[] = []
  const links: LayoutLink[] = []

  const centerBall: LayoutBall = {
    id: '',
    name: '我',
    depth: 0,
    brightness: center.brightness,
    marks: center.marks,
    lit: false,
    size: ballSizeAt(0),
    x: 0,
    y: 0,
    isCenter: true,
    node: null,
  }
  balls.push(centerBall)

  const place = (parent: LayoutBall, children: TreeNode[], angle: number, span: number): void => {
    if (children.length === 0) return
    const depth = parent.depth + 1
    const radius = radii.get(depth) ?? 0
    const totalWeight = children.reduce((sum, child) => sum + weightOf(child, cache), 0)
    const gap = children.length > 1 ? Math.min(0.15, span * 0.045) : 0
    const usable = Math.max(span - gap * (children.length - 1), 0.0001)
    let cursor = angle - span / 2

    for (const child of children) {
      const childSpan = usable * (weightOf(child, cache) / totalWeight)
      const childAngle = cursor + childSpan / 2
      const x = Math.cos(childAngle) * radius
      const y = Math.sin(childAngle) * radius
      const ball: LayoutBall = {
        id: child.id,
        name: child.name,
        depth,
        brightness: child.brightness,
        marks: child.marks,
        lit: Boolean(child.litAt),
        size: ballSizeAt(depth),
        x,
        y,
        isCenter: false,
        node: child,
      }
      balls.push(ball)
      links.push({
        id: child.id,
        depth,
        x1: parent.x,
        y1: parent.y,
        x2: x,
        y2: y,
        brightness: child.brightness,
        onFocusPath: false,
      })
      place(ball, child.children, childAngle, childSpan)
      cursor += childSpan + gap
    }
  }

  const rootBall = centerBall
  place(rootBall, nodes, -Math.PI / 2, Math.PI * 2)

  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0
  for (const ball of balls) {
    minX = Math.min(minX, ball.x - ball.size / 2)
    maxX = Math.max(maxX, ball.x + ball.size / 2)
    minY = Math.min(minY, ball.y - ball.size / 2)
    maxY = Math.max(maxY, ball.y + ball.size / 2 + 34)
  }
  const pad = 16
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad

  const rings: LayoutRing[] = []
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    rings.push({ depth, radius: radii.get(depth) ?? 0 })
  }

  return {
    balls,
    links,
    rings,
    maxDepth,
    center: centerBall,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY,
    },
  }
}
