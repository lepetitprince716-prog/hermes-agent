import type { ComponentProps, ElementType, FC } from 'react'
import { memo } from 'react'
import { Streamdown } from 'streamdown'

import { cn } from '@/lib/utils'

// 照抄 desktop components/chat/compact-markdown.tsx 的 Streamdown 管线，
// token 换成移动端 styles.css 里的 --dt-* 映射（border/muted/foreground）。
// 流式消息用 mode="streaming" + parseIncompleteMarkdown 渲染半截 markdown。

const TAG_CLASSES = {
  blockquote: 'mt-2 mb-2 border-l-2 border-border pl-2.5 italic text-muted-foreground/85',
  h1: 'mt-3 mb-1.5 text-[15px] font-semibold tracking-tight text-foreground first:mt-0',
  h2: 'mt-3 mb-1.5 text-[14px] font-semibold tracking-tight text-foreground first:mt-0',
  h3: 'mt-2.5 mb-1 text-[13px] font-semibold text-foreground first:mt-0',
  h4: 'mt-2 mb-1 text-[13px] font-semibold text-foreground first:mt-0',
  hr: 'my-2 border-border',
  li: 'marker:text-muted-foreground/60',
  ol: 'mb-2 list-decimal pl-5 last:mb-0',
  p: 'mb-1.5 leading-relaxed last:mb-0',
  pre: 'mb-2 overflow-x-auto rounded-md border border-border bg-muted/50 p-2.5 font-mono text-[11px] leading-[1.55] last:mb-0',
  td: 'px-2 py-1 align-top leading-snug',
  th: 'px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80',
  thead: 'bg-muted/40',
  ul: 'mb-2 list-disc pl-5 last:mb-0',
} as const

function tagged<T extends keyof typeof TAG_CLASSES>(Tag: T) {
  const Component = (({ className, ...rest }: ComponentProps<T>) => {
    const Element = Tag as ElementType

    return <Element className={cn(TAG_CLASSES[Tag], className)} {...rest} />
  }) as FC<ComponentProps<T>>

  Component.displayName = `Md.${Tag}`

  return Component
}

function MarkdownAnchor({ children, className, href, ...rest }: ComponentProps<'a'>) {
  return (
    <a
      className={cn('font-medium text-primary underline underline-offset-2', className)}
      href={href}
      rel="noreferrer"
      target="_blank"
      {...rest}
    >
      {children}
    </a>
  )
}

function MarkdownCode({ className, ...rest }: ComponentProps<'code'>) {
  return (
    <code
      className={cn('rounded bg-muted px-1 py-px font-mono text-[0.85em]', className)}
      {...rest}
    />
  )
}

function MarkdownTable({ className, ...rest }: ComponentProps<'table'>) {
  return (
    <div className="mb-2 max-w-full overflow-x-auto rounded-md border border-border last:mb-0">
      <table
        className={cn(
          'w-full border-collapse text-[11px] [&_tr]:border-b [&_tr]:border-border last:[&_tr]:border-0',
          className,
        )}
        {...rest}
      />
    </div>
  )
}

const COMPONENTS = {
  a: MarkdownAnchor,
  blockquote: tagged('blockquote'),
  code: MarkdownCode,
  h1: tagged('h1'),
  h2: tagged('h2'),
  h3: tagged('h3'),
  h4: tagged('h4'),
  hr: tagged('hr'),
  li: tagged('li'),
  ol: tagged('ol'),
  p: tagged('p'),
  pre: tagged('pre'),
  table: MarkdownTable,
  td: tagged('td'),
  th: tagged('th'),
  thead: tagged('thead'),
  ul: tagged('ul'),
}

export const Markdown = memo(function Markdown({
  className,
  text,
  streaming = false,
}: {
  className?: string
  text: string
  streaming?: boolean
}) {
  return (
    <div className={cn('max-w-full text-[13px] leading-relaxed wrap-anywhere', className)}>
      <Streamdown
        components={COMPONENTS}
        controls={false}
        mode={streaming ? 'streaming' : 'static'}
        parseIncompleteMarkdown={streaming}
      >
        {text}
      </Streamdown>
    </div>
  )
})
