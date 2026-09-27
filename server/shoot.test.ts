import { describe, expect, it } from 'vitest'
import { pathToFileURL } from 'node:url'
import { shotArgv } from './shoot.ts'

const argv = shotArgv({
  browser: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  url: 'file:///transom/inbox/z/page.html',
  outPath: '/tmp/shot.png',
  profileDir: '/tmp/transom-shot-abc',
  width: 1280,
  height: 800,
})

describe('shotArgv', () => {
  it('leads with the browser and ends with the page as a file URL', () => {
    expect(argv[0]).toMatch(/Google Chrome$/)
    expect(argv[argv.length - 1]).toBe('file:///transom/inbox/z/page.html')
  })

  it('asks for a headless shot at the given size', () => {
    expect(argv).toContain('--headless=new')
    expect(argv).toContain('--screenshot=/tmp/shot.png')
    expect(argv).toContain('--window-size=1280,800')
  })

  it('gives every shot its own profile, so two never fight over one lock', () => {
    expect(argv).toContain('--user-data-dir=/tmp/transom-shot-abc')
  })

  it('escapes a path that would otherwise break the file URL', () => {
    expect(pathToFileURL('/transom/inbox/my zone/a b.html').href).toBe(
      'file:///transom/inbox/my%20zone/a%20b.html',
    )
  })

  it('leaves the GPU off for a document, and draws GL in software when asked', () => {
    expect(argv).toContain('--disable-gpu')
    const gl = shotArgv({
      browser: '/c',
      url: 'http://localhost:8787/view/mesh',
      outPath: '/tmp/s.png',
      profileDir: '/tmp/p',
      width: 10,
      height: 10,
      webgl: true,
    })
    expect(gl).not.toContain('--disable-gpu')
    expect(gl).toContain('--use-angle=swiftshader')
  })

  it('shoots onto white unless asked for nothing', () => {
    expect(argv).not.toContain('--default-background-color=00000000')
    const clear = shotArgv({
      browser: '/c',
      url: 'http://localhost:8787/view/mesh',
      outPath: '/tmp/s.png',
      profileDir: '/tmp/p',
      width: 10,
      height: 10,
      transparent: true,
    })
    expect(clear).toContain('--default-background-color=00000000')
    expect(clear[clear.length - 1]).toBe('http://localhost:8787/view/mesh')
  })
})
