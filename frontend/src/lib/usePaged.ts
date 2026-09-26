import { useState } from 'react'

/** Show a long list a page at a time; starts over when the list itself changes. */
export function usePaged<T>(items: T[] | undefined, pageSize = 30) {
  const [state, setState] = useState({ items, count: pageSize })
  if (state.items !== items) setState({ items, count: pageSize }) // new search: back to page 1
  const count = state.items === items ? state.count : pageSize
  return {
    visible: items?.slice(0, count) ?? [],
    hasMore: (items?.length ?? 0) > count,
    showMore: () => setState((s) => ({ ...s, count: s.count + pageSize })),
  }
}
