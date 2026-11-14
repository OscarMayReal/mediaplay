"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"

export function ExpandableText({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isTruncated, setIsTruncated] = React.useState(false)
  const textRef = React.useRef<HTMLParagraphElement>(null)

  React.useEffect(() => {
    const element = textRef.current
    if (!element) return

    const updateTruncation = () => {
      if (!isExpanded) {
        setIsTruncated(element.scrollHeight > element.clientHeight)
      }
    }

    updateTruncation()

    const observer = new ResizeObserver(updateTruncation)
    observer.observe(element)
    return () => observer.disconnect()
  }, [isExpanded, text])

  return (
    <div className="space-y-1">
      <p ref={textRef} className={`text-sm ${isExpanded ? "" : "line-clamp-2"}`}>
        {text}
      </p>
      {isTruncated && (
        <Button
          variant="link"
          size="sm"
          className="p-0 h-auto"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "Show less" : "Read more"}
        </Button>
      )}
    </div>
  )
}
