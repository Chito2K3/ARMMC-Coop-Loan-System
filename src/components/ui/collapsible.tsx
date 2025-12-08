"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

if (!CollapsiblePrimitive.Root || !CollapsiblePrimitive.Trigger || !CollapsiblePrimitive.Content) {
  throw new Error('Radix UI Collapsible primitives not found. Ensure @radix-ui/react-collapsible is properly installed.')
}

let Collapsible, CollapsibleTrigger, CollapsibleContent

try {
  Collapsible = CollapsiblePrimitive.Root
  CollapsibleTrigger = CollapsiblePrimitive.Trigger
  CollapsibleContent = CollapsiblePrimitive.Content
} catch (error) {
  throw new Error(`Failed to initialize Collapsible components: ${error instanceof Error ? error.message : 'Unknown error'}`)
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
