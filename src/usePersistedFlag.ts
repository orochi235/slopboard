import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/** Storage throws rather than returning null in a private window, so the wall
 *  opens with a default rather than not at all. */
export function usePersistedFlag(
  key: string,
  initial: boolean,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [on, setOn] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : raw === '1'
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, on ? '1' : '0')
    } catch {
      // A refused store costs the panel's memory, not the panel.
    }
  }, [key, on])
  return [on, setOn]
}
