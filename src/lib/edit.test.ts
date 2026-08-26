import { describe, expect, it } from 'vitest'
import { clipsFromAsset } from './edit'
import type { MediaAsset } from '../types'

describe('clipsFromAsset', () => {
  it('places imported GIF renditions without an audio clip', () => {
    const asset: MediaAsset = {
      id: 'gif-1',
      name: 'reaction-gif.mp4',
      kind: 'video',
      mediaType: 'video',
      origin: 'gif',
      duration: 3,
      path: 'media/reaction-gif.mp4',
    }
    const clips = clipsFromAsset(asset, 0)
    expect(clips).toHaveLength(1)
    expect(clips[0].track).toBe('V1')
    expect(clips[0].kind).toBe('video')
    expect(clips[0].linkId).toBeUndefined()
  })

  it('keeps linked audio for ordinary video assets', () => {
    const asset: MediaAsset = {
      id: 'video-1',
      name: 'interview.mp4',
      kind: 'video',
      mediaType: 'video',
      duration: 3,
      path: 'media/interview.mp4',
    }
    expect(clipsFromAsset(asset, 0).map((clip) => clip.track)).toEqual(['V1', 'A1'])
  })

  it('does not invent an audio clip for a probed silent video', () => {
    const asset: MediaAsset = {
      id: 'silent-1',
      name: 'silent.mp4',
      kind: 'video',
      mediaType: 'video',
      duration: 3,
      hasAudio: false,
    }
    expect(clipsFromAsset(asset, 0).map((clip) => clip.track)).toEqual(['V1'])
  })
})
