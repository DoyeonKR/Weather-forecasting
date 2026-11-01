// 화면의 글을 고른 말투로 — 컴포넌트마다 고치지 않고 글자 노드를 한곳에서 바꾼다.
// 앞으로 추가되는 문구에도 저절로 적용된다. 기본 말투면 아무것도 하지 않는다.
import { useEffect } from 'react'
import type { Persona } from '../../supabase/functions/_shared/persona.ts'
import { voice } from './voice'

/** 말투를 입히지 않는 곳: 기상청 특보 원문, 개인정보·출처 안내, 지도, 말투 고르기 칩 */
const SKIP = '.warn-banner, .foot, .leaflet-container, .persona-sec, script, style, textarea, input'

interface Seen {
  original: string
  shown: string
}

export function useVoice(persona: Persona): void {
  useEffect(() => {
    const seen = new WeakMap<Text, Seen>()
    const touched = new Set<Text>()

    const apply = (node: Text) => {
      const cur = node.nodeValue ?? ''
      let s = seen.get(node)
      // 우리가 쓴 값 그대로면 할 일이 없고, 다르면 React 가 새 글을 넣은 것이다
      if (s && cur === s.shown) return
      if (node.parentElement?.closest(SKIP)) return
      s = { original: cur, shown: voice(persona, cur) }
      seen.set(node, s)
      touched.add(node)
      if (s.shown !== cur) node.nodeValue = s.shown
    }
    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return apply(root as Text)
      if (root.nodeType !== Node.ELEMENT_NODE) return
      const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = it.nextNode(); n; n = it.nextNode()) apply(n as Text)
    }

    if (persona === 'default') return
    walk(document.body)
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') apply(m.target as Text)
        else m.addedNodes.forEach(walk)
      }
    })
    mo.observe(document.body, { subtree: true, childList: true, characterData: true })
    return () => {
      mo.disconnect()
      // 말투를 바꾸면 원문으로 되돌린 뒤 새 말투를 입힌다
      touched.forEach((node) => {
        const s = seen.get(node)
        if (s && node.nodeValue === s.shown) node.nodeValue = s.original
      })
    }
  }, [persona])
}
