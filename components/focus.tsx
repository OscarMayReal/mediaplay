"use client"

import { FocusNode as LrudFocusNode, FocusRoot } from "@please/lrud"
import React, { createContext, useContext, useEffect, useState } from "react"

const FocusReadyContext = createContext(false)

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  return (
    <FocusReadyContext.Provider value={ready}>
      {ready ? <FocusRoot pointerEvents>{children}</FocusRoot> : children}
    </FocusReadyContext.Provider>
  )
}

export function FocusNode(props: any) {
  const ready = useContext(FocusReadyContext)
  if (ready) return <LrudFocusNode {...props} />

  const {
    elementType: Element = "div",
    focusId,
    wrapping,
    wrapGridHorizontal,
    wrapGridVertical,
    orientation,
    isGrid,
    isTrap,
    forgetTrapFocusHierarchy,
    defaultFocusColumn,
    defaultFocusRow,
    disabled,
    onMountAssignFocusTo,
    defaultFocusChild,
    isExiting,
    propsFromNode,
    focusedClass,
    focusedLeafClass,
    disabledClass,
    activeClass,
    onKey,
    onArrow,
    onLeft,
    onRight,
    onUp,
    onDown,
    onSelected,
    onBack,
    onMove,
    onGridMove,
    onFocused,
    onBlurred,
    ...domProps
  } = props

  return <Element {...domProps} />
}
